// 冻结输入层：参数不可变性回归。
//
// ⚠ 本层的用例设计经变异测试校正过，值得记录：
//   最初版本用「不存在的项目」+「table/bar 类型图表」调 execute，结果
//   —— helper 在 updateDelivery 处提前返回（项目不存在）
//   —— 图表非 image 类型，在 type!=='image' 处 continue
//   两处都让执行压不到赋值分支，于是「还原历史 bug 后用例仍然全过」（假绿）。
//   修正后：隔离 DSH_HOME + 建真实项目 + 用真实存在的 image 文件，
//   并在成功路径上断言 res.ok===true —— 若为 false 直接报「属假绿」。
//   实测：还原历史 bug（移除两层防御）后本层 2/5 变红，恢复后全绿。
//
// 背景：dsh 的 ToolRuntime 会对 `exec.arguments` 做 deepFreeze
// （dsh-tools `materializePresentation` / 执行上下文构造处）。
// 历史 bug：dcs_delivery_update 对图表对象原地赋值（c.data = ...），
// 在冻结对象上抛 "Cannot assign to read only property 'data'"，导致交付提交失败。
// 该 bug 已被修复（改为展开创建新对象），本层确保它不会复发
// —— 并在平台未来把冻结提前到 execute 的 args 时，提前暴露问题。

import { join } from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { test, assert, assertEqual, ROOT } from '../lib/harness.mjs';

/** 深度冻结（与 dsh deepFreeze 语义一致：递归冻结对象与数组）。 */
function deepFreeze(v, seen = new Set()) {
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v)) return v;
  seen.add(v);
  Object.freeze(v);
  for (const k of Object.keys(v)) deepFreeze(v[k], seen);
  return v;
}

/**
 * 在隔离的 DSH_HOME 下准备一个真实项目与真实图片文件。
 *
 * 关键：早先版本的用例用「不存在的项目」调 execute，代码在 updateDelivery
 * 处就提前返回了，根本没走到 charts 处理分支 —— 导致用例假绿
 * （变异测试发现：还原历史 bug 后用例仍然全过）。
 * 必须让项目真实存在且图片真实可读，才能真正压到赋值路径。
 */
