// dsh-dcs-cloud — DCS 任务状态存储（Host 侧，纯 Node）。
// 维护「DCS 任务」面板所需的分析计划/数据源/步骤逻辑关系/进展，持久化于 ~/.dsh/dcs-cloud-tasks.json。
// 任务按 sessionId 作用域化：每个会话（对话）只看到自己的任务。
// 由 dcs_task_update 工具写入，/api/dcs-cloud/tasks 路由读取，浏览器「DCS 任务」tab 渲染。

import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const VALID_STATUS = ['pending', 'running', 'done', 'failed', 'blocked'];

export function tasksPath() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dcs-cloud-tasks.json');
}

// ---- 进程内互斥锁：串行化 dcs-cloud-tasks.json 的读-改-写，避免多会话并发覆盖 ----
let taskLockChain = Promise.resolve();
export function withTaskLock(work) {
  const run = taskLockChain.then(work, work);
  taskLockChain = run.catch(() => {});
  return run;
}

// 读全部任务（不分会话）
function loadAllTasks() {
  try {
    const d = JSON.parse(readFileSync(tasksPath(), 'utf8'));
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

function saveAllTasks(tasks) {
  mkdirSync(dirname(tasksPath()), { recursive: true });
  const target = tasksPath();
  // 原子写（同 projects.saveAll）：避免中断写入导致文件半截损坏，
  // 而 loadTasks 对损坏 JSON 静默返回 []，会让任务记录凭空消失。
  const tmp = target + '.tmp-' + process.pid + '-' + Date.now();
  try {
    writeFileSync(tmp, JSON.stringify(tasks, null, 2));
    renameSync(tmp, target);
  } catch (e) {
    try { unlinkSync(tmp); } catch { /* ignore */ }
    throw e;
  }
}

/** 读某会话的任务；sessionId 为空时返回全部（向后兼容）。 */
export function loadTasks(sessionId) {
  const all = loadAllTasks();
  return sessionId ? all.filter((t) => t.sessionId === sessionId) : all;
}

const VALID_DELIVERABLE_TYPES = ['dataset', 'result', 'chart', 'report', 'file'];

function normDeliverable(d) {
  return {
    name: String(d.name || ''),
    type: VALID_DELIVERABLE_TYPES.includes(d.type) ? d.type : 'file',
    path: String(d.path || ''),
    desc: String(d.desc || ''),
  };
}

function normStep(s) {
  // 交付物：优先用 deliverables（对象数组），否则把 outputs（字符串数组）转成 file 类型交付物。
  const deliverables = Array.isArray(s.deliverables)
    ? s.deliverables.map(normDeliverable)
    : (Array.isArray(s.outputs) ? s.outputs.map((o) => ({ name: String(o), type: 'file', path: String(o), desc: '' })) : []);
  const step = {
    id: String(s.id || 'step-' + Math.random().toString(36).slice(2, 7)),
    title: String(s.title || s.desc || ''),
    status: VALID_STATUS.includes(s.status) ? s.status : 'pending',
    detail: String(s.detail || s.desc || ''),
    dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String) : (Array.isArray(s.deps) ? s.deps.map(String) : []),
    outputs: deliverables.map((d) => d.path).filter(Boolean),
    deliverables,
    progress: typeof s.progress === 'number' ? Math.max(0, Math.min(100, Math.floor(s.progress))) : (s.status === 'done' ? 100 : 0),
  };
  return step;
}

function normSource(s) {
  return {
    name: String(s.name || ''),
    path: String(s.path || ''),
    type: String(s.type || ''),
    desc: String(s.desc || ''),
  };
}

/** 创建或更新一个任务（按 sessionId 作用域）。 */
export async function upsertTask(input, sessionId) {
  return withTaskLock(() => {
    const sid = sessionId || input.sessionId || '';
    const tasks = loadAllTasks();
    const now = Date.now();
    const id = input.task_id ? String(input.task_id) : ('dcs-task-' + now + '-' + Math.random().toString(36).slice(2, 6));
    const steps = (input.steps || []).map(normStep);
    const dataSources = (input.dataSources || input.data_sources || []).map(normSource);
    const task = {
      id,
      sessionId: sid,
      title: String(input.title || '未命名 DCS 任务'),
      objective: String(input.objective || ''),
      model: String(input.model || 'auto'),
      resources: String(input.resources || input.resource || ''),
      dataSources,
      steps,
      createdAt: input.createdAt || now,
      updatedAt: now,
    };
    const idx = tasks.findIndex((t) => t.id === id && t.sessionId === sid);
    if (idx >= 0) {
      task.createdAt = tasks[idx].createdAt || now;
      tasks[idx] = task;
    } else {
      tasks.unshift(task);
    }
    // 上限保护：修剪到最近 100 个任务。
    // ⚠ 同 projects：不得静默丢弃 —— 任务记录含步骤进度与交付物清单。
    const MAX_TASKS = 100;
    if (tasks.length > MAX_TASKS) {
      const dropped = tasks.slice(MAX_TASKS);
      process.emitWarning(
        `DCS 任务数已达上限 ${MAX_TASKS}，将丢弃最旧的 ${dropped.length} 个任务`
        + `（${dropped.map((t) => t.id).slice(0, 5).join(', ')}${dropped.length > 5 ? ' …' : ''}）。`
        + `如需保留，请先备份 ${tasksPath()}`,
        { code: 'DCS_TASK_LIMIT' });
    }
    const trimmed = tasks.slice(0, MAX_TASKS);
    saveAllTasks(trimmed);
    return { task, tasks: sid ? trimmed.filter((t) => t.sessionId === sid) : trimmed };
  });
}

/** 单步状态更新（轻量，供 agent 逐步推进时调用）。 */
export async function updateStepStatus(taskId, stepId, status, detail, progress, sessionId) {
  return withTaskLock(() => {
    const tasks = loadAllTasks();
    const task = tasks.find((t) => t.id === taskId && (!sessionId || t.sessionId === sessionId));
    if (!task) return { ok: false, error: '任务不存在: ' + taskId };
    const step = task.steps.find((s) => s.id === stepId);
    if (!step) return { ok: false, error: '步骤不存在: ' + stepId };
    if (status) step.status = VALID_STATUS.includes(status) ? status : step.status;
    if (detail !== undefined && detail !== null && detail !== '') step.detail = String(detail);
    if (typeof progress === 'number') step.progress = Math.max(0, Math.min(100, Math.floor(progress)));
    if (step.status === 'done') step.progress = 100;
    task.updatedAt = Date.now();
    saveAllTasks(tasks);
    return { ok: true, task };
  });
}

export function getTask(taskId, sessionId) {
  const tasks = loadAllTasks();
  return tasks.find((t) => t.id === taskId && (!sessionId || t.sessionId === sessionId)) || null;
}

/** 局部更新任务字段（如模型选择），不影响其它字段。 */
export async function mergeTask(taskId, patch, sessionId) {
  return withTaskLock(() => {
    const tasks = loadAllTasks();
    const task = tasks.find((t) => t.id === taskId && (!sessionId || t.sessionId === sessionId));
    if (!task) return { ok: false, error: '任务不存在: ' + taskId };
    if (patch.model !== undefined) task.model = String(patch.model);
    if (patch.resources !== undefined) task.resources = String(patch.resources);
    if (patch.title !== undefined) task.title = String(patch.title);
    if (patch.objective !== undefined) task.objective = String(patch.objective);
    task.updatedAt = Date.now();
    saveAllTasks(tasks);
    return { ok: true, task };
  });
}
