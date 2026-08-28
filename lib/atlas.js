// dsh-dcs-cloud — DCS 云平台「数据库全图谱」（静态参考数据，供 dcs_atlas 工具与 agent 查询）。
// 内容基于 2026-08-19 对 dcs CLI v1.1.0 的实测梳理。公共库数量会随平台更新而变动，
// 这里记录的是当时快照与稳定的分类结构，用于「找数据更容易」而非替代实时查询。

// 片区图：BGI 中心节点（公共库更全，官方 DCS 流程多）与 DCS 公共云节点。
export const REGIONS = [
  { id: 'st', name: 'BGI-时空', type: 'bgi-center', publicWorkflows: 740, officialDcs: 103, note: 'BGI 中心核心节点，官方 DCS 流程最全（SAW/SC_Miner/Stereo_Miner 全系）' },
  { id: 'bgid_center', name: '医学-时空', type: 'bgi-center', publicWorkflows: 79, officialDcs: 39, note: '医学方向时空组学' },
  { id: 'bgid', name: '医学-华南1', type: 'bgi-center', publicWorkflows: 39, officialDcs: 39, note: '医学方向，官方流程齐全' },
  { id: 'cq', name: 'BGI-重庆1', type: 'bgi-center', publicWorkflows: null, officialDcs: null, note: '需先在片区内建项目才能查公共库' },
  { id: 'sugon', name: 'BGI-杭州1', type: 'bgi-center', publicWorkflows: null, officialDcs: null, note: '需先在片区内建项目' },
  { id: 'bgit', name: '科服-西南1', type: 'bgi-center', publicWorkflows: null, officialDcs: null, note: '科技服务方向，需建项目' },
  { id: 'wh', name: 'BGI-武汉1', type: 'bgi-center', publicWorkflows: null, officialDcs: null, note: '需建项目' },
  { id: 'iimr', name: 'BGI-武汉2', type: 'bgi-center', publicWorkflows: null, officialDcs: null, note: '需建项目' },
  { id: 'ali', name: 'DCS-华南1', type: 'dcs-public', publicWorkflows: 924, officialDcs: 85, note: '公共云主片区，公共流程总数最多（Genos 模型所在片区）' },
  { id: 've', name: 'DCS-华北2', type: 'dcs-public', publicWorkflows: 596, officialDcs: 38, note: '公共云，公共流程多' },
  { id: 'east2', name: 'DCS-华东2', type: 'dcs-public', publicWorkflows: null, officialDcs: null, note: '需建项目' },
];

// 官方组学工具库（dcs project omics_tools）：8 大类 → 官方 DCS 流程。
export const OMICS_TOOLS = [
  { code: 'Genomics', label: '基因组学', tools: ['DCS_Build_Index_FASTA', 'DCS_WGS_Germline_FASTQ_HumanOnly', 'DCS_WGS_Germline_FASTQ', 'DCS_WES_Germline_FASTQ', 'WGS-zbolt-fpga2', 'Lowpass_v5-NHS', 'ExpansionHunter_WGS_STR', 'seqarc_decompress', 'seqarc_index', 'seqarc_compress', 'PanGenie_WGS_SV', 'Lowpass_v5-Human', 'zbolt-build-index', 'Bcftools_Index_VCF', 'CNVpytor_WGS_CNV', 'LowpassSummary_v5'] },
  { code: 'Epigenomics', label: '表观基因组学', tools: [] },
  { code: 'Microbiomics', label: '微生物组学', tools: ['MSAP', 'minimap2-build-host-reference'] },
  { code: 'Transcriptomics', label: '转录组学', tools: ['BulkRNA-seq', 'BulkRNA-seq-build-index'] },
  { code: 'Proteomics', label: '蛋白质组学', tools: ['ESMFold'] },
  { code: 'Metabonomics', label: '代谢组学', tools: [] },
  { code: 'Single-cell Omics', label: '单细胞组学', tools: ['scVDJ-seq', 'SAW_spatial_scRNA_V2', 'scATAC-seq', 'scRNA-seq_v3', 'Copy-scRNA-seq_v3', 'Chips_scRNA_singlespecies_unlimited_S1', 'SAW_spatial_scRNA_V1', 'SC_Miner_Annotation', 'SC_Miner_Interaction', 'SC_Miner_Pseudotime', 'SC_Miner_Clustering', 'SC_Miner_Preprocessing', 'SC_Miner_data_qc', 'SC_Miner_Enrichment', 'SC_Miner_Autoannotation', 'SC_Miner_Clustering_dev', 'scRNA-seq_v3.1.5', 'Single-cell-multi-sample-anlysis', 'scVDJ-build-IMGT-ref', 'Chips_scRNA_singlespecies'] },
  { code: 'Spatial Omics', label: '空间组学（Stereo-seq）', tools: ['SAW-ST-V8', 'Stereo_Miner_Autoannotation', 'SAW-ST-V8-realign', 'SAW-ST-V6', 'Stereo_Miner_data_qc', 'Stereo_Miner_Enrichment', 'Stereo_Miner_Clustering', 'Stereo_Miner_Preprocessing', 'SAW-ST-V7', 'SAW-ST-V8-makeRef', 'SAW-ST-V8-clustering', 'SAW-ST-V8-Visualization', 'SAW-ST-V8-MIDFilter', 'SAW-ST-V8-img2rpi', 'SAW-ST-V8-gef2gem', 'SAW-ST-V8-diffexp', 'SAW-ST-V8-gem2gef', 'SAW-ST-V8-reanalyze-lasso', 'SAW-ST-V8-merge', 'SAW-ST-V8-checkGTF'] },
];