function setupHome() {
  const prev = process.env.DSH_HOME;
  const home = mkdtempSync(join(tmpdir(), 'dcs-frz-'));
  process.env.DSH_HOME = home;
  const imgDir = join(home, 'imgs');
  mkdirSync(imgDir, { recursive: true });
  const img = join(imgDir, 'x.png');
  writeFileSync(img, 'fake-png');
  return {
    home, img,
    cleanup() {
      if (prev === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = prev;
      try { rmSync(home, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

/** 用插件注册的工具定义，直接以冻结参数调用 execute。 */
async function loadTools() {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const tools = new Map();
  const ctx = {
    tools: { register(d) { tools.set(d.name, d); return () => {}; } },
    systemPrompt: { section: () => () => {} },
    webServer: {
      register: () => () => {}, registerUpgrade: () => () => {},
      registerFallback: () => () => {}, tapIndex: () => () => {},
    },
    sessions: { get: () => null },
    tokenMeter: {},
    sessionPersistence: {},
    get: () => undefined,
    effect: (f) => (typeof f === 'function' ? f() : undefined),
    on: () => () => {},
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  };
  await mod.apply(ctx);
  return tools;
}

const execStub = () => ({
  signal: undefined,
  sessionId: '',
  workspace: process.cwd(),
  arguments: {},
});

// ---------------------------------------------------------------- 冻结安全

test('frozen', 'frozen/args-deep-frozen-tolerant', '工具在深度冻结的参数上不抛只读错误', async () => {
  const env = setupHome();
  try {
    // 真实项目：否则 helper 会在 updateDelivery 处提前返回，压不到赋值分支
    const projects = await import(join(ROOT, 'lib', 'projects.js'));
    await projects.upsertProject({ project_id: 'p-frz', title: 't' });

    const tools = await loadTools();
    const t = tools.get('dcs_delivery_update');
    assert(t, '应注册 dcs_delivery_update');

    // 必须用 type:'image' 且 data 指向真实存在的文件 —— 这是唯一会走到
    // 「计算本地缓存路径」并可能触发原地赋值的数据形态。
    // （早期用例只用 table/bar 类型，会在 type!=='image' 处 continue，属假绿。）
    const args = deepFreeze({
      project_id: 'p-frz',
      charts: [{ id: 'c1', type: 'image', data: env.img }],
      sections: { findings: 'x' },
    });
    assert(Object.isFrozen(args), '测试前置：参数应已被冻结');
    assert(Object.isFrozen(args.charts[0]), '测试前置：图表元素应已被冻结');

    let res;
    try {
      res = await t.execute(args, execStub());
    } catch (e) {
      const msg = String((e && e.message) || e);
      assert(!/read only|readonly|not extensible|Cannot assign/i.test(msg),
        `冻结参数上出现只读赋值（历史 bug 复发）: ${msg}`);
      throw e;
    }
    // 必须真的走到业务层（项目存在 → 应成功），否则说明用例没压到目标分支
    assert(res && res.ok === true,
      `应成功更新交付（若为 ok:false 说明用例未压到 charts 分支，属假绿）: ${JSON.stringify(res)}`);
  } finally {
    env.cleanup();
  }
});

test('frozen', 'frozen/charts-not-mutated-in-place', '工具不得原地修改传入的图表对象', async () => {
  const env = setupHome();
  try {
    const projects = await import(join(ROOT, 'lib', 'projects.js'));
    await projects.upsertProject({ project_id: 'p-frz2', title: 't' });

    const tools = await loadTools();
    const t = tools.get('dcs_delivery_update');

    const chartEl = { id: 'c1', type: 'image', data: env.img };
    const dataBefore = chartEl.data;
    // 不冻结，验证「即使没被冻结也不会被就地污染」（代码应主动创建新对象）
    const args = { project_id: 'p-frz2', charts: [chartEl] };

    const res = await t.execute(args, execStub());
    assert(res && res.ok === true, `应成功: ${JSON.stringify(res)}`);

    assertEqual(chartEl.data, dataBefore,
      '传入的图表对象被就地修改（应创建新对象，否则冻结时会抛 readonly）');
  } finally {
    env.cleanup();
  }
});

test('frozen', 'frozen/render-tolerant-of-frozen-value', 'output.render 可安全处理冻结的输出值', async () => {
  const tools = await loadTools();
  assert(tools.size > 0, '未注册任何工具（用例将空转）');
  const problems = [];
  for (const [name, t] of tools) {
    const req = (t.output.schema && t.output.schema.required) || [];
    const value = {};
    for (const k of req) {
      const p = (t.output.schema.properties || {})[k] || {};
      if (p.type === 'boolean') value[k] = true;
      else if (p.type === 'number' || p.type === 'integer') value[k] = 0;
      else if (p.type === 'array') value[k] = [];
      else if (p.type === 'object') value[k] = {};
      else value[k] = 'x';
    }
    deepFreeze(value);
    try {
      const blocks = t.output.render(deepFreeze({}), value);
      assert(Array.isArray(blocks), `${name}.render 应返回数组`);
    } catch (e) {
      problems.push(`${name}: ${e.message}`);
    }
  }
  assertEqual(problems.length, 0, `${problems.length} 个 render 在冻结值上崩溃`, problems);
});

// ---------------------------------------------------------------- 静态守卫

test('frozen', 'frozen/no-inplace-assign-in-source', '源码中不存在对参数对象的原地赋值模式', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8');
  const lines = src.split('\n');
  const hits = [];
  let scanned = 0;

  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    // 与 scripts/check-hooks.cjs 同源的检测。注意两点（都是踩过的坑）：
    //  1) 不能用 `!/nextCharts/` 做豁免 —— 真实的历史 bug 形态恰是
    //     `c.data = local; nextCharts.push(c);` 同行含 nextCharts，
    //     该豁免会把要拦的目标本身放过。
    //  2) 豁免应基于「push 的是否为新对象」：只有本行 push 里含对象展开
    //     （`push({ ...c, ... })`）才算合法的新对象写法。
    const m = t.match(/\b(c\d*|chart|ch)\d*\.(\w+)\s*=(?!=)/);
    scanned++;
    if (!m) return;
    if (/^(const|let|var)\b/.test(t)) return;        // 声明行
    if (/payload\./.test(t)) return;                  // payload 是本地构造的副本
    const pushesNewObject = /push\(\s*\{[^}]*\.\.\./.test(t);
    if (!pushesNewObject) {
      hits.push(`lib/index.js:${i + 1}: ${t.slice(0, 90)}`);
    }
  });

  assert(scanned > 0, '未扫描到任何源码行（用例将空转）');
  assertEqual(hits.length, 0,
    `发现疑似原地赋值（冻结对象会抛 readonly）：\n${hits.join('\n')}`, hits);
});

test('frozen', 'frozen/platform-freezes-exec-arguments', '平台确实会冻结 exec.arguments（冻结层的前提仍成立）', async () => {
  const { readFileSync } = await import('node:fs');
  const { join: j } = await import('node:path');
  const { findDshRoot, dshModulesDir } = await import('../lib/harness.mjs');
  const mods = dshModulesDir(findDshRoot());
  const toolsSrc = readFileSync(j(mods, '@deepseek-ai', 'dsh-tools', 'lib', 'index.js'), 'utf8');

  // 平台在构造执行上下文时对 arguments 做 deepFreeze。
  // 若未来平台改掉这一行为，本层的前提失效，需要重新评估防御措施。
  assertIncludesFreeze(toolsSrc);
});

function assertIncludesFreeze(src) {
  const hasFreeze = /arguments:\s*deepFreeze\(/.test(src) || /deepFreeze\(\s*detached\s*\)/.test(src);
  assert(hasFreeze,
    'dsh 不再冻结 exec.arguments —— 冻结输入层的前提变了，请重新评估工具参数的不可变性假设');
}
