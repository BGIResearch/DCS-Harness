# DCS Cloud 数据库全图谱

> 基于 2026-08-19 对 `dcs` CLI v1.1.0 的实测梳理。目标：让「找数据 / 找流程」更容易。
> 公共库数量为当时快照，会随平台更新变动；分类结构稳定。

## 1. 片区图（BGI 中心节点公共库更全）

DCS Cloud 有 11 个片区，分两类：**BGI 中心节点**（官方 DCS 流程多、内部共享流程全）与 **DCS 公共云节点**（公共流程总量大）。

| 片区 | id | 类型 | 公共流程 | 官方 DCS | 说明 |
| --- | --- | --- | --- | --- | --- |
| **BGI-时空** | `st` | BGI 中心 | 740 | **103** | BGI 中心核心节点，官方 DCS 流程最全（SAW / SC_Miner / Stereo_Miner 全系） |
| 医学-时空 | `bgid_center` | BGI 中心 | 79 | 39 | 医学方向时空组学 |
| 医学-华南1 | `bgid` | BGI 中心 | 39 | 39 | 医学方向，官方流程齐全 |
| BGI-重庆1 | `cq` | BGI 中心 | 需建项目 | - | 需先在该片区建项目 |
| BGI-杭州1 | `sugon` | BGI 中心 | 需建项目 | - | 需先建项目 |
| 科服-西南1 | `bgit` | BGI 中心 | 需建项目 | - | 科技服务方向 |
| BGI-武汉1 | `wh` | BGI 中心 | 需建项目 | - | 需建项目 |
| BGI-武汉2 | `iimr` | BGI 中心 | 需建项目 | - | 需建项目 |
| **DCS-华南1** | `ali` | DCS 公共云 | **924** | 85 | 公共云主片区，公共流程总量最多（Genos 模型所在片区） |
| DCS-华北2 | `ve` | DCS 公共云 | 596 | 38 | 公共流程多 |
| DCS-华东2 | `east2` | DCS 公共云 | 需建项目 | - | 需建项目 |

**结论**：找官方流程去 **BGI-时空**（官方 DCS 流程最多）；找共享流程总量去 **DCS-华南1**。
注意：`workflow ls -p`（公共库）需要当前片区有项目（否则报 41102 未选项目）。

## 2. 官方组学工具库（dcs project omics_tools）

8 大类 → 官方 DCS 流程（official_tag=DCS，有官方维护与参数说明）。

| 组学类别 | 数量 | 官方流程 |
| --- | --- | --- |
| 基因组学 Genomics | 16 | DCS_Build_Index_FASTA、DCS_WGS_Germline_FASTQ(_HumanOnly)、DCS_WES_Germline_FASTQ、WGS-zbolt-fpga2、Lowpass_v5-NHS/Human、LowpassSummary_v5、ExpansionHunter_WGS_STR、PanGenie_WGS_SV、CNVpytor_WGS_CNV、seqarc_index/compress/decompress、zbolt-build-index、Bcftools_Index_VCF |
| 表观基因组学 Epigenomics | 0 | — |
| 微生物组学 Microbiomics | 2 | MSAP、minimap2-build-host-reference |
| 转录组学 Transcriptomics | 2 | BulkRNA-seq、BulkRNA-seq-build-index |
| 蛋白质组学 Proteomics | 1 | ESMFold |
| 代谢组学 Metabonomics | 0 | — |
| 单细胞组学 Single-cell | 20 | scRNA-seq_v3(.1.5)、scATAC-seq、scVDJ-seq、scVDJ-build-IMGT-ref、SAW_spatial_scRNA_V1/V2、Chips_scRNA_*、SC_Miner_*（Preprocessing/data_qc/Clustering/Annotation/Autoannotation/Interaction/Pseudotime/Enrichment） |
| 空间组学 Spatial | 20 | SAW-ST-V6/V7/V8 及子流程（makeRef/clustering/Visualization/diffexp/gef2gem/gem2gef/merge/realign/reanalyze-lasso/checkGTF/MIDFilter/img2rpi/tar2img/bin2cell）、Stereo_Miner_*（Preprocessing/data_qc/Clustering/Annotation/Autoannotation/Interaction/Pseudotime/Enrichment） |

## 3. 关键词 → 组学类别

| 类别 | 关键词 |
| --- | --- |
| Genomics | wgs/wes/germline/变异/snp/indel/cnv/sv/str/lowpass/低深度/全基因组/外显子/建索引/fasta |
| Single-cell | scrna/单细胞/single cell/scatac/scvdj/vdj/免疫组/细胞系 |
| Spatial | stereo-seq/saw/空间转录组/spatial/stereominer/gef/gem/bin/lasso/时空组 |
| Transcriptomics | bulk rna/转录组/rna-seq/差异表达 |
| Microbiomics | 宏基因组/metagenomic/微生物/16s/msap/宿主/rmhost |
| Proteomics | 蛋白/proteom/esmfold/结构/fold |
| Epigenomics | 甲基化/wgbs/chip/atac/表观/epigen |
| Metabonomics | 代谢/metabol |

## 4. 找数据优先级