// 关键词 → 组学类别（帮助 agent 把研究问题映射到正确的工具类别）。
export const KEYWORD_TO_CATEGORY = [
  { keywords: ['wgs', 'wes', 'germline', '变异', 'snp', 'indel', 'cnv', 'sv', 'str', 'lowpass', '低深度', '全基因组', '外显子', '建索引', 'fasta'], category: 'Genomics' },
  { keywords: ['scrna', '单细胞', 'single cell', 'scatac', 'scvdj', 'vdj', '免疫组', 'cell line', '细胞系', 'multi-sample'], category: 'Single-cell Omics' },
  { keywords: ['stereo-seq', 'saw', '空间转录组', 'spatial', 'stereominer', 'stereo', 'gef', 'gem', 'bin', 'lasso', '时空组'], category: 'Spatial Omics' },
  { keywords: ['bulk rna', 'bulk-rna', '转录组', 'rna-seq', 'rnaseq', '差异表达'], category: 'Transcriptomics' },
  { keywords: ['宏基因组', 'metagenomic', '微生物', 'microbiome', '16s', 'msap', '宿主', 'rmhost'], category: 'Microbiomics' },
  { keywords: ['蛋白', 'proteom', 'esmfold', '结构', 'fold'], category: 'Proteomics' },
  { keywords: ['甲基化', 'wgbs', 'chip', 'atac', '表观', 'epigen'], category: 'Epigenomics' },
  { keywords: ['代谢', 'metabol'], category: 'Metabonomics' },
];

export function searchHints() {
  return `找数据/找流程的优先级：
1. 先定组学类别：按研究问题关键词 → 类别（Genomics/Single-cell/Spatial/Transcriptomics/Microbiomics/Proteomics/Epigenomics/Metabonomics）。
2. 找公共数据优先查容器 /public：dcs_container_ls 列 /public 与 /public/database/CNGBdb/pub/SciRAID/stomics/（STDS 编号数据集），再用 dcs_data_inspect 看 h5ad 结构（细胞类型/基因）；容器 /public 里没有的元数据或跨片区资源再用 dcs_public_search 搜公共库。
3. 官方流程优先：用 dcs_workflow_search（public=true）查公共库，命中 official_tag=DCS 的流程最稳（有官方维护与参数说明）。
4. 公共库最全的片区：BGI-时空（官方 DCS 流程 103 个最全）、DCS-华南1（公共流程总数 924 最多）、DCS-华北2（596）。查某片区公共库先 dcs region switch <region> 且需在该片区有项目。
5. 数据文件补充：dcs_data_find 在 /Files 全库按名称/类型/样本/SN/流程过滤；参考基因组在 /Files/ReferenceData。
6. 流程参数：dcs_workflow_info 看 check_parameter（必填项）与 plan（多步规划），再 dcs_workflow_run 投递。`;
}

