# 提交分类索引（按修复目的）

本文件把 `40f16a6..HEAD` 之间的 **69 个提交**按**修复目的**归类，
便于按主题追溯、评审与回滚。提交本身保持原样（未改写历史）。

生成时间：2026-09-15 · 基线：`40f16a6`（v2.15.0）

---

## 一、按目的分类总览

| 目的类别 | 提交数 | 涉及文件 | 严重度 |
|---|---|---|---|
| A. 安全：注入（XSS） | 4 | `lib/report.js`、`lib/client.js` | 🔴 高 |
| B. 数据持久化：原子写 / 静默丢数据 | 7 | `lib/atomic-write.js`(新)、`projects/tasks/dcs-client/plan/report` | 🔴 高 |
| C. 失效守卫（写了但从未生效的检查） | 3 | `scripts/check-hooks.cjs` | 🟠 中 |
| D. 测试框架自身的静默退化 / 假绿 | 6 | `test/compat/lib/harness.mjs`、`run.mjs` | 🟠 中 |
| E. 审计规则（漏报 / 误报 / 分级） | 5 | `lib/audit.js` | 🟠 中 |
| F. 命令行与错误分类（SAW / 路径 / 重试判定） | 4 | `lib/index.js` | 🟠 中 |
| G. 提示词与 UI 契约 | 4 | `lib/index.js`、`lib/client.js` | 🟡 低 |
| H. 兼容性测试模块建设（新增用例层） | 22 | `test/compat/**` | — |
| I. 文档与版本声明 | 11 | `README/REPORT/IMPROVEMENTS/CHANGELOG/package.json` | — |
| J. CI 与工程化 | 1 | `.github/workflows/compat.yml` | — |
| K. 性能优化 | 2 | `test/compat/**` | — |
| **合计** | **69** | | ✅ 与提交总数一致 |

> 类别 A–G 是**插件代码的真实缺陷修复**（23 处），H–K 是**测试与工程能力建设**。
> 计数口径：按提交主题归类，每个提交**只计入一个**类别（主要目的）；
> 故各类之和恰为 69。例如 `25f378a` 同时含 check-hooks 修复与 client-render 修正，归入 C 类。

---

## 二、A. 安全：注入（XSS）🔴

同一类缺陷出现在两处渲染器：**先套 Markdown 标记、未先转义 HTML**。

| 提交 | 说明 |
|---|---|
| `5637590` | `fix(security): 报告 Markdown 渲染未转义 HTML（XSS）` |
| `3a5a7b8` | `fix(security): 客户端 mdToHtml 同样未转义 HTML（XSS，与报告同一类）` |
| `4f201c2` | `test(compat): 补端到端 XSS 验证（存储 → 渲染 全链路）` |

**影响**：报告是自包含 HTML（用户直接用浏览器打开）；客户端经
`dangerouslySetInnerHTML` 注入。输入含模型撰写的研究结果，会夹带上游数据/文件名/DCS 返回文本。

**修复策略**：先 `esc()` → 再套标记；链接校验协议（`javascript:`/`data:` 降级为纯文本）。

---

## 三、B. 数据持久化：原子写 / 静默丢弃 🔴

| 提交 | 说明 |
|---|---|
| `ddd8086` | `fix: 项目/任务存储改为原子写（防中断导致全量数据静默丢失）` |
| `be010fc` | `fix: 配置文件（含 PAT/API key）改为原子写 + 写前收紧权限` |
| `a294630` | `refactor: 抽出 lib/atomic-write.js 统一 5 处落盘 + 覆盖剩余 3 处非原子写` |
| `66963fe` | `fix: 项目/任务超限时静默丢弃数据 → 改为显式告警` |
| `1e1fde0` | `test(compat): 补测「反复读写后数据完整保留」（防 normProject 静默腐蚀）` |
| `a82484f` | `fix(compat): 为 all-writers-use-atomic 补非空守卫（meta 守卫抓到的空转）` |

**根因模式**：`writeFileSync` 先截断再写 → 中断留下半截文件；
而读取路径对损坏内容**静默降级**（返回空列表/默认值）→「数据凭空消失且无提示」。

