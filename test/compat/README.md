# dsh 兼容性测试模块（test/compat）

面向 **dsh 平台版本升级**的回归测试网。一条命令给出「插件是否还兼容当前 dsh」的明确结论。

```bash
node test/compat/run.mjs                 # 全量（65 例，约 0.2s）
node test/compat/run.mjs -l contract     # 只跑平台契约层
node test/compat/run.mjs -k defineTool   # 关键词过滤
node test/compat/run.mjs --json          # 机器可读报告（CI 用）
node test/compat/run.mjs --bail          # 首个失败即停
DSH_ROOT=/path/to/node_modules node test/compat/run.mjs   # 指定 dsh 安装根
```

零依赖、零构建，只用 Node 内置模块，**不需要安装任何东西**。

## 为什么需要它

本插件深度耦合 dsh 平台的私有 API 面：`defineTool` 的 schema DSL、`tools.register`、
`systemPrompt.section`、`webServer.register(WebRoute)`、客户端 `__ModuleLoader__` 信封与
slot 契约。dsh 处于 `0.1.x-rc` 快速迭代期，这些契约随时可能变动；而插件的
`peerDependencies` 可能滞后于实际运行的 dsh —— **版本错位是静默的**。

本模块把「插件依赖的每一个平台契约」都变成可执行断言，升级 dsh 后重跑即可定位破坏点。

## 四层结构

| 层 | 例数 | 回答什么问题 | 依赖 dsh |
|---|---|---|---|
| `unit` | 19 | 插件自身纯逻辑对不对（atlas/audit/plan/report/tasks/projects/dcs-client） | 否 |
| `contract` | 15 | 插件消费的**平台契约**还在不在、签名对不对 | 是 |
| `integration` | 11 | 插件能否真的装载进去、工具全注册、渲染不崩 | 是 |
| `lifecycle` | 20 | 配置/任务库/项目库的读写、权限、幂等、版本递增 | 部分 |

分层价值：**失败位置直接指向根因**。`unit` 红 = 插件自身 bug；`contract` 红 = dsh 平台变了；
`integration` 红 = 装载/注册环节被破坏；`lifecycle` 红 = 本地状态管理回归。

## 关键设计

### 1. 契约以「运行时 API + 类型定义」为准，不靠猜
`contract` 层直接 `import` 真实的 `@deepseek-ai/dsh-tools`，调用
`parameterSchemaSpecToJsonSchema` / `valueSchemaSpecToJsonSchema` 验证插件使用的每一种
schema 写法仍被接受；并读取 dsh 包内的 `.d.ts` 与源码文本校验 slot 存在性。

### 2. 测试替身必须与真实契约同步
`integration` 层的 mock 宿主（`webServer.register` / `systemPrompt.section` / `tools.register`）
按 0.1.5 的**真实签名**实现，并主动抛错拒绝非法调用。这样 mock 本身也参与版本匹配 ——
避免「mock 太宽松导致假绿」。

### 3. 版本漂移自检
`contract/platform/dsh-tools-version` 比对实际 dsh-tools 版本与 `peerDependencies` 声明的主次版本线，
版本线不一致直接失败，逼出 `peerDependencies` 的更新。

### 4. 声明覆盖面（slot ↔ inject 一致性）
`lifecycle/platform/client-inject-covers-slots` 自动解析 `lib/client.js` 用到的 slot，
反查其提供方包是否都在 `package.json` 的 `dsh.client.inject` 里。dsh 对该字段的缺失项是
**静默跳过**的，只靠肉眼审查发现不了。

### 5. 安全规则用「危险集 + 安全集」双向断言
`unit/audit/flags-dangerous-rm` 同时要求危险命令全命中、安全命令零误报，
避免「正则改宽了乱报警」或「改窄了漏检」这类单边修复。

## 已捕获的真实缺陷

建这套测试的过程中抓到并修复了 2 个**与 dsh 版本无关的既有缺陷**：

1. **`lib/audit.js` 漏检最危险的删除命令**（安全影响）
   `\b` 在 `/`、`~` 之后不是有效边界，导致 `rm -rf /`、`rm -rf ~`、`rm -rf / ` **全部漏报**；
   同时 `rm -f /tmp/x`（无 `-r`）被误报 critical，造成告警疲劳。
   修复：改用「行尾/空白/分隔符」边界 + 强制要求递归标志。现危险集 9/9 命中、安全集 6/6 无误报。

2. **`package.json` 的 `dsh.client.inject` 引用了不存在的包**
   原值 `@deepseek-ai/dsh-client-runtime` 在 dsh 0.1.5-rc 中不存在（官方 63 个客户端包无一引用该名）。
   dsh 对 inject 缺失项静默跳过 → 客户端半的装载顺序失去保障，界面可能加载不出来。
   修复：改为声明真实的 slot 提供方 `ui-renderer`（slots 服务）/ `ui-conversation`（conversation.view）/
   `ui-settings-general`（settings.section）/ `ui-sidebar`（sidebar.brand.*）。

## 升级 dsh 后的标准流程

```bash
# 1. 跑一遍，看红在哪一层
node test/compat/run.mjs

# 2. contract 红 → 平台契约变了，读 dsh 的 .d.ts 对齐
#    integration 红 → mock 或注册流程要跟进
#    unit 红 → 插件自身逻辑问题
node test/compat/run.mjs -l contract

# 3. 更新 peerDependencies 与 dsh.client.inject（若有变动）
# 4. 全绿后提交
```

## 环境变量

| 变量 | 说明 |
|---|---|
| `DSH_ROOT` | 指定 dsh 安装根（含 `@deepseek-ai/dsh`）。缺省自动探测：`command -v dsh` → realpath → 上溯。 |
| `DSH_BIN` | 指定 dsh 可执行文件名（默认 `dsh`）。 |

自动探测兼容两种布局：npm 全局（`<root>/@deepseek-ai/*`）与 dsh bundle（`<root>/@deepseek-ai/dsh/node_modules/@deepseek-ai/*`）。

## 新增用例

在 `test/compat/cases/` 下加 `NN-<layer>.mjs`，导入 `test` 注册：

```js
import { test, assert, assertEqual, assertIncludes, ROOT } from '../lib/harness.mjs';

test('contract', 'my/check', '这个契约还成立', async () => {
  assert(true, '失败信息');
});
```

可用断言：`assert` / `assertEqual` / `assertIncludes` / `assertThrows` / `assertNoThrow`。
文件名前缀决定执行顺序（`05-` `10-` `20-` `30-`）。
