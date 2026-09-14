// 集成层用例：把插件真正装载进一个模拟 dsh 宿主上下文，验证
//   - apply() 可执行、不抛错
//   - 全部工具成功注册（名称唯一、schema 合法）
//   - 每个工具的 output 渲染函数对典型值可用
//   - 客户端半在模拟 __ModuleLoader__ 环境下可装载
//
// 这一层是「升级后第一时间发现问题」的主力：平台 API 一变，这里立刻红。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, assert, assertEqual, assertIncludes, ROOT, findDshRoot, dshModulesDir } from '../lib/harness.mjs';

// ---------------------------------------------------------------- 模拟宿主

/** 构造一个最小可用的 dsh 宿主 ctx，记录所有注册行为。 */
function makeHostCtx() {
  const state = { tools: [], warnings: [], disposed: false };
  const registered = new Map();

  const tools = {
    register(def) {
      if (!def || typeof def !== 'object') throw new Error('tools.register 收到了非法定义');
      if (!def.name) throw new Error('tools.register 收到无 name 的定义');
      if (registered.has(def.name)) throw new Error(`工具名重复注册: ${def.name}`);
      if (!def.parameters || def.parameters.type !== 'object') {
        throw new Error(`工具 ${def.name} 的 parameters 不是合法 JSON Schema`);
      }
      if (!def.output || typeof def.output.render !== 'function') {
        throw new Error(`工具 ${def.name} 缺少 output.render`);
      }
      if (typeof def.execute !== 'function') {
        throw new Error(`工具 ${def.name} 缺少 execute`);
      }
      registered.set(def.name, def);
      state.tools.push(def);
      return () => { registered.delete(def.name); state.tools = state.tools.filter((t) => t.name !== def.name); };
    },
  };

  const services = {
    tools,
    systemPrompt: {
      sections: [],
      // 0.1.5 契约：section({ name, order, text: () => string }) => disposer
      section(descriptor) {
        if (!descriptor || typeof descriptor !== 'object') {
          throw new Error('systemPrompt.section 需要描述对象');
        }
        if (!descriptor.name) throw new Error('systemPrompt.section 缺少 name');
        if (typeof descriptor.text !== 'function') {
          throw new Error(`systemPrompt.section(${descriptor.name}) 的 text 必须是函数`);
        }
        let body;
        try {
          body = descriptor.text();
        } catch (e) {
          throw new Error(`systemPrompt.section(${descriptor.name}).text() 抛错: ${e.message}`);
        }
        if (typeof body !== 'string') {
          throw new Error(`systemPrompt.section(${descriptor.name}).text() 未返回字符串`);
        }
        this.sections.push({ ...descriptor, body });
        return () => {};
      },
    },
    webServer: {
      routes: [],
      // 0.1.5 契约：register({ kind, path, handler }) => disposer
      register(route) {
        if (!route || typeof route !== 'object') throw new Error('webServer.register 需要 WebRoute 对象');
        if (!route.kind || !route.path || typeof route.handler !== 'function') {
          throw new Error(`WebRoute 不完整: ${JSON.stringify(Object.keys(route || {}))}`);
        }
        if (!['exact', 'prefix'].includes(route.kind)) {
          throw new Error(`WebRoute.kind 非法: ${route.kind}（应为 exact | prefix）`);
        }
        if (route.path.endsWith('/')) throw new Error(`WebRoute.path 不应有尾斜杠: ${route.path}`);
        if (this.routes.some((r) => r.kind === route.kind && r.path === route.path)) {
          throw new Error(`WebRoute 重复注册: ${route.kind} ${route.path}`);
        }
        this.routes.push(route);
        return () => { this.routes = this.routes.filter((r) => r !== route); };
      },
      registerUpgrade(route) {
        if (!route || !route.path || typeof route.handler !== 'function') throw new Error('WebUpgradeRoute 不完整');
        this.routes.push({ ...route, kind: 'upgrade' });
        return () => {};
      },
      registerFallback(handler) {
        if (typeof handler !== 'function') throw new Error('registerFallback 需要函数');
        return () => {};
      },
      tapIndex(fn) {
        if (typeof fn !== 'function') throw new Error('tapIndex 需要函数');
        return () => {};
      },
    },
    sessions: { get: () => null, list: () => [], create: () => null },
    tokenMeter: { usage: () => ({ input: 0, output: 0 }) },
    sessionPersistence: { list: async () => [], load: async () => null, save: async () => {} },
  };

  const ctx = {
    ...services,
    services: new Map(Object.entries(services)),
    get(name) {
      return this.services.get(name);
    },
    has(name) {
      return this.services.has(name);
    },
    effect(fn) {
      const dispose = typeof fn === 'function' ? fn() : undefined;
      return typeof dispose === 'function' ? dispose : () => {};
    },
    on() { return () => {}; },
    emit() {},
    logger: { debug() {}, info() {}, warn(...a) { state.warnings.push(a.join(' ')); }, error() {} },
    _state: state,
  };
  return { ctx, state };
}

