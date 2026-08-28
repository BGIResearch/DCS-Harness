# Changelog

本项目的所有显著变更记录于此。版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [2.14.8] - 2026-08-28

### 新增：Genpilot 回答可折叠展示（默认收起摘要，点击展开完整内容）

- **需求**：像其他 LLM 一样「既有进展可打开看，又不一直等待」——默认只显示简短摘要，完整内容可展开/收起。
- **实现**：`dcs_llm` 的 render 改为输出 HTML `<details><summary>` 折叠块——summary 显示首行摘要（≤120 字符，点击展开/收起），body 为完整内容（\n → <br>）。`mdToHtml` 验证对 `<details>` 原样透传，浏览器正确渲染为可折叠元素。
- **配合 v2.14.7 流式**：`genpilotChat` 流式输出（首字 1.3s，实时思考过程）+ 折叠展示（默认收起摘要）——等待不卡顿、结果不占屏，点击可看完整。
- **真实验证**：`mdToHtml('<details>...')` 输出 `<p><details>...</details></p>`，折叠结构保留。

## [2.14.7] - 2026-08-28

### 新增：Genpilot 对话流式输出（stream=true，实时思考过程）

- **背景**：容器内 Genpilot 对话（dcs_llm 等）复杂任务需 30-107s 推理，等待期间无反馈显得卡顿。
- **实现**：`genpilotChat` 改用 `stream=true`（SSE 流式）——python 流式读取 delta 增量并**实时打印（flush）**，首个 chunk **1.3s** 到达（vs 非流式等 30-107s 一次拿到），terminal exec 返回时拿到完整内容（兼容现有 `__MODEL__` 解析）。
- **真实验证**：流式对话 3.9s 完成（非流式同任务需等待更久）；流式内容完整组装、模型标记正确。
- **体验提升**：等待期间能看到模型逐字生成过程，不再显得卡顿；简单问答 1.3-4s，复杂方案也能快速看到首字。

## [2.14.6] - 2026-08-28

### 优化：容器内 Genpilot 对话耗时预期与 prompt 精简

- **实测诊断**：容器对话慢的根因是 deepseek-v4-flash 处理「详细方案/结构化输出」任务时的固有推理耗时——简单问答 3-6s，命令/方案生成 30-90s（与输出长度/是否 JSON 无关，是模型推理生成长输出的固有开销）；LLM API 本身快（1.3-1.9s），非网络/容器/网关瓶颈。
- **工具描述补充耗时预期**：`dcs_llm` / `dcs_task_delegate` 描述注明「复杂方案生成 30-90s，请耐心等待，勿因超时重复调用」。
- **prompt 精简**：`delegateTaskWithGenpilot` 约束从 3 条精简为 1 条，减少模型推理负担。
- **已验证不可行的优化**：max_tokens 参数（API 返回空响应）；限制输出长度（与耗时无关）。

## [2.14.5] - 2026-08-28

### 明确：Genpilot 对话在项目在线容器内进行（项目对话任务）

- **机制说明**：Genpilot 对话（dcs_llm / dcs_task_delegate / dcs_module_consult / dcs_task_diagnose）均在**项目在线容器内**进行——即「在项目里新建任务、在任务容器里对话」，对话绑定当前项目（容器归属项目，鉴权自动注入）；容器未开时插件自动 terminal open。
- **systemPrompt 步骤 7**：补充「Genpilot 对话均在项目在线容器内进行」的说明。
- **真实验证**：LungCancerFFPESpatial 项目容器内 Genpilot 对话 5.94s 返回（flash 模型），专业回答肺癌 FFPE bcSTAR 配置检查要点。

## [2.14.4] - 2026-08-28

### 强化：模块分析任务强制优先 Genpilot chat 对话模式（强制分层）

- **systemPrompt 步骤 4**：第一优先级 = Genpilot chat 对话模式，强制分层——①**分析/解读/方案/写作/统计判断类模块：直接用 `dcs_llm`（Genpilot chat）在对话中完成分析本身**（数据/结果/问题作为 prompt 提交，Genpilot 直接产出解读/结论/方案/写作，**不写脚本、不落容器**）；②重计算类模块（比对/聚类/差异表达等实际计算）：先对话定方案再落容器/离线；③投递类：`dcs_task_delegate` 对话委托。未经 Genpilot 对话理解模块并确定方式，不得直接执行。
- **执行阶段引导**：明确「分析任务本身用对话完成」——分析类模块直接 `dcs_llm` 对话产出分析结论，不写脚本；重计算才落容器。
- **`dcs_llm` 描述**：明确「每个模块的分析任务优先通过本工具（Genpilot chat）在对话中完成」。
- **`dcs_module_consult` 描述**：分析/解读/写作类模块直接由 Genpilot 对话完成。

## [2.14.3] - 2026-08-28

### 强化：模块执行「Genpilot 对话优先」从建议改为强制流程

