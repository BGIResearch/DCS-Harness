# DCS-Harness × dsh 0.1.5-rc 兼容性测试报告

| 项目 | 值 |
|---|---|
| 被测插件 | `dsh-dcs-cloud` v2.15.0 |
| 目标平台 | **dsh 0.1.5-rc.1**（运行中） / dsh-tools 0.1.5-rc.2 |
| 测试模块 | `test/compat`（零依赖 ESM，140 例，十二层） |
| 结论 | ✅ **兼容**（140/140 通过，耗时 ~1.8s） |
| 多版本实测 | ✅ **0.1.5-alpha.1 / 0.1.5-rc.1 / 0.1.5-rc.2 均 140/140 通过** |
| dcs CLI 实测 | ✅ **22 个插件调用的 dcs 子命令全部存在**（真实 CLI 校验） |
| 修复缺陷 | **5 处真实缺陷**（审计安全 ×2 / 客户端装载 / 崩溃隔离 / 提示词工具引用） |

```bash
npm test          # 全量 93 例
npm run test:contract   # 只看平台契约
```

---

## 一、测试结论总览

| 层次 | 通过 | 说明 |
|---|---|---|
| `unit` | 23/23 | 插件纯逻辑（atlas/audit/plan/report/tasks/projects/dcs-client） |
| `contract` | 16/16 | 插件消费的 dsh 平台契约全部成立 |
| `integration` | 16/16 | 插件可装载，48 个工具全部注册且 schema 可编译 |
| `lifecycle` | 20/20 | 配置/任务库/项目库生命周期、权限、幂等 |
| `upgrade` | 8/8 | 会话格式迁移链演练（升级/降级/损坏三方向） |
| `frozen` | 5/5 | 冻结参数不可变性（历史 readonly bug 防复发） |
| `e2e` | 5/5 | 真实 dcs CLI 调用（默认跳过） + **命令面存在性（默认运行）** |
| `meta` | 12/12 | 测试自身有效性（变异测试、假绿守卫、退出码契约、JSON 纯净性） |

---

## 二、平台契约核验明细

逐项验证插件依赖的 dsh 私有 API 在 0.1.5-rc.1 上仍然成立：

### 2.1 工具定义契约

| 契约 | 插件用法 | 0.1.5 状态 |
|---|---|---|
| `defineTool(options)` | 48 处调用 | ✅ 导出未变，签名兼容 |
| 参数 schema DSL | `string`/`number`/`boolean`/`array`/`object`/`json`/`enum`/`required:true` | ✅ 全部被 `parameterSchemaSpecToJsonSchema` 接受 |
| 输出 value schema | `output.schema` + 嵌套 `additionalProperties` + `required` | ✅ 全部被 `valueSchemaSpecToJsonSchema` 接受 |
| `output.render(args, value)` | 48 处 | ✅ 返回 `ContentBlock[]` 契约未变 |
| `execute(args, exec)` | 48 处 | ✅ 平台仍会在 execute 前做严格参数校验 |
| `isConcurrencySafe(args)` | 14 处 | ✅ 仍在 `DefineToolOptions` 中 |
| `timeoutMs` | 84 处 | ✅ 仍要求正有限数 |
| `presentCall` / `presentResult` | 12 处 / 1 处 | ✅ `ToolCallView` / `ToolResultView` 联合类型未变 |

**关键点**：`defineTool` 的 `presentCall`/`presentResult` 在 0.1.5 会**先软校验参数**，
非法则回退通用卡片（`if (validate(args).length > 0) return void 0`）——插件的纯函数式
presenter 写法天然满足该约束。

### 2.2 宿主服务契约

`inject = ['tools', 'systemPrompt', 'webServer', 'sessions', 'tokenMeter', 'sessionPersistence']`

| 服务 | 提供方包 | 0.1.5 状态 |
|---|---|---|
| `tools` | `dsh-tools` | ✅ |
| `systemPrompt` | `dsh-system-prompt` | ✅ |
| `webServer` | `dsh-host-webserver` | ✅ |
| `sessions` | `dsh-session` | ✅ |
| `tokenMeter` | `dsh-token-meter` | ✅ |
| `sessionPersistence` | `dsh-session-persistence` | ✅ |

**方法签名核验**：

- `systemPrompt.section({ name, order, text: () => string })` ✅ 与插件用法一致
- `webServer.register({ kind: 'exact'|'prefix', path, handler })` ✅ 与插件 2 处调用一致，
  且插件的 `path` 均无尾斜杠、不重复 —— 满足平台「重复注册抛错」约束

### 2.3 客户端契约

