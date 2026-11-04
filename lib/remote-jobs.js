// dsh-dcs-cloud — SSH/本地远程作业账本读取（Host 侧，纯 Node，**只读**）。
//
// 与 dsh-science 的 remote-compute 引擎共用同一份账本（**写入方是那个引擎**，本模块只读、
// 从不修改这些文件，避免两个插件抢写）：
//   <项目根>/.dsh/remotes/jobs.json       作业注册表（schema 1，随项目走、跨会话持续）
//   <项目根>/.dsh/remotes/allowlist.json  本项目已授权主机
//   $DSH_HOME/remotes/hosts.json          全机主机注册表（含最近一次只读探测摘要）
//
// 用途：补齐「本机/SSH 长任务在项目管理窗口里看不见状态」的缺口 —— 展示作业状态、
// 退出码、时长、日志路径与所属主机，并与 DCS Harness 的运行（run）通过 jobIds 关联。
// 注意：本模块**不发起 ssh**。刷新状态由 agent 调 remote_status（它会回写同一账本），
// 窗口只负责读与展示 —— 保持「宿主插件不自行连远端」的边界。

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve as pathResolve, dirname } from 'node:path';
import { homedir } from 'node:os';

/** 作业状态枚举（与 dsh-science remote-compute 的 newJob().state 一致）。 */
export const REMOTE_JOB_STATES = ['submitted', 'running', 'succeeded', 'failed', 'killed', 'unknown'];

export const REMOTE_STATE_LABEL = {
  submitted: '已提交',
  running: '运行中',
  succeeded: '成功',
  failed: '失败',
  killed: '已终止',
  unknown: '未知',
};

/** 作业状态 → DCS Harness 运行状态（供统一进度聚合）。 */
export function remoteStateToRunStatus(state) {
  const s = String(state || '').toLowerCase();
  if (s === 'succeeded') return 'done';
  if (s === 'failed' || s === 'killed') return 'failed';
  if (s === 'running' || s === 'submitted') return 'running';
  return 'pending';
}

export function remoteJobsPath(root) {
  return join(root, '.dsh', 'remotes', 'jobs.json');
}

export function remoteAllowlistPath(root) {
  return join(root, '.dsh', 'remotes', 'allowlist.json');
}

export function hostsRegistryPath() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'remotes', 'hosts.json');
}

/**
 * 工作区/项目根探测 —— 与 dsh-science core.findProjectRoot 保持一致（同一账本必须解析到同一根）：
 * 从 start 向上找含 `.dsh` 或 `.git` 的目录；**跳过 HOME**（~/.dsh 是 DSH 配置目录，不是项目标记）；
 * 一路到文件系统根都没有则回退到 start 本身。
 */
