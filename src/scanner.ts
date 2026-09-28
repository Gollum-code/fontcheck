import * as fs from "node:fs";
import * as path from "node:path";
import type { FontRef, ScanOptions } from "./types";
import { normalizeToken } from "./license";

const FONT_FILE_EXT = new Set([".ttf", ".otf", ".woff", ".woff2", ".eot"]);

const TEXT_EXT = new Set([
  "css", "scss", "less", "sass", "styl", "html", "htm", "xhtml",
  "js", "jsx", "mjs", "ts", "tsx", "vue", "svelte", "json", "md", "markdown",
  "mdx", "txt", "yaml", "yml", "xml", "svg", "php", "py", "rb", "java", "go",
  "rs", "cpp", "c", "h", "cs", "swift", "kt", "kts", "sh", "bash", "ps1", "bat",
  "cmd", "conf", "ini", "cfg", "toml", "env", "gradle", "properties", "gitignore",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".hg", ".svn", "dist", "build", "out", ".next",
  ".nuxt", "coverage", ".venv", "venv", "target", "__pycache__", ".cache",
  ".idea", ".vscode",
]);

const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024;

const FONT_FAMILY_RE = /font-family\s*:\s*([^;{}]+)/gi;
const URL_FONT_FILE_RE = /url\(\s*['"]?([^)'"]+\.(?:ttf|otf|woff2?|eot))\s*['"]?\s*\)/gi;
const EXT_FONT_FILE_RE = /([A-Za-z0-9._-]+\.(?:ttf|otf|woff2?|eot))\b/gi;

// 系统/通用字体栈关键字：非真实字体，忽略以免误报
const GENERIC_FONT_TOKENS = new Set(
  [
    "-apple-system", "BlinkMacSystemFont", "system-ui", "ui-sans-serif", "ui-serif",
    "ui-monospace", "ui-rounded", "sans-serif", "serif", "monospace", "cursive",
    "fantasy", "math", "emoji", "initial", "inherit", "unset", "revert", "none",
    "apple color emoji", "segoe ui emoji", "segoe ui symbol", "noto color emoji",
    "symbol", "dingbats", "wingdings", "webdings", "helvetica neue",
  ].map((t) => normalizeToken(t).toLowerCase()),
);

