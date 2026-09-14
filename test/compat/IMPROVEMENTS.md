# DCS-Harness 改进建议（基于 dsh 0.1.5-rc 兼容性审查）

本文件记录在兼容性审查过程中发现的、**超出单纯版本兼容**的改进机会。
按「风险 / 收益」排序，每条给出具体证据与落地方式。

---

## P0 — 安全性：已修复但值得系统性加固

### 1. ✅（已修）脚本审计的危险删除规则

`lib/audit.js` 的 `rm -rf` 检测因 `\b` 边界误用而漏检 `rm -rf /`、`rm -rf ~`，
同时误报 `rm -f`（无递归）。已修复并加双向断言（危险集 9/9 命中、安全集 6/6 无误报）。

**已继续加固** ✅ —— 原先 7 类破坏性操作**完全漏检**，现已全部补齐：

| 盲区 | 例子 | 现分级 |
|---|---|---|
| 通配符叠加根路径 | `rm -rf /*` | critical |
| 上级目录 | `rm -rf ..` | critical |
| 变量间接 | `rm -rf $VAR`（变量本身即目标） | high |
| xargs 转发 | `echo x \| xargs rm -rf` | high |
| find 直接删除 | `find / -delete` | high |
| dd 写裸设备（无 `if`） | `dd of=/dev/sda` | critical |
| 重定向覆盖系统文件 | `> /etc/passwd` | critical |

同时把**绝对路径删除按危险度分级**，兼顾安全与可用性：

```
rm -rf /                      → critical（根目录）
rm -rf /data|/work|/Files|... → high    （挂载/工作区）
rm -rf /tmp/x                 → medium  （临时目录）
```

并**消除误报**（误报会造成告警疲劳，最终让人忽略真正的 critical，与安全目标相悖）：
`rm -rf $WORKDIR/tmp`、`$WORKDIR/$SAMPLE/tmp` 等生信脚本常规清理不再报 high
（仅当变量**单独构成**删除目标时才告警）。11 个真实生信脚本写法零 critical/high 误报。

**仍建议**：引入「审计结论字段」——出现任一 `critical` 时，`dcs_audit_script`
应明确返回「不建议执行」的结构化结论，而不是只列 findings 让调用方自己判断。

### 2. 命令注入面：`terminal_exec` 的 shell 拼接

`dcs_terminal_exec` 把用户命令直接拼进 `-c`。虽然这是工具的本意，但
`lib/index.js` 中有多处用字符串拼接构造命令（如把路径拼进 `catInContainer`）。
建议对路径类插值做 shell 转义（`'...'` 单引号包裹 + 内部引号转义），
避免路径含空格/引号时命令被截断或注入。

---

## P1 — 平台能力未充分利用（0.1.5 已支持）

### 3. `presentResult` 覆盖不足（48 个工具仅 1 个使用）

现状：12 个工具有 `presentCall`（待执行卡），但只有 `dcs_terminal_exec` 配了
`presentResult`（完成卡）。11 个工具在完成后会从「精美卡片」塌回纯文本。

**已做** ✅：
- 核实 dsh 契约后确认：`generic` 卡省略 `presentResult` 时，
  平台会**保留待执行卡片标题 + 渲染原始结果内容** —— 属可接受的渐进增强，
  不是缺陷。故未强行给 11 个工具塞 presenter（避免无谓改动）。
- 强制 `terminal`/`diff` 卡配对（`integration/load/presenters-consistent`）。
- 补齐 `exitCode` 徽章：原注释声称「完成后带 stdout+退出码」，
  但 `presentResult` 从未设置 `exitCode`。现已从渲染文本还原退出码并露出，
  同时 `cliView` 增加结构化 `exit_code` 字段（详见第 15 条）。
- 新增 `load/presenters-soft-validate`：presenter 对非法参数必须返回
  `undefined` 而非抛错（dsh 会先软校验）。

**建议继续**：为高频检索类工具补 `presentResult`，用 `card:'generic'` 的
`title`/`content` 重新组织完成态展示：