- **systemPrompt 执行阶段**：明确「**每模块第一动作=Genpilot chat**」——每个模块开始前**第一步必须先调 Genpilot 对话（dcs_llm / dcs_task_delegate / dcs_module_consult）**，把模块名称/描述/项目上下文作为 prompt 提交，产出执行方案/步骤/命令；**未经 Genpilot 对话理解模块，不得直接执行命令或投递任务**（对话是第一动作，非可选项）。执行中失败/异常/参数不确定回到对话分析，不闷头重试。
- **`dcs_run_start` 工具**：描述明确「启动前必须先经 Genpilot 对话理解模块并确定执行方案」；execute 增加**对话优先校验**——notes 未记录 Genpilot 对话方案时返回强提示「每模块第一动作=Genpilot chat」；notes 参数要求记录对话方案摘要。
- **`dcs_run_update` 工具**：描述与 OAA observation 要求记录「已按 Genpilot 对话方案执行」的对应关系。
- **执行看门狗**：断点续跑唤醒文本要求「每个模块启动前先调 Genpilot 对话理解模块并确定执行方案，未经对话不得直接执行」。

## [2.14.2] - 2026-08-28

### 强化：Genpilot LLM 全面优先使用 deepseek-v4-flash

- `genpilotChat` 默认模型 `deepseek-v4-flash`（v2.14.1 已改）；本次补齐所有残留：`atlas.js` 的 `GENPILOT_PATTERN.llmModel` 与 `GENPILOT_MODELS` 默认标注（pro「旗舰默认」→ flash「默认」）、systemPrompt 立项/解读写作描述、`dcs_llm`/项目模型参数说明——**flash 为默认，pro 仅复杂分析可选**。
- 理由：dcsapi 网关 180s 流式超时限制下，flash 处理复杂结构化 prompt 仅 10-13s（pro 需 ~167s 撞限），且输出质量一致。

## [2.14.1] - 2026-08-28

### 修复：Genpilot LLM 调用 504 stream timeout

- **根因**：dcsapi LLM 网关对单次流式请求有 ~180s 硬超时；`deepseek-v4-pro` 处理复杂结构化 prompt（对话式委托/诊断）时模型推理 ~167s，撞上网关限制返回 504 stream timeout。
- **默认模型切换**：`genpilotChat` 默认 `deepseek-v4-pro` → `deepseek-v4-flash`（相同复杂 prompt 实测 10-13s vs pro 167s，输出质量一致；可显式指定 pro）。
- **超时提升**：python `urlopen` 180→420s；terminal exec `--timeout` 300→420s；外层 `timeoutMs` 320s→450s。
- **自动重试**：LLM 调用遇 504/502/503/超时/stream timeout 自动重试一次，避免瞬时网关抖动直接失败。
- **真实验证**：flash 对话式委托第一轮 10.31s 返回（pro 需 167.73s），正确反问 5 个补充问题。

## [2.14.0] - 2026-08-28

### 新增：对话式任务委托（Genpilot 对话优先执行，多轮反问补信息）

- **核心范式**：所有投递/分析任务都可以**直接以对话方式把想法提交给 Genpilot 执行**——Genpilot 作为执行者理解任务、判断所需环境/镜像/命令；**若信息不足会反问（questions），用 answers 补充后再次调用，多轮对话直到 ready=true**，再按方案执行。
- **新增 `dcs_task_delegate` 工具**：把任务想法（task_desc）交给 DCS Genpilot 对话，返回 understanding/needSaw/image/envSetup/commands/ready/questions；ready=false 时用 answers 回答 questions 后再次调用（多轮）；submit=true 且 ready 时按对话方案直接投递离线任务（needSaw=true 用 SAW-ST-V8.2.2 + 环境初始化，false 用通用 ubuntu:24.04-python3.12）。
- **真实环境验证**：Genpilot 对「对这批 Stereo-seq 数据做比对」第一轮反问 5 个问题（数据路径/参考基因组/输出目录/工具/样本信息），第二轮补充后给出完整 bcSTAR 比对方案（needSaw=true，SAW-ST-V8.2.2，source /opt/saw-8.2.2/env.sh，双端 zcat 比对命令）。
- **systemPrompt 更新**：步骤 4 改为「第一优先级 = 对话式任务委托」，明确投递/分析类任务优先 `dcs_task_delegate` 对话提交想法、反问补信息多轮；执行阶段引导同步更新。
- **SAW 环境识别增强**：`isSawProbeCommand` → `isSawCommand`——bc* 工具（bcSTAR/bcSaw/bcBarcode）无论运行还是 --help 探测都需 SAW 环境（缺 LD_LIBRARY_PATH 时 --help 也会失败）；支持绝对路径调用（/opt/saw-8.2.2/lib/bcstar/bcSTAR）；**非 SAW 任务（通用 python/pandas/系统命令）原样透传，不加载 SAW 环境**——由 Genpilot 对话判断任务所需环境/镜像。

## [2.13.0] - 2026-08-28

### 新增：模块执行「对话优先」范式（Genpilot 对话驱动每个模块）

- **背景**：每个模块的任务优先通过 Genpilot 对话（dcs_llm chat）方式执行——先对话定方案，再按方案执行，失败回灌对话。
- **新增 `dcs_module_consult` 工具**：把模块目标 + 项目上下文（项目目标/自定义数据/分析计划/依赖模块产物/可用能力）交给 DCS Genpilot 对话，产出**结构化执行方案**（plan 概述 + steps 步骤数组[step/action/expect] + risks 风险备选）+ 文本摘要。提供 project_id/module_id 时自动采集项目上下文。
- **执行阶段引导更新（systemPrompt）**：每个模块开始前**先调 dcs_module_consult（或 dcs_llm）通过 Genpilot 对话确定执行方案**，再按方案执行；执行中失败、结果异常、参数不确定时**回到对话**（dcs_task_diagnose / dcs_llm / dcs_module_consult）分析调整，而不是闷头重试。
- **闭环**：对话定方案 → 按 steps 执行（在线容器/离线任务/WDL/Genpilot 对话）→ 失败/异常回灌对话调整 → OAA 评估 → 下一模块。

