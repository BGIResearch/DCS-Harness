// dsh-dcs-cloud v2.0 — DCS Harness 项目/模块/运行/交付 存储（Host 侧，纯 Node）。
// 支撑 DCS Harness 独立页面的三个窗口：
//   - 任务交互：项目的任务分解（modules）+ 执行状态
//   - 项目管理：模块的运行版本（每次重跑新增一个 Run）、文件清单、资源消耗（dsh tokens + dcs 费用）
//   - 结果交付：论文式交付文档（8 个章节），关键节点整体梳理更新（revision 递增）
// 持久化于 ~/.dsh/dcs-projects.json，按 sessionId 作用域（每个对话一个项目）。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const VALID_STATUS = ['pending', 'running', 'done', 'failed', 'blocked'];
const VALID_FILE_KINDS = ['code', 'input', 'output'];
// Human-in-the-loop 审阅状态（节点级，与执行 status 正交）：
//   none       未设闸门/无需审阅（普通节点）
//   gate       人工把关闸门，等待人批准（check 节点）
//   reviewing  已提交待审（等价 gate，兼容写作）
//   approved   人已批准，可执行
//   rejected   人被否决，需 AI 回退/重设计
const VALID_REVIEW = ['none', 'gate', 'reviewing', 'approved', 'rejected'];
// 交付文档章节（论文写作逻辑顺序）
export const DELIVERY_SECTIONS = [
  'question',      // 科学问题
  'hypothesis',    // 科学假说
  'decomposition', // 科学问题分解（可检验子问题）
  'data',          // 原始数据
  'methods',       // 分析方法
  'findings',      // 科学发现与主要结论
  'novelty',       // 创新性与已有科研结果的关系
  'nextSteps',     // 下一步计划与建议
  'trajectory',    // 执行轨迹（ReAct 推理图的可读产物，可由 includeTrajectory 自动汇总）
];

export function projectsPath() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dcs-projects.json');
}

// ---- 进程内互斥锁：串行化 dcs-projects.json 的读-改-写，避免多会话并发覆盖 ----
// 用 Promise 链实现：每个写操作排队，前一个完成后才执行下一个，保证读-改-写原子。
let projectLockChain = Promise.resolve();
export function withProjectLock(work) {
  const run = projectLockChain.then(work, work);
  // 无论成败都释放锁，且不把一次失败传给下一次
  projectLockChain = run.catch(() => {});
  return run;
}

function loadAll() {
  try {
    const d = JSON.parse(readFileSync(projectsPath(), 'utf8'));
    if (Array.isArray(d)) return d; // 兼容旧格式：裸数组
    return Array.isArray(d && d.projects) ? d.projects : [];
  } catch {
    return [];
  }
}

function saveAll(projects) {
  mkdirSync(dirname(projectsPath()), { recursive: true });
  writeFileSync(projectsPath(), JSON.stringify({ projects }, null, 2));
}

// ---- 归一化 ----

function normFile(f, kind) {
  return {
    name: String(f.name || f.path || ''),
    path: String(f.path || f.name || ''),
    desc: String(f.desc || ''),
    kind: VALID_FILE_KINDS.includes(f.kind) ? f.kind : kind,
    size: typeof f.size === 'number' ? f.size : null,
    mtime: f.mtime ? String(f.mtime) : '',
  };
}

function normFiles(files) {
  const out = { code: [], input: [], output: [] };
  if (!files || typeof files !== 'object') return out;
  for (const kind of VALID_FILE_KINDS) {
    const list = Array.isArray(files[kind]) ? files[kind] : [];
    out[kind] = list.map((f) => normFile(f, kind));
  }
  return out;
}

// ---- 执行轨迹（OAA 三段式 + 自评 verdict）----
// Biomni 式「执行中自批评/自适应 refine」在运行粒度上的显式记录：
//   oaa        观察(observation)→评估(assessment)→行动(action) 三段式（ReAct 推理图节点）
//   selfReview 自评节点输出：verdict(pass/revise/rerun) + 证据 + 风险 + 下一步
function normOaa(o) {
  if (!o || typeof o !== 'object') return null;
  return {
    observation: String(o.observation || o.obs || ''),
    assessment: String(o.assessment || o.assess || ''),
    action: String(o.action || ''),
  };
}

