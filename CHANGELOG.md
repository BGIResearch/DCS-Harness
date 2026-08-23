# Changelog

本项目的所有显著变更记录于此。版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [2.6.1] - 2026-08-23

### 变更：技能 API key 配置管理 + Genos / Genos‑VEP 集成

- **API key 统一管理**：在 DCS 配置（`~/.dsh/dcs-cloud.json`）新增 `apiKeys` 字段。`dcs-client.js` DEFAULT_CFG 加入 `apiKeys: {}`。
- **`dcs_configure` 增强**：接受 `api_keys` 参数（JSON 对象），可批量设置技能 API key（如 `{"genos_vep":"sk-..."}`）。
- **新增工具 `dcs_api_key`**：支持 set / get / list / delete 操作，管理技能 API key。key 持久化于 `dcs-cloud.json`（600 权限）。
- **`atlas.js` 新增 `API_KEY_SKILLS`**：记录已知需 key 的技能（genos_vep / genos_mutation / genos），每个含 envVar、label、desc、apiUrl、关联 skill 路径。
- **自动注入**：`getApiKey(name)` / `skillEnvVars(name)` 辅助函数从配置读取 key；调用 Genos‑VEP 等技能时自动注入 `HG38_VCF_PREDICT_API_KEY`。
- **systemPrompt 更新**：step 0.5 增加「技能 API key 管理」说明，首次使用前提示用户从 DCS Cloud 申请。
- 实测 Genos‑VEP 完整预测（NIPBL 基因 × HG00128.vcf.gz，7 窗口，产出 448 条 logFC 记录 + 231 张三轨图），API key 验证通过。

## [2.6.0] - 2026-08-23

### 变更：默认引擎 = DCS Genpilot + 原生 skill / 专家支持 + 一次使用=一个 Genpilot 项目

- **默认引擎 = DCS Genpilot**（systemPrompt 强化）：明确「你（dsh）是使用科学家导师，只做方案设计与结果把关；一切分析计算默认交由 DCS Genpilot 智能交互执行（在线容器 / 离线并行 / Genpilot LLM），不自上而下手写整套分析代码」。
- **一次使用 = 一个 Genpilot 项目**：新增 `dcs_project_create` 工具，在 genpilot 创建真实项目（`dcs project create`，`billing_group` 缺省自动取 `dcs billing ls` 的第一个授权计费组），返回项目 code；systemPrompt 立项步骤改为「先 dcs_project_create → 再 dcs_project_update 登记」。
- **DCS 原生 skill 读取**：新增 `dcs_skills_list`（按 category/keyword/native 检索 /public/skills 技能库，读取 skills_snapshot.json 973 条）与 `dcs_skill_read`（读 SKILL.md / README.md / AGENTS.md）。
- **专家（专家库）读取**：新增 `dcs_experts_list`（列出 /public/skills/experts 的专家：scrna-seq-expert / stereo-seq-expert / wgs-wes-germline-expert / cima-expert / hcc-multiomics-pathology-expert）与 `dcs_expert_read`（读取 AGENTS.md + SOUL.md + 子技能清单）。
- **atlas 扩充**：`dcs_atlas` 新增 `skills` section（原生技能库 / 专家库一览）；`atlas.js` 新增 `SKILLS_BASE / SKILLS_SNAPSHOT / EXPERT_BASE / SKILL_TOP_DIRS / EXPERTS / skillsHints`。
- **systemPrompt 优化**：立项后增加「0.5 优先复用 DCS 原生 skill / 专家」步骤（先 dcs_skills_list → dcs_skill_read；需要方向专家用 dcs_experts_list → dcs_expert_read），把专家思路/模板融入方案与产出。
- 说明：skill / 专家读取均经在线容器（`terminal exec`）访问 `/public/skills`，无需额外鉴权；`dcs_project_create` 会真实创建 DCS 项目并从计费组扣费，应由用户确认后再调用。