### 新增：Genpilot 对话式任务诊断与全流程咨询（对话优先范式）

- **背景**：很多任务投递/运行问题可以通过与 Genpilot 对话的方式分析解决，而非依赖纯本地规则。
- **新增 `dcs_task_diagnose` 工具**：用 Genpilot 对话分析离线/WDL 任务失败原因——自动采集任务详情（analysis info / workflow task_info）+ 日志（log / task_log）+ 投递参数（command/镜像/资源/挂载）作为证据，组装结构化 prompt（含 DCS 平台规则：镜像 url 路径约定、资源格式、/data/work 工作目录、只读挂载、-m 挂载、任务归属、SAW 环境加载）交给 DCS Genpilot LLM，输出结构化 JSON（rootCause/category/confidence/evidence/fix/nextAction）+ 文本摘要。适合投递失败、运行失败、任务被拒等场景深度归因。
- **失败路径自动接入**：`submitDcsTask` 宿主通道投递失败且本地规则未命中（笼统错误）时，自动调 Genpilot 对话深度诊断（60s 同签名去重，不重复消耗 LLM），结果以「🧠 Genpilot 对话诊断」附在错误后。
- **`dcs_llm` 增强 json_mode**：请求结构化 JSON 输出并解析返回（data 对象 + 文本摘要双输出），适合失败诊断/参数预检等需要程序化处理的场景。
- **全流程对话咨询**：数据检索、流程选择、参数填写、失败诊断均可通过 `dcs_llm` / `dcs_task_diagnose` 与 Genpilot 对话完成。

### 新增：SAW 运行环境自动加载（投递 bc* 工具探测命令前）

- **背景**：投递 SAW（Stereo-seq Analysis Workflow）工具探测命令（如 `bcSTAR --help` / `bcSaw -h`）前，bc* 工具因缺 LD_LIBRARY_PATH（anaconda 动态库）与 PATH 而报错或误判工具不可用。
- **二选一加载策略（dcs_configure sawEnvMode 配置）**：
  - `source` —— 先 `source <sawRoot>/env.sh`（或对应 setenv 脚本）初始化完整运行环境；
  - `ldpath` —— 直接 `export LD_LIBRARY_PATH=<sawRoot>/anaconda/lib:$LD_LIBRARY_PATH` 后直跑工具（如 `bcSTAR --help`）；
  - `auto`（默认）—— env.sh 存在则 source，否则回退 LD_LIBRARY_PATH（兼容无 env.sh 的安装）；
  - `off` —— 不自动加载。
- `sawRoot` 缺省 `/opt/saw-8.2.2`，可用 `dcs_configure sawRoot=<路径>` 覆盖。
- **接入点**：`dcs_terminal_exec`（在线容器）与 `dcs_offline_run` / `dcs_parallel_run`（离线投递 s 型，经 `submitDcsTask` 统一入口）——识别 bc* 系列（bcSTAR/bcSaw/bcBarcode）或 SAW 主脚本调用（运行或 --help 探测，bc* 工具缺 LD_LIBRARY_PATH 时连 --help 都会失败）自动前置环境初始化；支持 `&&` / `;` / `||` 链式命令、bash -c / source / cd / export 包装与绝对路径（/opt/saw-8.2.2/lib/bcstar/bcSTAR）。**非 SAW 任务（通用 python/pandas/系统命令）原样透传，不加载 SAW 环境**——由 Genpilot 对话（dcs_module_consult / dcs_llm）判断任务是否需要 SAW，需要时选 SAW 镜像+环境，不需要时用通用镜像。

### 离线任务投递鲁棒性：错误透传 + 失败诊断 + 描述修正（PR #1 整合进 v2.12.0 多通道投递）

复盘离线投递的多轮试错（99999 黑盒、镜像无效、资源格式被拒、/data/work 权限），做以下改进：

**错误透传（runDcs）**
- 失败响应压平时补充 hint（；提示：…）、retryable（（可重试））、信封级 request_id（[request_id: …]，可用 dcs history get 反查）与 metadata。
- 笼统错误（99999 系统内部错误 / 81201 等）自动附上 stderr 末尾，尽量带出底层 api_msg，不再纯黑盒。

**离线投递失败诊断（dcs_offline_run / dcs_parallel_run）**
- 已知错误模式给出可操作的「下一步」提示：image_url不存在 → 用云平台镜像库 url 路径（如 public-library/<镜像名>:latest）并经 dcs_public_search（resType=img）确认；资源格式错 → 必须 vf=<内存>g,num_proc=<核数>；permission denied / 只读 → 离线容器工作目录是 /data/work；unknown shorthand flag → 复杂命令写成脚本文件再 bash 执行。
- 宿主通道（analysis run）失败且错误笼统（99999/81201 等，任务未创建）时，自动带 --debug 重跑同一命令（仅诊断）抓取底层 api_msg；结构化错误（镜像/资源/权限）信息已足够，不重跑、避免重复投递风险。同签名错误 60s 内只诊断一次（dcs_parallel_run 同批分片去重）。
- 诊断挂接在 v2.12.0 统一投递助手 submitDcsTask 的宿主通道失败路径；Pod 通道业务失败与资源校验拒绝由工具层补「下一步」提示。