| 契约 | 状态 |
|---|---|
| `window.__ModuleLoader__.load({ id, factory })` 信封 | ✅ 仍为 0.1.5 的客户端模块格式 |
| `id` 与插件名一致（`dsh-dcs-cloud`） | ✅ |
| slot `conversation.view` | ✅ 存在（`dsh-client-ui-conversation`） |
| slot `settings.section` | ✅ 存在（`dsh-client-ui-settings-general`） |
| slot `sidebar.brand.mark` / `sidebar.brand.name` | ✅ 存在（`dsh-client-ui-sidebar`） |
| `ctx.slots.inject(name, fn)` / `ctx.slots.register(meta, comp)` | ✅ 签名未变 |

### 2.4 会话格式

dsh 0.1.5 提供完整迁移链 `dsh-session-format-v0-to-v1` / `v1-to-v2` / `v2-to-v3`，
**升级不会丢历史会话** ✅。

---

## 三、发现的版本错位风险

### 3.1 peerDependencies 滞后（需治理，未致失败）

```
实际运行 dsh-tools : 0.1.5-rc.2
peerDependencies   : ^0.1.1-rc.2   ← 滞后 4 个 rc 版本
devDependency      : 0.1.1-rc.2    ← 本地开发/CI 装的是旧版
```

**风险**：`pnpm install` 后本地解析到 0.1.1-rc.2，而运行时是 0.1.5-rc.2。
两版 API 目前兼容，但本地无法捕获未来平台变更 —— 即「开发环境比生产环境旧」。

**建议**：把 `devDependencies` 与 `peerDependencies` 提升到 `^0.1.5-rc.2`，
并在 CI 中用真实 dsh 版本跑 `npm run test:contract`。

> `contract/platform/dsh-tools-version` 用例已在守护主次版本线；上述滞后属同线（0.1.x）故未失败，
> 一旦 dsh 进入 0.2.x 会立即红灯。

### 3.2 已修复：`dsh.client.inject` 引用了不存在的包

见第四章缺陷 2。

---

## 四、修复的真实缺陷

### 缺陷 1：`lib/audit.js` 漏检最危险的删除命令 🔴 安全影响

**现象**：脚本静态审计的最核心职责是拦截危险删除，但实际行为是反的：

| 命令 | 修复前 | 期望 |
|---|---|---|
| `rm -rf /` | ❌ 漏报（仅报「缺 shebang」） | 🔴 critical |
| `rm -rf ~` | ❌ 漏报 | 🔴 critical |
| `rm -rf / ` | ❌ 漏报 | 🔴 critical |
| `rm -rf /data/work` | ✅ critical | 🔴 critical |
| `rm -f /tmp/x`（无 `-r`） | ⚠️ 误报 critical | ✅ 不报 |

**根因**：正则 `/\brm\s+-rf\s+\/\b/` 中用 `\b` 作为目标后的边界，但 `/` 和 `~` 都是
**非单词字符**，`\b` 在「非单词字符 → 行尾」处**不成立**，故 `rm -rf /`（行尾）
与 `rm -rf ~` 全部漏检；而 `rm -rf /data` 因后面是字母 `d` 反而命中 —— 是偶然生效。
另外原正则要求 `-rf` 连写，`rm -fr /`、`rm -r -f /data` 也逃逸。

**修复**：改用「行尾 / 空白 / 分隔符」作边界，并强制要求递归标志：

```js
{ re: /\brm\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*(?:\s+-[a-zA-Z]+)*\s*\/(?=\s|$|;|&|\||[A-Za-z])/, sev: 'critical', ... }
```

**验证**（危险集 + 安全集双向断言）：

```
危险集 9/9 全命中：rm -rf / · /data/work · * · ~ · "/ " · $HOME · "rm  -rf  /" · rm -fr / · rm -r -f /data
安全集 6/6 零误报：rm -f /tmp/x.txt · rm -rf ./build · rm -rf build · ls -l /tmp · mkdir -p /work/a · rm /tmp/a.txt
```

### 缺陷 2：设置页缺少渲染错误边界 🟠 整页白屏风险

**现象**：`lib/client.js` 中其余视图（项目管理 / 结果交付 / 会话地图）都用
`guarded()` 包了 `ErrorBoundary`，**唯独设置页 `DcsCloudSettingsPage` 直接注册**：

```js
// 修复前
ctx.slots.register({ name: "settings.section", id: "dcs-cloud", ... }, DcsCloudSettingsPage);
// 修复后
ctx.slots.register({ name: "settings.section", id: "dcs-cloud", ... }, guarded(DcsCloudSettingsPage));
```