## [2.5.3] - 2026-08-22

### 变更：数据提交改为「任务互动中主动询问」，移除静态表单

- **移除项目管理窗口的「核心数据输入」静态表单**：数据收集不应靠用户手动填表，改为在对话交互中由 agent 主动引导。
- **systemPrompt 首步强化**：立项后**第一时间用 ask_user_question 主动询问用户是否提供自有数据**（本地路径/容器 /work/.../链接/公共库编号，不限类型，附每份数据用途描述），用户给出后用 `customData.items` 登记（`{path, desc}`）；无自有数据则说明将优先用 DCS 公共库 /public 数据。**数据确认是规划第一步，不跳过**。
- **项目管理窗口改为只读展示「自有数据来源」**：显示 agent 在对话中登记的数据地址与描述（不可编辑），供用户参考。
- 保留 `customData.items` 数据模型 + `dcs_project_update` 支持（兼容旧 genomes/annotations/other）。

## [2.5.2] - 2026-08-22

### 变更：核心数据输入改为自由提交（不限类型）

- **前端「核心数据输入」改造**：去掉「基因组/注释/其他」三个类型分栏，改为**单一自由文本域**——每行一条数据地址（本地路径/容器 /work/.../链接），可带描述（格式 `地址` 或 `地址 描述`，TAB 或空格分隔），另有整体说明框。
- **数据模型**：`customData.items`（数组，每项 `{path, desc}`）+ `note`；兼容旧 `genomes/annotations/other` 字段（`buildItemsFromLegacy` 自动合并）。
- **host `dcs_project_update`**：`customData` schema 改为 `items`（自由 {path, desc}）+ `note`，不再限制类型。
- **解析/回填**：保存时按行解析（TAB 优先，空格兜底）；切换项目时回填（TAB 分隔避免描述含空格被拆错）。
- 验证：自由输入解析、空格描述、纯路径、旧数据合并均正确。

## [2.5.1] - 2026-08-22

### 修复：图片交付本地化（不再依赖 DCS 远程容器在线）

- **新增 `downloadContainerFile`（index.js）**：容器图片下载到本机持久交付目录 `~/.dsh/dcs-img-cache/`，交付文档与图片文件本地化。
- **修复 `dcs_delivery_update` 调用未定义函数的崩溃**：此前 image 图表处理调用了 `downloadContainerFile`（只在 report.js 定义），导致交付 image 图时必然抛 `ReferenceError`。现已在 index.js 定义并正确调用。
- **图片交付改为存本地绝对路径**（而非 base64 塞进 dcs-projects.json）：`dcs_delivery_update` 把容器/远程图片下载到本机交付目录，charts 里 image 数据存**本地绝对路径**，避免 JSON 膨胀。
- **前端 `MediaImage` 统一走 `/v2/chart-image`**：base64/http 直接显示，容器路径或本机绝对路径都经该接口读本机文件——容器路径仅在本地无缓存时下载一次，之后即本地化、离线可用。
- **`/v2/chart-image`、`/v2/delivery-images` 统一用本地交付目录**：优先读本机文件，容器路径本地无缓存才触发下载。
- **目录统一**：report.js 与 index.js 共用 `dcs-img-cache`，且本地文件名算法（`img-<sha1前16>.<ext>`）完全一致，报告与交付窗口引用同一本地文件，无重复下载。
- systemPrompt 引导更新：image 传容器路径即可，插件自动本地化，无需手动处理 base64。

## [2.5.0] - 2026-08-22

### 修复：进程内并发写互斥（多会话安全）