**资源格式本地校验**
- 新增 checkDcsResource：归一化后不满足 vf=…g,num_proc=…[,gpu=…] 时直接拒绝投递并给出格式说明（前置在 dcs_offline_run / dcs_parallel_run 工具层，先于多通道投递），不再把非法格式交给 CLI 报错。

**描述与引导修正**
- dcs_offline_run / dcs_parallel_run 的 image 描述改为云平台镜像库 url 路径约定（如 public-library/<镜像名>:latest），去掉 ubuntu:24.04-python3.12 裸用推荐；command/command_template 描述补充 /data/work 工作目录、只读挂载、挂载文件容器内 /data/input/ 前缀与脚本文件建议（依据官方帮助中心 CLI 手册核实；output 目录同步机制因平台侧问题暂不在插件层给指引）。
- dcs_atlas Genpilot 范式（GENPILOT_PATTERN.offlineNote）与 systemPrompt 第 5 条新增离线容器法则（/data/work、只读挂载、output 结果目录、镜像约定、flag 规避）与任务归属提示（任务归数据所在项目；跨项目数据先 dcs data copy --target-project）。
- docs/dcs-cli-reference.md analysis 章节、docs/dcs-database-atlas.md 标准配置同步上述注意事项。

## [2.12.0] - 2026-08-28

### 修复：离线/WDL 任务投递输入文件对引擎不可见（外部导入实体挂载）

- **根因**：插件此前 `dcs_offline_run` / `dcs_workflow_run` / `dcs_parallel_run` 全走**宿主侧** `dcs analysis run` / `dcs workflow run`（Go CLI v1.1.0）。该 CLI **无 `task` 子命令、无 `-m` 容器挂载语义**，而外部导入实体（如 `entity_id=VIRE-chip202205001`）的输入文件在数据管理可见、但**未挂载进任务容器**，导致 WDL/离线引擎「看不到」这些文件——正是投递频繁失败、且**不是计费问题**的原因。
- **官方正确通道**：Genpilot Pod 内 `/dcs-sdk-soft/dcs task run -t s|w` 走**容器挂载体系**，`-m` 显式挂载 `-m /Files/...` 数据文件后引擎才看得到（脚本投递走 `-t s`，WDL 投递走 `-t w`）。
- **修复（多通道 + 自动挂载）**：新增统一任务投递助手 `submitDcsTask`，三处投递工具全部改走它：
  1. **离线 shell（`s` 型）优先**经 Genpilot Pod 内通道执行 `dcs task run`（`-t s`），并**自动推导 `-m` 挂载**——凡输入引用 `/Files/...`、外部导入实体文件等路径，自动提取并挂载（`extractMountFiles` / `toMountList`）；`-m` 只取真正输入来源（command / inputs / batch_file / 显式 mount），**不把 `output_path`（结果输出目录）当输入挂载**。
  2. Pod 内通道**不可用**（session/token 过期、unknown command、容器未开/未就绪）时**自动降级宿主 CLI**（`analysis run`），并在返回里标注所用通道（`channel: pod|host`）；**业务/参数/资源/镜像校验失败不降级**，直接报回真实原因，避免掩盖错误。
  3. 结果统一解析 task_id / task_ids（兼容 terminal exec 包装的 stdout 文本兜底）。
- **WDL（`w` 型）按平台规范投递**：`dcs_workflow_run` 走**宿主 `workflow run`**（`-n/-v/-e/-i/--table`，不传 `-m`——宿主 workflow run 无 `-m`）。**移除 `-j` JSON 投递**（WDL 规范禁止），并明确「WDL 请配合 `dcs_wdl_fill_parameter` + `dcs_wdl_submit_task` 以启用离线回调与自动续跑；禁止 Pod 内 `terminal_exec` 手写 `dcs task run` 投 WDL」。
- **验证**：`node --check` 与 `npm run check` 静态回归通过；`extractMountFiles` / `toMountList` / s、w 参数拼装冒烟通过（外部实体 `/Files/VIRE-chip202205001/...` 与 `/Files/ReferenceData/...` 均能自动推导进 `-m`）；经 `critical-review-expert` 与独立模型双轮评审修正（WDL 通道合规、`-j` 移除、`output_path` 隔离、降级集补全、未用变量清理）。

### 新增：builtin 云技能接线（cloud-terminal / cloud-public-resource / dcs-data-manager / dcs-workflow-skill / literature-search）

- `skillCatalog` 改为在 `skills_snapshot.json`（973 条）之外，**额外扫描 `/public/skills/builtin_skills/` 目录**，把 `cloud-terminal`、`cloud-public-resource`、`dcs-data-manager`、`dcs-workflow-skill`、`literature-search`、`dcs-skills-manager`、`dcs-expert-skill`、`dcs-notebook-skill`、`genpilot`、`preview-omics-data`、`image-manager` 等平台内置技能纳入候选（按优先级排序，按 name 去重），使它们能被 `dcs_skills_list` / `dcs_skill_read` / `dcs_skill_route` 发现与读取。
- `dcs_skills_list` 的 `category=builtin_skills` / `native` 过滤自然覆盖新条目；`dcs_skill_read` 的叶子名定位也能命中 `builtin_skills/cloud-terminal`。

### 新增：专家优先路由（先专家后技能）

