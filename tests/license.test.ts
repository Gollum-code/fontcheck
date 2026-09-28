import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { LicenseDb, normalizeToken, stripStyleSuffixes, riskLabel, categoryLabel, licenseLabel } from "../src/license";

const db = new LicenseDb();

describe("license", () => {
  test("loads database with entries", () => {
    assert.ok(db.size > 50, "许可库应收录足量字体");
  });

  test("identify by canonical name", () => {
    const rec = db.identify("Microsoft YaHei");
    assert.ok(rec);
    assert.equal(rec!.name, "Microsoft YaHei");
    assert.equal(rec!.risk, "restricted");
  });

  test("identify by Chinese alias", () => {
    assert.equal(db.identify("微软雅黑")!.name, "Microsoft YaHei");
    assert.equal(db.identify("苹方")!.name, "PingFang SC");
    assert.equal(db.identify("汉仪旗黑")!.name, "HY QiHei");
    assert.equal(db.identify("方正黑体")!.name, "FZ LanTingHei");
  });

  test("identify open-source fonts as ok", () => {
    assert.equal(db.identify("思源黑体")!.name, "Source Han Sans");
    assert.equal(db.identify("思源黑体")!.risk, "ok");
    assert.equal(db.identify("Noto Sans SC")!.risk, "ok");
    assert.equal(db.identify("Inter")!.risk, "ok");
    assert.equal(db.identify("Roboto")!.risk, "ok");
  });

  test("identify returns null for unknown", () => {
    assert.equal(db.identify("SomeRandomFontXYZ"), null);
  });

  test("normalizeToken strips quotes/spaces/case", () => {
    assert.equal(normalizeToken("  'Arial' "), "arial");
    assert.equal(normalizeToken("Noto Sans SC"), "notosanssc");
    assert.equal(normalizeToken('"Microsoft YaHei"'), "microsoftyahei");
  });

  test("stripStyleSuffixes removes weight/style suffixes", () => {
    assert.ok(stripStyleSuffixes("Montserrat-SemiBold").includes("montserrat"));
    assert.ok(stripStyleSuffixes("Inter-Regular").includes("inter"));
    assert.ok(stripStyleSuffixes("NotoSansSC-Regular").includes("notosanssc"));
    // 不应在过短的 token 上误剥离
    assert.equal(stripStyleSuffixes("Bold")[0], "bold");
  });

  test("labels", () => {
    assert.equal(riskLabel("restricted"), "禁止/受限商用");
    assert.equal(riskLabel("ok"), "可商用");
    assert.equal(categoryLabel("open"), "开源");
    assert.equal(categoryLabel("commercial"), "商业");
    assert.equal(licenseLabel("OFL"), "SIL Open Font License 1.1");
    assert.equal(licenseLabel("nope"), "nope");
  });
});