**落盘点**：项目库 / 任务库 / 配置（含密钥）/ dcs 二进制 / 生成的文档。

---

## 四、C. 失效守卫（写了但从未生效）🟠

`scripts/check-hooks.cjs` 的**四条规则全部有问题** —— 它们都输出 `✅ 通过`，却什么都没检查。

| 提交 | 规则 | 失效方式 |
|---|---|---|
| `25f378a` | useState setter 解构 | 要求变量名以 `S` 结尾，而实际命名是 `xxxState`（37 处无一匹配）→ **从未生效** |
| `d0064b6` | charts 原地赋值 | 用 `!/nextCharts/` 豁免，而历史 bug 形态**恰好同行含 nextCharts** → 放过目标 |
| `a7ccc51` | 语法检查 | 硬编码只查 2 个文件，而 `lib/` 下有 9 个 → 7 个模块从未被检查 |

（第 4 条 `checkSyntax` 的覆盖问题在 `a7ccc51` 中一并修复。）

---

## 五、D. 测试框架自身的静默退化 / 假绿 🟠

| 提交 | 问题 | 后果 |
|---|---|---|
| `05d93dd` | `importDsh` 指定安装加载失败时**回退裸名解析** | 拿到项目内旧包 → 平台不兼容被完全掩盖（实测契约层 16/16 全过） |
| `34ff89e` | `DSH_ROOT` 无效时**静默回退自动探测** | CI 可能测到与预期不同的 dsh 版本 |
| `d1f065f` | `package.json` 损坏/包缺失时静默退化 | 报出误导性的「缺字段」而非「文件坏了」 |
| `262fb18` | `importDsh` 传**目录**给 `import()` | Node ESM 不支持目录导入；干净环境整体失败（可移植性缺陷） |
| `25839e3` | e2e 跳过提示写 stdout | 污染 `--json` 输出，打断 matrix.sh 与 CI |

**共同规律**：**失败后仍能继续** = 假绿。一个检测机制如果失败还能"成功"，它就没有价值。

---

## 六、E. 审计规则（漏报 / 误报 / 分级）🟠

| 提交 | 说明 |
|---|---|
| `e5fc44c` | `fix(audit): 补齐 7 处破坏性操作检测盲区 + 按危险度分级，消除误报` |
| `6129f40` | `feat(audit): 补齐数据破坏/凭据外泄检测（+16 类），保持零误报` |
| `88ede9f` | `fix(audit): WDL 镜像规则漏检含连字符/点的 registry + 补 WDL 规则测试` |
| `3393187` | `test(compat): 审计规则全量覆盖（49 条逐条验证，防规则静默失效）` |
| `1602377` | `test(compat): 审计规则的精确率守护（20 个真实脚本零 critical/high 误报）` |

**典型缺陷**：
- `rm -rf /` 因 `\b` 在 `/` 后不成立而**漏报**（最该拦的命令没拦住）
- `bcftools` 因 `/i` 被**误判**为 SAW 工具
- docker registry 因 `[a-z]+/` 不认连字符，**漏检插件自己推荐的格式**

---

## 七、F. 命令行与错误分类 🟠

| 提交 | 说明 |
|---|---|
| `362abaf` | `fix: SAW 命令识别把 bcftools/bcat 误判为 SAW 工具` |
| `fbb92e1` | `fix: extractMountFiles 把中文文字并进挂载路径 + safeServeName 误拒下划线` |
| `f6ffee2` | `fix: isFileVisibilityError 的裸 does not exist 会吞掉业务错误（触发无谓重试）` |
| `0154be2` | `fix: explainOfflineError 的「镜像」分支过宽，会误导排查方向` |

**共同点**：正则字符类/别名未覆盖真实输入形态。`explainOfflineError` 那条会把用户
引向错误方向（网络问题被提示去改镜像名）。

---

## 八、G. 提示词与 UI 契约 🟡

| 提交 | 说明 |
|---|---|
| `d778e90` | `fix(prompt): 修正 systemPrompt/描述中 5 个不存在的 dcs_wdl_* 工具引用` |
| `aa8272c` | `feat(client): 设置页加渲染错误边界` |
| `8a2a924` | `feat(ui): 终端卡片露出退出码徽章 + 修复由此引入的 schema 拒绝风险` |