// Genpilot 智能分析的实际使用范式（实测自 PGP 项目的真实任务）。
export const GENPILOT_PATTERN = {
  standardImage: 'ubuntu:24.04-python3.12',
  standardResource: '4c 16g',
  workDir: '/work/{username}/{project}_{date}/',
  dirLayout: [
    'plan.md              — 执行计划与过程文档（步骤进度表 + 产物路径 + 方法学 + 总结）',
    'scripts/stepN_*.py   — 编号步骤脚本，配套 *_run.log 与 *_exit_code.log',
    '.env                 — 系统自动生成的配置（LLM_MODEL / LLM_API_BASE 等；Genpilot chat 鉴权由系统注入 LLM_API_KEY，Genos 预测需用户通过 dcs_api_key 配置）',
    'start.sh             — Streamlit 应用启动器（经 notebook 网关）',
    'output/              — 结果产物',
  ],
  llmApiBase: 'https://dcsapi.dcs.cloud/api/aigress/unified/v1/chat/completions',
  llmModel: 'deepseek-v4-pro',
  // Genpilot 与 Genos 是两种不同的模型：
  //   - Genpilot LLM：对话/写作模型（deepseek-v4-pro 等），经 unified API 调用，鉴权由 DCS 系统注入 LLM_API_KEY。
  //   - Genos 系列：基因组预测模型（1.2B，VCF→RNA 表达信号），调用 Genos-Mutation 预测 API，需用户 API key（sk-...，从 DCS Cloud「个人资料→API_key 管理」申请，通过 dcs_api_key 配置）。
  note: 'Genpilot LLM 与 Genos 模型均为 DCS 系统自带。Genpilot 对话模型自动鉴权（LLM_API_KEY 由系统注入）；Genos 预测模型需用户 API key（通过 dcs_api_key 配置）。',
};

export function genpilotHints() {
  return `Genpilot 智能分析典型用法（实测 PGP）：
1. 在在线容器 /work/{user}/{project}_{date}/ 建项目目录，写 plan.md（步骤进度表）。
2. 写 scripts/stepN_*.py 分步脚本；密钥由 DCS 系统自动注入，无需手动填写 API key。
3. 长任务/并行：把脚本按 --shard N --total M 分片，每片用 dcs_offline_run 投递一条离线任务（标准镜像 ubuntu:24.04-python3.12、资源 4c 16g）。
4. 简单/交互：dcs_terminal_exec 在线运行。
5. 解读与写作：dcs_llm 调 DCS 系统 Genpilot LLM（deepseek-v4-pro 等对话模型，自动选模型），用于文献综合/变异解读/论文写作。注意 Genpilot chat 与 Genos 预测模型不同——Genos 是 VCF→RNA 信号预测（1.2B），需用户 API key（通过 dcs_api_key 配置后调用 Genos-VEP/genos-mutation skill）。
6. 产物：dcs_generate_report 出 HTML 网页；dcs_plan 出 Plan.md。`;
}

// 在线容器 /public 目录结构（公共数据/工具/参考，找数据的第一优先级）。
export const CONTAINER_PUBLIC = {
  path: '/public',
  dirs: [
    { name: 'database', desc: '生信数据库高频数据合集（15 个库）' },
    { name: 'database/CNGBdb', desc: '多组学公共数据集（MOSTA/HESTA 等，路径 pub/SciRAID/stomics/）' },
    { name: 'database/Genome', desc: '参考基因组（按物种分类 Mammalia/Plant/...）' },
    { name: 'demo', desc: 'demo 数据（snpEff/wes/wgs）' },
    { name: 'reference', desc: '参考索引' },
    { name: 'resources', desc: '资源' },
    { name: 'skills', desc: '技能库' },
    { name: 'tools', desc: '生信工具（star/gatk/samtools/...）' },
  ],
};

