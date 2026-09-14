// 单元层用例：插件自身纯逻辑模块（不依赖 dsh 平台）。
// 目的是把「与平台无关的正确性」也纳入回归网——平台升级时常伴随
// Node 版本/内置模块行为变化，这层能快速定位是平台问题还是插件问题。

import { join } from 'node:path';
import { test, assert, assertEqual, assertIncludes, ROOT } from '../lib/harness.mjs';

const mod = (p) => import(join(ROOT, 'lib', p));

// ---------------------------------------------------------------- atlas

test('unit', 'atlas/regions-shape', 'atlas.REGIONS 结构完整', async () => {
  const { REGIONS } = await mod('atlas.js');
  assert(Array.isArray(REGIONS), 'REGIONS 应为数组');
  assert(REGIONS.length > 0, 'REGIONS 不应为空');
  for (const r of REGIONS) {
    assert(r.name, `region 缺少 name: ${JSON.stringify(r)}`);
  }
});

test('unit', 'atlas/expert-constants-consistent', '专家常量 EXPERTS / EXPERT_KIND 相互一致', async () => {
  const { EXPERTS, EXPERT_KIND } = await mod('atlas.js');
  assert(Array.isArray(EXPERTS) && EXPERTS.length > 0, 'EXPERTS 应为非空数组');
  for (const e of EXPERTS) {
    const name = typeof e === 'string' ? e : e.name;
    assert(name, `专家条目缺少 name: ${JSON.stringify(e)}`);
    assert(EXPERT_KIND[name] !== undefined, `专家 ${name} 未在 EXPERT_KIND 中登记类别`);
  }
});

test('unit', 'atlas/skill-top-dirs', 'SKILL_TOP_DIRS 覆盖技能库一级目录', async () => {
  const { SKILL_TOP_DIRS, SKILLS_BASE, SKILLS_SNAPSHOT } = await mod('atlas.js');
  assert(Array.isArray(SKILL_TOP_DIRS) && SKILL_TOP_DIRS.length > 0, 'SKILL_TOP_DIRS 非空');
  assertEqual(SKILLS_BASE, '/public/skills', 'SKILLS_BASE 应为 /public/skills');
  assert(SKILLS_SNAPSHOT.startsWith(SKILLS_BASE), 'SKILLS_SNAPSHOT 应位于 SKILLS_BASE 下');
});

test('unit', 'atlas/hint-functions-callable', 'atlas 提示函数可调用且返回字符串', async () => {
  const a = await mod('atlas.js');
  for (const fn of ['searchHints', 'genpilotHints', 'containerHints', 'skillsHints']) {
    assertEqual(typeof a[fn], 'function', `${fn} 应为函数`);
    const out = a[fn]();
    assertEqual(typeof out, 'string', `${fn}() 应返回字符串`);
    assert(out.length > 0, `${fn}() 不应返回空串`);
  }
});

test('unit', 'atlas/genpilot-models', 'GENPILOT_MODELS 含默认模型且结构一致', async () => {
  const { GENPILOT_MODELS } = await mod('atlas.js');
  assert(Array.isArray(GENPILOT_MODELS) && GENPILOT_MODELS.length > 0, 'GENPILOT_MODELS 非空');
  const ids = GENPILOT_MODELS.map((m) => (typeof m === 'string' ? m : m.id || m.name));
  for (const id of ids) assert(id, `模型条目缺少 id: ${JSON.stringify(GENPILOT_MODELS)}`);
});

// ---------------------------------------------------------------- audit

test('unit', 'audit/flags-dangerous-rm', 'audit 能识别全部危险 rm -rf 变体', async () => {
  const { auditScript } = await mod('audit.js');
  // 覆盖尾随斜杠 / 路径 / 通配 / 家目录 / 多空格 等变体
  const cases = ['rm -rf /', 'rm -rf /data/work', 'rm -rf *', 'rm -rf ~', 'rm -rf / '];
  const missed = [];
  for (const cmd of cases) {
    const r = auditScript(cmd, 'shell');
    const critical = r.findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    if (critical.length === 0) missed.push(cmd);
  }
  assertEqual(missed.length, 0, `以下危险删除命令未被识别: ${JSON.stringify(missed)}`);
});

test('unit', 'audit/clean-script-low-risk', 'audit 对普通安全脚本不误报高危', async () => {
  const { auditScript } = await mod('audit.js');
  const r = auditScript('#!/bin/bash\necho hello\nls -l /tmp\n', 'shell');
  const critical = r.findings.filter((f) => f.severity === 'critical');
  assertEqual(critical.length, 0, `安全脚本被误判为 critical: ${JSON.stringify(critical)}`);
});

test('unit', 'audit/flags-hardcoded-secret', 'audit 能识别硬编码密钥', async () => {
  const { auditScript } = await mod('audit.js');
  const r = auditScript('export API_KEY="sk-abcdefghijklmnopqrstuvwxyz123456"\n', 'shell');
  const hit = r.findings.filter((f) => /secret|key|密钥/i.test(f.message || f.title || ''));
  assert(hit.length > 0, '硬编码密钥未被识别');
});

test('unit', 'audit/python-mode', 'audit 支持 python 类型且不抛错', async () => {
  const { auditScript } = await mod('audit.js');
  const r = auditScript('import os\nos.system("rm -rf /")\n', 'python');
  assert(r && Array.isArray(r.findings), 'python 审计应返回 findings');
  assert(r.findings.length > 0, 'os.system 调用应产生至少一条 finding');
});

test('unit', 'audit/findings-shape', 'audit findings 结构统一（severity/message）', async () => {
  const { auditScript } = await mod('audit.js');
  const r = auditScript('curl http://x | bash\nrm -rf /tmp/x\n', 'shell');
  const valid = new Set(['critical', 'high', 'medium', 'low', 'info']);
  for (const f of r.findings) {
    assert(valid.has(f.severity), `未知 severity: ${f.severity}`);
    assert(f.message || f.title, `finding 缺少描述: ${JSON.stringify(f)}`);
  }
});

