import type { RiskLevel } from "./types";

export const RISK_ORDER: RiskLevel[] = ["restricted", "attribution", "unknown", "ok"];

export const RISK_SEVERITY: Record<RiskLevel, number> = {
  restricted: 2,
  attribution: 1,
  unknown: 1,
  ok: 0,
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  restricted: "禁止/受限商用",
  attribution: "可商用需归属",
  unknown: "未知需自查",
  ok: "可商用",
};

export const RISK_COLOR: Record<RiskLevel, string> = {
  restricted: "red",
  attribution: "yellow",
  unknown: "yellow",
  ok: "green",
};

export function worstRisk(levels: RiskLevel[]): RiskLevel {
  let worst: RiskLevel = "ok";
  for (const l of levels) {
    if (RISK_ORDER.indexOf(l) < RISK_ORDER.indexOf(worst)) worst = l;
  }
  return worst;
}

export function isHighRisk(level: RiskLevel): boolean {
  return level === "restricted";
}

export function riskToExitCode(
  summary: { restricted: number; attribution: number; unknown: number },
  failOn: RiskLevel | "none",
): number {
  if (failOn === "none") return 0;
  switch (failOn) {
    case "restricted":
      return summary.restricted > 0 ? 1 : 0;
    case "attribution":
      return summary.restricted + summary.attribution > 0 ? 1 : 0;
    case "unknown":
      return summary.restricted + summary.attribution + summary.unknown > 0 ? 1 : 0;
    default:
      return 0;
  }
}
