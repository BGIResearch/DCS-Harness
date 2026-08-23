# dsh-dcs-cloud

DeepSeek Harness 插件：接入 BGI Research 发布的 [**dcs CLI**](https://github.com/BGIResearch/dcs_cli)，面向 **DCS Cloud**（[cloud.stomics.tech](https://cloud.stomics.tech)）做基因组 / 时空组学的**生信研究编排**。

在 DSH 里完成「任务分解 → 深度研究 → 形成研究方案 → 数据检索 → Genpilot 流程复用 → 脚本审计 → 在线/离线执行 → 学术网页报告」的完整闭环。

## 🚀 DCS Harness v2.5（默认 dsh 内嵌，规划式工作流）

v2.0 曾把 DCS 研究工作台做成独立 profile（`dcs-harness`）单独开页面；v2.1 起改为**直接在默认 dsh 中使用**：插件装入常规 dsh 后，工作窗口随每个对话自动出现，无需独立 profile、无需启动器按钮、不再弹出单独页面。v2.2 把「任务交互」并入「项目管理」并移除旧版「DCS 任务」tab；后续版本强化了**规划式工作流**（先检索→出计划→与用户确认→再执行）、**多模态图表**、**图片本地化交付**与**数据确认走对话**。

**核心原则**：你（dsh）是「使用科学家」导师，负责分解科学问题、制定方案、指导与监督；具体计算由 **DCS Genpilot 智能交互**执行。用户输入问题后**先规划、再执行，绝不直接开跑**。

**v2.6.2 · Genpilot 默认 + 原生 skill/专家 + Genos 预测模型区分**：新增「**默认引擎 = DCS Genpilot**」与「**一次使用 = 一个 Genpilot 项目**」两条默认规则（每次用 `dcs_project_create` 立项，项目 code 登记到「项目管理」窗口）；并支持读取 **DCS 原生技能库**（`/public/skills`，973 条）与 **专家库**（`/public/skills/experts`）；**Genos 预测模型**（VCF→RNA 信号，1.2B）与 **Genpilot 对话 LLM**（deepseek-v4-pro 等）在插件中彻底区分，避免混淆。

**两个核心窗口**（`conversation.view` tab 环，随每个对话更新，`对话`原样保留）：

| 窗口 | 内容 |
| --- | --- |
| **项目管理** | 项目概览（目标 / 状态 / 模块统计 / token 消耗 / 模型 / 节点）+ 模块卡片（状态 / 进度）+ **运行版本时间线**（v1/v2…，历史全保留）+ 代码/输入/输出文件清单 + 运行费用 + **Genpilot 模型下拉切换**（持久化）+ **节点（片区）下拉切换**（`dcs region switch`）+ **费用与资源面板**（项目余额 + 最近离线任务费用/资源/镜像）+ **里程碑质检清单** + **分片任务进度聚合** + **自有数据来源展示** |
| **结果交付** | 论文式交付文档（科学问题 / 假说 / 分解 / 数据 / 方法 / 发现与结论 / 创新性与已有研究的关系 / 下一步计划），关键节点**整体梳理**（revision 递增），支持 **bar/line/pie/scatter/heatmap/stat/table/summary/image/video/audio/iframe/link/html 多模态图表** + **`%%chart:图id%%` 正文随文插入** + **图片本地化交付**（自动下载到本机，离线可用） |

**使用流程**：

```bash
# 1) 把插件装进默认 dsh（本地开发用本仓库路径；发布后用 github: 源）
dsh plugin --profile web add /path/to/DCS-Harness   # 或 github:xuxun-oss/DCS-Harness
# 重启 dsh web 后，「项目管理 / 结果交付」两个窗口自动出现在对话上方；
# 设置 → DCS Cloud：配置 PAT 后即可开始使用。

# 2) 或一键安装脚本（同上，等价）
bash scripts/install-harness-profile.sh
```

开发迭代时，web profile 里 `node_modules/dsh-dcs-cloud` 是指向本仓库的软链，改代码后重启 dsh web（host 半）或刷新页面（client 半）即可生效。

## 🧭 规划式工作流（用户输入问题后）

```
用户提问
  → ⓪ 立项（Genpilot 项目）：dcs_project_create 创建本项目（自动取第一个授权计费组），project_code 登记到 dcs_project_update
  → ⓪.5 复用 DCS 原生 skill / 专家：dcs_skills_list → dcs_skill_read；需要某方向专家用 dcs_experts_list → dcs_expert_read
  → ① 数据确认（第一步）：用 ask_user_question 主动询问用户是否提供自有数据（本地路径/容器/链接，不限类型，附用途描述），customData.items 登记；无则说明优先用 DCS 公共库 /public
  → ② 学术检索：web_search/子代理查文献背景；dcs_atlas/dcs_container_ls/dcs_public_search 摸清可用数据资源与可复用流程
  → ③ 给出分析计划：dcs_plan_update（科学问题→数据→方法步骤→预期产出），planStatus=awaiting_review
  → ④ 与用户互动修改：ask_user_question 请用户确认/调整，直至 planStatus=approved
  → ⑤ 才进入执行：dcs_module_update 分解模块 → dcs_run_start 执行（Genpilot 在线容器/离线并行）
  → ⑥ 监督与登记：执行后 dcs_run_update 更新状态/文件/费用，dcs_task_ids 记录离线任务
  → ⑦ 交付：dcs_delivery_update 按论文逻辑整体梳理，多模态图表随文插入，图片下载到本地
  → ⑧ 报告：dcs_generate_report 生成自包含 HTML 网页
```

## 能力一览

| 工具 | 作用 |
| --- | --- |
| `dcs_atlas` | 查看「数据库全图谱」：11 片区公共库 + 官方组学工具库（8 大类）+ 关键词映射 + 容器公共数据集 + DCS 原生技能/专家库 |
| `dcs_skills_list` | 列出/检索 DCS Genpilot「原生技能库」（`/public/skills`，dcs-skills / builtin_skills / OmicsClaw / LabClaw / bioSkills / claude-scientific-skills / ClawBio，973 条），支持按类别/关键词/仅原生过滤 |
| `dcs_skill_read` | 读取某个 DCS 原生技能的完整 `SKILL.md`（必要时 `README.md` / `AGENTS.md`） |
| `dcs_experts_list` | 列出 DCS「专家库」（`/public/skills/experts`：单细胞/空间/WGS-WES/CIMA/HCC 病理等） |
| `dcs_expert_read` | 读取某位 DCS 专家的完整定义（`AGENTS.md` + `SOUL.md`）与其绑定子技能 |
| `dcs_api_key` | 管理 DCS 技能/模型 API key（set/get/list/delete），持久化于 `~/.dsh/dcs-cloud.json`（600 权限）。支持 Genos‑VEP / Genos‑Mutation，调用技能时自动注入 key |
| `dcs_project_create` | 在 DCS Genpilot 平台创建真实项目（`dcs project create`，自动取第一个授权计费组；**一次使用=一个项目**），返回项目 code 供 `dcs_project_update` 登记 |
| `dcs_public_search` | 搜索 DCS 公共库元数据（容器 `/public` 之外的补充，走 REST API） |
| `dcs_container_ls` | 列在线容器目录（**第一优先级**：`/public` 公共库挂载、`/work` 已有分析） |
| `dcs_data_inspect` | 快速查看 h5ad/csv 结构（细胞类型 annotation / 脑区 / 基因，不加载矩阵） |
| `dcs_find_results` | 查找 /work 里 Genpilot 已跑的分析结果，避免重复计算 |
| `dcs_login` / `dcs_status` / `dcs_configure` | PAT 登录、查看当前项目/片区、本地配置 |
| `dcs_data_ls` / `dcs_data_find` / `dcs_data_info` | 在 DCS 数据管理（`/Files` 文件结构）检索平台项目/样本数据 |
| `dcs_data_download` | 下载数据到本机（**第二优先级**：外部数据获取） |
| `dcs_data_upload` / `dcs_data_push` | 上传本机数据到 `/Files`（支持 batch_import 批量导入）；把容器 `/work` 结果推送到 `/Files` 归档 |
| `dcs_workflow_search` / `dcs_workflow_info` | 检索并查看 Genpilot 现有流程（WDL）与参数规格、多步规划（**第一优先级**：复用现有脚本/方案） |
| `dcs_terminal_exec` / `dcs_terminal_file` | 在线容器（Genpilot 智能分析环境）执行 / 读写文件（**第二优先级**：在线写新脚本、简单任务在线运行） |
| `dcs_offline_run` / `dcs_parallel_run` | 离线任务投递（长任务/资源大/需并行）；`dcs_parallel_run` 按 `{i}` 分片并行投递 |
| `dcs_workflow_run` | 投递 WDL 工作流任务 |
| `dcs_task_status` | 跟踪离线任务与 WDL 任务状态 / 日志 |
| `dcs_task_update` / `dcs_step_status` | 把「分析计划 + 数据源 + 步骤依赖关系 + 进展」写入「DCS 任务」面板（浏览器 tab） |
| `dcs_llm` | 调用 DCS Genpilot LLM（对话模型，deepseek-v4-pro 等，系统自动鉴权）做解读 / 文献综合 / 写作。注意：与 Genos 预测模型（VCF→RNA 信号）不同 |
| `dcs_plan` | 生成 Genpilot 风格 Plan.md（步骤进度表 + 产物路径 + 方法学 + 总结） |
| `dcs_audit_script` | 执行前静态审计脚本（危险命令 / 硬编码密钥 / 注入 / 资源镜像配置） |
| `dcs_generate_report` | 把结果、图表、方法按学术逻辑整理成自包含 HTML 网页 |
| `dcs_cli` | 通用透传任意 `dcs` 命令（逃生舱） |

## 「DCS 任务」面板（浏览器 UI）

插件在 DSH web 的对话视图里增加一个 **「DCS 任务」tab**（`conversation.view`），除了对话外，可视化展示：

- **分析计划**：任务标题、研究目标、步骤清单；
- **模型 / 资源**：当前任务使用的 Genpilot 模型（下拉切换，自动持久化）与计算资源规格；
- **数据源**：每步用到的数据（名称 / 路径 / 类型）；
- **步骤逻辑关系**：步骤间的依赖（`依赖 → step1 → step2`）；
- **分析细节**：每步的说明与输出、交付物（数据集 / 结果 / 图表 / 报告 / 文件）；
- **执行进展**：每步状态（待执行/进行中/已完成/失败/受阻）+ 进度条，5 秒自动刷新；
- **离线任务与资源消耗**：最近 10 个离线任务（`dcs analysis`）的子任务状态、资源规格、费用与镜像，5 秒自动刷新。

数据由 agent 通过 `dcs_task_update`（建任务/写步骤，可带 `model`/`resources`）和 `dcs_step_status`（单步推进）写入，存于 `~/.dsh/dcs-cloud-tasks.json`；离线任务清单实时读 `dcs analysis ls/info`。

## 「DCS Cloud」设置页（浏览器 UI）

插件还在 DSH 设置（`settings.section`，导航栏「DCS Cloud」）里提供一个配置页，**无需在对话中操作**即可完成：

- 填写/保存 **PAT**（`dcs_pat_...`）并一键登录、测试连接；
- 展示当前登录态（用户名 / 片区 / 项目）；
- 配置 `dcs` CLI 二进制路径与自动下载开关（`auto` / `never`）。

配置写入 `~/.dsh/dcs-cloud.json`，与 `dcs_login` / `dcs_configure` 工具共用同一份配置。

插件通过 systemPrompt 注入上面的流程引导，让 agent 自动按「容器 `/public` 公共数据优先、现有脚本优先、审计后执行、离线并行、网页交付」的规则推进。

详细图谱见 [`docs/dcs-database-atlas.md`](docs/dcs-database-atlas.md)（片区公共库、官方组学工具库、Genpilot 使用范式）。

## 前置：dcs CLI 与 PAT

`dcs` 是 BGI Research 发布的**本机二进制**（Go），通过 **Personal Access Token (PAT)** 登录 DCS Cloud。

1. 获取 PAT：登录 DCS Cloud →「个人中心 → API Key / PAT 管理」创建，形如 `dcs_pat_xxx`。
2. 插件首次调用时会自动按当前平台下载对应二进制（含 SHA256 校验）到 `~/.dsh/dcs-bin/`；也可手动安装：

```bash
# macOS（Apple Silicon）
curl -L -o dcs https://github.com/BGIResearch/dcs_cli/releases/download/v1.1.0/dcs-darwin-arm64
chmod +x dcs && sudo mv dcs /usr/local/bin/dcs
```

## 安装

```bash
# 从 GitHub 安装（推荐）
dsh plugin --profile web add github:xuxun-oss/DCS-Harness

# 或本地目录安装
dsh plugin --profile web add /path/to/DCS-Harness

# 然后重启 dsh web（或按 dsh 的插件热载提示操作）
```

在会话中对 agent 说「用 DCS 云分析 XX 数据」，或直接调用 `dcs_login` 输入 PAT 开始。

## 安全说明

- PAT 仅运行时使用：交给 `dcs` 自身**加密存储**在 `~/.dcs/config.yaml`；同时为直连公共库检索 API 而缓存于 `~/.dsh/dcs-cloud.json`（本机私有文件，写入时设为 `0600` 权限，不通过任何接口外发）。
- 插件本地配置（二进制路径、自动下载开关）存于 `~/.dsh/dcs-cloud.json`。
- **Genpilot LLM 与 Genos 模型为 DCS 系统自带**：Genpilot 对话 LLM（deepseek-v4-pro 等）由系统自动鉴权；Genos 预测模型（VCF→RNA 信号，1.2B）需用户 API key（通过 `dcs_api_key` 配置，key 从 DCS Cloud「个人资料→API_key 管理」申请）。dcs 登录仅需 `dcs_pat_...`（PAT）。
- `dcs_data_rm`、`dcs_task_cancel/rm` 等破坏性命令**不会**由高层工具直接触发；如需使用请走 `dcs_cli` 透传，并确认后果。
- 执行前请用 `dcs_audit_script` 审计脚本。

## 目录

```
lib/index.js         宿主半：35+ 工具 + systemPrompt 流程引导 + 「项目管理/DCS/设置」HTTP 路由 + 图片本地化交付
lib/dcs-client.js    dcs 二进制管理、PAT 登录、命令执行、公共库检索
lib/projects.js      v2 数据模型：项目/模块/运行版本/文件/交付/自定义数据/计划/里程碑存储（~/.dsh/dcs-projects.json，带进程内写锁）
lib/atlas.js         数据库全图谱（片区/官方工具库/关键词映射/容器公共数据集/Genpilot 范式/模型列表）
lib/audit.js         脚本静态审计（shell/python/WDL 分级报告）
lib/plan.js          Plan.md 生成（Genpilot 执行计划文档）
lib/report.js        学术 HTML 报告生成（多模态媒体，图片随章插入）
lib/tasks.js         任务存储（按会话作用域）+ 局部字段更新（model/resources，带进程内写锁）
lib/client.js        浏览器半：「项目管理/结果交付」两窗口（默认 dsh 自动注册）+ 多模态图表 + 图片本地化展示 + 设置页
docs/dcs-cli-reference.md     dcs CLI 完整能力图谱（命令/参数/JSON 输出）
docs/dcs-database-atlas.md    数据库全图谱（片区公共库/官方工具库/Genpilot 范式）
cordis.patch.yml     组合 patch（insert 行）
package.json         包元数据（dsh.bundle）
scripts/install-harness-profile.sh   安装到默认 dsh（web profile）的安装脚本
```