- **projects.js / tasks.js 读写加进程内互斥锁**：新增 `withProjectLock` / `withTaskLock`（Promise 链互斥），把所有写操作（`upsertProject`/`mergeProject`/`upsertModule`/`startRun`/`updateRun`/`updateDelivery`/`deleteProject`/`upsertTask`/`updateStepStatus`/`mergeTask`）的"读-改-写"序列整体串行化。
- **目的**：多个 dsh 会话并发写同一 `~/.dsh/dcs-projects.json` / `dcs-cloud-tasks.json` 时，避免后写覆盖先写导致的数据丢失。
- **改造**：写函数由同步改为 `async`，并同步更新 `lib/index.js` 中全部调用点为 `await`（含 `/api/dcs-cloud/tasks` 路由的非 async 回调改为 async）。
- 验证：并发写串行化逻辑单元测试通过（前一个写完整读-改-写后才执行下一个）。

## [2.4.0] - 2026-08-22## [2.4.0] - 2026-08-22

### 新增：项目管理协同 + 规划式工作流（Phase 3）

- **规划式工作流重塑**（systemPrompt）：用户输入问题后，① 先用 `web_search`/子代理做**学术检索**了解背景 → ② `dcs_atlas`/`dcs_container_ls`/`dcs_public_search` 摸清**可用数据资源与可复用流程** → ③ 用 `dcs_plan_update` 产出**分析计划**（`planStatus=awaiting_review`）→ ④ `ask_user_question` 与用户**互动修改计划**直至批准 → 才开始执行。杜绝"一上来就直接开跑"。
- **新工具 `dcs_plan_update`**：更新分析计划 + 里程碑质检清单，管理计划互动状态（drafting/awaiting_review/approved）。
- **新接口 `GET /v2/project-overview`**：里程碑质检 + 分片任务进度聚合 + 任务状态/费用汇总（供项目管理窗口）。
- **`/v2/regions` 增加 `hint` 节点联动提示**：展示当前节点片区特色 + 公共库查找优先级。
- **核心数据输入（项目管理窗口）**：提供"基因组/注释/其他"三类数据路径输入框（每行一个，本机或容器路径），保存到 `customData`；留空则分析优先用 DCS 公共库 /public 数据（非必须）。
- **项目管理窗口新增区块**：节点联动提示、分析计划（含互动状态 badge + markdown 预览）、里程碑质检清单、分片任务进度聚合（进度条 + 完成/总数）。
- `projects.js` 项目模型扩展：`customData` / `plan` / `milestones` 三组字段（normProject + mergeProject 支持）。

## [2.3.0] - 2026-08-22

### 增强：健壮性 / 多模态交付体验

- **资源规格自动归一化**：`dcs_offline_run` / `dcs_parallel_run` 自动把 `4c 16g`、`8核32G`、`16g 4c` 等自然语言资源转换为 dcs 要求的 `vf=16g,num_proc=4` 格式（含已合法格式透传），降低 Agent 调参失败率。
- **容器错误码自动重连**：`termExec` 补齐 `83006/83007/83008/83013` 及"未就绪/未开/会话/超时"等文案识别，容器未就绪时自动 `terminal open` 后重试一次。
- **图片点击放大预览（Modal lightbox）**：`MediaImage` 点击图片弹出全屏大图查看（含图注，Esc/点击关闭）。
- **大数据集表格分页**：`DataTable` 组件，`table` 类型 `rows > 10` 自动客户端分页（« ‹ 第x/y页 › »），避免长表拖垮阅读。
- **图片下载并发去重**：`ensureImageCached` 内存 in-flight 去重，同一容器图片路径并发请求只下载一次，后续复用磁盘缓存。
- **离线任务引导**：systemPrompt 明确资源 "4c 16g" 或 "vf=32g,num_proc=8" 均可（插件自动转换）。

## [2.2.0] - 2026-08-22

### 变更：窗口整合 + 费用面板 + 交付图表（v2.2）

