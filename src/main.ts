import * as fs from "node:fs";
import * as path from "node:path";
import { LicenseDb, categoryLabel, licenseLabel, riskLabel } from "./license";
import { scan } from "./scanner";
import { writeReport } from "./report";
import { riskToExitCode } from "./risk";
import { buildReportData } from "./analyze";
import type { CliOptions, RiskLevel } from "./types";

const VERSION = "0.1.0";

const HELP = `fontcheck - 字体许可 / 商用风险检查

用法:
  fontcheck [目录] [选项]

参数:
  目录                   要扫描的项目/文档目录（默认当前目录）

选项:
  --format <text|json|html>   输出格式（默认 text）
  --report <path>             同时将报告写入文件
  --fail-on <restricted|attribution|unknown|none>
                              设定 CI 失败阈值（默认 restricted）
  --ignore <dir1,dir2>        额外跳过目录
  --ext <ext1,ext2>           仅扫描这些扩展名文件
  --quiet                     只在有问题时输出
  --no-color                  禁用颜色输出
  --db <path>                 自定义字体许可库 JSON 路径
  --list-fonts                列出许可库中收录的字体
  --version                   输出版本号
  --help                      显示帮助

退出码:
  0  通过（无超过阈值的风险）
  1  发现超过 --fail-on 阈值的风险
  2  参数错误或执行失败
`;

function parseArgs(argv: string[]): { opts: CliOptions; action: "scan" | "list" | "help" | "version" } {
  const opts: CliOptions = {
    target: process.cwd(),
    format: "text",
    failOn: "restricted",
    quiet: false,
    color: process.stdout.isTTY ? true : false,
  };
  let action: "scan" | "list" | "help" | "version" = "scan";
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--help":
      case "-h":
        action = "help";
        break;
      case "--version":
      case "-v":
        action = "version";
        break;
      case "--list-fonts":
        action = "list";
        break;
      case "--format":
        opts.format = argv[++i] as CliOptions["format"];
        break;
      case "--report":
        opts.reportPath = argv[++i];
        break;
      case "--fail-on":
        opts.failOn = argv[++i] as CliOptions["failOn"];
        break;
      case "--ignore":
        opts.ignoreDirs = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--ext":
        opts.include = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--quiet":
        opts.quiet = true;
        break;
      case "--no-color":
        opts.color = false;
        break;
      case "--db":
        opts.dbPath = argv[++i];
        break;
      default:
        if (a.startsWith("-")) {
          console.error(`未知参数: ${a}`);
          process.exit(2);
        }
        positional.push(a);
    }
  }

  if (positional.length > 1) {
    console.error("只能指定一个扫描目录");
    process.exit(2);
  }
  if (positional.length === 1) {
    opts.target = positional[0];
  }

  if (!["text", "json", "html"].includes(opts.format)) {
    console.error(`不支持的格式: ${opts.format}`);
    process.exit(2);
  }
  if (!["restricted", "attribution", "unknown", "none"].includes(opts.failOn)) {
    console.error(`不支持的 --fail-on: ${opts.failOn}`);
    process.exit(2);
  }

  return { opts, action };
}

async function main(): Promise<void> {
  const { opts, action } = parseArgs(process.argv.slice(2));

  if (action === "help") {
    console.log(HELP);
    return;
  }
  if (action === "version") {
    console.log(`fontcheck v${VERSION}`);
    return;
  }

  let db: LicenseDb;
  try {
    db = new LicenseDb(opts.dbPath);
  } catch (err) {
    console.error(`无法加载字体许可库: ${(err as Error).message}`);
    process.exit(2);
    return;
  }

  if (action === "list") {
    console.log(`字体许可库共收录 ${db.size} 个字体条目:`);
    for (const rec of db.all()) {
      console.log(
        `  ${rec.name.padEnd(28)} ${categoryLabel(rec.category).padEnd(8)} ${riskLabel(rec.risk)}${rec.alternatives.length ? `  替代: ${rec.alternatives.join("/")}` : ""}`,
      );
    }
    return;
  }

  const target = opts.target;
  if (!fs.existsSync(target)) {
    console.error(`路径不存在: ${target}`);
    process.exit(2);
    return;
  }

  const outcome = scan(target, db.allTokens(), {
    root: target,
    include: opts.include,
    excludeDirs: opts.ignoreDirs,
  });

  const data = buildReportData(path.resolve(target), db, outcome.refs, outcome.filesScanned, outcome.durationMs);
  const colored = opts.color;
  const body = writeReport(data, opts.format, colored);
  const exitCode = riskToExitCode(data.summary, opts.failOn);

  if (opts.reportPath) {
    try {
      const dir = path.dirname(opts.reportPath);
      if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(opts.reportPath, body, "utf-8");
    } catch (err) {
      console.error(`写入报告失败: ${(err as Error).message}`);
      process.exit(2);
      return;
    }
  }

  if (!opts.quiet || exitCode !== 0) {
    if (opts.format === "text") {
      console.log(body);
      if (opts.reportPath) console.log(`报告已写入: ${opts.reportPath}`);
    } else if (opts.format === "json") {
      if (opts.reportPath) {
        console.log(`JSON 报告已写入: ${opts.reportPath}`);
      } else {
        console.log(body);
      }
    } else {
      if (opts.reportPath) {
        console.log(`HTML 报告已写入: ${opts.reportPath}`);
      } else if (body.length > 2000) {
        console.log(`${body.length} 字符的 HTML 报告（建议用 --report <路径> 落盘后打开）`);
      } else {
        console.log(body);
      }
    }
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});