- `dcs_data_ls` / `dcs_container_ls` / `dcs_data_find`：完成态显示「N 个条目」摘要 + 文件列表
- `dcs_task_status`：完成态显示状态徽章（running/done/failed）+ 费用
- `dcs_public_search`：完成态按 `resType` 分组

收益：卡片信息密度提升，用户不必展开原始文本。

### 4. `presentationMeta` 完全未使用（0 处）

dsh 0.1.5 的 `output.presentationMeta(args, value)` 提供**纯可重放**的呈现元数据
（`JsonValue`，不参与模型输入）。适合：

- 把「任务 ID / 项目 ID / 图表路径」等结构化信息交给客户端做二次渲染
- 让「项目管理」「结果交付」窗口直接从卡片元数据取数，而不是再发一次 HTTP 请求

建议优先给 `dcs_offline_run` / `dcs_workflow_run` / `dcs_project_update` 加，
返回 `{ taskIds, projectId, costs }` 之类的轻量元数据。

### 5. `presentCall` 的高级字段未用满

`GenericCallView` 支持 `rawInput` / `content` / `location`，插件只用了 `title`/`kind`：

- `rawInput`：卡片展开时显示关键输入（如离线任务的 `command`、资源规格）
- `location`：**文件跟随** —— `dcs_terminal_file` 读写容器文件时声明 `{ path }`，
  编辑器可高亮/跳转。这是 0.1.5 明确支持的「follow along」能力，对生信场景（大量文件操作）价值高

### 6. `exec.deferContext(ctx)` 未使用

目前插件在 `render` 文本里夹带「下一步该做什么」的引导（如计划批准后提示）。
`deferContext` 能把这些作为**系统上下文**注入 agent 循环，比塞在工具输出里更规范、
不会被文本截断影响。建议用于：

- 计划批准后注入「按模块顺序执行」的执行约束
- 离线任务投递后注入「用 dcs_task_ids 登记」的提醒

### 7. `exec.concludeTurn()` 未使用

交付完成、项目收尾等「终态」工具可标记 `concludeTurn()`，让 agent 循环
明确知道本轮目标已达成，避免多余的后续动作。

### 8. `finalizeContent(exec, result)` 未使用

适合统一处理失败输出。当前每个工具各自 `catch` 后拼错误文本（48 处重复模式），
可用 `finalizeContent` 在末次内容变换中统一：

```js
finalizeContent(exec, result) {
  if (!result.isError) return undefined;
  return [{ type: 'text', text: '❌ DCS 调用失败：' + extractMessage(result) }];
}
```

收益：错误展示一致，且能覆盖「参数校验失败」这类不经 `execute` 的路径。

---

## P2 — 版本与依赖治理

### 9. peerDependencies / devDependencies 滞后

```
实际运行 dsh-tools : 0.1.5-rc.2
peerDependencies   : ^0.1.1-rc.2   ← 滞后
devDependencies    : 0.1.1-rc.2    ← 滞后
```

**风险**：本地开发装的是旧版，开发环境比生产环境旧，未来的平台变更
在本地无法提前发现。

**建议**：
1. 提升到 `^0.1.5-rc.2`；
2. 在 `package.json` 增加 `dsh.compat` 字段声明已测版本，供测试模块比对：

```json
"dsh": {
  "compat": { "tested": "0.1.5-rc.1", "min": "0.1.1-rc.2" }
}
```

3. 测试模块已内置版本线守卫（`contract/platform/dsh-tools-version`），
   dsh 进入 0.2.x 会立即红灯。

### 10. ✅（已修）`dsh.client.inject` 引用了不存在的包

原值 `@deepseek-ai/dsh-client-runtime` 在 0.1.5-rc 中不存在，且 dsh 对 inject
缺失项**静默跳过**，导致客户端装载顺序无保障。已改为真实提供方，
并新增 `client-inject-covers-slots` 自动守护。

**建议继续**：把「slot → 提供方包」映射抽成可复用常量
（`test/compat/cases/30-lifecycle.mjs` 里目前是测试内联表），
未来新增 slot 使用时能在测试里被提示。

