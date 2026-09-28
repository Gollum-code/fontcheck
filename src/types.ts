export type RiskLevel = "ok" | "attribution" | "restricted" | "unknown";

export type LicenseCategory = "open" | "free" | "commercial" | "system";

export interface FontLicenseRecord {
  name: string;
  aliases: string[];
  license: string;
  category: LicenseCategory;
  risk: RiskLevel;
  note: string;
  source: string;
  alternatives: string[];
}

export interface FontRef {
  font: string;
  raw: string;
  file: string;
  line: number;
  context: string;
}

export interface FontOccurrence {
  file: string;
  line: number;
}

export interface FontSummary {
  font: string;
  matched: boolean;
  record: FontLicenseRecord | null;
  risk: RiskLevel;
  category: LicenseCategory | "unknown";
  licenseLabel: string;
  riskLabel: string;
  alternatives: string[];
  note: string;
  source: string;
  count: number;
  occurrences: FontOccurrence[];
}

export interface ReportData {
  root: string;
  scannedAt: string;
  durationMs: number;
  filesScanned: number;
  findings: FontRef[];
  fonts: FontSummary[];
  summary: {
    total: number;
    distinctFonts: number;
    ok: number;
    attribution: number;
    restricted: number;
    unknown: number;
    highRisk: number;
  };
}

export interface ScanOptions {
  root: string;
  include?: string[];
  excludeDirs?: string[];
  maxFileSize?: number;
}

export interface CliOptions {
  target: string;
  format: "text" | "json" | "html";
  reportPath?: string;
  failOn: RiskLevel | "none";
  quiet: boolean;
  color: boolean;
  include?: string[];
  ignoreDirs?: string[];
  dbPath?: string;
}
