# fontcheck

> 字体许可 / 商用风险检查。项目用了什么字体？能不能商用？—— 许可风险一查。

`fontcheck` 扫描项目（代码 / CSS / 文档 / 设计资源）中的字体引用，识别每种字体的**许可类型**（开源 OFL/Apache / 免费商用 / 商业专有 / 未知），评估**商用风险**（可商用 / 需归属 / 禁止·受限），为高风险的商业字体**推荐开源替代**（Noto / 思源 / 站酷 / 得意黑…），输出 CLI / HTML / JSON 报告并支持 **CI 退出码** —— 帮助设计、产品与开发团队在发布前避免字体侵权。

## 为什么需要它

- 微软雅黑 / 苹方 / 汉仪 / 方正等**商用字体侵权是高发法律风险**，设计、产品团队常无意识使用。
- 现有工具只有"字体下载"，没有"许可扫描 + 商用风险"一体的检查。
- 需求真实（设计合规 / 法务审计 / 开源发布），接入成本极低：一条命令。

## 功能

| 模块 | 能力 |
|---|---|
| 扫描 | 递归扫描 CSS `font-family`、`@font-face`、Google Fonts 链接、`.ttf/.otf/.woff/.woff2/.eot` 字体文件、HTML / JS / 文档中的字体名 |
| 识别 | 87+ 字体条目（含中文别名），许可类型分级：开源（OFL/Apache2/MIT）/ 免费商用 / 商业专有 / 系统内置 |
| 风险 | 商用风险四级：`可商用` / `可商用需归属` / `禁止·受限` / `未知需自查`（白名单过滤系统字体，减少误报） |
| 建议 | 高风险字体给出开源替代（Noto Sans SC / 思源黑体 / 阿里巴巴普惠体 / 站酷…），文件名自动剥离字重后缀（`Montserrat-SemiBold.otf` → `Montserrat`） |
| 报告 | CLI 终端报告 / 自包含 HTML / 结构化 JSON，含出现位置与来源标注 |
| CI | 按阈值退出码，高风险即构建失败 |

## 快速开始

```bash
npm install
npm run build

# 扫描当前目录
npx fontcheck

# 扫描指定目录，生成 HTML 报告并落盘
npx fontcheck ./my-project --format html --report ./fontcheck-report.html

# JSON 输出（适合 CI 归档）
npx fontcheck ./my-project --format json --report ./report.json

# CI：存在禁止/受限字体即失败（默认）
npx fontcheck ./my-project --fail-on restricted
```

### 输出示例

```text
扫描目录 : D:\project\fontcheck\tests\fixtures\sample-web
扫描文件 : 8   用时: 10ms   引用: 37 处 / 18 个字体

高风险 5 | 需归属 1 | 未知 1 | 可商用 11

[禁止/受限商用] (5)
  Microsoft YaHei  引用 3 处
    许可: 商业专有授权
    说明: 随 Windows 授权，仅限在 Windows 环境渲染显示；禁止作为 Web 字体嵌入网页……
    来源: https://learn.microsoft.com/en-us/typography/font-list/microsoft-yahei
    建议替代: Noto Sans SC / Source Han Sans SC / HarmonyOS Sans SC / Alibaba PuHuiTi
    出现: fonts\MSYH.ttf:0, index.html:9, index.html:15
  ...

✗ 发现 5 个禁止/受限字体，不满足商用合规要求。
```

## 用法

```text
fontcheck [目录] [选项]

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
  --version / --help          版本 / 帮助
```

### 退出码

| 码 | 含义 |
|---|---|
| 0 | 通过（未超过 `--fail-on` 阈值） |
| 1 | 存在超过阈值的风险字体 |
| 2 | 参数错误或执行失败 |

示例：`--fail-on restricted` 有任何"禁止/受限"字体即退出 1；`--fail-on unknown` 把"未知需自查"也视为失败；`--fail-on none` 始终通过（纯检查）。

## 目录结构

```
fontcheck/
├─ src/
│  ├─ main.ts        # CLI 入口、参数解析、退出码
│  ├─ scanner.ts     # 字体引用扫描（CSS/文件/文档）
│  ├─ license.ts     # 许可库加载与字体识别（别名 + 字重后缀剥离）
│  ├─ risk.ts        # 商用风险分级
│  ├─ suggest.ts     # 开源替代建议
│  ├─ report.ts      # CLI / HTML / JSON 报告
│  └─ analyze.ts     # 识别 → 风险 → 聚合
├─ licenses/
│  └─ fonts.json     # 字体许可库（87+ 条目，含别名/来源/替代）
├─ tests/            # node:test 单元测试 + fixtures 示例工程
└─ package.json
```

## 开发

```bash
npm run build      # tsc 编译到 dist/
npm test           # 运行单元测试
npm run typecheck  # 类型检查
```

## 许可数据说明

- `licenses/fonts.json` 为人工整理的许可信息，每条含**来源标注**（版权方官网 / OFL / 官方许可页）。
- 许可数据仅供参考，**正式商用前请以字体版权方官网许可为准**。
- 欢迎通过 PR 补充字体条目与修正许可信息。
- 常见开源替代：Noto Sans/Serif（OFL）、思源黑体/宋体（OFL）、阿里巴巴普惠体（免费商用）、鸿蒙字体（免费商用）、站酷系列（免费商用）、得意黑（OFL）、霞鹜文楷（OFL）。

## Roadmap

- [ ] 字体文件真实内容解析（从 TTF/OTF 内嵌名称与 LICENSE 推导，覆盖重命名文件）
- [ ] 更多设计资源格式（Sketch / Figma 导出数据 / PSD 文本层）
- [ ] 许可库托管发布 + 自动更新
- [ ] GitHub Actions / lint-staged 集成示例

## License

MIT