// ---------------------------------------------------------------- 用例

test('integration', 'load/apply-runs', '插件 apply(ctx) 可在模拟宿主中成功执行', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx, state } = makeHostCtx();
  await mod.apply(ctx);
  assert(state.tools.length > 0, 'apply 后应至少注册一个工具');
});

test('integration', 'load/tool-count', '注册的工具数量符合预期（>= 40，防止静默丢失）', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx, state } = makeHostCtx();
  await mod.apply(ctx);
  assert(state.tools.length >= 40, `工具数量异常：仅 ${state.tools.length} 个（预期 >= 40）`, {
    count: state.tools.length,
    names: state.tools.map((t) => t.name),
  });
});

test('integration', 'load/tool-names-dcs-prefixed', '所有工具名均以 dcs_ 前缀且全局唯一', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx, state } = makeHostCtx();
  await mod.apply(ctx);
  const bad = state.tools.filter((t) => !t.name.startsWith('dcs_')).map((t) => t.name);
  assertEqual(bad.length, 0, `以下工具名缺少 dcs_ 前缀: ${bad.join(', ')}`);
  const names = state.tools.map((t) => t.name);
  assertEqual(new Set(names).size, names.length, '工具名存在重复');
});

test('integration', 'load/schemas-compile', '每个工具的参数与输出 schema 均可通过平台校验', async () => {
  const root = findDshRoot();
  const mods = dshModulesDir(root);
  const { assertSupportedJsonSchema } = await import(join(mods, '@deepseek-ai', 'dsh-tools', 'lib', 'index.js'));
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx, state } = makeHostCtx();
  await mod.apply(ctx);
  const failures = [];
  for (const t of state.tools) {
    try {
      assertSupportedJsonSchema(t.parameters);
      if (t.output && t.output.schema) assertSupportedJsonSchema(t.output.schema);
    } catch (e) {
      failures.push(`${t.name}: ${e.message}`);
    }
  }
  assertEqual(failures.length, 0, `${failures.length} 个工具的 schema 不被平台接受`, failures);
});

test('integration', 'load/output-renderers-robust', '每个工具的 output.render 对最小合法值不抛错', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx, state } = makeHostCtx();
  await mod.apply(ctx);
  const failures = [];
  for (const t of state.tools) {
    try {
      // 构造一个满足 required 的最小对象
      const req = (t.output.schema && t.output.schema.required) || [];
      const value = {};
      for (const k of req) {
        const prop = t.output.schema.properties[k] || {};
        if (prop.type === 'boolean') value[k] = true;
        else if (prop.type === 'number' || prop.type === 'integer') value[k] = 0;
        else if (prop.type === 'array') value[k] = [];
        else if (prop.type === 'object') value[k] = {};
        else value[k] = 'x';
      }
      const blocks = t.output.render({}, value);
      assert(Array.isArray(blocks), `${t.name}.render 应返回 ContentBlock[]`);
      for (const b of blocks) {
        assert(b && typeof b.type === 'string', `${t.name}.render 返回的块缺少 type`);
      }
    } catch (e) {
      failures.push(`${t.name}: ${e.message}`);
    }
  }
  assertEqual(failures.length, 0, `${failures.length} 个工具的 render 在最小值上崩溃`, failures);
});