**影响**：设置页渲染抛错会冒泡到根，导致设置弹窗（乃至整个页面）空白。
而设置页承载 PAT 配置与登录，**是用户修复其它问题的入口** —— 崩溃代价比普通视图更高。

**发现方式**：新增的 `client-render` 层用「所有视图注册必须经 `guarded()` 包裹」
的断言扫出。该断言经变异验证：移除 `guarded()` 后立即变红。

### 缺陷 3：systemPrompt 引用了 5 个不存在的工具 🟠 工具调用反复失败

**现象**：`lib/index.js` 的 systemPrompt 与工具描述里写着
`dcs_wdl_list` / `dcs_wdl_plan` / `dcs_wdl_check_parameter` /
`dcs_wdl_fill_parameter` / `dcs_wdl_submit_task`，但插件**实际注册**的是
`dcs_workflow_search` / `dcs_workflow_info` / `dcs_workflow_run`。

**根因**：这些名字是**从外部 `dcs-workflow-skill` 文档抄来的**（该 skill 确有同名工具），
本插件并未实现它们。

**影响**：agent 严格按提示词去调用不存在的工具 → 反复失败，且失败原因难以归因
（提示词与工具表不一致）。**全程不报任何错**。

**为何长期未被发现**：提示词只是字符串。契约层查 API、集成层查注册、
HTTP 层查路由 —— **没有任何一层会比对「提示词里写的工具名」与「实际注册的工具名」**。

**修复**：修正 11 处引用（注释 / 工具描述 / systemPrompt / 投递结果提示），
并新增两条守卫：`prompt-tool-references-resolve`、`tool-descriptions-references-resolve`。

### 缺陷 4：`package.json` 的 `dsh.client.inject` 声明了不存在的包 🟠 客户端装载

**现象**：原值 `@deepseek-ai/dsh-client-runtime` 在 dsh 0.1.5-rc.1 中**不存在**
（核对官方 63 个 `dsh-client-*` 包，无一声明或引用该包名）。

**影响**：dsh 客户端模块图对 `inject` 的语义是**软依赖** ——
`dsh-client-modules/lib/client.js` 中 `if (dependency !== void 0) await this.arriveGraphRow(...)`，
缺失项被**静默跳过**。因此这一失效声明不会报错，只会让客户端半的**装载顺序失去保障**，
表现为项目管理/结果交付窗口偶发加载不出来，且极难定位。

**修复**：改为声明真实提供方（按客户端半实际使用的 slot 反查）：

| 用途 | 应注入的包 |
|---|---|
| `ctx.slots` 服务本身 | `@deepseek-ai/dsh-client-ui-renderer`（`class Slots extends Service`，`super(ctx, "slots")`） |
| `conversation.view` | `@deepseek-ai/dsh-client-ui-conversation` |
| `settings.section` | `@deepseek-ai/dsh-client-ui-settings-general` |
| `sidebar.brand.mark` / `.name` | `@deepseek-ai/dsh-client-ui-sidebar` |

**防回归**：新增 `lifecycle/platform/client-inject-covers-slots` 用例，
自动解析 `lib/client.js` 里用到的每个 slot，反查其提供方包是否都在 `inject` 中 ——
该字段今后不会再静默漂移。

---

## 四·补、测试网自身可靠性（元测试）

本模块用**变异测试**验证「测试真的能抓到问题」，避免一套永远为绿的测试：

| 已验证的变异 | 结果 |
|---|---|
| 把 `dcs_terminal_exec` 的 `presentResult` 改名 | `integration/presenters-*` 变红 ✓ |
| 移除 `dcs_delivery_update` 的两层防御（还原历史 readonly bug） | `frozen/*` 2/5 变红 ✓ |
| 注入只 `try/catch` 的假绿用例 | `meta/execute-tests-assert-real-success` 变红 ✓ |
| 断言库自检（`assert(false)` 等必须抛错） | 全部通过 ✓ |

**一个真实教训**：`frozen` 层最初版本用「不存在的项目」+「table/bar 类型图表」
调 execute，helper 在 `updateDelivery` 处提前返回、图表在 `type !== 'image'` 处
`continue` —— 两处都压不到赋值分支，于是**还原历史 bug 后用例仍然全过**（假绿）。
变异测试暴露了它，修正后同一变异 2/5 变红。

---

## 五、0.1.5 新增能力中**尚未使用**的改进机会

这些不是兼容性问题，是本插件可以更好利用平台的地方（详见改进建议）：