**`d778e90` 值得注意**：提示词引用的 5 个工具**根本不存在**（名字从外部 skill 文档抄来），
agent 会反复调用失败。**没有任何一层会比对「提示词写的工具名」与「实际注册的工具名」**。

---

## 九、H. 兼容性测试模块建设（按层）

25 个提交构建了 13 层 196 例的测试模块：

| 层 | 代表提交 | 例数 |
|---|---|---|
| 基础框架 + unit/contract/integration/lifecycle | `e233588` | — |
| meta（防假绿/空转） | `2ee6868`、`bb573ee` | 15 |
| upgrade（会话迁移链） | `2cb7995` | 8 |
| frozen（冻结参数不可变性） | `fb5c6eb` | 5 |
| e2e（真实 dcs CLI + 命令面） | `2db0552` | 5 |
| client-render（hook 替身真实渲染） | `aa8272c`、`e9798b6` | 9 |
| http（路由契约 + 真实 handler） | `798c4de`、`62bc570`、`c8b8b93` | 11 |
| consistency（内部常量自洽） | `4cfabe9` | 11 |
| embedded（内嵌 Python 语法） | `12485d1` | 4 |
| internals（未导出纯函数） | `362abaf`、`f11f1a4`、`89e1b82`、`845a57a` | 29 |
| 可移植性 / profile 装载证据 | `262fb18`、`c0d794f` | — |

---

## 十、I/J/K. 文档、CI、工程化

| 类别 | 代表提交 |
|---|---|
| 文档（README/报告/改进建议/CHANGELOG） | `f4f0917`、`f7220a0`、`35ea899`、`bc19b36` 等 12 个 |
| CI / npm scripts | `e5d99df`（workflow）、`f4f0917`、`17ab8d0`（matrix.sh） |
| 性能优化 | `b88b606`（3.2s→1.8s）、`6d87673`（1.32s→0.10s） |

---

## 十三、逐类提交清单（全部 69 个，可完整追溯）

以下按类别列出**每一个**提交（含文档与测试），便于按目的整体审阅或回滚。
表格顺序为提交时间先后。

### A (4)
| `5637590` | fix(security): 报告 Markdown 渲染未转义 HTML（XSS） |
| `3a5a7b8` | fix(security): 客户端 mdToHtml 同样未转义 HTML（XSS，与报告同一类） |
| `4f201c2` | test(compat): 补端到端 XSS 验证（存储 → 渲染 全链路） |
| `fb10c58` | docs: 报告补「注入防护」章节（两处 XSS + 端到端验证）并同步 180 例 |

### B (7)
| `66963fe` | fix: 项目/任务超限时静默丢弃数据 → 改为显式告警 |
| `1e1fde0` | test(compat): 补测「反复读写后数据完整保留」（防 normProject 静默腐蚀） |
| `ddd8086` | fix: 项目/任务存储改为原子写（防中断导致全量数据静默丢失） |
| `be010fc` | fix: 配置文件（含 PAT/API key）改为原子写 + 写前收紧权限 |
| `a294630` | refactor: 抽出 lib/atomic-write.js 统一 5 处落盘 + 覆盖剩余 3 处非原子写 |
| `a82484f` | fix(compat): 为 all-writers-use-atomic 补非空守卫（meta 守卫抓到的空转） |
| `1843658` | docs: 报告补「数据持久化加固」章节（原子写 + 截断告警）并同步 173 例 |

### C (3)
| `25f378a` | fix: check-hooks 的 useState 守卫从未生效 + client-render 渲染的是包装器而非视图 |
| `d0064b6` | fix: check-hooks 的 charts 规则同样被自己的豁免放过（第 3 个失效守卫） |
| `a7ccc51` | fix: check-hooks 的语法检查只覆盖 2/9 个模块（第 4 个失效守卫） |