test('integration', 'load/descriptions-present', '每个工具都有非空 description（模型可见）', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx, state } = makeHostCtx();
  await mod.apply(ctx);
  const missing = state.tools.filter((t) => !t.description || t.description.trim().length < 8).map((t) => t.name);
  assertEqual(missing.length, 0, `以下工具缺少有效 description: ${missing.join(', ')}`);
});

test('integration', 'load/idempotent-second-apply', 'apply 重复执行不抛错（热重载场景）', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const first = makeHostCtx();
  await mod.apply(first.ctx);
  // 第二次用全新 ctx，模拟热重载
  const second = makeHostCtx();
  await mod.apply(second.ctx);
  assertEqual(second.state.tools.length, first.state.tools.length, '两次装载的工具数量应一致');
});

test('integration', 'load/system-prompt-injected', '插件向 systemPrompt 注入了 DCS 工作流指导', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx } = makeHostCtx();
  await mod.apply(ctx);
  const sections = ctx.systemPrompt.sections;
  assert(sections.length > 0, 'systemPrompt 未注入任何 section（DCS 流程引导会丢失）');
  const all = sections.map((s) => s.body).join('\n');
  assertIncludes(all, 'DCS', 'systemPrompt 内容中应包含 DCS 相关指导');
  const dcsSection = sections.find((s) => s.name === 'dcs-cloud');
  assert(dcsSection, '应注册名为 dcs-cloud 的 systemPrompt section');
  assert(typeof dcsSection.order === 'number', 'section 应声明 order（决定注入顺序）');
  assert(dcsSection.body.length > 500, `DCS 引导内容过短（${dcsSection.body.length} 字符），可能被截断`);
});

test('integration', 'load/web-routes-registered', '插件按 0.1.5 WebRoute 契约注册 HTTP 路由', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx } = makeHostCtx();
  await mod.apply(ctx);
  const routes = ctx.webServer.routes;
  assert(routes.length > 0, '未注册任何 WebRoute（项目管理/结果交付的数据接口会失效）');
  const paths = routes.map((r) => r.path);
  assertIncludes(paths, '/api/dcs-cloud', '应注册 /api/dcs-cloud 前缀路由');
  for (const r of routes) {
    assert(['exact', 'prefix'].includes(r.kind), `路由 kind 非法: ${r.kind}`);
    assert(r.path.startsWith('/'), `路由 path 应以 / 开头: ${r.path}`);
    assert(!r.path.endsWith('/'), `路由 path 不应以 / 结尾: ${r.path}`);
    assertEqual(typeof r.handler, 'function', `路由 ${r.path} 缺少 handler`);
  }
});

test('integration', 'load/presenters-consistent', '呈现契约一致：terminal/diff 卡必须配对 presentResult', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx, state } = makeHostCtx();
  await mod.apply(ctx);

  // dsh 的 presentCall/presentResult 是「待执行卡 / 完成卡」一对。
  // generic 卡省略 presentResult 会沿用待执行卡片标题（可接受）；
  // 但 terminal/diff 卡若省略，完成后会用原始文本替换掉终端/差异卡片，
  // 造成「执行中美观、完成后塌成纯文本」的体验断裂——故强制配对。
  const CARD_REQUIRES_RESULT = new Set(['terminal', 'diff']);
  const failures = [];
  let withCall = 0;
  let withResult = 0;

  for (const t of state.tools) {
    const hasCall = typeof t.presentCall === 'function';
    const hasResult = typeof t.presentResult === 'function';
    if (hasCall) withCall++;
    if (hasResult) withResult++;
    if (!hasCall) continue;

    // 用最小合法参数调用 presentCall，忽略参数校验失败的场景
    let view;
    try {
      view = t.presentCall(minimalArgs(t));
    } catch {
      continue;
    }
    if (!view || typeof view !== 'object') continue;
    if (CARD_REQUIRES_RESULT.has(view.card) && !hasResult) {
      failures.push(`${t.name}: presentCall 返回 card='${view.card}' 但缺少 presentResult`);
    }
    if (view.card !== undefined && !['generic', 'terminal', 'diff'].includes(view.card)) {
      failures.push(`${t.name}: 未知 card 类型 '${view.card}'`);
    }
    if (view.card === 'generic' && (!view.title || String(view.title).trim() === '')) {
      failures.push(`${t.name}: generic 卡缺少 title（卡片会显示为空标题）`);
    }
    if (view.card === 'terminal' && (!view.title || String(view.title).trim() === '')) {
      failures.push(`${t.name}: terminal 卡缺少 title（应显示命令行）`);
    }
    if (view.kind !== undefined) {
      const kinds = ['read', 'edit', 'delete', 'move', 'search', 'execute', 'fetch', 'other'];
      if (!kinds.includes(view.kind)) failures.push(`${t.name}: 未知 kind '${view.kind}'`);
    }
  }

  assert(withCall > 0, '应至少有一个工具声明 presentCall');
  assertEqual(failures.length, 0, `呈现契约不一致（${failures.length} 处）`, failures);
});