function isGenericFont(name: string): boolean {
  const n = normalizeToken(name).toLowerCase();
  if (n.length === 0) return true;
  if (GENERIC_FONT_TOKENS.has(n)) return true;
  if (n.endsWith("emoji") || n.endsWith("symbol") || n.endsWith("dingbats")) return true;
  return false;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTokenRegex(tokens: string[]): RegExp {
  const variants = new Set<string>();
  for (const raw of tokens) {
    const trimmed = raw.trim().replace(/^["']|["']$/g, "");
    if (!trimmed) continue;
    // 原始写法：CSS font-family / 文档正文中的带空格字体名
    variants.add(trimmed);
    // 归一化写法：字体文件命名（无空格/连字符）
    variants.add(normalizeToken(trimmed));
    // Google Fonts URL 写法：空格 -> +
    const plus = trimmed.toLowerCase().replace(/[_-]+/g, "").replace(/\s+/g, "+");
    if (plus.includes("+")) variants.add(plus);
  }
  const list = [...variants]
    .map((v) => v.toLowerCase())
    .sort((a, b) => b.length - a.length);
  if (list.length === 0) return /(?!){0}/;
  return new RegExp(`(${list.map(escapeRe).join("|")})`, "gi");
}

function splitFontFamilyList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim().replace(/^['"]|['"]$/g, ""))
    .filter((v) => v.length > 0 && !v.startsWith("var("));
}

function basenameNoExt(p: string): string {
  const base = path.basename(p);
  const ext = path.extname(base);
  return ext ? base.slice(0, -ext.length) : base;
}

function isTextExt(ext: string): boolean {
  return TEXT_EXT.has(ext.toLowerCase().replace(/^\./, ""));
}

function isFontFileExt(ext: string): boolean {
  return FONT_FILE_EXT.has(ext.toLowerCase());
}

export interface ScanOutcome {
  refs: FontRef[];
  filesScanned: number;
  filesSkipped: number;
  durationMs: number;
}

export function scan(root: string, fontTokens: string[], opts?: ScanOptions): ScanOutcome {
  const started = Date.now();
  const maxSize = opts?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const skipDirs = new Set<string>([
    ...SKIP_DIRS,
    ...(opts?.excludeDirs ?? []).map((d) => d.toLowerCase()),
  ]);
  const include = opts?.include ?? [];
  const includeSet = include.length > 0 ? new Set(include.map((e) => e.toLowerCase())) : null;

  const refs: FontRef[] = [];
  let filesScanned = 0;
  let filesSkipped = 0;

  const tokenRegex = buildTokenRegex(fontTokens);

  function pushRef(file: string, raw: string, line: number, context: string): void {
    if (isGenericFont(raw)) return;
    refs.push({
      font: raw,
      raw,
      file,
      line,
      context: context.slice(0, 200),
    });
  }

  function scanTextFile(file: string, abs: string): void {
    let content: string;
    try {
      content = fs.readFileSync(abs, "utf-8");
    } catch {
      filesSkipped += 1;
      return;
    }
    if (content.length > maxSize) {
      filesSkipped += 1;
      return;
    }
    filesScanned += 1;
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const rel = path.relative(root, file);

      for (const m of line.matchAll(FONT_FAMILY_RE)) {
        const value = m[1];
        for (const name of splitFontFamilyList(value)) {
          if (name.toLowerCase().startsWith("sans-serif") || name.toLowerCase().startsWith("serif") || name.toLowerCase().startsWith("monospace")) {
            continue;
          }
          pushRef(rel, name, i + 1, line.trim());
        }
      }

      for (const m of line.matchAll(URL_FONT_FILE_RE)) {
        pushRef(rel, basenameNoExt(m[1]), i + 1, line.trim());
      }

      for (const m of line.matchAll(EXT_FONT_FILE_RE)) {
        pushRef(rel, basenameNoExt(m[1]), i + 1, line.trim());
      }

      for (const m of line.matchAll(tokenRegex)) {
        pushRef(rel, m[0], i + 1, line.trim());
      }
    }
  }

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      filesSkipped += 1;
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const ent of entries) {
      if (ent.name.startsWith(".") && ent.name !== ".gitignore") continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (skipDirs.has(ent.name.toLowerCase())) {
          filesSkipped += 1;
          continue;
        }
        walk(abs);
        continue;
      }
      if (!ent.isFile()) {
        filesSkipped += 1;
        continue;
      }
      const ext = path.extname(ent.name).toLowerCase();
      if (includeSet && !includeSet.has(ext.slice(1))) continue;
      if (isFontFileExt(ext)) {
        pushRef(path.relative(root, abs), basenameNoExt(ent.name), 0, "(字体文件)");
        filesScanned += 1;
        continue;
      }
      if (isTextExt(ext)) {
        scanTextFile(abs, abs);
      } else {
        filesSkipped += 1;
      }
    }
  }

  const stat = fs.statSync(root, { throwIfNoEntry: false });
  if (!stat) throw new Error(`路径不存在：${root}`);
  if (stat.isFile()) {
    const ext = path.extname(root).toLowerCase();
    if (isFontFileExt(ext)) {
      pushRef(path.basename(root), basenameNoExt(root), 0, "(字体文件)");
      filesScanned += 1;
    } else if (isTextExt(ext)) {
      scanTextFile(root, root);
    }
  } else {
    walk(root);
  }

  const seen = new Set<string>();
  const deduped: FontRef[] = [];
  for (const r of refs) {
    const key = `${r.file}|${r.line}|${r.font}|${r.raw}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  return {
    refs: deduped,
    filesScanned,
    filesSkipped,
    durationMs: Date.now() - started,
  };
}