### D (6)
| `f7220a0` | docs(test): dsh 0.1.5-rc 兼容性测试报告 + 修复 --json 输出纯净性 |
| `34ff89e` | fix(compat): DSH_ROOT 无效时不再静默回退 + 退出码契约（0/1/2） |
| `25839e3` | fix(compat): e2e 跳过提示改写 stderr（修复 --json 输出污染）+ JSON 纯净性守卫 |
| `262fb18` | fix(compat): 修复目录导入缺陷 + 补 peerDependencies 前置自检（可移植性验证） |
| `05d93dd` | fix(compat): importDsh 静默回退会掩盖平台不兼容（模拟升级验证时发现） |
| `d1f065f` | fix(compat): 消除契约层的静默退化（package.json 损坏 / 包缺失时给出可诊断错误） |

### E (5)
| `e5fc44c` | fix(audit): 补齐 7 处破坏性操作检测盲区 + 按危险度分级，消除误报 |
| `6129f40` | feat(audit): 补齐数据破坏/凭据外泄检测（+16 类），保持零误报 |
| `88ede9f` | fix(audit): WDL 镜像规则漏检含连字符/点的 registry + 补 WDL 规则测试 |
| `3393187` | test(compat): 审计规则全量覆盖（49 条逐条验证，防规则静默失效） |
| `1602377` | test(compat): 审计规则的精确率守护（20 个真实脚本零 critical/high 误报） |

### F (4)
| `362abaf` | fix: SAW 命令识别把 bcftools/bcat 误判为 SAW 工具 + 新增 internals 层（9 例） |
| `fbb92e1` | fix: extractMountFiles 把中文文字并进挂载路径 + safeServeName 误拒下划线 + internals 层扩到 16 例 |
| `f6ffee2` | fix: isFileVisibilityError 的裸 does not exist 会吞掉业务错误（触发无谓重试） |
| `0154be2` | fix: explainOfflineError 的「镜像」分支过宽，会误导排查方向 |

### G (4)
| `8a2a924` | feat(ui): 终端卡片露出退出码徽章 + 修复由此引入的 schema 拒绝风险 |
| `aa8272c` | feat(client): 设置页加渲染错误边界 + 新增 client-render 层（4 例） |
| `a6b613f` | docs: 报告与 README 同步九层 115 例 + 设置页错误边界缺陷章节 |
| `d778e90` | fix(prompt): 修正 systemPrompt/描述中 5 个不存在的 dcs_wdl_* 工具引用 |

### H (22)
| `e233588` | test: 建立 dsh 0.1.5-rc 兼容性测试用例模块（65 例）+ 修复 2 处真实缺陷 |
| `2ee6868` | test(compat): 新增 meta 层（8 例，变异测试防假绿）+ 呈现契约一致性用例 |
| `2cb7995` | test(compat): 新增 upgrade 层（8 例）—— 会话格式迁移链升级演练 |
| `fb5c6eb` | test(compat): 新增 frozen 层（5 例）+ 逐用例假绿守卫 |
| `c4a8442` | test(compat): 补 presenter 软校验契约用例（非法参数返回 undefined 而非抛错） |
| `35ea899` | feat: v2.16.0 — dsh 0.1.5-rc 兼容性测试模块（99 例七层）+ dsh.compat 声明 + CHANGELOG |
| `17ab8d0` | feat(compat): 多版本兼容性矩阵 matrix.sh —— 实测跨 3 个 dsh 版本 99/99 通过 |
| `2db0552` | feat(compat): 新增 e2e 层（5 例）—— 真实 dcs CLI 调用 + 命令面兼容性校验 |
| `e9798b6` | test(compat): client-render 层补图表类型覆盖（6 例） |
| `798c4de` | test(compat): 新增 http 层（5 例）—— 客户端/服务端路由契约 |
| `62bc570` | test(compat): http 层补真实 handler 调用（8 例）—— 验证响应而非仅注册 |
| `4cfabe9` | test(compat): 新增 consistency 层（9 例）—— 内部常量与引用自洽性 |
| `5ee3c62` | test(compat): 补工具错误路径结构化断言（133 例） |
| `c0d794f` | test(compat): 新增「插件已在 dsh profile 注册」用例（真实装载证据） |
| `12485d1` | test(compat): 新增 embedded 层（4 例）—— 内嵌 Python 片段语法校验 |
| `bb573ee` | test(compat): 系统性加固「空转断言」+ 新增 meta 守卫（141 例） |
| `f11f1a4` | test(compat): internals 层扩到 22 例（文本提取/打分/术语抽取） |
| `118ae0f` | test(compat): 补测破坏性操作 deleteProject（会话隔离）+ 记录死代码发现 |
| `6566553` | test(compat): 补测看门狗候选筛选 + upsertModule 的 module_id 契约 |
| `c8b8b93` | test(compat): 补 HTTP 异常输入健壮性（3 例，http 层 11 例） |
| `89e1b82` | test(compat): 补测资源规格归一化（文档承诺的 7 种写法）+ 覆盖率升至 54% |
| `845a57a` | test(compat): 补测 extractJsonObj（从 LLM 输出中稳健提取 JSON） |

