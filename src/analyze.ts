import { LicenseDb, licenseLabel, stripStyleSuffixes } from "./license";
import { RISK_LABEL } from "./risk";
import { suggestAlternatives } from "./suggest";
import type {
  FontLicenseRecord,
  FontOccurrence,
  FontRef,
  FontSummary,
  ReportData,
  RiskLevel,
} from "./types";

function severityOf(r: RiskLevel): number {
  return r === "restricted" ? 2 : r === "attribution" || r === "unknown" ? 1 : 0;
}

export function resolveRecord(db: LicenseDb, raw: string): FontLicenseRecord | null {
  const direct = db.identify(raw);
  if (direct) return direct;
  for (const cand of stripStyleSuffixes(raw)) {
    const rec = db.identify(cand);
    if (rec) return rec;
  }
  return null;
}

export function buildReportData(
  root: string,
  db: LicenseDb,
  refs: FontRef[],
  filesScanned: number,
  durationMs: number,
): ReportData {
  const map = new Map<string, FontSummary>();

  for (const ref of refs) {
    const record = resolveRecord(db, ref.raw);
    let key: string;
    if (record) {
      key = record.name;
    } else {
      key = stripStyleSuffixes(ref.raw)[0] || ref.raw;
    }

    let sum = map.get(key);
    if (!sum) {
      const risk: RiskLevel = record?.risk ?? "unknown";
      sum = {
        font: record ? record.name : ref.raw,
        matched: !!record,
        record,
        risk,
        category: record ? record.category : "unknown",
        licenseLabel: record ? licenseLabel(record.license) : "未知",
        riskLabel: RISK_LABEL[risk],
        alternatives: suggestAlternatives(record, ref.raw),
        note: record?.note ?? "许可库中未收录，请人工核验。",
        source: record?.source ?? "",
        count: 0,
        occurrences: [],
      };
      map.set(key, sum);
    }
    sum.count += 1;
    const occ: FontOccurrence = { file: ref.file, line: ref.line };
    const last = sum.occurrences[sum.occurrences.length - 1];
    if (!last || last.file !== occ.file || last.line !== occ.line) {
      sum.occurrences.push(occ);
    }
  }

  const fonts = [...map.values()].sort((a, b) => {
    const r = severityOf(b.risk) - severityOf(a.risk);
    if (r !== 0) return r;
    return a.font.localeCompare(b.font, "zh-CN");
  });

  const summary = {
    total: refs.length,
    distinctFonts: fonts.length,
    ok: fonts.filter((f) => f.risk === "ok").length,
    attribution: fonts.filter((f) => f.risk === "attribution").length,
    restricted: fonts.filter((f) => f.risk === "restricted").length,
    unknown: fonts.filter((f) => f.risk === "unknown").length,
    highRisk: fonts.filter((f) => f.risk === "restricted").length,
  };

  return {
    root,
    scannedAt: new Date().toISOString(),
    durationMs,
    filesScanned,
    findings: refs,
    fonts,
    summary,
  };
}
