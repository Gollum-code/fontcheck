import * as fs from "node:fs";
import * as path from "node:path";
import type { FontLicenseRecord, LicenseCategory, RiskLevel } from "./types";

const DEFAULT_DB = path.join(__dirname, "..", "licenses", "fonts.json");

interface RawFontRecord {
  name: string;
  aliases: string[];
  license: string;
  category: LicenseCategory;
  risk: RiskLevel;
  note: string;
  source: string;
  alternatives: string[];
}

interface RawDatabase {
  version: number;
  updatedAt: string;
  fonts: RawFontRecord[];
}

export class LicenseDb {
  private records: FontLicenseRecord[];
  private index = new Map<string, FontLicenseRecord>();

  constructor(dbPath?: string) {
    const resolved = dbPath ?? DEFAULT_DB;
    const raw = JSON.parse(
      fs.readFileSync(resolved, "utf-8"),
    ) as RawDatabase;

    this.records = raw.fonts.map((f) => ({
      name: f.name,
      aliases: f.aliases ?? [],
      license: f.license,
      category: f.category,
      risk: f.risk,
      note: f.note ?? "",
      source: f.source ?? "",
      alternatives: f.alternatives ?? [],
    }));

    for (const rec of this.records) {
      const tokens = [rec.name, ...rec.aliases]
        .map(normalizeToken)
        .filter(Boolean);
      for (const t of new Set(tokens)) {
        const prev = this.index.get(t);
        if (!prev || rec.name.length >= prev.name.length) {
          this.index.set(t, rec);
        }
      }
    }
  }

  get size(): number {
    return this.records.length;
  }

  all(): FontLicenseRecord[] {
    return [...this.records];
  }

  identify(rawName: string): FontLicenseRecord | null {
    const token = normalizeToken(rawName);
    if (!token) return null;
    return this.index.get(token) ?? null;
  }

  allTokens(): string[] {
    const tokens: string[] = [];
    for (const rec of this.records) {
      tokens.push(rec.name, ...rec.aliases);
    }
    return tokens;
  }
}

const STYLE_SUFFIXES = [
  "blackitalic", "bolditalic", "extrabolditalic", "semibolditalic", "lightitalic",
  "thinitalic", "regularitalic", "mediumitalic", "black", "extrabold", "semibold",
  "semi bold", "bold", "medium", "regular", "light", "thin", "italic", "oblique",
  "roman", "condensed", "narrow", "compressed", "hairline", "ultralight", "book",
];

export function stripStyleSuffixes(rawName: string): string[] {
  const base = normalizeToken(rawName);
  if (!base) return [];
  const candidates = [base];
  for (const s of STYLE_SUFFIXES) {
    if (base.length > s.length && base.endsWith(s)) {
      candidates.push(base.slice(0, base.length - s.length));
    }
  }
  return candidates;
}

export function normalizeToken(name: string): string {
  return name
    .toLowerCase()
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")
    .replace(/[+\-\s_]+/g, "")
    .trim();
}

export function riskLabel(risk: RiskLevel): string {
  switch (risk) {
    case "ok":
      return "可商用";
    case "attribution":
      return "可商用需归属";
    case "restricted":
      return "禁止/受限商用";
    case "unknown":
      return "未知需自查";
  }
}

export function categoryLabel(category: LicenseCategory | "unknown"): string {
  switch (category) {
    case "open":
      return "开源";
    case "free":
      return "免费商用";
    case "commercial":
      return "商业";
    case "system":
      return "系统内置";
    default:
      return "未知";
  }
}

export function licenseLabel(code: string): string {
  const map: Record<string, string> = {
    OFL: "SIL Open Font License 1.1",
    Apache2: "Apache License 2.0",
    MIT: "MIT License",
    free: "免费商用授权",
    proprietary: "商业专有授权",
    system: "系统内置字体",
  };
  return map[code] ?? (code || "未知");
}