// CNGBdb 公共时空/单细胞数据集目录（/public/database/CNGBdb/pub/SciRAID/stomics/）。
export const PUBLIC_DATASETS = [
  { code: 'STDS0000058', name: 'MOSTA 小鼠器官发生时空转录组图谱', note: 'E9.5-E16.5 胚胎多器官，含 cell_bin 单细胞分割 h5ad', dir: 'STDS0000058' },
  { code: 'STDS0000394', name: 'HESTA 人类胚胎发生时空转录组图谱', note: '人类胚胎', dir: 'STDS0000394' },
  { code: 'STDS0000057', name: 'ZESTA 斑马鱼胚胎发生时空转录组图谱', note: '斑马鱼', dir: 'STDS0000057' },
  { code: 'STDS0000056', name: 'ARTISTA 美西螈端脑再生与发育时空图谱', note: '美西螈', dir: 'STDS0000056' },
  { code: 'STDS0000059', name: '小鼠肝脏再生时空细胞图谱', note: '多组学', dir: 'STDS0000059' },
  { code: 'STDS0000062', name: '小鼠肺解剖与功能时空转录组', note: '肺', dir: 'STDS0000062' },
  { code: 'STDS0000235', name: '胚胎小鼠脑空间转录组图', note: '神经发生', dir: 'STDS0000235' },
  { code: 'STDS0000239', name: '胆汁淤积性损伤与修复时空图谱', note: '肝脏', dir: 'STDS0000239' },
  { code: 'STDS0000060', name: '发育中果蝇胚胎与幼虫时空转录组图谱', note: '果蝇', dir: 'STDS0000060' },
];

export function containerHints() {
  return `在线容器找公共数据（第一优先级）：
1. dcs_container_ls 列 /public（公共库挂载目录）。
2. 时空/单细胞公共数据集在 /public/database/CNGBdb/pub/SciRAID/stomics/（STDS 编号，如 MOSTA=STDS0000058）。
3. 用 dcs_container_ls 列 STDS 目录找到 h5ad/csv；用 dcs_data_inspect 看 h5ad 结构（细胞类型 annotation / 基因）。
4. 参考基因组在 /public/database/Genome/<物种>/；工具在 /public/tools/。`;
}

// Genpilot 提供的 AI 模型（公共库 ai_model 资源，zone=ve）。
export const GENPILOT_MODELS = [
  { id: 'auto', label: '自动选择（agent 决定）' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro（旗舰，默认）' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash（轻量高速）' },
  { id: 'qwen3.7-max', label: 'Qwen3.7 Max' },
  { id: 'qwen3.6-plus', label: 'Qwen3.6 Plus（视觉语言）' },
  { id: 'qwen3.5-flash', label: 'Qwen3.5 Flash' },
  { id: 'glm-5.2', label: 'GLM-5.2' },
  { id: 'glm-5.1', label: 'GLM-5.1' },
  { id: 'kimi-k3', label: 'Kimi K3' },
  { id: 'kimi-k2.6', label: 'Kimi K2.6' },
  { id: 'kimi-k2.5', label: 'Kimi K2.5（多模态）' },
];

// ---- DCS Genpilot 平台「原生技能库」（容器 /public/skills，找可复用 skill 的第一优先级）----
export const SKILLS_BASE = '/public/skills';
export const SKILLS_SNAPSHOT = SKILLS_BASE + '/skills_snapshot.json';
export const EXPERT_BASE = SKILLS_BASE + '/experts';
// 技能库顶级目录：DCS 原生（前两个）与社区/生物信息技能集；skills_snapshot 覆盖前 6 个（973 条）。
export const SKILL_TOP_DIRS = ['dcs-skills', 'builtin_skills', 'OmicsClaw', 'LabClaw', 'bioSkills', 'claude-scientific-skills', 'ClawBio'];
// 已确认的专家（每项含 AGENTS.md + SOUL.md + 若干子技能）。
// 覆盖 DCS 平台实际存在的 7 位专家；顺序即「分析类专家在前、把关/评审类在后」的路由偏好。
export const EXPERTS = [
  'scrna-seq-expert', 'stereo-seq-expert', 'wgs-wes-germline-expert',
  'cima-expert', 'hcc-multiomics-pathology-expert', 'cell-annotation-expert',
  // 评审/把关类：不吃上游重跑，只审已有结果/技能/文章；与分析专家组成「分析→把关」接力链
  'critical-review-expert',
];

