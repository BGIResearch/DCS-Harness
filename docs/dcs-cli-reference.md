# dcs CLI 能力图谱（v1.1.0）

> 本文档基于对 [BGIResearch/dcs_cli](https://github.com/BGIResearch/dcs_cli) v1.1.0 的实测梳理，
> 供 `dsh-dcs-cloud` 插件与 agent 参考。二进制是 Go 编译的本机程序，通过 PAT 登录 DCS Cloud。

## 1. 安装与登录

| 命令 | 说明 |
| --- | --- |
| `dcs auth login --token <PAT>` | PAT 登录（`dcs login` 同义）。成功后写 `~/.dcs/config.yaml`（token 加密为 aes256gcm） |
| `dcs auth logout` / `dcs logout` | 登出，清除本地 token |
| `dcs config show` / `get <k>` / `set <k> <v>` / `init` / `language zh\|en` | 本地配置（`base_url`、`copilot_base_url`、`current_project`、`current_region` 等） |

- `base_url` 默认 `https://www.dcs.cloud`；`copilot_base_url` 默认 `https://genpilot-release.dcs.cloud`。
- 未登录常见错误码：`83002 / 70102 / 41104`；未选项目：`83003 / 41102`；容器未开：`83006`；open 后立即 exec：`83007`（等 3–5 秒再 exec）。
- 失败响应的 JSON 信封：`{ data, error: {type, detail:{business_code,message}, hint}, exit_code, message, metadata, request_id, version }`；`error` 是嵌套对象，解析时需压平为可读文本。

## 2. 全局约定

- `--output json|ndjson|table`（默认 table）。JSON 统一结构：
  `{ data, error, exit_code, message, metadata:{...}, request_id, version }`
- `--json <inline|@file|->`：部分命令支持 JSON 入参。
- `--describe` / `--schema`：输出参数说明 / JSON Schema。
- `--no-history`、`--debug`、`--quiet`。

## 3. 命令组

### region（片区）
`region ls` / `region switch <region>` / `region current`
（实测 11 个片区：BGI-时空、医学-时空、BGI-重庆1、BGI-杭州1、医学-华南1、科服-西南1、BGI-武汉1/2、DCS-华东2、DCS-华北2、DCS-华南1）

### project（项目）
`project ls` / `switch --id <code>` / `current` / `detail [--code]` / `create` / `tags` / `omics` / `omics_tools`
- `omics_tools` 列出全部组学技术及官方工具（Genpilot 工具库），含 `code:omics_tech:Genomics` 等与 tools 数组。

### data（数据文件，`/Files` 文件结构）
`data ls [path] [-l -t -s --page --page-size]` / `find [-n 通配 -t f|d -s +100M -e/-a/-N/-k/-w/-u/-T]` / `info -p <path>` / `cd` / `pwd` / `rm` / `copy` / `move`
`data download -T <web|raysync|ossutil|tosutil|obsutil|aws|mount> -p <path> [-t 本机目录] [-m client|command]`
`data upload [--type web|oss] [--cluster-mode other|batch_import] -p <path> -t /Files/...`（`--type`：本机文件上传，web≤100MB/oss 大文件直传；`--cluster-mode`：集群文件 other（逗号分隔多路径）或批量导入表 batch_import）
`data push <src> [dest] [-b]`（容器 /work → /Files，`-b` 表格模式：DEST 为表名）
`data upload --json @params.json`（JSON 入参，`--rows` 数组逐行 file_path + sample_id）

- 根目录结构：`/Files/{ReferenceData, RawData, ManualData, ResultData(Workflow/Notebook)}`
- web 下载仅 ≤200MB 且非 FastQ/bam。

### table（Excel 表格）
`table ls [-n 通配]` / `find` / `info -n <表名>`

### terminal（在线容器 = Genpilot 智能分析，OpenSandbox）
`terminal ls_resource` / `open [--resource_id]` / `close [--force]`
`terminal exec [-c '<cmd>'] [--cwd] [--timeout 秒]`
`terminal read -p <容器绝对路径>` / `create -p <path> -c '<内容>'` / `edit -p <path> --old --new [--replace-all]`
`terminal upload -p <path> -f <本机>` / `download -p <path> -t <本机>`

- 容器内路径用 `/work/{username}/...`；本机路径用本机路径；Files 用 `/Files/...`。
- 容器由 Copilot 服务管理（`/chat_svr/intelligent_analysis_start_workspace` 等）。

### analysis（离线任务，非 WDL 的 shell 脚本）
`analysis run -i '<cmd>' -l '<资源>' --image '<镜像>' [-n 名] [-o /Files/...] [-m 挂载]`
`analysis run -p <批量文件>`（每行一条命令 → 并行多条任务）
`analysis ls [-i/-n/-u/-a --page --page-size]` / `info <task-id>` / `log <task-id>` / `start` / `cancel` / `rm` / `consume`

- 资源：`-l` 只认 `vf=<内存>g,num_proc=<核数>[,gpu=L4]`；`"4c 16g"` 这类自然语言**不会**被 CLI 转换（报「-l 参数缺少 num_proc 或 vf」），仅插件层做了自动转换。
- 镜像必填，且必须是**公共库注册路径** `public-library/<镜像名>:latest`；`ubuntu:24.04` 这类 Docker Hub 短名会报 `image_url不存在`。合法镜像可经公共库检索（resType=img）确认。
- 离线容器环境与在线容器不同：工作目录是 `/data/work`（不是 `/work/{username}`）；`/Files`、`share-data` 为只读挂载。
- `-o/--output` 指定结果输出到「数据管理」的路径（以 `/Files` 开头），缺省输出到 `/Files/ResultData/Notebook/<TaskID>/`。
- `-m/--mount` 挂载 `/Files/...` 数据；**容器内访问挂载文件需补全 `/data/input/` 前缀**。
- `-i` 命令里若含 `-t`/`-c` 等会被 CLI 当全局 flag 解析（unknown shorthand flag）；复杂命令先写成脚本文件再 `bash <脚本>`。
- 失败排查：错误为「99999 系统内部错误」时用 `dcs --debug` 重跑可看到底层 `api_msg`；信封里的 `request_id` 可用 `history get <request_id>` 反查（插件失败时会自动做这两步）。
- 任务归属：DCS 项目间数据不共享，跨项目数据先 `data copy --target-project <项目>`；任务应投递到数据所在项目。

### workflow（WDL 工作流，复用 Genpilot 现有方案）
`workflow ls [-n 名 -p 公共库 -t 标签 -u 人 -a --page --page-size]`
`workflow info -n <名> [-v 版本] [-p]`（唯一支持 `-p` 的查询子命令）
`workflow plan -n <名> [-n <名2>...] [-v]`（**agent 友好**：JSON 的 `wdl_plan` 对齐 Hermes `dcs_wdl_plan`；`-n` 可重复=执行顺序，不支持 `-p`）
`workflow check_parameter -n <名> [-v]`（**agent 友好**：JSON 的 `wdl_parameter` 用中文列名：参数名/类型/必填/说明；不支持 `-p`）
`workflow run -n <名> [-v] [-e 实体 -i k=v ... | -j json文件 | --table 表格] [-o /Files/...]`（投递命令，二进制实为 `run`；官方 README 写的 `submit_task` 与实际二进制不符）
`workflow tasks [-a -e 实体 -i id -n 名 -s 状态 --time 区间]` / `task_info <id>` / `task_log <id> [--stdout --stderr --script --intermediate -n 步骤]` / `start` / `cancel` / `rm`（tasks 无 `-u`）

### billing / history
`billing ls`；`history ls` / `get <request_id>`

## 4. 对应到研究编排

| 需求 | dcs 命令 |
| --- | --- |
| 数据检索（容器 `/public` 优先） | `data ls/find/info` + `terminal exec ls /public` |
| 外部数据（次优） | `data download -T web/ossutil/...` |
| 现有脚本/方案（Genpilot 优先） | `workflow ls -p` + `workflow info/plan/check_parameter` + `project omics_tools` |
| 重写脚本（次优） | `terminal create/edit` 写脚本 |
| 审计 | 插件 `dcs_audit_script`（静态审计） |
| 长任务/并行（离线投递） | `analysis run -i/-p` + `workflow run` |
| 简单任务（在线运行） | `terminal exec` |
| 跟踪 | `analysis ls/info/log` + `workflow tasks/task_info/task_log` |