export function findWorkspaceRoot(start) {
  const base = pathResolve(start || process.cwd());
  let dir = base;
  const home = homedir();
  for (;;) {
    if (dir !== home) {
      for (const m of ['.dsh', '.git']) {
        try {
          if (existsSync(join(dir, m))) return dir;
        } catch { /* 权限等问题忽略 */ }
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return base;
    dir = parent;
  }
}

function readJsonSafe(file, fallback) {
  try {
    return { ok: true, data: JSON.parse(readFileSync(file, 'utf8')) };
  } catch (e) {
    if (e && e.code === 'ENOENT') return { ok: true, data: fallback, missing: true };
    return { ok: false, data: fallback, error: String((e && e.message) || e) };
  }
}

function str(v) {
  return v === undefined || v === null ? '' : String(v);
}

function ts(v) {
  const s = str(v);
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

/** 单个作业归一化（字段缺失/类型异常都不抛错，窗口渲染要稳）。 */
function normJob(j, now) {
  const state = REMOTE_JOB_STATES.includes(str(j && j.state)) ? str(j.state) : 'unknown';
  const submittedAt = ts(j && j.submittedAt);
  const startedAt = ts(j && j.startedAt);
  const finishedAt = ts(j && j.finishedAt);
  // 时长：已结束取 start→finish，运行中取 start→now，未开始取 submit→now
  const from = startedAt || submittedAt;
  const to = finishedAt || (state === 'succeeded' || state === 'failed' || state === 'killed' ? 0 : now);
  return {
    id: str(j && j.id),
    host: str(j && j.host),
    title: str(j && j.title),
    state,
    label: REMOTE_STATE_LABEL[state] || state,
    mode: str(j && j.mode),            // direct | slurm
    pid: j && j.pid != null ? String(j.pid) : '',
    slurmJobId: j && j.slurmJobId != null ? String(j.slurmJobId) : '',
    jobDir: str(j && j.jobDir),
    stdoutLog: str(j && j.stdoutLog),
    stderrLog: str(j && j.stderrLog),
    timeoutMinutes: j && j.timeoutMinutes != null ? Number(j.timeoutMinutes) : null,
    submittedAt,
    startedAt,
    finishedAt,
    exitCode: j && j.exitCode != null ? Number(j.exitCode) : null,
    lastCheckedAt: ts(j && j.lastCheckedAt),
    error: str(j && j.error),
    durationMs: from ? Math.max(0, (to || now) - from) : null,
    runStatus: remoteStateToRunStatus(state),
  };
}

/** 全机已注册主机（只读摘要；供窗口显示"这台机器是什么"）。 */
export function readHosts() {
  const r = readJsonSafe(hostsRegistryPath(), { hosts: [] });
  const list = Array.isArray(r.data && r.data.hosts) ? r.data.hosts : [];
  return list.map((h) => ({
    id: str(h && h.id),
    alias: str(h && h.alias),
    transport: str(h && h.transport),
    scratch: str(h && h.scratch),
    cpus: (h && h.probe && Number(h.probe.cpus)) || 0,
    memBytes: (h && h.probe && Number(h.probe.memBytes)) || 0,
    gpus: Array.isArray(h && h.probe && h.probe.gpus) ? h.probe.gpus.map(String) : [],
    sbatch: Boolean(h && h.probe && h.probe.sbatch),
    probedAt: str(h && h.probedAt),
    notes: str(h && h.notes).slice(0, 400),
  })).filter((h) => h.id);
}

/**
 * 读取某个项目根的远程作业账本（只读、永不抛错）。
 * 过滤（按主机/作业号）由调用方（路由）自己做，这里只负责读全量与归一。
 * @returns {{ok:boolean, root:string, jobs:Array, allowlist:Array, error:string, missing:boolean}}
 */
export function readRemoteJobs(root, opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const abs = pathResolve(root || process.cwd());
  const fileName = remoteJobsPath(abs);
  const r = readJsonSafe(fileName, { schema: 1, jobs: [] });
  const raw = r.data && Array.isArray(r.data.jobs) ? r.data.jobs : [];
  const jobs = raw.map((j) => normJob(j, now)).filter((j) => j.id);
  jobs.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  const al = readJsonSafe(remoteAllowlistPath(abs), { hosts: [] });
  const allowlist = (Array.isArray(al.data && al.data.hosts) ? al.data.hosts : []).map((h) => ({
    host: str(h && h.host),
    grantedAt: str(h && h.grantedAt),
    grantedBy: str(h && h.grantedBy),
    note: str(h && h.note),
  })).filter((h) => h.host);
  return {
    ok: r.ok,
    root: abs,
    jobs,
    allowlist,
    missing: Boolean(r.missing),
    error: r.ok ? '' : String(r.error || ''),
  };
}

/** 作业号 → 作业（同时按 id / slurmJobId / pid 建索引，兼容三种登记口径）。 */
export function indexJobsById(jobs) {
  const map = new Map();
  for (const j of Array.isArray(jobs) ? jobs : []) {
    if (!j || !j.id) continue;
    if (!map.has(j.id)) map.set(j.id, j);
    for (const alt of [j.slurmJobId, j.pid]) if (alt && !map.has(String(alt))) map.set(String(alt), j);
  }
  return map;
}

/** 取一个 run 关联的远程作业（按 run.jobIds 匹配；返回原始顺序）。 */
export function jobsForRun(run, byId) {
  const ids = Array.isArray(run && run.jobIds) ? run.jobIds : [];
  if (!ids.length || !byId || typeof byId.get !== 'function') return [];
  const out = [];
  for (const id of ids) {
    const j = byId.get(String(id));
    if (j && !out.includes(j)) out.push(j);
  }
  return out;
}

/**
 * 项目级远程作业汇总（供 /v2/project-overview）：按状态计数 + 与 run 的关联。
 * @returns {{total:number, byState:Object, hosts:string[], linked:Object, unlinked:number}}
 */
export function remoteSummary(project, byId) {
  const out = { total: 0, byState: {}, hosts: [], linked: {}, unlinked: 0 };
  const modules = Array.isArray(project && project.modules) ? project.modules : [];
  const seen = new Set();
  for (const m of modules) {
    for (const run of (Array.isArray(m.runs) ? m.runs : [])) {
      const jobs = jobsForRun(run, byId);
      if (!jobs.length) continue;
      out.linked[run.id] = jobs.map((j) => ({ id: j.id, host: j.host, state: j.state, label: j.label, durationMs: j.durationMs, exitCode: j.exitCode }));
      for (const j of jobs) {
        if (seen.has(j.id)) continue;
        seen.add(j.id);
        out.total++;
        out.byState[j.state] = (out.byState[j.state] || 0) + 1;
        if (j.host && !out.hosts.includes(j.host)) out.hosts.push(j.host);
      }
    }
  }
  if (byId && typeof byId.values === 'function') {
    for (const j of byId.values()) if (j && j.id && !seen.has(j.id)) { out.unlinked++; seen.add(j.id); }
  }
  return out;
}

/** 人类可读时长（窗口与轨迹共用；null → ''）。 */
export function fmtDuration(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '';
  let s = Math.max(0, Math.floor(Number(ms) / 1000));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  if (h) return h + 'h' + String(m).padStart(2, '0') + 'm';
  if (m) return m + 'm' + String(s).padStart(2, '0') + 's';
  return s + 's';
}