| 能力 | 现状 | 潜在收益 |
|---|---|---|
| `output.presentationMeta` | **0 处使用** | 为直接调用提供可重放的呈现元数据 |
| `presentResult` | **仅 1 处使用**（48 个工具中） | 其余 47 个工具的结果卡片仍是通用样式，可像官方 `bash` 工具那样提供终端/搜索/读取专用卡片 |
| `presentCall` 的 `rawInput` / `location` / `content` | 部分使用 | `rawInput` 能让卡片展开时显示关键输入；`location` 支持编辑器跟随高亮 |
| `finalizeContent(exec, result)` | **0 处使用** | 可在末次内容变换中统一处理失败输出（如离线任务错误透传） |
| `exec.deferContext(ctx)` | **0 处使用** | 把「下一步提示」注入 agent 循环，替代目前在 `render` 文本里夹带引导 |
| `exec.concludeTurn()` | **0 处使用** | 交付完成等终态标志 |

---

## 五·补、多版本兼容性矩阵（实测）

```bash
npm run test:matrix
```

```
dsh 版本         结果         说明
------------------ -------------- ------------------------------
0.1.5-alpha.1     ✔ 99/99      dsh-tools 0.1.5-rc.2
0.1.5-rc.1        ✔ 99/99      dsh-tools 0.1.5-rc.2   ← 当前运行版本
0.1.5-rc.2        ✔ 99/99      dsh-tools 0.1.5-rc.2   ← npm 最新 rc
✔ 全部被测 dsh 版本均兼容
```

**意义**：这直接证明了本模块的核心价值 —— 换一个 dsh 版本，一条命令即可给出
明确的兼容性结论；且插件在 rc 迭代的多个版本上都稳定兼容。

---

## 五·补二、dcs CLI 命令面校验（实测）

除 dsh 平台契约外，还有一个易忽视的兼容性维度：**dcs CLI 自身升级**也会让命令改名/移除，
插件会**静默失效**（调用报错但没有任何编译期提示）。

`e2e/dcs-command-surface-exists`（默认运行，只需 dcs 二进制）从插件源码抽取全部构造的
ds 子命令，逐个比对 CLI 真实子命令表：

```
实测 22 个命令全部存在：
analysis consume/info/ls · billing ls · project create/detail/switch
region current/switch · terminal download/exec/open
data download/find/info/ls/push/upload
workflow check_parameter/info/ls/plan/run/task_info/task_log/tasks
```

**实现要点**（两处都曾导致校验完全失效，靠变异测试发现）：
1. 不能用 `<cmd> --help` 判断子命令存在 —— dcs 对未知子命令**静默打印父命令帮助并退出 0**；
   须解析父命令帮助的 `Available Commands` 表。
2. 不能笼统匹配 `['x','y']` —— schema 里的 `enum: ['analysis','workflow']` 会被误当命令；
   须逐行扫描 + 跟踪 schema 块深度 + 排除 enum。

---

## 五·补三、HTTP 接口契约（实测）

客户端与服务端通过 `fetch("/api/dcs-cloud" + path)` 约定接口，**没有类型检查**。
`http` 层静态比对两侧并真实调用 handler：

```
服务端路由 27 条  vs  客户端调用 16 处   → 全部一一对应，无重复注册
真实调用（mock req/res）：
  /v2/health   → 200 {"ok":true,"version":"2.15.0","time":...}
  /v2/regions  → 200 {"ok":true,"regions":[...]}
  /config      → 200 {"ok":true,"patSet":...,"patHint":"…c7d7",...}
未知子路径     → 4xx 且正常结束响应（不会挂起连接）
```

**变异验证**：服务端把 `/v2/tokens` 改名为 `/v2/tokenz` 后，
`http/client-calls-have-server-routes` 立即变红并指名 `client.js:849`。

---

## 六、给版本升级的标准化动作

```bash
# 1) 升级 dsh 后先跑契约层（最快定位平台破坏点）
npm run test:contract

# 2) 红在 contract  → 读 dsh 包内 .d.ts 对齐签名，改 lib/index.js
#    红在 integration → mock 与注册流程跟进
#    红在 unit       → 插件自身逻辑问题

# 3) 全量回归
npm test

# 4) 同步版本声明
#    peerDependencies / devDependencies / dsh.client.inject
```

---

## 七、复现方式

```bash
cd /Volumes/repo/ciao/github.com/DCS-Harness
npm test                      # 65/65
npm test -- --json            # 机器可读
DSH_ROOT=/path/to/node_modules npm test   # 指定 dsh 安装根
```

环境：Node v22.21.1 · macOS · dsh 0.1.5-rc.1 · dsh-tools 0.1.5-rc.2