test('integration', 'load/presenters-render-safe', 'presentResult 对成功/失败两种结果均不抛错', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx, state } = makeHostCtx();
  await mod.apply(ctx);
  const failures = [];
  let checked = 0;

  for (const t of state.tools) {
    if (typeof t.presentResult !== 'function') continue;
    checked++;
    // 需覆盖两种态：正常结果与错误结果（presentResult 会看到 result.isError）
    const samples = [
      { content: [{ type: 'text', text: 'ok\n' }], isError: false },
      { content: [{ type: 'text', text: 'boom' }], isError: true },
      { content: [], isError: false },
    ];
    for (const result of samples) {
      try {
        const view = t.presentResult(minimalArgs(t), result);
        if (view !== undefined) {
          assert(view && typeof view === 'object', `${t.name}.presentResult 应返回对象或 undefined`);
          assert(view.card, `${t.name}.presentResult 返回的对象缺少 card`);
        }
      } catch (e) {
        failures.push(`${t.name} (isError=${result.isError}): ${e.message}`);
      }
    }
  }
  assert(checked > 0, '应至少有一个工具声明 presentResult');
  assertEqual(failures.length, 0, `${failures.length} 处 presentResult 崩溃`, failures);
});

/** 依据工具的参数 schema 造一份「最小合法」参数。 */
function minimalArgs(t) {
  const schema = t.parameters || {};
  const req = schema.required || [];
  const args = {};
  for (const k of Object.keys(schema.properties || {})) {
    const p = schema.properties[k];
    if (!req.includes(k)) continue;
    if (p.type === 'boolean') args[k] = false;
    else if (p.type === 'number' || p.type === 'integer') args[k] = 1;
    else if (p.type === 'array') args[k] = [];
    else if (p.type === 'object') args[k] = {};
    else args[k] = 'x';
  }
  return args;
}

test('integration', 'load/presenters-soft-validate', 'presentCall/presentResult 对非法参数返回 undefined 而非抛错', async () => {
  // dsh 契约：presenter 会先软校验参数，非法即返回 undefined（回退通用卡片），
  // 由 defineTool 包一层实现。插件必须能容忍该行为（不得假设返回对象）。
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx, state } = makeHostCtx();
  await mod.apply(ctx);

  const problems = [];
  for (const t of state.tools) {
    if (typeof t.presentCall === 'function') {
      // 非法参数（缺必填 / 类型错）不应抛错
      try {
        const v = t.presentCall({ __nonexistent__: 1 });
        if (v !== undefined) {
          assert(v && typeof v === 'object', `${t.name}.presentCall 应返回对象或 undefined`);
        }
      } catch (e) {
        problems.push(`${t.name}.presentCall: ${e.message}`);
      }
    }
    if (typeof t.presentResult === 'function') {
      try {
        const v = t.presentResult({ __nonexistent__: 1 }, { content: [], isError: false });
        if (v !== undefined) {
          assert(v && typeof v === 'object', `${t.name}.presentResult 应返回对象或 undefined`);
        }
      } catch (e) {
        problems.push(`${t.name}.presentResult: ${e.message}`);
      }
    }
  }
  assertEqual(problems.length, 0, `${problems.length} 个 presenter 在非法参数上抛错`, problems);
});