- **移除旧版「DCS 任务」tab**：删除 `DcsTaskView` 与 `statusClass`，离线任务/资源消耗信息并入项目管理窗口的「最近离线任务费用」区块。
- **「任务交互」并入「项目管理」**：删除 `TaskInteractView` 注册与代码，其项目概览（标题/目标/模块统计/token 消耗/模型/节点）合并进「项目管理」窗口顶部；`conversation.view` 现在只有「项目管理」「结果交付」两个 tab（+「对话」）。
- **费用与资源面板**：
  - 新增 host 路由 `GET /v2/billing`：项目余额（`project detail`）+ 最近 10 个离线任务的费用（`analysis info` 的 `amount`）、资源规格（`computing_name`）、镜像、状态；
  - `GET /v2/costs` 增强：`analysis info` 的 `amount` 优先，`analysis consume` 兜底，并返回 resource/image/status；
  - 项目管理窗口展示「项目余额 / 最近任务费用 / 离线任务数」与「最近离线任务费用」明细（5 秒轮询）。
- **交付图表（结果交付窗口）**：
  - 新增 host 路由 `GET /v2/delivery-images`：自动收集项目各 run `files.output` 里的 png/jpg（容器路径自动 `terminal download` 缓存），base64 返回；
  - 结果交付窗口自动展示分析图（`ChartView` 新增 `image` 类型），与交付文档 charts 一起呈现；
  - `dcs_generate_report` 的 figures 支持**容器路径**（`/work/...`、`/data/...` 等自动下载内嵌），修复「传容器图片路径导致报告图缺失」；
  - systemPrompt 强调：交付必须带 charts + 分析图登记到 run 的 files.output。
- **工具 schema 修复**：`cliView`/`execCli` 返回字段与工具 output schema 不一致（`exit_code`/`message`/`binary` 未被声明，`additionalProperties:false` 校验拒绝）导致 `dcs_terminal_exec`、`dcs_task_status`、`dcs_cli` 等 14 个工具调用崩溃——统一裁剪为 schema 声明字段，额外信息折叠进文本。
- `lib/report.js` 异步化：`generateReport` 改为 async（容器图片下载），新增 `downloadContainerFile`/`isContainerPath`。

## [2.1.0] - 2026-08-22

### 变更：默认 dsh 内嵌（v2.1），不再需要独立 profile / 独立页面

- **三个核心窗口改为默认 dsh 自动注册**：`任务交互 / 项目管理 / 结果交付` 随每个对话自动出现在 `conversation.view`，无需 `dcs-harness` 独立 profile、无需「启动 DCS Harness」按钮、不再弹出单独页面。旧版「DCS 任务」tab 保留（离线任务 / 资源消耗）。
- **移除独立页面启动器**：删除 host 侧 `launchHarness` / `waitForHarness` / `/api/dcs-cloud/launch` 路由与 client 设置页的「启动 DCS Harness」按钮及相关 UI；品牌接管仅保留在独立 profile（若仍手动使用）。
- **项目管理窗口新增「节点」下拉切换**：列出 DCS 11 个片区（节点），切换即 `dcs region switch <region>`，并把选择写入项目 `region` 字段持久化；「任务交互」窗口同步展示节点。新增 host 路由 `GET /v2/regions` 与 `POST /v2/region`。
- `lib/projects.js` 项目模型新增 `region` 字段（`normProject` / `mergeProject` 支持）。
- `scripts/install-harness-profile.sh` 改为安装到默认 dsh（web profile），不再创建独立 profile。
- systemPrompt 补充：模型与节点都可在「项目管理」窗口切换。

## [2.0.1] - 2026-08-20

### 修复

- **agent 工具调用崩溃（`Cannot read properties of undefined (reading 'prepare')`）**：根因是插件的 `@deepseek-ai/dsh-tools@0.1.0-rc.7` 依赖被 pnpm 装入 profile，与 dsh 内核的 `0.1.1-rc.2` 形成**双重模块实例**，导致 agent-loop 的 `TOOL_RUNTIME_SCHEDULER` Symbol 在 tools 服务上取不到。修复：插件改为 `peerDependencies`（版本对齐内核 `^0.1.1-rc.2`），并移除 profile 中独立安装的 dsh-tools，保证插件/工具服务/agent-loop 三者共享同一模块实例。
- 修复 `dcs_data_push` 等（保留）：`RunFiles`/`BarChart` 组件把 props 对象误当数据对象，导致文件清单与柱状图渲染为空。