// 分析类专家（承接上游流程重跑/调参），评审类专家（只吃结果与结论，做证据化把关）。
export const EXPERT_KIND = {
  'scrna-seq-expert': 'analysis',
  'stereo-seq-expert': 'analysis',
  'wgs-wes-germline-expert': 'analysis',
  'cima-expert': 'analysis',
  'hcc-multiomics-pathology-expert': 'analysis',
  'cell-annotation-expert': 'analysis',
  'critical-review-expert': 'review',
};

export function skillsHints() {
  return `DCS Genpilot 原生技能库（容器 /public/skills）：
1. 总索引 skills_snapshot.json（973 条，每条 {name, description, path, metadata}）。
2. 顶级目录：dcs-skills（DCS 原生，5 个：BiOmics-KG-interpretation / Genos-VEP / clinical-metagenome-machinelearning / genos-mutation / publish-workflow-best-practice）、builtin_skills（内置：dcs-data-manager / dcs-workflow-skill / dcs-skills-manager / genpilot 等）、OmicsClaw / LabClaw / bioSkills / claude-scientific-skills / ClawBio（生物信息技能集，按组学与操作拆分）。
3. 专家（experts 目录）：scrna-seq-expert / stereo-seq-expert / wgs-wes-germline-expert / cima-expert / hcc-multiomics-pathology-expert，每个含 AGENTS.md + SOUL.md + 子技能。
4. 用法：发起分析前先 dcs_skills_list 按类别/关键词检索可复用 skill → dcs_skill_read 读 SKILL.md；需要某方向专家则 dcs_experts_list → dcs_expert_read 读取专家定义（AGENTS.md/SOUL.md），把其思路与模板融入方案与产出。
5. 个人技能：用户可在自己的容器 /work/{user}/skills/<技能名>/SKILL.md 自建技能（dcs_skills_list 传 scope=personal 列出，dcs_skill_read 传 personal/<技能名> 或叶子名读取），个人技能优先于同名公共技能。`;
}

// ---- 需要 API key 的技能（skill 名 → 所需 env var / 描述 / 获取方式）----
// dcs_api_key 工具据此管理 key；skill 调用时自动注入当前配置的 key。
export const API_KEY_SKILLS = [
  {
    name: 'genos_vep',
    envVar: 'HG38_VCF_PREDICT_API_KEY',
    label: 'Genos-VEP（Genos-Mutation VCF 变异效应预测）',
    desc: '调用 Genos-Mutation API 预测 VCF 变异对 RNA-seq 表达信号的影响。API key 从 DCS Cloud「个人资料→API_key 管理」申请，仅限本 skill。',
    apiUrl: 'https://www.dcs.cloud/api/aigateway/genos/person/predict_rna_seq_tracks/vcf',
    skills: ['dcs-skills/Genos-VEP'],
  },
  {
    name: 'genos_mutation',
    envVar: 'HG38_VCF_PREDICT_API_KEY',
    label: 'Genos-Mutation（基因变异效应预测）',
    desc: '与 Genos-VEP 共用同一 API key。用于 VCF 变异效应预测的底层 API。',
    apiUrl: 'https://www.dcs.cloud/api/aigateway/genos/person/predict_rna_seq_tracks/vcf',
    skills: ['dcs-skills/genos-mutation'],
  },
  {
    name: 'genos',
    envVar: 'HG38_VCF_PREDICT_API_KEY',
    label: 'Genos 全系（Genos-VEP + Genos-Mutation）',
    desc: 'Genos 系列所有技能共用同一个 API key。',
    apiUrl: 'https://www.dcs.cloud/api/aigateway/genos/person/predict_rna_seq_tracks/vcf',
    skills: ['dcs-skills/Genos-VEP', 'dcs-skills/genos-mutation'],
  },
];
