import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { worstRisk, isHighRisk, riskToExitCode, RISK_ORDER, RISK_SEVERITY } from "../src/risk";

describe("risk", () => {
  test("worstRisk returns highest severity", () => {
    assert.equal(worstRisk(["ok", "attribution"]), "attribution");
    assert.equal(worstRisk(["restricted", "ok"]), "restricted");
    assert.equal(worstRisk(["ok"]), "ok");
    assert.equal(worstRisk(["unknown", "attribution", "ok"]), "attribution");
  });

  test("isHighRisk", () => {
    assert.ok(isHighRisk("restricted"));
    assert.ok(!isHighRisk("ok"));
    assert.ok(!isHighRisk("attribution"));
  });

  test("severity ordering", () => {
    assert.equal(RISK_ORDER[0], "restricted");
    assert.ok(RISK_SEVERITY.restricted > RISK_SEVERITY.attribution);
    assert.ok(RISK_SEVERITY.attribution > RISK_SEVERITY.ok);
  });

  test("riskToExitCode thresholds", () => {
    const s = { restricted: 1, attribution: 3, unknown: 2 };
    assert.equal(riskToExitCode(s, "restricted"), 1);
    assert.equal(riskToExitCode(s, "attribution"), 1);
    assert.equal(riskToExitCode(s, "unknown"), 1);
    assert.equal(riskToExitCode(s, "none"), 0);

    const clean = { restricted: 0, attribution: 0, unknown: 1 };
    assert.equal(riskToExitCode(clean, "restricted"), 0);
    assert.equal(riskToExitCode(clean, "unknown"), 1);
    assert.equal(riskToExitCode(clean, "attribution"), 0);
  });
});