test('integration', 'load/terminal-presenter-exit-code', '终端卡片从失败输出还原退出码徽章', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const { ctx, state } = makeHostCtx();
  await mod.apply(ctx);
  const t = state.tools.find((x) => x.name === 'dcs_terminal_exec');
  assert(t, '应注册 dcs_terminal_exec');
  assert(t.output.schema.properties.exit_code,
    'output schema 应声明 exit_code（否则结构化退出码会被 additionalProperties:false 拒绝）');

  const view = (text) => t.presentResult(
    { command: 'ls /nope' },
    { content: [{ type: 'text', text }], isError: false },
  );

  // 非 0 退出码 → 应设置 exitCode（UI 显示失败徽章）
  assertEqual(view('❌ 失败：x\nboom\n(exit_code=1)').exitCode, 1, 'exit_code=1 应被还原');
  assertEqual(view('boom\n(exit_code=127)').exitCode, 127, 'exit_code=127 应被还原');

  // 成功（无 exit_code 文本）与显式 0 → 不应设置，避免误导性成功徽章
  assertEqual(view('🖥️ 在线执行：\nok\n').exitCode, undefined,
    '无退出码信息时不应设置 exitCode');
  assertEqual(view('ok\n(exit_code=0)').exitCode, undefined,
    'exit_code=0 不应设置徽章（成功是默认态）');

  // 卡片类型与输出仍保持终端卡片语义
  const v = view('hello');
  assertEqual(v.card, 'terminal', '应保持终端卡片');
  assertEqual(v.title, 'ls /nope', '标题应为命令');
  assertEqual(v.output, 'hello', '输出应原样透传');
});