- `atlas.js` 的 `EXPERTS` 扩充为实际存在的 7 位：`scrna-seq-expert` / `stereo-seq-expert` / `wgs-wes-germline-expert` / `cima-expert` / `hcc-multiomics-pathology-expert` / `cell-annotation-expert`（分析类）+ `critical-review-expert`（评审/把关类）；新增 `EXPERT_KIND` 区分分析 vs 评审。
- `dcs_skill_route` 的专家候选**加相关度加成**（分析类 +0.9、评审类 +0.6，先跑分析再让把关），并在 `category` 标注 `expert/analysis` / `expert/review`，让 agent 一眼识别「分析 → 把关」接力链。
- `dcs_expert_read` 描述/参数补全 7 位专家名。

### 新增：项目归属判断（带特定目标数据必须在已有项目分析）

- 立项流程改为**先问「新建 / 已有项目」**：若用户提供特定目标数据（自备数据 /Files、容器 /work/...、上游产物、链接）→ **必须落已有项目**（数据挂在上游项目上，另开新项目会导致引擎看不到输入），仅无既有数据时才新建。写入 systemPrompt 步骤 0。
- systemPrompt 同步更新步骤 0.5 / 2 / 5，新增云技能专项引导（cloud 技能边界、投递挂载、`-m` 推导、**禁 Linux find** 扫 /Files/public、数据检索用 `dcs table/data find`）。

## [2.11.0] - 2026-08-28

### 新增：执行看门狗（防项目意外中止 / 自动断点续跑）

- **背景**：计划批准后进入全自动执行（planStatus=approved），若过程中因 LLM 调用失败、网络/连接中断、模型异常退出等原因导致 agent 回合意外结束，项目会静默停在半途，无人推进、也无提示。
- **看门狗巡检**：宿主端每 60s 扫描一次所有「已批准、未终结、仍有待执行模块」的项目。判定「意外停滞」需同时满足：① 存在未完成模块且无 running 模块/运行；② 项目最近实质推进时间（模块/运行的最新 updatedAt/startedAt/finishedAt 最大值）距今超过 10 分钟（排除刚批准的启动窗口与长任务正常空档）；③ 对应会话的 live Agent 当前空闲（`agent.status !== 'running'`，正在跑回合时不打扰）。
- **自动恢复**：命中后注入一条以「[执行守护]」开头的用户消息唤醒 agent（复用 `wakeSession` 的 `agent.followup()` 机制），指令明确：先检查各模块状态 → **只执行未完成模块**（failed 用 dcs_run_start 重跑 v2、pending 按 dependsOn 继续）→ 已完成模块绝不重复 → 全部完成后 dcs_delivery_update 汇总交付。
- **防无限循环**：同一项目两次唤醒最小间隔 5 分钟（冷却）；自动唤醒累计上限 3 次，达到上限仍无进展则标记 `watchdog.blockedAt`（需人工介入），此后不再自动打扰，避免烧 token。
- **启用时机**：点「🚀 批准计划并自动执行」时自动启用（watchdog.enabled=true）；项目完成（全部模块 done）或终结（done/failed/blocked）后自然退出巡检。
- **可视化**：项目管理窗口新增「🛡️ 执行守护」状态条：运行中（绿）/ 已自动恢复 N 次（黄）/ 需人工介入（红），并显示最近一次恢复原因。
- **prompt 引导**：systemPrompt 执行阶段新增看门狗/断点续跑指引——收到「[执行守护]」消息时从断点续跑、登记已完成状态、失败重跑 v2、不从头开始。
- **验证**：`node --check` 语法通过；`npm run check` 静态回归通过；独立测试 17 项断言覆盖候选判定（running 不打扰 / 全部完成退出 / 冷却 / 上限 / blocked 后停止）、持久化与端到端续跑流程。

## [2.10.2] - 2026-08-28

### 修复：项目管理窗口按钮无法唤醒 AI（「根据意见重新修正计划」/「批准计划并自动执行」）

- **根因**：`/v2/project/revise-request` 与 `/v2/project/approve-plan` 的唤醒逻辑 `wakeSession` 只调用 `session.append('user/message', …)` 往会话日志写入一条事件，**不会触发 agent 回合**——DSH 中只有 `agent.followup()`（把消息投进 inbox 并 `wakeDriver()`）才会真正唤醒 agent 开始下一轮。因此用户点击「🔄 根据意见重新修正计划」或「🚀 批准计划并自动执行」后，数据（planStatus=approved、反馈留痕）都保存了，但 AI 从未被唤醒，既不修订计划也不自动执行。
- **修复**：`wakeSession` 改为优先通过 `ctx.agents.get(sessionId)` 拿到 live Agent 并调用 `agent.followup({ id, role:'user', content, source:{kind:'plugin', plugin:'dcs-project-review'} })` 真正入队一个 user 回合；Agent 不在线时回退为写日志留痕并返回 `woken:false`（前端已有提示「请在对话窗口直接说明该请求」）。
- **附带**：两条唤醒消息补充项目 ID（project_id=…），agent 醒来后能直接定位到对应项目修订/执行，无需从上下文猜测。
- **验证**：`node --check` 语法通过；`npm run check` 静态回归通过。

## [2.10.1] - 2026-08-28

### 多模型评审修复（对标 Biomni 长 loop 的稳健性加固）