## [2.0.0] - 2026-08-20

### 新增：DCS Harness 独立页面（v2.0）

- **独立 profile**（`dcs-harness`）：在独立网页中运行，内核仍为 dsh（dsh-base + dsh-web-app + 本插件），与常规 dsh 共享同一份 `~/.dsh`（会话/配置/任务数据）。安装脚本：`scripts/install-harness-profile.sh`。
- **一键启动**：常规 dsh「设置 → DCS Cloud」页新增「启动 DCS Harness」按钮 → 宿主 spawn `dsh --profile dcs-harness --port 3280` 并打开新页面（`POST /api/dcs-cloud/launch`，已运行则直接复用）。
- **三个核心窗口**（`conversation.view` tab 环，随对话更新，`对话`原样保留）：
  - **任务交互**：研究项目概览（目标/模型/状态）+ 任务分解与执行状态（模块级）+ 本会话 dsh token 消耗；
  - **项目管理**：模块卡片（状态/进度）+ **运行版本时间线**（每次重跑新增 v1/v2…，历史全部保留）+ 代码/输入/输出文件清单 + DCS 任务费用（`analysis consume`，60s 缓存）+ dsh token + **Genpilot 模型下拉切换**（默认 auto，持久化到项目）；
  - **结果交付**：论文式交付文档（8 章节：科学问题/假说/分解/数据/方法/发现与结论/创新性/下一步），关键节点整体梳理（revision 递增），支持 bar/summary/html 图表。
- **品牌**：harness profile 禁用官方品牌行，插件接管侧边栏品牌（"DCS Harness"）；该行缺失同时作为 harness 模式标记（client 通过 `__DSH_BOOT__` 检测）。
- **新数据模型** `lib/projects.js`：项目/模块/运行版本/文件/交付存储（`~/.dsh/dcs-projects.json`，按 sessionId 作用域）。
- **新工具**：`dcs_project_update` / `dcs_module_update` / `dcs_run_start` / `dcs_run_update` / `dcs_delivery_update`（共 34 个工具）。
- **新路由**：`/api/dcs-cloud/v2/{projects,tokens,costs,health}` + `/launch`。
- **systemPrompt v2**：dsh 以「使用科学家」身份宏观指导，优先复用 DCS Genpilot 能力；数据优先容器 `/public`（BGI Center 片区节点）；大任务离线投递、必要时并行分片；关键节点整体更新交付文档。

## [0.6.0] - 2026-08-20

### 新增

- 新工具 `dcs_data_upload`（本机 `--type web|oss` / 集群 `--cluster-mode other|batch_import` → `/Files`）与 `dcs_data_push`（容器 `/work` → `/Files`，归档结果供复用/交付）。
- `dcs_data_inspect` 补齐 csv/tsv 支持：pandas 快速探查（抽样 1 万行，输出行列数/列名/类型/指定列唯一值），不再只支持 h5ad。

### 修复

