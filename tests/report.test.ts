import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { LicenseDb } from "../src/license";
import { scan } from "../src/scanner";
import { buildReportData } from "../src/analyze";
import { formatText, formatJson, formatHtml } from "../src/report";

const ROOT = path.join(__dirname, "fixtures", "sample-web");
const db = new LicenseDb();

function data() {
  const out = scan(ROOT, db.allTokens());
  return buildReportData(ROOT, db, out.refs, out.filesScanned, out.durationMs);
}

describe("analyze + report", () => {
  test("aggregates distinct fonts and counts", () => {
    const d = data();
    assert.ok(d.fonts.length >= 12, "应聚合出多个不同字体");
    assert.ok(d.summary.distinctFonts === d.fonts.length);
    assert.ok(d.summary.total >= d.fonts.length);
    assert.ok(d.summary.restricted >= 2, "应识别出至少 2 个受限字体");
  });

  test("restricted fonts carry alternatives", () => {
    const d = data();
    const yahei = d.fonts.find((f) => f.font === "Microsoft YaHei");
    assert.ok(yahei);
    assert.ok(yahei!.alternatives.length > 0, "受限字体应给出开源替代");
    assert.ok(yahei!.alternatives.includes("Noto Sans SC"));
  });

  test("font file resolves through suffix stripping", () => {
    const d = data();
    const inter = d.fonts.find((f) => f.font === "Inter");
    assert.ok(inter, "Montserrat-SemiBold / Inter-Regular 应归并到 Inter");
    const mont = d.fonts.find((f) => f.font === "Montserrat");
    assert.ok(mont, "Montserrat-SemiBold 应归并到 Montserrat");
  });

  test("msyh.ttf resolves to Microsoft YaHei via alias", () => {
    const d = data();
    const yahei = d.fonts.find((f) => f.font === "Microsoft YaHei");
    assert.ok(yahei);
    assert.ok(yahei!.occurrences.some((o) => o.file.endsWith("MSYH.ttf")));
  });

  test("unknown font file surfaces as unknown risk", () => {
    const d = data();
    const unknown = d.fonts.find((f) => f.font === "BrandNew-Pro");
    assert.ok(unknown, "未收录的字体文件应进入未知");
    assert.equal(unknown!.risk, "unknown");
  });

  test("text report contains summary and suggestions", () => {
    const text = formatText(data(), false);
    assert.match(text, /禁止\/受限商用/);
    assert.match(text, /建议替代/);
    assert.match(text, /Noto Sans SC/);
  });

  test("json report is parseable and complete", () => {
    const d = data();
    const parsed = JSON.parse(formatJson(d));
    assert.ok(parsed.fonts.length >= 1);
    assert.ok("summary" in parsed);
    assert.ok("findings" in parsed);
  });

  test("html report renders table rows", () => {
    const html = formatHtml(data());
    assert.match(html, /<table>/);
    assert.match(html, /禁止\/受限商用/);
    assert.match(html, /fontcheck/);
  });
});
