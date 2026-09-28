import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { LicenseDb } from "../src/license";
import { scan } from "../src/scanner";

const ROOT = path.join(__dirname, "fixtures", "sample-web");
const db = new LicenseDb();

function refs() {
  return scan(ROOT, db.allTokens()).refs;
}

function has(raw: string): boolean {
  return refs().some((r) => r.raw === raw || r.font === raw);
}

function rawSet(): Set<string> {
  return new Set(refs().map((r) => r.raw));
}

describe("scanner", () => {
  test("detects font-family references in css/html", () => {
    const set = rawSet();
    for (const name of ["Microsoft YaHei", "PingFang SC", "Roboto", "Inter"]) {
      assert.ok(set.has(name), `应识别 ${name}`);
    }
    // Google Fonts URL 用 + 连接字体名
    assert.ok(set.has("Open+Sans"), "应识别 Google Fonts URL 中的 Open Sans");
  });

  test("detects CJK commercial font names", () => {
    const set = rawSet();
    for (const name of ["方正兰亭黑", "微软雅黑"]) {
      assert.ok(set.has(name), `应识别 ${name}`);
    }
  });

  test("detects font files on disk and in url()", () => {
    const set = rawSet();
    assert.ok(set.has("Inter-Regular"), "应识别本地字体文件 Inter-Regular");
    assert.ok(set.has("Montserrat-SemiBold"), "应识别本地字体文件 Montserrat-SemiBold");
    assert.ok(set.has("MSYH"), "应识别本地字体文件 MSYH");
  });

  test("skips generic/system stack keywords (whitelist)", () => {
    const set = rawSet();
    for (const name of ["-apple-system", "sans-serif", "Segoe UI Emoji", "BlinkMacSystemFont"]) {
      assert.ok(!set.has(name), `不应报告通用关键字 ${name}`);
    }
  });

  test("records file and line info", () => {
    const r = refs().find((x) => x.raw === "Microsoft YaHei");
    assert.ok(r);
    assert.equal(r!.file, "index.html");
    assert.ok(r!.line >= 1);
    assert.ok(r!.context.length > 0);
  });

  test("detects spaced font names in prose/docs", () => {
    const docRoot = path.join(__dirname, "fixtures", "doc-report");
    const out = scan(docRoot, db.allTokens());
    const set = new Set(out.refs.map((r) => r.raw));
    for (const name of ["Noto Sans SC", "Smiley Sans", "Inter"]) {
      assert.ok(set.has(name), `文档正文应识别 ${name}`);
    }
    for (const name of ["汉仪旗黑", "微软雅黑"]) {
      assert.ok(set.has(name), `文档正文应识别 ${name}`);
    }
  });

  test("scan honors excludeDirs", () => {
    const out = scan(ROOT, db.allTokens(), { excludeDirs: ["fonts"] });
    assert.ok(!out.refs.some((r) => r.file.includes("fonts\\") || r.file.includes("fonts/")));
  });

  test("scan honors include ext filter", () => {
    const out = scan(ROOT, db.allTokens(), { include: ["css"] });
    assert.ok(out.refs.every((r) => r.file.endsWith(".css")));
  });
});