- **dcs 二进制自动下载失效**：`RELEASE_SHA` 五个平台的 SHA256 与 v1.1.0 官方 SHA256SUMS 全部不一致（旧值疑似手写/错误），自动下载必抛「SHA256 校验失败」。已更新为官方发布页 v1.1.0 实测一致的哈希。
- **失败响应解析崩溃**：`runDcs` 对 JSON 失败响应里的嵌套 error 对象（`{type, detail:{business_code,message}, hint}`）规范化为可读字符串（含错误码），不再让上层 `cliView` 对对象调 `.slice()` 报 "text.slice is not a function"。
- **`dcs_workflow_info` 查公共流程失败**：`-p` 只追加给支持它的 `workflow info`；`workflow plan` / `check_parameter` 不支持 `-p`（此前 public=true 时这两个子命令必然报未知 flag）。
- **`dcs_task_status` 过滤 flag 错配**：`analysis ls` 无 `-s/--status`、`workflow tasks` 无 `-u/--user`，现按命令实际能力分别下发（status 过滤仅 workflow、user 过滤仅 analysis）。
- `dcs_find_results` 不再硬编码默认用户名：优先从登录状态取当前用户，未登录时列出 `/work` 全量目录。
- 抽取公共 `termExec` 辅助函数，统一「容器未开（83006/83007 等）自动 open 后重试一次」逻辑：`dcs_terminal_exec` / `dcs_container_ls` / `dcs_data_inspect` / `dcs_find_results` / `dcs_llm` 5 处共用，消除重复代码。

## [0.5.1] - 2026-08-20

### 变更

- 找数据优先级调整：默认**优先查在线容器 `/public` 公共数据**（`dcs_container_ls`），`dcs_public_search` 降为容器外的元数据补充/跨片区检索；同步更新 systemPrompt、`dcs_atlas` 图谱 hints、工具描述与 README/docs。

## [0.5.0] - 2026-08-20

### 新增

- **浏览器「DCS Cloud」设置页**（`settings.section`）：无需在对话中操作即可填写/保存 PAT、一键登录、测试连接、查看当前登录态（用户名/片区/项目），并配置 `dcs` CLI 二进制路径与自动下载开关（`auto`/`never`）。
- **「DCS 任务」面板增强**：
  - 任务支持 `model`（Genpilot 模型下拉切换，自动持久化）与 `resources`（计算资源规格）；
  - 新增「离线任务与资源消耗」区块：展示最近 10 个 `dcs analysis` 任务的子任务状态、资源规格、费用与镜像（5 秒轮询）。
- `dcs_task_update` 工具新增 `model` / `resources` 参数。
- `lib/atlas.js` 新增 `GENPILOT_MODELS` 模型清单（auto / deepseek-v4-pro / deepseek-v4-flash / qwen3.7-max / glm-5.2 / kimi-k3 等）。

### 修复

- 依赖修正：`@deepseek-ai/dsh-tools` 从 `peerDependencies` 移入 `dependencies`（`0.1.0-rc.7`），干净安装不再报 `ERR_MODULE_NOT_FOUND`。
- 配置文件 `~/.dsh/dcs-cloud.json` 写入时收紧为 `0600` 权限（可能含 PAT）。

## [0.4.2] - 2026-08-20

### 修复

- 「DCS 任务」tab 按会话隔离任务。

## [0.4.1] - 2026-08-20

### 新增

- 「DCS 任务」面板步骤可点击展开，展示交付物（数据集 + 结果/图表/报告/文件）。

## [0.4.0] - 2026-08-20

### 新增

- 浏览器「DCS 任务」tab（`conversation.view`）：分析计划、数据源、步骤依赖关系、执行进展可视化。
- 任务追踪工具：`dcs_task_update` / `dcs_step_status`。

## [0.3.0] - 2026-08-19

### 新增

- 结合 E16.5 MOSTA 实测经验加速分析（公共库检索、容器公共数据集路径、h5ad 结构探查等）。

## [0.2.1] - 2026-08-19

### 修复

- Genpilot LLM 与 Genos 为 DCS 系统自带，移除手动 API key 配置。

## [0.2.0] - 2026-08-19

### 新增

- 数据库全图谱 + Genpilot 能力：`dcs_atlas` / `dcs_llm` / `dcs_parallel_run` / `dcs_plan`。

## [0.1.0] - 2026-08-19

### 新增

- 首个版本：`dsh-dcs-cloud` 插件 —— 接入 BGI Research 的 `dcs` CLI，面向 DCS Cloud 的生信研究编排。