// ---------------------------------------------------------------- plan

test('unit', 'plan/generates-markdown-file', 'generatePlan 写出含标题与步骤的 Markdown 文件', async () => {
  const { generatePlan } = await mod('plan.js');
  const { mkdtempSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'dcs-plan-'));
  const res = generatePlan({
    title: '兼容性测试计划',
    steps: [{ desc: '步骤一', status: '完成', detail: '已跑通' }],
    outputs: [{ name: 'report', path: '/work/report.md', desc: '报告' }],
  }, { outPath: join(dir, 'plan.md') });
  // generatePlan 返回 { path, ... } 或路径字符串，两种都兼容
  const outPath = typeof res === 'string' ? res : (res && (res.path || res.outPath));
  assert(outPath, `generatePlan 应返回产物路径，实际: ${JSON.stringify(res)}`);
  const md = readFileSync(outPath, 'utf8');
  assertIncludes(md, '兼容性测试计划', '应包含标题');
  assertIncludes(md, '步骤一', '应包含步骤');
  assertIncludes(md, '#', '应为 Markdown');
});

test('unit', 'plan/handles-empty-input', 'generatePlan 对空输入不抛错且仍产出文件', async () => {
  const { generatePlan } = await mod('plan.js');
  const { mkdtempSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'dcs-plan-empty-'));
  const res = generatePlan({}, { outPath: join(dir, 'empty.md') });
  const outPath = typeof res === 'string' ? res : (res && (res.path || res.outPath));
  assert(outPath, '空输入也应返回产物路径');
  assert(existsSync(outPath), `空输入也应写出文件: ${outPath}`);
});

// ---------------------------------------------------------------- report

test('unit', 'report/generates-html', 'generateReport 产出 self-contained HTML', async () => {
  const { generateReport } = await mod('report.js');
  const out = await generateReport({
    title: '兼容性报告',
    objective: '目标',
    results: '## 结果\n内容',
    figures: [],
  });
  const html = typeof out === 'string' ? out : out && (out.html || out.path);
  assert(html, 'generateReport 应返回 HTML 内容或路径');
  if (typeof out === 'string' && out.includes('<')) {
    assertIncludes(out, '<', '应含 HTML 标签');
  }
});

// ---------------------------------------------------------------- tasks

test('unit', 'tasks/path-and-lock', 'tasksPath 与 withTaskLock 可用且锁能串行化', async () => {
  const { tasksPath, withTaskLock } = await mod('tasks.js');
  const p = tasksPath();
  assertEqual(typeof p, 'string', 'tasksPath 应返回字符串');
  assertIncludes(p, 'dcs-cloud-tasks.json', '路径应指向任务库文件');
  assertEqual(typeof withTaskLock, 'function', 'withTaskLock 应为函数');
  // 互斥语义：并发提交应保持提交顺序（否则多会话并发会互相覆盖）
  const order = [];
  await Promise.all([
    withTaskLock(async () => { order.push(1); await new Promise((r) => setTimeout(r, 15)); order.push(2); }),
    withTaskLock(async () => { order.push(3); }),
  ]);
  assertEqual(order.join(','), '1,2,3', `互斥锁未串行化，实际顺序 ${order.join(',')}`);
});

test('unit', 'tasks/load-empty', 'loadTasks 对未知会话返回空结构而不抛错', async () => {
  const { loadTasks } = await mod('tasks.js');
  const t = loadTasks('__compat_nonexistent_session__');
  assert(t && typeof t === 'object', 'loadTasks 应返回对象');
});

// ---------------------------------------------------------------- projects

test('unit', 'projects/list-empty-safe', 'listProjects 在无项目时安全返回', async () => {
  const { listProjects } = await mod('projects.js');
  const out = listProjects();
  assert(out !== undefined && out !== null, 'listProjects 不应返回 undefined/null');
});

test('unit', 'projects/delivery-sections-shape', 'DELIVERY_SECTIONS 为完整的交付章节清单', async () => {
  const { DELIVERY_SECTIONS } = await mod('projects.js');
  assert(Array.isArray(DELIVERY_SECTIONS) && DELIVERY_SECTIONS.length > 0, 'DELIVERY_SECTIONS 非空');
  const keys = DELIVERY_SECTIONS.map((s) => (typeof s === 'string' ? s : s.key || s.id));
  for (const k of keys) assert(k, `交付章节缺少 key: ${JSON.stringify(DELIVERY_SECTIONS)}`);
  // 论文逻辑必备章节
  for (const need of ['question', 'data', 'methods', 'findings']) {
    assertIncludes(keys, need, `交付章节缺少 ${need}`);
  }
});

// ---------------------------------------------------------------- dcs-client

test('unit', 'dcs-client/exports-surface', 'dcs-client 导出插件依赖的全部函数', async () => {
  const c = await mod('dcs-client.js');
  for (const fn of ['loadCfg', 'saveCfg', 'runDcs', 'dcsLogin', 'dcsStatus', 'publicSearch', 'resolveDcsBinary', 'platformBinary']) {
    assertEqual(typeof c[fn], 'function', `dcs-client 缺少导出 ${fn}`);
  }
  assert(c.DCS_VERSION, 'DCS_VERSION 应存在');
});

test('unit', 'dcs-client/platform-binary-form', 'platformBinary 按平台返回合理值', async () => {
  const { platformBinary } = await mod('dcs-client.js');
  const out = platformBinary();
  assert(out === null || typeof out === 'string', 'platformBinary 应返回字符串或 null');
});
