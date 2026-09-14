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
| `integration` | 13 | 插件能否真的装载进去、工具全注册、渲染/呈现不崩 | 是 |
| `lifecycle` | 20 | 配置/任务库/项目库的读写、权限、幂等、版本递增 | 部分 |
| `meta` | 8 | **测试自身会不会空转**（断言/运行器/守卫阈值/覆盖完整性） | 是 |
| `upgrade` | 8 | 会话格式迁移链：旧版本可迁移、新版本明确拒绝、损坏可诊断 | 是 |
| `frozen` | 5 | 冻结参数不可变性：工具不得原地修改入参（历史 bug 防复发） | 是 |

合计 **93 例**。

分层价值：**失败位置直接指向根因**。`unit` 红 = 插件自身 bug；`contract` 红 = dsh 平台变了；
`integration` 红 = 装载/注册环节被破坏；`lifecycle` 红 = 本地状态管理回归；
`meta` 红 = 测试网本身失效（比功能红更危险，必须优先修）。

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

### 6. 升级演练：会话格式迁移链
`upgrade` 层验证 dsh 的 `sessionFormatCatalog`，覆盖升级/降级两个方向：
- 迁移包成链（v0→v1→v2→…，不跳步、不断裂）；
- **旧版本**必须可迁移（不得判 `unsupported`，那是「比本 build 新」的专用状态）；
- **更新版本**（用户降级 dsh）必须明确 `unsupported` + 可读原因，
  绝不能静默按旧格式解析 —— 那会污染数据；
- 损坏的头给出**具体缺失字段**（可诊断，而非笼统报错）；
- 反向检查插件未绕过平台服务直接读 `.jsonl`（否则格式一变就静默错读）。

### 7. 冻结输入：参数不可变性
dsh 的 ToolRuntime 会对 `exec.arguments` 做 deepFreeze。历史 bug：
`dcs_delivery_update` 对图表对象原地赋值，抛出
`Cannot assign to read only property 'data'`，导致交付提交失败。
`frozen` 层用**真实项目的真实 image 文件**压到赋值分支（见下方教训），
并断言 `res.ok === true` —— 若为 false 会直接报「属假绿」。

> **一个值得记录的教训**：本层最初版本用「不存在的项目」+「table/bar 类型图表」
> 调 execute，结果 helper 在 `updateDelivery` 处提前返回、图表在
> `type !== 'image'` 处 `continue`，两处都压不到赋值分支 ——
> **还原历史 bug 后用例仍然全过**。变异测试暴露了这个假绿。
> 现已在 `meta/execute-tests-assert-real-success` 里用**逐用例**静态检查
> 防止同类问题：凡调用 `.execute(` 的用例，必须断言成功态或明确声明为负向用例。

### 8. 元测试：防止测试网自身空转
`meta` 层用**变异测试**证明关键断言真的能抓到违规：
- 断言库自检：`assert(false)` / `assertEqual(1,2)` / `assertIncludes('abc','zzz')` 必须抛错；
- 运行器自检：注册一个刻意失败的用例，确认运行器判为 `failed` 且保留失败原因；
- 守卫阈值自检：确认 `load/tool-count` 的 `>=40` 阈值在正常情况可满足
  （阈值虚高会让用例永远红、虚低则抓不到大面积注册失败）；
- 平台断言自检：确认 `assertSupportedJsonSchema` 既接受合法也不放行非法 schema。

另有 `integration/load/presenters-consistent`：`terminal`/`diff` 卡必须配对 `presentResult`，
否则会出现「执行中美观、完成后塌成纯文本」的体验断裂。

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

## 多版本兼容性矩阵

```bash
bash test/compat/matrix.sh          # 或 npm run test:matrix
```

对多个已安装的 dsh 版本分别跑全量测试，一次给出兼容性结论：

```
dsh 版本         结果         说明
------------------ -------------- ------------------------------
0.1.5-alpha.1     ✔ 99/99      dsh-tools 0.1.5-rc.2
0.1.5-rc.1        ✔ 99/99      dsh-tools 0.1.5-rc.2
0.1.5-rc.2        ✔ 99/99      dsh-tools 0.1.5-rc.2
✔ 全部被测 dsh 版本均兼容
```

**准备多个版本**（脚本不自动安装，避免副作用）：

```bash
mkdir -p /tmp/dsh-rc2 && cd /tmp/dsh-rc2 && npm init -y
npm i @deepseek-ai/dsh@0.1.5-rc.2
DSH_ROOTS=/tmp/dsh-rc2/node_modules bash test/compat/matrix.sh
```

**当前实测结论**：`dsh-dcs-cloud` v2.16.0 在 **0.1.5-alpha.1 / 0.1.5-rc.1 / 0.1.5-rc.2**
三个版本上均 **99/99 通过**。

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