- **genpilotChat 不再假阳性成功**：terminal exec 失败（容器未就绪/CLI 报错/超时）时如实返回 `ok:false`，避免把错误文本当 LLM 成功内容，污染 dcs_llm / dcs_self_review / dcs_skill_route 三条链路。
- **DCS 自带 LLM 鉴权回退**：系统注入的 `LLM_API_KEY` 缺失或 401 时，自动回退到用户已配置的 Genos API key（base64 内嵌、命令串不落明文、默认 --no-history）直连 DCS LLM 网关，实测调通。
- **dcs_self_review**：产物证据采集改 `Promise.all` 并行（6 个文件最坏耗时从 ~680s 降到 ~45s）、工具超时提到 600s；路径改用 `shq` 单引号转义（杜绝 `$()`/反引号注入）；LLM 不可用时保守置 `verdict=rerun` 并新增 `llmError` 输出字段，不再无依据给出 pass/revise。
- **dcs_skill_route 中文召回修复**：新增 `CN_EN_BIO_TERMS` 中英扩充表 + 复用 `KEYWORD_TO_CATEGORY` 类别词扩充（「单细胞数据差异表达分析」对目标技能从 0 分 → 7 分）；短 ASCII 关键词（sv/bin/fold 等）改词边界匹配，消除 csv/service/combine 等子串误命中；剔除 `de`/`go` 泛化词；三路检索改并行；工作流分页提到 200 条；`top_k=0` 支持；llm_rank 下标去重；readAction 名称加引号。
- **其他**：`dcs_skill_read` 拒绝 `..` 路径段并修复容器绝对路径分支死代码（既有 bug）；`catInContainer` / `dcs_db_query` 改 `shq` 单引号防注入（既有注入面）；`normSelfReview` 非法 verdict 归空（修掉恒等三目）；`buildTrajectory` 对非法 `finishedAt` try/catch 兜底；termExec 容器自动 open 加进程内互斥锁（防并行 open 争用）。

## [2.10.0] - 2026-08-28

### 执行中自批评 / 自适应 refine（对标 Biomni 长 loop）

- 新增 `dcs_self_review` 自批评节点：输入模块目标 + 产物清单 → 自动采集证据（容器产物文件存在性/大小/行数、本机文件 size）→ 调 Genpilot LLM 自评 → 输出 `{verdict: pass/revise/rerun, evidence, risks, nextAction}`；传 project/module/run_id 时自动把 verdict + OAA 三段式持久化进对应运行（ReAct 循环在模块粒度上成立）。
- `dcs_run_update` 新增 `oaa`（observation/assessment/action）与 `self_review` 结构化字段；执行阶段 prompt 重写为「评估-调整循环」：每个模块完成后强制 ①检查产物 ②写 OAA ③异常时用 dcs_module_update 调整后续未开始模块 desc/顺序（不新增模块、不触发人审）④失败先自评定位再重跑 v2（dcs_run_start 自动递增版本）。

### 工具级动态编排（ToolRetriever）

- 新增 `dcs_skill_route` 技能路由：输入任务/模块目标（自然语言）→ 自动并行检索 技能库（973 条）+ 公共 WDL 工作流 + 专家库，术语相关度打分合并去重排序，输出候选（名称/类别/用途/读取命令）；可选 `llm_rank=true` 用 Genpilot LLM 二次排序（Biomni ToolRetriever 的 LLM 选工具）。

### ReAct 推理图 / self-critique 显式化

- 运行记录新增 OAA（观察→评估→行动）与 selfReview（verdict/证据/风险/下一步）字段，项目管理窗口运行卡显示 verdict 徽章 + OAA 三段（循环状态一眼可见）。
- 交付文档新增第 9 章节「执行轨迹」：`dcs_delivery_update` 传 `includeTrajectory=true` 自动把各模块 OAA/自评/产物汇总成可读的推理图产物（无需手写），前端 SECTION_META 同步渲染。

### Biomni 公共数据库查询（B1 落地）+ 个人技能支持

- 新增 `dcs_db_query` 工具：uniprot / gwas / ensembl / drugbank / opentargets 五个公共生物医学数据库只读查询（REST），主路径容器执行、插件本机直连兜底。
- **个人技能自动生成**：首次调用 `dcs_db_query` 时幂等自动把 `biomni-db-query` 技能（SKILL.md + query_db.py）写入容器 `/work/{user}/skills/`，用户零操作即得，且生成后可编辑、可被 `dcs_skill_read` / `dcs_skill_route` 读取路由（B1：Biomni database 工具库进入工具检索候选池）。
- `dcs_skills_list` 新增 `scope` 参数（public=公共库默认 / personal=个人技能 / all=合并），个人技能以 `personal/` 前缀标记。
- `dcs_skill_read` 支持 `personal/<技能名>`（容器 /work/{user}/skills/）与容器绝对路径（/work/...、/Files/...），叶子名自动在公共+个人里定位。
- `dcs_skill_route` 新增 `include_personal`（默认 true），自动生成的个人技能默认进入路由候选。

## [2.9.0] - 2026-08-28

### 结果交付：可拖动 3D 分子结构（structure3d）