test('integration', 'load/cli-view-fields-declared', '返回 cliView 结果的工具必须声明其全部字段', async () => {
  // 教训：给 cliView 增加 exit_code 字段后，dcs_task_status 的 output schema
  // 是 additionalProperties:false 且未声明 exit_code —— 平台会拒绝该结果。
  // 这类「共享 helper 增字段、消费方 schema 未跟上」的问题极易漏掉，故设此守卫。
  //
  // 注意：必须扫**源码**而非 t.execute.toString() —— defineTool 会把用户 execute
  // 包一层（return userExecute(args, exec)），包装后的函数体里看不到 cliView。
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8');

  // 1) 解析 cliView 实际返回的字段名
  const cliStart = src.indexOf('function cliView(');
  assert(cliStart > 0, '应找到 cliView 定义');
  const cliBody = src.slice(cliStart, src.indexOf('\n}', cliStart));
  const retIdx = cliBody.lastIndexOf('return {');
  assert(retIdx > 0, 'cliView 应有 return 对象');
  const retBlock = cliBody.slice(retIdx);
  // 同时支持 `key: value` 与 ES6 简写 `key,`
  const cliFields = [...retBlock.matchAll(/^\s{4}([a-z_][\w]*)\s*(?::|,|$)/gm)].map((m) => m[1]);
  assert(cliFields.length >= 4,
    `未能解析 cliView 返回字段（应含 ok/error/output/truncated 等），实际: ${JSON.stringify(cliFields)}`);

  // 2) 按工具切分源码，找出「直接把 cliView(...) 作为返回值」的工具
  const blocks = src.split(/ctx\.tools\.register\(defineTool\(\{/).slice(1);
  const problems = [];
  let checked = 0;

  for (const b of blocks) {
    const nameM = b.match(/name:\s*'([^']+)'/);
    if (!nameM) continue;
    const name = nameM[1];
    // 只关心「整个工具的输出就是 cliView 结果」的形态
    if (!/return cliView\(/.test(b)) continue;
    checked++;

    const schM = b.match(/schema:\s*\{([\s\S]*?)\}\s*,\s*\n\s*render\(/);
    if (!schM) continue;
    const sch = schM[1];
    if (!/additionalProperties:\s*false/.test(sch)) continue;

    const missing = cliFields.filter((f) => !new RegExp(`\\b${f}\\s*:`).test(sch));
    if (missing.length > 0) {
      problems.push(`${name}: 返回 cliView 但 schema 未声明 ${missing.join(', ')}`
        + `（additionalProperties:false 会拒绝该结果）`);
    }
  }

  assert(checked > 0, '应至少找到一个直接返回 cliView 的工具（否则守卫失效）');
  assertEqual(problems.length, 0, problems.join('; '));
});

// ---------------------------------------------------------------- 客户端半

test('integration', 'client/loads-in-moduleloader', '客户端半可在模拟 __ModuleLoader__ 环境中装载', async () => {
  const src = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
  const captured = [];
  const React = { createElement: (...a) => ({ __el: a }), Component: class {}, Fragment: 'frag' };

  // 模拟浏览器全局
  const g = globalThis;
  const prevWindow = g.window;
  const prevDoc = g.document;
  g.window = {
    __ModuleLoader__: { load: (def) => captured.push(def) },
    location: { search: '', href: '' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  g.document = {
    getElementById: () => null,
    createElement: () => ({ set textContent(v) {}, set id(v) {}, style: {}, appendChild() {} }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    addEventListener: () => {},
  };
  try {
    Object.defineProperty(g, 'navigator', { value: { userAgent: 'node' }, configurable: true, writable: true });
  } catch { /* 已有 navigator 则复用 */ }

  try {
    // 在隔离作用域里执行客户端源码
    const fn = new Function('window', 'document', 'navigator', 'React', src);
    fn(g.window, g.document, g.navigator, React);
    assertEqual(captured.length, 1, '客户端半应调用 __ModuleLoader__.load 恰好一次');
    const def = captured[0];
    assertEqual(def.id, 'dsh-dcs-cloud', '模块 id 应为 dsh-dcs-cloud');
    assertEqual(typeof def.factory, 'function', 'factory 必须是函数');

    const requireStub = (name) => {
      if (name === 'react') return React;
      throw new Error(`未预期的依赖: ${name}`);
    };
    const exported = def.factory(requireStub);
    assert(exported && typeof exported.apply === 'function', 'factory 应返回带 apply 的模块');
    assert(Array.isArray(exported.inject), '模块应声明 inject');
    assertIncludes(exported.inject, 'slots', '客户端应注入 slots');
  } finally {
    g.window = prevWindow;
    g.document = prevDoc;
  }
});

test('integration', 'client/apply-registers-slots', '客户端 apply 在真实 slots 契约下注册界面', async () => {
  const src = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
  const captured = [];
  const g = globalThis;
  const prevWindow = g.window;
  const prevDoc = g.document;
  g.window = { __ModuleLoader__: { load: (d) => captured.push(d) }, localStorage: { getItem: () => null, setItem: () => {} } };
  g.document = { getElementById: () => null, createElement: () => ({ style: {}, set textContent(v) {} }), head: { appendChild: () => {} } };
  const React = { createElement: (...a) => ({ __el: a }), Component: class {}, Fragment: 'frag' };

  const registrations = [];
  const injected = [];
  const slots = {
    inject(name, fn) { injected.push(name); return fn ? fn() : undefined; },
    register(meta, comp) { registrations.push({ meta, comp }); return () => {}; },
    entries: () => [],
    subscribe: () => () => {},
    getVersion: () => 0,
  };

  try {
    const fn = new Function('window', 'document', 'React', src);
    fn(g.window, g.document, React);
    const mod = captured[0].factory((n) => {
      if (n === 'react') return React;
      throw new Error(`未预期的依赖: ${n}`);
    });
    mod.apply({ slots, effect: (f) => (typeof f === 'function' ? f() : undefined), get: () => undefined });
    assert(injected.length > 0, '客户端应通过 slots.inject 挂载');
    assert(registrations.length > 0, '客户端应注册至少一个界面');
    const names = registrations.map((r) => r.meta && r.meta.name);
    assertIncludes(names, 'conversation.view', '应注册会话视图（项目管理/结果交付）');
    assertIncludes(names, 'settings.section', '应注册设置页');
    for (const r of registrations) {
      assert(r.meta && r.meta.id, `注册项缺少 id: ${JSON.stringify(r.meta)}`);
      assert(r.comp, `注册项 ${r.meta.id} 缺少组件`);
    }
  } finally {
    g.window = prevWindow;
    g.document = prevDoc;
  }
});
