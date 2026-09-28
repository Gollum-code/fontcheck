import type { ReportData, RiskLevel, FontSummary } from "./types";
import { RISK_LABEL, RISK_COLOR } from "./risk";
import { categoryLabel } from "./license";

type Color = "reset" | "red" | "green" | "yellow" | "bold" | "dim" | "cyan";

const ANSI: Record<Color, string> = {
  reset: "\u001b[0m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
};

function paint(color: Color, text: string, enabled: boolean): string {
  return enabled ? `${ANSI[color]}${text}${ANSI.reset}` : text;
}

function riskPip(risk: RiskLevel): Color {
  switch (risk) {
    case "restricted":
      return "red";
    case "attribution":
    case "unknown":
      return "yellow";
    default:
      return "green";
  }
}

function groupFonts(data: ReportData): Map<RiskLevel, FontSummary[]> {
  const order: RiskLevel[] = ["restricted", "attribution", "unknown", "ok"];
  const map = new Map<RiskLevel, FontSummary[]>();
  for (const r of order) map.set(r, []);
  for (const f of data.fonts) {
    map.get(f.risk)?.push(f);
  }
  return map;
}

export function formatText(data: ReportData, colored: boolean): string {
  const out: string[] = [];
  const s = data.summary;
  const groups = groupFonts(data);

  out.push(paint("bold", "========== fontcheck 字体许可检查 ==========", colored));
  out.push(`扫描目录 : ${data.root}`);
  out.push(
    `扫描文件 : ${data.filesScanned}   用时: ${data.durationMs}ms   引用: ${s.total} 处 / ${s.distinctFonts} 个字体`,
  );
  out.push("");
  out.push(
    `${paint("red", `高风险 ${s.restricted}`, colored)} | ${paint("yellow", `需归属 ${s.attribution}`, colored)} | ${paint("yellow", `未知 ${s.unknown}`, colored)} | ${paint("green", `可商用 ${s.ok}`, colored)}`,
  );

  const buckets: Array<[RiskLevel, string]> = [
    ["restricted", "禁止/受限商用"],
    ["attribution", "可商用需归属"],
    ["unknown", "未知需自查"],
    ["ok", "可商用"],
  ];

  for (const [risk, title] of buckets) {
    const list = groups.get(risk) ?? [];
    if (list.length === 0) continue;
    out.push("");
    out.push(
      paint("bold", `[${title}] (${list.length})`, colored),
    );
    for (const f of list) {
      out.push(paint(riskPip(risk), `  ${f.font}`, colored) + paint("dim", `  引用 ${f.count} 处`, colored));
      out.push(`    许可: ${f.licenseLabel}`);
      if (f.note) out.push(`    说明: ${f.note}`);
      if (f.source) out.push(`    来源: ${f.source}`);
      if (f.alternatives.length > 0) {
        out.push(paint("cyan", `    建议替代: ${f.alternatives.join(" / ")}`, colored));
      }
      const occ = f.occurrences.slice(0, 5);
      const shown = occ.map((o) => `${o.file}:${o.line}`).join(", ");
      const tail = f.count > occ.length ? ` ...等 ${f.count} 处` : "";
      out.push(`    出现: ${shown}${tail}`);
    }
  }

  out.push("");
  if (s.restricted > 0) {
    out.push(
      paint("red", `✗ 发现 ${s.restricted} 个禁止/受限字体，不满足商用合规要求。`, colored),
    );
  } else if (s.unknown > 0 || s.attribution > 0) {
    out.push(
      paint("yellow", `△ 存在未知/需归属字体，请人工核验许可后再发布。`, colored),
    );
  } else {
    out.push(paint("green", "✓ 未发现高风险字体。", colored));
  }

  return out.join("\n");
}

export function formatJson(data: ReportData): string {
  return JSON.stringify(data, null, 2);
}