- 交付图表新增 `structure3d` 类型：`dcs_delivery_update` 的 charts 可直接投递 PDB（容器路径/本地路径/URL），交付窗口内渲染可拖拽 3D 结构。
- MoleculeViewer 组件：卡通/球棍/表面/pLDDT 四种样式、并列/叠合两种布局、侧链显示、截图/全屏工具栏。
- 多结构叠合使用自实现 Kabsch 算法（3x3 Jacobi 特征分解，往返 RMSD < 0.001Å），不依赖 3Dmol 付费 API。
- 3Dmol 从 cdnjs 2.4.0 本地化并懒加载（`/v2/vendor/3dmol.js`，508KB，首次用到 3D 才下载，零首屏影响）。
- 新增 PDB 文件服务：`/v2/chart-file`（任意媒体）、`/v2/serve-local/<name>`（本地文件白名单安全代理）、`/v2/chart-image` 按扩展名给 MIME。

### 结果交付：视觉与图文混排升级

- 8 章节独立主题色 + 英文小标 + 3px 强调边；「科学发现与主要结论」hero 金色渐变底；顶部章节速览 chips 平滑滚动。
- 结构化发现渲染：`### 发现 N：…` 自动切成编号发现卡片（序号徽章 + 加粗标题 + 附图容器），`%%chart:id%%` 图表在卡片内就地内嵌（含标题行内占位符的剥离重排），图文一体。
- 新 markdown 语法：`==高亮==`、`~~删除线~~`、`> 引用块`、`---` 分隔线；`**重点**` 荧光笔效果；表格圆角斑马纹；图表卡阴影 + 悬浮抬升。
- 末尾「数据图表」区只放未被正文引用的图表 + 自动收集的分析图。

### 工作流画布：纵向分层布局

- 画布从横向分层改为**纵向分层**：依赖深度=行号、层内节点横向排布、超宽自动换行、行内居中——基本消除横向拖动，纵向滚动浏览全流程。
- 宽度经 ResizeObserver 实测自适应；普通滚轮留给页面纵向滚动，Ctrl/⌘+滚轮缩放；边路由改垂直贝塞尔。

### 防崩加固（整窗永不白屏）

- 三层 React ErrorBoundary（图表卡/章节/整窗）+ 顶层视图守卫（项目管理/会话地图/结果交付），任一组件异常只显示内联错误卡（含错误信息自诊断）。
- WebGL 预检（webgl2/webgl/experimental 三探）：远程桌面/无 GPU 环境显示可操作降级提示，其余图表不受影响。
- 修复 MoleculeViewer useState 解构隐患核查（全库 40+ 处 useState 审计）与图表冻结对象提交（不可变更新 + 工具入口防御深拷贝）。

### 图片交付自包含

- 修复 delivery-update 图片本地化 bug：本机绝对路径图片直接复制进 `dcs-img-cache`（此前误用 dcs CLI 下载本机路径导致 charts 一直存外部引用，源文件删除即丢失）。
- 容器路径图片继续下载缓存，交付展示离线可用。

### 防回归：静态检查脚本

- 新增 `scripts/check-hooks.cjs`：拦截 useState setter 解构错误与图表对象原地赋值两类已修复 Bug 模式 + 双文件语法检查。
- `npm run check` / `precommit` 钩子，支持 `CHECK_ROOT` 覆盖接入 CI。

### 其他

- 会话隔离保持：每个对话只显示该会话的结果交付项目。

## [2.8.1] - 2026-08-23

### 紧急修复：SSE 连接关闭时 ctx.off 崩溃导致 dsh 进程退出

- 根因：`req.on('close')` 回调中调用 `disposeListener()` → `ctx.off('session/event')`，在插件重载/进程关闭时 Cordis 上下文可能已销毁，抛 `cannot get property "off" without inject` → 未捕获异常 → 整个 node 进程崩溃。
- 修复：`try/catch` 包住 `disposeListener()`，listener 随进程消亡自然回收。

## [2.8.0] - 2026-08-23

### 重大升级：会话地图实时推送 + Synapse 式事件驱动架构