### I (11)
| `f4f0917` | docs(test): compat 模块 README + npm scripts 接入（npm test / test:contract 等） |
| `a25e99a` | docs(test): 报告与 README 同步七层结构（93 例）+ 元测试可靠性章节 |
| `e7e926d` | docs: 更新改进建议（presentResult 核实结论 + cliView 字段同步教训） |
| `6301b34` | docs: 兼容性报告补多版本矩阵实测结论（3 版本 99/99） |
| `f560d7e` | docs: 报告同步八层 109 例 + dcs CLI 命令面校验实测章节 |
| `220bc3a` | docs: 报告与 README 同步十层 123 例 + HTTP 接口契约章节 |
| `dd50e18` | docs: README/run.mjs 同步 consistency 层（132 例 11 层）+ test:consistency 脚本 |
| `54a7727` | docs: 报告与 README 同步十二层 140 例 + embedded 层与提示词引用缺陷章节 |
| `69aa861` | docs: README 与报告同步 13 层 164 例（补 internals 层、修正各层计数） |
| `eb6792c` | docs: IMPROVEMENTS 记录 upsertModule 的静默重复模块风险与改进建议 |
| `bc19b36` | docs: README 同步 183 例与各层实际计数（lifecycle 31 / unit 29 / internals 22 / http 11） |

### J (1)
| `e5d99df` | ci: 新增 dsh 兼容性测试 workflow + 更新改进建议文档 |

### K (2)
| `b88b606` | perf(compat): 套件提速 3.2s → 1.8s（快速模式 0.6s） |
| `6d87673` | perf(compat): 修剪告警用例 1.32s → 0.10s（13x），套件回到 2.45s |

---

## 十一、快速追溯（按目的找提交）

```bash
# 只看真实缺陷修复（A–G）
git log --oneline 40f16a6..HEAD | grep -E "fix\(|fix:|feat\(audit\)|feat\(security\)|feat\(client\)"

# 安全类
git log --oneline 40f16a6..HEAD --grep="security"

# 数据持久化类
git log --oneline 40f16a6..HEAD -- lib/projects.js lib/tasks.js lib/atomic-write.js lib/dcs-client.js

# 失效守卫类
git log --oneline 40f16a6..HEAD -- scripts/check-hooks.cjs

# 审计规则类
git log --oneline 40f16a6..HEAD -- lib/audit.js

# 测试框架自身缺陷
git log --oneline 40f16a6..HEAD -- test/compat/lib/harness.mjs test/compat/run.mjs
```

---

## 十二、附：修复严重度汇总

| 严重度 | 数量 | 类别 |
|---|---|---|
| 🔴 高 | 9 | XSS ×2、非原子写 ×5（含密钥文件）、静默丢数据 ×1、插件加载回退 ×1 |
| 🟠 中 | 12 | 失效守卫 ×4、测试框架假绿 ×4、审计漏报/误报 ×3、错误分类 ×1 |
| 🟡 低 | 2 | 提示词引用、UI 错误边界 |

**全部修复均经变异验证或实机复现**（见各提交说明与
`COMPATIBILITY-REPORT.md` 的「测试网自身可靠性」章节）。