0. **Genpilot 对话找数据（默认，第一动作；默认片区 = 时空片区 BGI-时空）**：`dcs_biolens_search` 默认在**项目在线容器里走 Genpilot 对话**找数据——Genpilot 助手的 biolens_search（BioLens 组学数据集索引，约 11.7 万条 / 139 来源库，`db.cngb.org/biolens/mcp`）既能命中公开数据集，也能**优先找到容器 /public 里已有的本地数据**；对话返回的只读检索命令由工具在容器内执行验证，给出 /public 真实命中路径/dcs_path。**宿主直连 BioLens MCP 始终作为补充通道**（mcp=true 默认：并行给出 `search_datasets`/`list_dataset_files` 的公开库记录与文件——bm25+向量排序、download_url；经 DCS Cloud 集成调用会补 `dcs_path`）。注意：容器 /public 数据只在 **BGI Center 片区（BGI-时空等）** 挂载，当前片区非时空时先 `dcs region switch BGI-时空`（或项目管理切换节点）再跑。key：`dcs_api_key set biolens <auth_key>`（db.cngb.org/biolens 申请）或 env `DCS_BIOLENS_KEY`。
1. **定组学类别**：按研究问题关键词 → 类别。
2. **找公共数据优先查容器 `/public`**：`dcs_container_ls` 列 `/public` 与 `/public/database/CNGBdb/pub/SciRAID/stomics/`（STDS 编号数据集），`dcs_data_inspect` 看 h5ad 结构；容器 `/public` 里没有的元数据或跨片区资源再用 `dcs_public_search` 搜公共库。
3. **官方流程优先**：`dcs_workflow_search(public=true)`，命中 official_tag=DCS 最稳。
4. **公共库最全片区**：BGI-时空（官方 103）/ DCS-华南1（总量 924）/ DCS-华北2（596）。
5. **数据文件补充**：`dcs_data_find` 在 `/Files` 全库按名称/类型/样本/SN/流程过滤；参考基因组在 `/Files/ReferenceData`。
6. **流程参数**：`dcs_workflow_info` 看 check_parameter（必填项）与 plan（多步规划）。

## 5. Genpilot 智能分析使用范式（实测自 PGP 项目）

PGP 项目（BGI-时空）里的真实离线任务揭示的标准用法：

**标准配置**
- 在线容器镜像：`ubuntu:24.04-python3.12`；资源：`4c 16g`（插件自动转换为 `vf=16g,num_proc=4`）
- 在线容器工作目录：`/work/{username}/{project}_{date}/`
- ⚠️ 离线任务（`dcs_offline_run`）环境不同：工作目录 `/data/work`，`/Files`、`share-data` 只读；挂载数据容器内需补全 `/data/input/` 前缀；镜像须为云平台镜像库 url 路径（如 `public-library/<名>:latest`，不要用 Docker Hub 短名，会报 `image_url不存在`）

**目录结构**
```
plan.md              执行计划与过程文档（步骤进度表 + 产物路径 + 方法学 + 总结）
scripts/stepN_*.py   编号步骤脚本，配套 *_run.log 与 *_exit_code.log
.env                 私有配置（LLM_MODEL / LLM_API_BASE / LLM_API_KEY / GENOS_API_KEY，git-ignore）
start.sh             Streamlit 应用启动器（经 notebook 网关）
output/              结果产物
```

**典型流水线**（以变异分析为例）
1. 提取变异 → 统计 → ClinVar/GWAS 注释
2. Genos 打分（`--shard N --total M` 分片并行，每片一条离线任务）
3. LLM 解读（`deepseek-v4-pro` 做变异解读/文献综合）
4. LLM 写论文（manuscript + refine）
5. LaTeX/PDF + 图表 + Streamlit 网页

**关键 API 端点**
- Genpilot LLM：`https://dcsapi.dcs.cloud/api/aigress/unified/v1/chat/completions`（OpenAI 兼容）
- 模型：`deepseek-v4-pro`

**Genpilot LLM 与 Genos 均为系统自带**
- 自动鉴权、模型自动选择，**无需额外填写 API key**。
- 鉴权由 DCS 在线容器环境自动注入（`DCS_X_ACCESS_TOKEN` / `DCS_OPENSANDBOX_TOKEN`，或系统自动生成的 `.env`）。
- 唯一需要用户提供的是 `dcs_pat_...`（仅用于 `dcs` CLI 登录）。

## 6. 插件工具对应

| 需求 | 工具 |
| --- | --- |
| 查图谱 | `dcs_atlas` |
| 数据检索 | **`dcs_biolens_search`**（默认片区=时空 BGI-时空；Genpilot 对话找数据·容器 /public 优先，第一动作；MCP 补充 11.7 万条/139 库）→ `dcs_container_ls`/`dcs_data_inspect`（容器 `/public` 验证）→ `dcs_public_search`（公共库元数据）→ `dcs_data_ls/find/info/download` |
| 流程复用 | `dcs_workflow_search/info` |
| 在线运行 | `dcs_terminal_exec/file` |
| 离线投递 | `dcs_offline_run` / `dcs_parallel_run`（分片并行）/ `dcs_workflow_run` |
| Genpilot LLM | `dcs_llm` |
| 计划追踪 | `dcs_plan`（Plan.md） |
| 审计 | `dcs_audit_script` |
| 报告 | `dcs_generate_report`（HTML） |