借鉴 [dsh-synapse](https://github.com/liangmianya/dsh-synapse) 的核心设计，将会话地图从轮询升级为事件驱动实时推送。

**Host 新增 SSE 端点**
- `GET /api/dcs-cloud/v2/session-events/stream?sessionId=`：Server-Sent Events 长连接，替代轮询。
- 连接建立时回放当前会话的已有事件，之后通过 `ctx.on('session/event')` 实时推送每个新事件。
- `session/created` 事件触发时分叉关系自动广播（`event: forks`）。
- 事件投影逻辑与 `/v2/session-events` 完全一致（`user`/`assistant`/`tool` 归一化）。

**Client 替换轮询为 SSE**
- 移除 10s 轮询 + `nextSeq` 增量逻辑（消除死循环 bug 的根源）。
- 使用 `EventSource` 连接 SSE 端点，事件实时追加到本地状态。
- 连接状态指示器（🟢 实时 / 🔴 断线），断线可手动重连。
- 工具调用结果通过 `resultOnly` 标志自动补全到对应 callId 卡片。

**保留功能**
- 对话轮次卡片（用户消息 / 助手回复 / 工具调用折叠）
- 分支关系展示 + 复制会话 ID
- 分析角度建议

## [2.7.1] - 2026-08-23

### 修复：会话地图丢失进行中对话

- 根因：`sessionPersistence.readFrom` 只读磁盘已持久化事件，write-behind 延迟（200ms）内的当前轮次事件未落盘，导致进行中的对话在会话地图中消失。
- 修复：`/v2/session-events` 在持久化后缀之后，从 `session.events`（内存完整日志）补充 `seq > maxPersistedSeq` 的尾部事件。

### 优化：工作流画布自适应布局

- **自适应列数**：根据 SVG 宽度（920px）动态计算每行节点数（cell=200px, pad=24px, gutter=16px → 4 列；窄屏自动降为 2 列）。
- **自动换行 + 末行居中**：超出宽度自动折到下一行，末行不满时水平居中。
- **SVG 高度自适应**：根据内容行数动态计算（min 280px / max 600px）。
- **边渲染优化**：同行用水平贝塞尔曲线，跨行用正交路径（出→右拐→下行→左拐→入），比全贝塞尔更清晰。
- **支持 `dependsOn` 显式依赖边**：与顺序边叠加不重复。

## [2.7.0] - 2026-08-23

### 新增：原生工作流画布（项目管理面板重构）

- **项目管理面板重构**：保留 Genpilot 模型选择、节点（片区）选择与资源规格显示；原模块折叠列表 / 里程碑 / 自有数据 / 分片进度区块替换为 **原生 SVG 工作流画布**。
- **WorkflowCanvas**：模块 = 节点（按 `plan.stepIds` 拓扑排序，网格布局），状态色条 + 圆点（pending 灰 / running 蓝 / done 绿 / failed 红 / blocked 黄），连线带箭头；滚轮缩放（原生 `wheel` 监听，`passive:false`）、拖拽平移（位移按 scale 归一）、点击节点查看模块详情（运行历史 + 费用 + 分析计划）。配色用 `currentColor` + 半透明底，深浅主题均可读。

### 新增：会话地图（Synapse 式能力）

- **新窗口「会话地图」**（`conversation.view`，order 55，位于项目管理与结果交付之间）：把当前会话的已提交事件投影为对话轮次卡片——真人消息开新轮次，工具调用按 `callId` 折叠 call+result，插件注入上下文计数显示；展开可见工具参数与结果预览、助手回复、失败标记（❌）与中断标记。
- **分支关系**：展示当前会话的 fork 谱系（父会话 / 子分支 / 同源分支，活跃或已归档），可复制会话 ID 在侧栏打开；空态提示"fork 当前会话即可创建新分析分支"。
- **分析角度建议**：基于会话结构生成具体提示（失败调用定位重试、分支对比合并、发现固化到结果交付）。

### Host 新增 API

- `GET /api/dcs-cloud/v2/session-events?sessionId=&fromSeq=`：经 `sessionPersistence.readFrom` 按真实 DSH 事件类型（`user/message` / `assistant/message` / `tool/call` / `tool/result` / `session/title`）归一化投影；服务端按 `callId` 折叠工具调用，文本 400 字符、结果 800 字符截断；支持 `fromSeq` 增量拉取（返回 `nextSeq` 水位）。
- `GET /api/dcs-cloud/v2/session-forks?sessionId=`：合并内存活跃会话（`sessions.list()`，标题经 `sessionTitle.get` 折叠）与持久化历史（`sessionPersistence.list()`），按 `header.parentSession` 建谱系，返回本会话相关分支（自身/子/兄弟），按创建时间排序。
- `inject` 新增 `sessionPersistence` 硬依赖；`sessionTitle` 为可选服务（`ctx.get`）。

## [2.6.3] - 2026-08-23

### 新增：设置页 Genos API key 输入框

- **Host**：`GET /config` 返回 `genosKey`/`genosKeySet`；`POST /config` 接受 `genosKey` 写入 `apiKeys.genos/genos_vep/genos_mutation`。
- **Client**：设置页新增 `type=password` 的 Genos API key 输入框，已配置时显示 `••••••••`，声明 Genos 是预测模型非对话 LLM。
- 描述修正："Genpilot 对话 LLM 系统自动鉴权；Genos 预测模型需填写下方 API key"。

## [2.6.2] - 2026-08-23

### 修正：彻底区分 Genos 预测模型 与 Genpilot 对话 LLM

此前插件多处将 Genos（VCF→RNA 信号预测，1.2B）与 Genpilot LLM（对话/写作，deepseek-v4-pro）混为一谈，导致误解（如"Genos 无需 API key"——实际上 Genos 预测模型需要用户 API key）。

- **`atlas.js`**：修正 `GENPILOT_PATTERN.note`（区分 Genpilot 对话 LLM 自动鉴权 vs Genos 预测需用户 key）、`genpilotHints()`（`dcs_llm` 描述加上 Genos 区分）、`.env` 说明（区分 chat 与预测的鉴权方式）。
- **`index.js`**：
  - `dcs_configure` 描述：不再说 "Genos 无需 API key"，改为 "Genpilot 对话 LLM 系统自动鉴权；Genos 预测模型需用户 API key"。
  - `dcs_llm` 描述：加上 "注意：Genpilot chat 是对话模型，与 Genos 预测模型不同"。
  - systemPrompt header：新增强 `⚠️ 模型区分` 提示。
  - systemPrompt step 7：明确 `dcs_llm` 调的是 Genpilot 对话 LLM，Genos 预测需单独调用 skill。
  - `dcs_configure` render 输出：加上 "Genos 预测模型需 key，Genpilot 对话 LLM 系统自动鉴权"。
- **`README.md`**：能力一览表 `dcs_llm` 行加上 Genos 区分；底栏 "Genpilot LLM 与 Genos 模型" 说明改为区分两种模型。

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