export function formatHtml(data: ReportData): string {
  const s = data.summary;
  const rows = data.fonts
    .map((f) => {
      const risk = f.risk;
      const color = RISK_COLOR[risk];
      const occ = f.occurrences
        .slice(0, 8)
        .map((o) => `${escapeHtml(o.file)}:${o.line}`)
        .join("<br>");
      const alts =
        f.alternatives.length > 0
          ? f.alternatives.map(escapeHtml).join(" / ")
          : '<span class="muted">无需替换</span>';
      const src = f.source
        ? `<a href="${escapeHtml(f.source)}" target="_blank" rel="noopener">${escapeHtml(f.source)}</a>`
        : '<span class="muted">—</span>';
      return `<tr class="risk-${risk}">
        <td class="font-name">${escapeHtml(f.font)}</td>
        <td><span class="badge risk-${risk}">${escapeHtml(f.riskLabel)}</span></td>
        <td>${escapeHtml(categoryLabel(f.category))}</td>
        <td>${escapeHtml(f.licenseLabel)}</td>
        <td>${alts}</td>
        <td class="occ">${occ}</td>
        <td>${src}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>fontcheck 字体许可检查报告</title>
<style>
  :root { --red:#e5484d; --yellow:#f5a524; --green:#30a46c; --muted:#8b93a7; --border:#e3e6ee; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 0; background: #f6f7fb; color: #1f2330; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 20px; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; margin: 18px 0 24px; }
  .card { background:#fff; border:1px solid var(--border); border-radius:10px; padding:14px 18px; min-width:130px; }
  .card .n { font-size:26px; font-weight:700; }
  .card .l { font-size:12px; color:var(--muted); }
  .card.red .n { color: var(--red); }
  .card.yellow .n { color: var(--yellow); }
  .card.green .n { color: var(--green); }
  table { width:100%; border-collapse: collapse; background:#fff; border:1px solid var(--border); border-radius:10px; overflow:hidden; }
  th, td { text-align:left; padding:10px 12px; font-size:13px; border-bottom:1px solid var(--border); vertical-align:top; }
  th { background:#fafbfd; color:#5b6472; font-weight:600; }
  tr:last-child td { border-bottom:none; }
  .font-name { font-weight:600; white-space:nowrap; }
  .occ { color:#5b6472; font-size:12px; max-width:240px; }
  .muted { color: var(--muted); }
  .badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:12px; white-space:nowrap; }
  .risk-restricted { color:#fff; background: var(--red); }
  .risk-attribution, .risk-unknown { color:#7a4d00; background: var(--yellow); }
  .risk-ok { color:#fff; background: var(--green); }
  tr.risk-restricted td:first-child { box-shadow: inset 3px 0 0 var(--red); }
  tr.risk-attribution td:first-child, tr.risk-unknown td:first-child { box-shadow: inset 3px 0 0 var(--yellow); }
  .foot { margin-top:20px; color:var(--muted); font-size:12px; }
  a { color:#2563eb; text-decoration:none; }
</style>
</head>
<body>
<div class="wrap">
  <h1>fontcheck 字体许可检查报告</h1>
  <div class="sub">目录：${escapeHtml(data.root)} · 扫描时间：${escapeHtml(data.scannedAt)} · 文件 ${data.filesScanned} · 引用 ${s.total} 处 / ${s.distinctFonts} 个字体</div>
  <div class="cards">
    <div class="card red"><div class="n">${s.restricted}</div><div class="l">禁止/受限商用</div></div>
    <div class="card yellow"><div class="n">${s.attribution}</div><div class="l">可商用需归属</div></div>
    <div class="card yellow"><div class="n">${s.unknown}</div><div class="l">未知需自查</div></div>
    <div class="card green"><div class="n">${s.ok}</div><div class="l">可商用</div></div>
  </div>
  <table>
    <thead>
      <tr><th>字体</th><th>商用风险</th><th>类型</th><th>许可</th><th>开源替代建议</th><th>出现位置</th><th>来源标注</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <div class="foot">本报告由 fontcheck 自动生成，许可数据仅供参考，正式商用前请以字体版权方官网许可为准。</div>
</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function writeReport(data: ReportData, format: "text" | "json" | "html", color: boolean): string {
  if (format === "json") return formatJson(data);
  if (format === "html") return formatHtml(data);
  return formatText(data, color);
}