function normSelfReview(s) {
  if (!s || typeof s !== 'object') return null;
  const verdict = String(s.verdict || '').trim().toLowerCase();
  return {
    verdict: ['pass', 'revise', 'rerun'].includes(verdict) ? verdict : '', // 非法 verdict 归空，避免样式/逻辑被污染
    evidence: String(s.evidence || ''),
    risks: Array.isArray(s.risks) ? s.risks.map(String) : [],
    nextAction: String(s.nextAction || s.next_action || ''),
  };
}

function normRun(r, version) {
  return {
    id: String(r.id || 'run-' + Math.random().toString(36).slice(2, 8)),
    version: version || String(r.version || 1),
    status: VALID_STATUS.includes(r.status) ? r.status : 'running',
    startedAt: r.startedAt || Date.now(),
    finishedAt: r.finishedAt || null,
    dcsTaskIds: Array.isArray(r.dcsTaskIds) ? r.dcsTaskIds.map(String) : (r.dcs_task_ids ? r.dcs_task_ids.map(String) : []),
    files: normFiles(r.files),
    dcsCost: typeof r.dcsCost === 'number' ? r.dcsCost : (typeof r.dcs_cost === 'number' ? r.dcs_cost : null),
    dshTokens: typeof r.dshTokens === 'number' ? r.dshTokens : (typeof r.dsh_tokens === 'number' ? r.dsh_tokens : null),
    progress: typeof r.progress === 'number' ? Math.max(0, Math.min(100, Math.floor(r.progress))) : (r.status === 'done' ? 100 : (r.status === 'running' ? 50 : 0)),
    notes: String(r.notes || ''),
    oaa: normOaa(r.oaa),
    selfReview: normSelfReview(r.selfReview),
  };
}

function normModule(m) {
  return {
    id: String(m.id || 'module-' + Math.random().toString(36).slice(2, 8)),
    name: String(m.name || m.title || '未命名模块'),
    desc: String(m.desc || ''),
    status: VALID_STATUS.includes(m.status) ? m.status : 'pending',
    // ---- Human-in-the-loop 审阅字段（节点级闸门） ----
    isGate: Boolean(m.isGate),                 // 是否人工把关闸门（check 节点）
    review: VALID_REVIEW.includes(m.review) ? m.review : 'none', // 审阅状态
    reviewLog: Array.isArray(m.reviewLog) ? m.reviewLog.map(normReviewEntry) : [], // 人机纠正/批准历史
    dependsOn: Array.isArray(m.dependsOn) ? m.dependsOn.map(String) : [],           // 显式依赖（供画布连线）
    createdAt: m.createdAt || Date.now(),
    updatedAt: m.updatedAt || Date.now(),
    runs: Array.isArray(m.runs) ? m.runs.map((r, i) => normRun(r, r.version || String(i + 1))) : [],
  };
}

function normReviewEntry(e) {
  const now = Date.now();
  return {
    id: typeof e === 'object' && e && e.id ? String(e.id) : 'rv-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    at: typeof e === 'object' && e && e.at ? Number(e.at) : now,
    actor: typeof e === 'object' && e ? String(e.actor || 'user') : 'user', // user / ai
    action: typeof e === 'object' && e ? String(e.action || 'comment') : 'comment', // propose / approve / correct / veto / comment / revise
    text: typeof e === 'object' && e ? String(e.text || '') : String(e || ''),
    // 动态闭环字段：用户反馈是否已被 AI 处理；AI 回复指向哪条用户反馈
    addressed: typeof e === 'object' && e && e.addressed !== undefined ? Boolean(e.addressed) : false,
    replyTo: typeof e === 'object' && e && e.replyTo ? String(e.replyTo) : '',
  };
}

/** 需要 AI 响应的用户反馈动作（approve 只是放行，不算修订诉求） */
const FEEDBACK_ACTIONS = ['correct', 'propose', 'comment', 'veto'];

/** 列出项目内所有未被 AI 处理的人工反馈（动态调整闭环的查询侧）。 */
export async function listPendingFeedback(projectId, sessionId) {
  return withProjectLock(() => {
    const all = loadAll();
    const pIdx = all.findIndex((p) => p.id === projectId && (!sessionId || p.sessionId === sessionId));
    if (pIdx < 0) return { ok: false, error: '项目不存在: ' + projectId };
    const project = all[pIdx];
    const modules = [];
    for (const module of project.modules) {
      const pending = (module.reviewLog || []).filter(
        (e) => e.actor === 'user' && FEEDBACK_ACTIONS.includes(e.action) && !e.addressed
      );
      if (pending.length) {
        modules.push({ moduleId: module.id, name: module.name, desc: module.desc || '', status: module.status, review: module.review, pending });
      }
    }
    return { ok: true, projectTitle: project.title, total: modules.reduce((n, m) => n + m.pending.length, 0), modules };
  });
}