---

## P3 — 工程化与流程

### 11. CI 接入

当前无 CI 配置。建议新增 `.github/workflows/compat.yml`：

```yaml
name: dsh 兼容性
on: [push, pull_request, schedule]   # schedule 用于捕获 dsh 上游新版本
jobs:
  compat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      # 装真实 dsh（而非项目内旧的 devDep），确保测的是运行时版本
      - run: npm i -g @deepseek-ai/dsh@latest
      - run: npm test
```

**关键点**：CI 必须装**真实 dsh**，否则测的是 devDependency 里的旧版本。
配合 `schedule` 定时跑，可在 dsh 发新版时第一时间发现破坏。

### 12. 用 dsh 的 session-format 迁移链做升级演练

dsh 0.1.5 提供 `v0-to-v1` / `v1-to-v2` / `v2-to-v3` 迁移链。建议在测试里
构造真实的历史会话文件，验证插件在迁移后的会话上仍能读取
（`ctx.get('sessionPersistence')`）。当前 `lifecycle` 层只验证了迁移包存在。

### 13. `lib/index.js` 单文件 4707 行

48 个工具 + 全部 helper 挤在一个文件里，`client.js` 也有 2479 行。
**建议拆分**（低风险、纯搬运）：

```
lib/
  index.js        # 插件入口：apply / inject / name
  tools/
    data.js       # dcs_data_* / dcs_table_*
    task.js       # dcs_offline_run / dcs_parallel_run / dcs_task_*
    workflow.js   # dcs_wdl_* / dcs_workflow_*
    project.js    # dcs_project_* / dcs_module_* / dcs_run_* / dcs_delivery_*
    skill.js      # dcs_skills_* / dcs_expert_* / dcs_skill_route
    llm.js        # dcs_llm / dcs_task_delegate / dcs_module_consult
```

收益：可维护性、review 粒度、按模块跑测试。测试模块的 `load/*` 用例天然兼容拆分
（它们只关心最终注册了哪些工具）。

### 14. ✅（已修）共享 helper 增字段导致消费方 schema 拒绝

**问题**：`cliView` 是 2 个工具（`dcs_terminal_exec` / `dcs_task_status`）共享的
结果构造 helper。给它增加 `exit_code` 字段后，`dcs_task_status` 的
output schema 是 `additionalProperties: false` 且未声明该字段 —— **平台会拒绝该结果**。

**修复**：为 `dcs_task_status` 补声明 `exit_code`；并新增守卫
`integration/load/cli-view-fields-declared`：

- 解析 `cliView` 实际返回的字段（支持 `key: value` 与 ES6 简写 `key,`）
- 按工具切分源码，凡**直接** `return cliView(...)` 且 schema 为
  `additionalProperties: false` 的工具，必须声明全部字段
- **关键实现细节**：必须扫源码而非 `t.execute.toString()` ——
  `defineTool` 会把用户 `execute` 包一层（`return userExecute(args, exec)`），
  包装后完全看不到 `cliView`。初版守卫因此**完全失效**，经变异测试才发现。

**教训**：这类「共享 helper 增字段、消费方 schema 未跟上」的问题，
静态扫描 + 变异验证缺一不可。

### 15. `tokens:` 与成本可视化

`dcs_task_status` 已能取费用。建议把「本轮会话总费用」聚合到交付文档，
并在离线任务完成后用 `deferContext` 提示预估费用。

---

## 附：本次已落地的改动

| 文件 | 改动 |
|---|---|
| `lib/audit.js` | 修复危险删除规则漏检（`rm -rf /`、`~`、`/ `）+ 误报（`rm -f`） |
| `package.json` | 修正 `dsh.client.inject`；新增 `test` 系列 npm scripts |
| `test/compat/**` | 新增 75 例兼容性测试模块（5 层 + 元测试） |
| `test/compat/README.md` | 测试模块使用与设计文档 |
| `test/compat/COMPATIBILITY-REPORT.md` | 兼容性测试报告 |
| `IMPROVEMENTS.md`（本文件） | 改进建议 |
