import type { FontLicenseRecord } from "./types";

const COMMON_OPEN = ["Noto Sans SC", "Source Han Sans SC", "Inter"];

const STYLE_HINTS: Array<[string[], string[]]> = [
  [
    ["futura", "gilroy", "gotham", "proximanova", "montserrat"],
    ["Montserrat", "Poppins", "Inter"],
  ],
  [
    ["serif", "times", "georgia", "garamond", "palatino", "bodoni", "didot", "baskerville", "rockwell"],
    ["Source Serif 4", "Noto Serif", "Lora", "Playfair Display"],
  ],
  [
    ["mono", "consolas", "courier", "code", "fira"],
    ["JetBrains Mono", "Fira Code", "Source Code Pro"],
  ],
  [
    ["hand", "script", "cursive", "brush", "calligraphy", "lobster"],
    ["Caveat", "Dancing Script", "Pacifico"],
  ],
  [
    ["yahei", "pingfang", "hei", "song", "kai", "fang", "hanyi", "fangzheng", "cjk", "sc", "tc"],
    ["Noto Sans SC", "Source Han Sans SC", "HarmonyOS Sans SC", "Alibaba PuHuiTi"],
  ],
];

export function suggestAlternatives(
  record: FontLicenseRecord | null,
  rawName: string,
): string[] {
  if (record && record.alternatives.length > 0) {
    return record.alternatives;
  }
  if (record && record.category === "open") {
    return [];
  }
  const name = rawName.toLowerCase();
  for (const [hints, alts] of STYLE_HINTS) {
    if (hints.some((h) => name.includes(h))) return alts;
  }
  return COMMON_OPEN;
}