/** AI 回复某模块的人工反馈：追加 actor='ai' 条目，并把引用的用户反馈标记为已处理。 */
export async function replyFeedback(projectId, moduleId, text, sessionId) {
  return withProjectLock(() => {
    const all = loadAll();
    const pIdx = all.findIndex((p) => p.id === projectId && (!sessionId || p.sessionId === sessionId));
    if (pIdx < 0) return { ok: false, error: '项目不存在: ' + projectId };
    const project = all[pIdx];
    const module = project.modules.find((m) => m.id === String(moduleId));
    if (!module) return { ok: false, error: '模块不存在: ' + moduleId };
    const now = Date.now();
    const pending = (module.reviewLog || []).filter(
      (e) => e.actor === 'user' && FEEDBACK_ACTIONS.includes(e.action) && !e.addressed
    );
    // 存量数据兼容：老条目可能没有 id，先补齐再引用
    for (const e of pending) {
      if (!e.id) e.id = 'rv-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }
    module.reviewLog = module.reviewLog || [];
    module.reviewLog.push(normReviewEntry({
      at: now, actor: 'ai', action: 'revise',
      text: String(text || ''),
      replyTo: pending.map((e) => e.id).join(','),
    }));
    for (const e of pending) e.addressed = true;
    module.updatedAt = now;
    project.updatedAt = now;
    saveAll(all);
    return { ok: true, resolved: pending.length, module, project };
  });
}

function normDelivery(d) {
  const sections = {};
  for (const key of DELIVERY_SECTIONS) {
    sections[key] = String((d && d.sections && d.sections[key]) || '');
  }
  return {
    updatedAt: (d && d.updatedAt) || 0,
    revision: (d && d.revision) || 0,
    sections,
    charts: Array.isArray(d && d.charts) ? d.charts : [],
  };
}

// 兼容旧数据：把 genomes/annotations/other 三项合并为自由 items 列表
function buildItemsFromLegacy(cd) {
  const out = [];
  const add = (arr, prefix) => {
    if (Array.isArray(arr)) for (const x of arr) {
      const s = String(x || '');
      if (s) out.push({ path: s, desc: prefix });
    }
  };
  add(cd && cd.genomes, '基因组');
  add(cd && cd.annotations, '注释');
  add(cd && cd.other, '其他');
  return out;
}

function normProject(p, sessionId) {
  return {
    id: String(p.id || 'project-' + Math.random().toString(36).slice(2, 8)),
    sessionId: String(p.sessionId || sessionId || ''),
    title: String(p.title || '未命名 DCS 研究项目'),
    objective: String(p.objective || ''),
    model: String(p.model || 'auto'),
    resources: String(p.resources || ''),
    region: String(p.region || ''), // 项目关联的 DCS 节点（片区）
    status: VALID_STATUS.includes(p.status) ? p.status : 'pending',
    // Phase3：用户自定义数据地址（自由输入，不限类型；每项 {path, desc}，向右兼容旧 genomes/annotations/other）
    customData: {
      items: Array.isArray(p.customData && p.customData.items)
        ? p.customData.items.map((it) => ({ path: String((it && it.path) || ''), desc: String((it && it.desc) || '') }))
        : buildItemsFromLegacy(p.customData),
      note: String((p.customData && p.customData.note) || ''),
      genomes: Array.isArray(p.customData && p.customData.genomes) ? p.customData.genomes.map(String) : [],
      annotations: Array.isArray(p.customData && p.customData.annotations) ? p.customData.annotations.map(String) : [],
      other: Array.isArray(p.customData && p.customData.other) ? p.customData.other.map(String) : [],
    },
    // Phase3：分析计划（规划阶段）+ 互动状态（drafting 草拟中 / awaiting_review 待确认 / approved 已批准）
    plan: {
      content: String((p.plan && p.plan.content) || ''),
      planStatus: String((p.plan && p.plan.planStatus) || 'drafting'),
      stepIds: Array.isArray(p.plan && p.plan.stepIds) ? p.plan.stepIds.map(String) : [],
      updatedAt: (p.plan && p.plan.updatedAt) || 0,
    },
    // Phase3：里程碑质检（关键节点质检清单），每项 {name, status, check, updatedAt}
    milestones: Array.isArray(p.milestones) ? p.milestones.map(normMilestone) : [],
    // 执行看门狗（防意外暂停）：approved 计划在未得到最终结论前持续守护，
    // 检测到 LLM/连接等意外导致执行停滞后自动唤醒 agent 断点续跑。
    watchdog: normWatchdog(p.watchdog),
    createdAt: p.createdAt || Date.now(),
    updatedAt: p.updatedAt || Date.now(),
    modules: Array.isArray(p.modules) ? p.modules.map(normModule) : [],
    delivery: normDelivery(p.delivery),
  };
}

// 执行看门狗状态归一化（watchdog）：
//   enabled    是否已启用（planStatus=approved 时自动打开）
//   lastWakeAt 上次自动唤醒时间（冷却用，避免高频打扰）
//   wakes      累计自动唤醒次数（防无限循环，超上限标记需要人工介入）
//   blockedAt  判定为「需人工介入」的时间（0=正常守护中）
//   lastReason 上次判定/唤醒的原因
function normWatchdog(w) {
  if (!w || typeof w !== 'object') return { enabled: false, lastWakeAt: 0, wakes: 0, blockedAt: 0, lastReason: '' };
  return {
    enabled: w.enabled !== undefined ? Boolean(w.enabled) : false,
    lastWakeAt: typeof w.lastWakeAt === 'number' ? w.lastWakeAt : 0,
    wakes: typeof w.wakes === 'number' ? w.wakes : 0,
    blockedAt: typeof w.blockedAt === 'number' ? w.blockedAt : 0,
    lastReason: String(w.lastReason || ''),
  };
}

// 里程碑质检项归一化
function normMilestone(m) {
  return {
    name: String((m && m.name) || '里程碑'),
    status: VALID_STATUS.includes(m && m.status) ? m.status : 'pending',
    check: String((m && m.check) || ''),
    updatedAt: (m && m.updatedAt) || 0,
  };
}

// ---- 读取 ----

export function listProjects(sessionId) {
  const all = loadAll();
  return sessionId ? all.filter((p) => p.sessionId === sessionId) : all;
}

export function getProject(projectId, sessionId) {
  const all = loadAll();
  return all.find((p) => p.id === projectId && (!sessionId || p.sessionId === sessionId)) || null;
}

function projectIndex(projectId, sessionId) {
  return loadAll().findIndex((p) => p.id === projectId && (!sessionId || p.sessionId === sessionId));
}

// ---- 写操作 ----

/** 创建或更新项目级信息（标题/目标/模型/资源/状态）。 */
export async function upsertProject(input, sessionId) {
  return withProjectLock(() => {
    const sid = sessionId || input.sessionId || '';
    const all = loadAll();
    const now = Date.now();
    let idx;
    if (input.project_id || input.task_id) {
      idx = all.findIndex((p) => p.id === String(input.project_id || input.task_id) && (!sid || p.sessionId === sid));
    } else {
      idx = -1;
    }
    let project;
    if (idx >= 0) {
      project = normProject({ ...all[idx], ...input, updatedAt: now }, sid);
      project.createdAt = all[idx].createdAt || now;
      all[idx] = project;
    } else {
      project = normProject({ ...input, id: input.project_id || input.task_id || undefined, createdAt: now, updatedAt: now }, sid);
      all.unshift(project);
    }
    saveAll(all.slice(0, 200));
    return project;
  });
}

/** 更新项目的轻量字段（如模型选择），不影响模块与交付。 */
export async function mergeProject(projectId, patch, sessionId) {
  return withProjectLock(() => {
    const idx = projectIndex(projectId, sessionId);
    if (idx < 0) return { ok: false, error: '项目不存在: ' + projectId };
    const all = loadAll();
    const p = all[idx];
    if (patch.title !== undefined) p.title = String(patch.title);
    if (patch.objective !== undefined) p.objective = String(patch.objective);
    if (patch.model !== undefined) p.model = String(patch.model);
    if (patch.resources !== undefined) p.resources = String(patch.resources);
    if (patch.region !== undefined) p.region = String(patch.region);
    if (patch.status !== undefined && VALID_STATUS.includes(patch.status)) p.status = patch.status;
    // Phase3：自定义数据地址（自由输入，不限类型）
    if (patch.customData !== undefined && patch.customData !== null) {
      const cd = patch.customData || {};
      if (!p.customData) p.customData = { items: [], genomes: [], annotations: [], other: [], note: '' };
      if (Array.isArray(cd.items)) p.customData.items = cd.items.map((it) => ({ path: String((it && it.path) || ''), desc: String((it && it.desc) || '') }));
      // 兼容旧字段
      if (Array.isArray(cd.genomes)) p.customData.genomes = cd.genomes.map(String);
      if (Array.isArray(cd.annotations)) p.customData.annotations = cd.annotations.map(String);
      if (Array.isArray(cd.other)) p.customData.other = cd.other.map(String);
      if (cd.note !== undefined) p.customData.note = String(cd.note);
    }
    // Phase3：分析计划/互动状态
    if (patch.plan !== undefined && patch.plan !== null) {
      const pl = patch.plan || {};
      if (!p.plan) p.plan = { content: '', planStatus: 'drafting', stepIds: [], updatedAt: 0 };
      if (pl.content !== undefined) p.plan.content = String(pl.content);
      if (pl.planStatus !== undefined) p.plan.planStatus = String(pl.planStatus);
      if (Array.isArray(pl.stepIds)) p.plan.stepIds = pl.stepIds.map(String);
      p.plan.updatedAt = Date.now();
    }
    // Phase3：里程碑质检（整体替换或按 name 更新）
    if (patch.milestones !== undefined && Array.isArray(patch.milestones)) {
      const byName = {};
      for (const m of p.milestones) byName[m.name] = m;
      p.milestones = patch.milestones.map((m) => {
        const name = String(m && m.name || '里程碑');
        const prev = byName[name] || {};
        return normMilestone({
          ...prev,
          ...m,
          name,
          updatedAt: (m && m.updatedAt) || Date.now(),
        });
      });
    }
    p.updatedAt = Date.now();
    saveAll(all);
    return { ok: true, project: p };
  });
}

// ---- 执行看门狗（防意外暂停）----

/**
 * 列出所有「已批准、未终结」且「仍待执行」的项目（跨会话扫描，供看门狗巡检）。
 * 判定「仍待执行」：存在未完成模块（status 非 done），且无任何 running 模块/运行。
 */
export function listWatchdogCandidates() {
  return loadAll().filter((p) => {
    const planApproved = p.plan && p.plan.planStatus === 'approved';
    const finished = p.status === 'done' || p.status === 'failed' || p.status === 'blocked';
    if (!planApproved || finished) return false;
    const modules = Array.isArray(p.modules) ? p.modules : [];
    if (!modules.length) return false;
    const pendingWork = modules.some((m) => m.status !== 'done');
    if (!pendingWork) return false;
    const busy = modules.some((m) => m.status === 'running' || (Array.isArray(m.runs) && m.runs.some((r) => r.status === 'running')));
    return !busy;
  });
}

/** 项目最近一次「实质推进」时间：取所有模块/运行的 updatedAt/startedAt 最大值。 */
export function projectLastActivity(p) {
  let t = (p && p.updatedAt) || 0;
  const modules = Array.isArray(p && p.modules) ? p.modules : [];
  for (const m of modules) {
    if (m.updatedAt > t) t = m.updatedAt;
    if (m.createdAt > t) t = m.createdAt;
    for (const r of (Array.isArray(m.runs) ? m.runs : [])) {
      if (r.startedAt > t) t = r.startedAt;
      if (r.finishedAt && r.finishedAt > t) t = r.finishedAt;
    }
  }
  return t;
}

/** 更新看门狗状态（lastWakeAt / wakes / blockedAt / lastReason）。 */
export async function updateWatchdog(projectId, patch, sessionId) {
  return withProjectLock(() => {
    const idx = projectIndex(projectId, sessionId);
    if (idx < 0) return { ok: false, error: '项目不存在: ' + projectId };
    const all = loadAll();
    const p = all[idx];
    const cur = normWatchdog(p.watchdog);
    p.watchdog = normWatchdog({ ...cur, ...(patch || {}) });
    saveAll(all);
    return { ok: true, project: p };
  });
}

/** 创建模块或更新模块元信息（name/desc/status）。 */
export async function upsertModule(projectId, input, sessionId) {
  return withProjectLock(() => {
    const all = loadAll();
    const idx = all.findIndex((p) => p.id === projectId && (!sessionId || p.sessionId === sessionId));
    if (idx < 0) return { ok: false, error: '项目不存在: ' + projectId };
    const project = all[idx];
    let mIdx;
    if (input.module_id) {
      mIdx = project.modules.findIndex((m) => m.id === String(input.module_id));
    } else {
      mIdx = -1;
    }
    const now = Date.now();
    let module;
    if (mIdx >= 0) {
      const prev = project.modules[mIdx];
      module = normModule({
        ...prev,
        name: input.name !== undefined ? String(input.name) : prev.name,
        desc: input.desc !== undefined ? String(input.desc) : prev.desc,
        status: input.status !== undefined && VALID_STATUS.includes(input.status) ? input.status : prev.status,
        // Human-in-the-loop 字段：仅在显式传入时更新，避免覆盖已有人工审阅结果
        isGate: input.isGate !== undefined ? Boolean(input.isGate) : prev.isGate,
        review: input.review !== undefined && VALID_REVIEW.includes(input.review) ? input.review : prev.review,
        dependsOn: input.dependsOn !== undefined ? (Array.isArray(input.dependsOn) ? input.dependsOn.map(String) : prev.dependsOn) : prev.dependsOn,
        updatedAt: now,
      });
      project.modules[mIdx] = module;
    } else {
      module = normModule({
        id: input.module_id || undefined,
        name: input.name,
        desc: input.desc,
        status: input.status || 'pending',
        isGate: Boolean(input.isGate),
        review: VALID_REVIEW.includes(input.review) ? input.review : 'none',
        dependsOn: Array.isArray(input.dependsOn) ? input.dependsOn.map(String) : [],
        createdAt: now,
        updatedAt: now,
      });
      project.modules.push(module);
    }
    project.updatedAt = now;
    saveAll(all);
    return { ok: true, module, project };
  });
}

function findModule(project, moduleId) {
  return project.modules.find((m) => m.id === moduleId) || null;
}

/** 开始一次新的模块运行（版本号自动递增：v1, v2, …），模块置为 running。 */
export async function startRun(projectId, moduleId, input, sessionId) {
  return withProjectLock(() => {
    const all = loadAll();
    const pIdx = all.findIndex((p) => p.id === projectId && (!sessionId || p.sessionId === sessionId));
    if (pIdx < 0) return { ok: false, error: '项目不存在: ' + projectId };
    const project = all[pIdx];
    const module = findModule(project, moduleId);
    if (!module) return { ok: false, error: '模块不存在: ' + moduleId };
    const now = Date.now();
    const version = module.runs.length + 1;
    const run = normRun({
      id: input.run_id || undefined,
      status: input.status || 'running',
      startedAt: now,
      dcsTaskIds: input.dcsTaskIds || input.dcs_task_ids || [],
      files: input.files || {},
      dcsCost: input.dcsCost || input.dcs_cost || null,
      dshTokens: input.dshTokens || input.dsh_tokens || null,
      notes: input.notes || '',
      oaa: input.oaa || null,
      selfReview: input.selfReview || input.self_review || null,
      progress: input.progress,
    }, String(version));
    module.runs.push(run);
    module.status = 'running';
    module.updatedAt = now;
    project.updatedAt = now;
    saveAll(all);
    return { ok: true, run, module, project };
  });
}

/** 更新一次运行的状态/文件清单/成本/token/备注。 */
export async function updateRun(projectId, moduleId, runId, patch, sessionId) {
  return withProjectLock(() => {
    const all = loadAll();
    const pIdx = all.findIndex((p) => p.id === projectId && (!sessionId || p.sessionId === sessionId));
    if (pIdx < 0) return { ok: false, error: '项目不存在: ' + projectId };
    const project = all[pIdx];
    const module = findModule(project, moduleId);
    if (!module) return { ok: false, error: '模块不存在: ' + moduleId };
    const run = module.runs.find((r) => r.id === runId);
    if (!run) return { ok: false, error: '运行不存在: ' + runId };
    if (patch.status !== undefined && VALID_STATUS.includes(patch.status)) {
      run.status = patch.status;
      if (patch.status === 'done' || patch.status === 'failed' || patch.status === 'blocked') run.finishedAt = patch.finishedAt || Date.now();
      if (patch.status === 'done') run.progress = 100;
    }
    if (patch.progress !== undefined && typeof patch.progress === 'number') run.progress = Math.max(0, Math.min(100, Math.floor(patch.progress)));
    if (patch.files !== undefined && patch.files !== null) run.files = normFiles(patch.files);
    if (patch.dcsTaskIds !== undefined) run.dcsTaskIds = Array.isArray(patch.dcsTaskIds) ? patch.dcsTaskIds.map(String) : run.dcsTaskIds;
    if (patch.dcsCost !== undefined && patch.dcsCost !== null) run.dcsCost = Number(patch.dcsCost);
    if (patch.dshTokens !== undefined && patch.dshTokens !== null) run.dshTokens = Number(patch.dshTokens);
    if (patch.notes !== undefined) run.notes = String(patch.notes);
    // 执行轨迹：OAA 三段式 + 自评 verdict（Biomni 式自批评循环的持久化）
    if (patch.oaa !== undefined && patch.oaa !== null) run.oaa = normOaa(patch.oaa);
    if (patch.selfReview !== undefined && patch.selfReview !== null) run.selfReview = normSelfReview(patch.selfReview);
    // 模块状态跟随运行状态（running 时置 running，其余在运行 done/failed 时同步）
    if (run.status === 'running') module.status = 'running';
    else if (module.status === 'running') module.status = run.status;
    module.updatedAt = Date.now();
    project.updatedAt = Date.now();
    saveAll(all);
    return { ok: true, run, module, project };
  });
}

// ---- Human-in-the-loop 节点审批（设想/纠正/批准/否决） ----

/** 对单个模块节点做一次人机审阅动作。
 *  @param action 'propose'|'approve'|'correct'|'veto'|'comment'
 *  @param text 附带说明（纠正意见/批准理由/新设想等）
 *  @param opts { isGate, name, desc } 可选：同时更新节点元信息（如把某节点设为闸门）
 */
export async function reviewModule(projectId, moduleId, action, text, opts, sessionId) {
  return withProjectLock(() => {
    const all = loadAll();
    const pIdx = all.findIndex((p) => p.id === projectId && (!sessionId || p.sessionId === sessionId));
    if (pIdx < 0) return { ok: false, error: '项目不存在: ' + projectId };
    const project = all[pIdx];
    const module = project.modules.find((m) => m.id === moduleId);
    if (!module) return { ok: false, error: '模块不存在: ' + moduleId };
    const now = Date.now();
    const act = ['propose', 'approve', 'correct', 'veto', 'comment'].includes(action) ? action : 'comment';
    // 追加审阅历史（人机双向留痕）
    module.reviewLog = module.reviewLog || [];
    module.reviewLog.push(normReviewEntry({ at: now, actor: 'user', action: act, text }));
    // 按动作推进审阅状态
    if (act === 'approve') {
      module.review = 'approved';
      // 批准闸门节点后解除阻塞：模块可从 pending 进入可执行
    } else if (act === 'veto') {
      module.review = 'rejected';
      if (module.status === 'running') module.status = 'blocked';
    } else if (act === 'correct') {
      module.review = 'gate'; // 纠正后重新待审
      module.status = 'pending';
    } else if (act === 'propose') {
      module.review = 'gate'; // 新设想提交待审
    }
    // 可选元信息更新（闸门标记/改名/改描述）
    if (opts) {
      if (typeof opts.isGate === 'boolean') module.isGate = opts.isGate;
      if (typeof opts.name === 'string' && opts.name) module.name = opts.name;
      if (typeof opts.desc === 'string') module.desc = opts.desc;
    }
    module.updatedAt = now;
    project.updatedAt = now;
    saveAll(all);
    return { ok: true, module, project };
  });
}

/** 批量批准：把项目下所有闸门未批的节点置为 approved。返回被改动的模块数。 */
export async function approveAllGates(projectId, text, sessionId) {
  return withProjectLock(() => {
    const all = loadAll();
    const pIdx = all.findIndex((p) => p.id === projectId && (!sessionId || p.sessionId === sessionId));
    if (pIdx < 0) return { ok: false, error: '项目不存在: ' + projectId };
    const project = all[pIdx];
    const now = Date.now();
    let count = 0;
    let skippedRejected = 0;
    for (const module of project.modules) {
      if (module.isGate && module.review !== 'approved') {
        // 批量放行不越过人工否决：rejected 的闸门必须走单节点纠正/重新批准
        if (module.review === 'rejected') { skippedRejected++; continue; }
        module.review = 'approved';
        module.reviewLog = module.reviewLog || [];
        module.reviewLog.push(normReviewEntry({ at: now, actor: 'user', action: 'approve', text: text || '' }));
        module.updatedAt = now;
        count++;
      }
    }
    project.updatedAt = now;
    saveAll(all);
    return { ok: true, count, skippedRejected, project };
  });
}

/** 从项目所有模块的运行记录汇总「执行轨迹」Markdown（ReAct 推理图的可读产物）。
 *  按模块→运行版本排列，提取每跑的 OAA 三段式 / 自评 verdict / 备注 / 产物文件。
 *  由 updateDelivery 在 includeTrajectory 时自动调用，无需 agent 手写。 */
export function buildTrajectory(project) {
  const lines = [];
  lines.push('> 本章节由 DCS Harness 依据各模块运行的 **OAA 记录（观察→评估→行动）**、自评 verdict 与产物清单自动汇总（Biomni 式执行中自批评的推理图快照），随交付修订更新。');
  const modules = Array.isArray(project && project.modules) ? project.modules : [];
  if (!modules.length) {
    lines.push('\n（尚无模块运行记录）');
    return lines.join('\n');
  }
  for (const m of modules) {
    lines.push('\n### 模块：' + (m.name || m.id) + '（' + (m.status || 'pending') + '）');
    if (m.desc) lines.push('目标：' + m.desc);
    const runs = Array.isArray(m.runs) ? m.runs : [];
    if (!runs.length) { lines.push('（尚未运行）'); continue; }
    for (const r of runs) {
      // 防御：运行记录可能来自老数据/开放参数（如 finishedAt 非法值），格式化时间失败不能拖垮整篇轨迹
      let timeStr = '';
      if (r.finishedAt) {
        try { timeStr = ' · ' + new Date(r.finishedAt).toISOString().slice(0, 19).replace('T', ' '); } catch { timeStr = ''; }
      }
      lines.push('\n**v' + r.version + '** · ' + (r.status || 'running') + (r.progress != null && r.progress >= 0 ? ' · ' + r.progress + '%' : '') + timeStr);
      const oaa = r.oaa || null;
      if (oaa && (oaa.observation || oaa.assessment || oaa.action)) {
        if (oaa.observation) lines.push('- **观察**：' + oaa.observation);
        if (oaa.assessment) lines.push('- **评估**：' + oaa.assessment);
        if (oaa.action) lines.push('- **行动**：' + oaa.action);
      }
      const sr = r.selfReview || null;
      if (sr && (sr.verdict || sr.evidence)) {
        lines.push('- **自评**：' + (sr.verdict || '—') + (sr.evidence ? '（' + sr.evidence.slice(0, 400) + '）' : ''));
        if (Array.isArray(sr.risks) && sr.risks.length) lines.push('  - 风险：' + sr.risks.join('；'));
        if (sr.nextAction) lines.push('  - 下一步：' + sr.nextAction);
      }
      if (r.notes) lines.push('- 备注：' + r.notes.slice(0, 500));
      const outs = (r.files && Array.isArray(r.files.output)) ? r.files.output : [];
      if (outs.length) lines.push('- 产物：' + outs.map((f) => f.path || f.name || '').filter(Boolean).join('、'));
    }
  }
  return lines.join('\n');
}

/** 整体更新交付文档（关键节点梳理）：合并章节、递增 revision。 */
export async function updateDelivery(projectId, patch, sessionId) {
  return withProjectLock(() => {
    const all = loadAll();
    const pIdx = all.findIndex((p) => p.id === projectId && (!sessionId || p.sessionId === sessionId));
    if (pIdx < 0) return { ok: false, error: '项目不存在: ' + projectId };
    const project = all[pIdx];
    const current = normDelivery(project.delivery);
    const now = Date.now();
    const sections = { ...current.sections };
    if (patch.sections && typeof patch.sections === 'object') {
      for (const key of DELIVERY_SECTIONS) {
        if (patch.sections[key] !== undefined && patch.sections[key] !== null) sections[key] = String(patch.sections[key]);
      }
    }
    // 执行轨迹自动汇总：includeTrajectory 为真时用全部模块的 OAA/自评/产物覆盖生成（无需手写）。
    // 保留旧轨迹作为来源历史：若本次无新的运行数据，仍以自动生成结果为准（始终反映最新状态）。
    if (patch.includeTrajectory) {
      sections.trajectory = buildTrajectory(project);
    }
    const delivery = {
      updatedAt: now,
      revision: (current.revision || 0) + 1,
      sections,
      charts: Array.isArray(patch.charts) ? patch.charts : current.charts,
    };
    project.delivery = delivery;
    project.updatedAt = now;
    saveAll(all);
    return { ok: true, delivery, project };
  });
}

/** 删除项目（含全部模块与交付）。 */
export async function deleteProject(projectId, sessionId) {
  return withProjectLock(() => {
    const all = loadAll();
    const next = all.filter((p) => !(p.id === projectId && (!sessionId || p.sessionId === sessionId)));
    if (next.length === all.length) return { ok: false, error: '项目不存在: ' + projectId };
    saveAll(next);
    return { ok: true };
  });
}
