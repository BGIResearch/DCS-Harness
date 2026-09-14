// 客户端渲染层：在 hook-shim 下真实渲染客户端半的各视图组件。
//
// 为什么需要：integration 层只验证了「slot 注册成功」，但**没验证组件能否渲染**。
// 本文件的历史 bug 正是这类 —— `useState` 解构取错下标（setMsg = msgS[1] 而非 msg[1]），
// 导致 setter 为 undefined，运行时抛 "setBusy is not a function" → **整个对话页白屏**。
// 静态检查（scripts/check-hooks.cjs）能挡住已知模式，但挡不住其它渲染期错误。
//
// 做法：提供最小 React hook 运行时（useState/useEffect/useRef/useMemo/useCallback），
// 调用组件函数并断言返回合法的 React 元素树（不依赖 react-dom / jsdom）。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, assert, assertEqual, assertIncludes, ROOT } from '../lib/harness.mjs';

// ---------------------------------------------------------------- hook 运行时

/**
 * 构造一个最小 React 替身：createElement 返回可检查的元素对象，
 * hooks 提供稳定的状态槽（每次渲染复用同一组槽位，模拟 React 的调用顺序约定）。
 */
function makeReactShim() {
  const hooks = {
    states: [],        // useState 槽
    cursor: 0,         // 当前渲染的 hook 游标
    effects: [],       // useEffect 回调
    refs: [],          // useRef 槽
  };

  const React = {
    createElement(type, props, ...children) {
      // ⚠ 必须与真实 React 一致：children 放在 **props.children** 里。
      // 早期版本把它放在独立的 element.children 字段，导致所有遍历
      // props.children 的代码（含本文件的元素树校验与视图解包）全部落空 ——
      // 6 条渲染用例因此长期是空转的（视图函数体从未被执行）。
      const kids = children.length === 0 ? undefined
        : (children.length === 1 ? children[0] : children.flat());
      return { $$typeof: 'element', type, props: { ...(props || {}), children: kids }, key: null, ref: null };
    },
    Fragment: Symbol.for('react.fragment'),
    Component: class {},
    useState(init) {
      const i = hooks.cursor++;
      if (!(i in hooks.states)) hooks.states[i] = typeof init === 'function' ? init() : init;
      const setter = (v) => { hooks.states[i] = typeof v === 'function' ? v(hooks.states[i]) : v; };
      return [hooks.states[i], setter];
    },
    useEffect(fn) {
      hooks.effects.push({ fn, cursor: hooks.cursor++ });
      return () => {};
    },
    useRef(v) {
      const i = hooks.cursor++;
      if (!(i in hooks.refs)) hooks.refs[i] = { current: v };
      return hooks.refs[i];
    },
    useMemo(fn) { return fn(); },
    useCallback(fn) { return fn; },
    useLayoutEffect(fn) { return React.useEffect(fn); },
  };

  return { React, hooks, reset() { hooks.cursor = 0; } };
}

/** 加载客户端半模块（在模拟浏览器环境中执行源码）。 */
function loadClientModule() {
  const src = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
  const captured = [];
  const g = globalThis;
  const prevWindow = g.window;
  const prevDoc = g.document;

  g.window = {
    __ModuleLoader__: { load: (d) => captured.push(d) },
    location: { search: '', href: '', origin: 'http://localhost' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    addEventListener: () => {}, removeEventListener: () => {},
    fetch: () => Promise.resolve({ ok: true, json: async () => ({ ok: true }) }),
  };
  g.document = {
    getElementById: () => ({ set textContent(v) {}, style: {} }),
    createElement: () => ({ set textContent(v) {}, set id(v) {}, style: {}, appendChild() {} }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    addEventListener: () => {}, removeEventListener: () => {},
  };

  try {
    const fn = new Function('window', 'document', 'React', src);
    fn(g.window, g.document, makeReactShim().React); // 仅用于触发 __ModuleLoader__ 注册
    assertEqual(captured.length, 1, '客户端半应注册一个模块');
    return captured[0];
  } finally {
    g.window = prevWindow;
    g.document = prevDoc;
  }
}

/**
 * 触发 __ModuleLoader__ 注册并返回 slot 组件。
 *
 * ⚠ 注意：注册的组件是 `guarded(view)` 返回的 **Guarded 包装器**，
 * 不是真实视图。直接调用包装器只会渲染出 `<ErrorBoundary><view/></ErrorBoundary>`，
 * 而**不会执行视图自身的函数体** —— 那样测不到视图里的 hooks 与逻辑
 * （早期版本正是如此，导致 6 条渲染用例大部分是空转）。
 * 因此这里额外从包装器的元素树里**解包**出真实视图组件。
 */
function collectComponents() {
  const def = loadClientModule();
  const components = new Map();
  const shim = makeReactShim();

  const mod = def.factory((name) => {
    if (name === 'react') return shim.React;
    throw new Error(`未预期的依赖: ${name}`);
  });

  const slots = {
    inject(_name, fn) { return fn ? fn() : undefined; },
    register(meta, comp) { components.set(meta.id, { meta, comp }); return () => {}; },
    entries: () => [], subscribe: () => () => {}, getVersion: () => 0,
  };

  mod.apply({
    slots,
    effect: (f) => (typeof f === 'function' ? f() : undefined),
    get: () => undefined,
  });

  // 解包：Guarded 的源码是
  //   function Guarded(props) { return h(ErrorBoundary, {hint}, h(view, props)); }
  // 直接调用 Guarded 会**执行 h(ErrorBoundary,…)** —— 那只是创建元素、
  // 不构造实例，本身是安全的；但随后我们递归进 children 时会碰到
  // ErrorBoundary 这个 class，误当作函数调用就会抛
  // "Class constructor ErrorBoundary cannot be invoked without 'new'"。
  // 因此解包时**只遍历元素树、绝不调用任何 class 组件**。
  const unwrapped = new Map();
  const isClass = (fn) => {
    if (typeof fn !== 'function') return false;
    const src = Function.prototype.toString.call(fn);
    return /^class\s/.test(src.trim()) || /\bclass\s+\w+\s+extends\b/.test(src);
  };
  for (const [id, entry] of components) {
    const { meta, comp } = entry;
    let real = comp;
    if (typeof comp === 'function' && !isClass(comp)) {
      shim.hooks.cursor = 0; shim.hooks.states.length = 0; shim.hooks.refs.length = 0; shim.hooks.effects.length = 0;
      try {
        const el = comp({ sessionId: 'probe', close: () => {}, size: 24 });
        // 递归查找第一个「非 class 的函数型组件」——即真实视图
        const probe = (node, depth = 0) => {
          if (depth > 30 || !node || typeof node !== 'object') return null;
          if (Array.isArray(node)) {
            for (const c of node) { const r = probe(c, depth + 1); if (r) return r; }
            return null;
          }
          if (node.$$typeof === 'element') {
            const kids = node.props && node.props.children;
            if (Array.isArray(kids)) {
              for (const c of kids) { const r = probe(c, depth + 1); if (r) return r; }
            } else if (kids) {
              const r = probe(kids, depth + 1); if (r) return r;
            }
            if (typeof node.type === 'function' && !isClass(node.type) && node.type !== comp) {
              return { comp: node.type, props: node.props };
            }
          }
          return null;
        };
        const found = probe(el);
        if (found && typeof found.comp === 'function') real = found.comp;
      } catch { /* 解包失败则保留原组件 */ }
    }
    unwrapped.set(id, { meta, comp: real, wrapper: comp });
  }

  return { components: unwrapped, React: shim.React, hooks: shim.hooks };
}

// ---------------------------------------------------------------- 元素树校验

/** 递归校验元素树结构合法（不渲染到 DOM，只检查形状）。 */
function validateTree(node, path = 'root', depth = 0) {
  const problems = [];
  if (depth > 60) return problems;              // 防御：环形引用
  if (node === null || node === undefined || typeof node === 'boolean') return problems;
  if (typeof node === 'string' || typeof node === 'number') return problems;
  if (Array.isArray(node)) {
    node.forEach((c, i) => problems.push(...validateTree(c, `${path}[${i}]`, depth + 1)));
    return problems;
  }
  if (typeof node !== 'object') {
    problems.push(`${path}: 非法节点类型 ${typeof node}`);
    return problems;
  }
  if (node.$$typeof !== 'element') {
    problems.push(`${path}: 不是 React 元素（$$typeof=${String(node.$$typeof)}）`);
    return problems;
  }
  if (node.type === undefined || node.type === null) {
    problems.push(`${path}: 元素缺少 type`);
  }
  if (typeof node.type === 'string') {
    // 宿主元素：className/style 等属性应存在时合法
    if (node.props && node.props.children !== undefined) {
      problems.push(...validateTree(node.props.children, `${path}>${node.type}`, depth + 1));
    }
    return problems;
  }
  // 组件元素：仅检查 props.children
  if (node.props && node.props.children !== undefined) {
    problems.push(...validateTree(node.props.children, `${path}>${String(node.type.name || '?')}`, depth + 1));
  }
  return problems;
}

/**
 * 取出客户端半的内部组件（如 ChartView）。
 *
 * 客户端半只导出 { apply, inject }，组件是闭包内私有声明；
 * 直接改产物导出会污染发布物，因此这里在测试内**重新求值**客户端源码：
 * 剥掉 __ModuleLoader__ 信封，注入 require/React/h/module 后返回目标组件。
 * 仅用于测试，不修改 lib/client.js。
 */
function extractInternalComponents(names) {
  const src = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
  const body = src
    .replace(/^window\.__ModuleLoader__\.load\(\{ id: [^)]*factory: \(require\) => \{ var module = \{ exports: \{\} \}; var exports = module\.exports;/, '')
    .replace(/\nreturn module\.exports; \} \}\);\s*$/, '');
  const shim = makeReactShim();
  const moduleStub = { exports: {} };
  const fn = new Function('require', 'React', 'h', 'module', 'exports',
    body + `\nreturn { ${names.join(', ')} };`);
  return {
    components: fn(
      (n) => { if (n === 'react') return shim.React; throw new Error(`未预期的依赖: ${n}`); },
      shim.React, shim.React.createElement, moduleStub, moduleStub.exports,
    ),
    hooks: shim.hooks,
  };
}

// ---------------------------------------------------------------- 用例

const SKIP_REASON = '需要 React hook 运行时替身';

test('client-render', 'render/all-views-produce-valid-tree', '客户端全部视图组件可渲染出合法元素树', async () => {
  const { components, React, hooks } = collectComponents();
  assert(components.size > 0, '应收集到组件');

  const problems = [];
  for (const [id, { meta, comp }] of components) {
    if (typeof comp !== 'function') {
      problems.push(`${id}: 组件不是函数（${typeof comp}）`);
      continue;
    }
    // 每次渲染前重置 hook 游标与槽位，模拟全新挂载
    hooks.cursor = 0;
    hooks.states.length = 0;
    hooks.refs.length = 0;
    hooks.effects.length = 0;

    let tree;
    try {
      // 传入真实会收到的 props 形态
      tree = comp({
        sessionId: 'test-session',
        close: () => {},
        size: 24,
      });
    } catch (e) {
      problems.push(`${id}: 渲染抛错 → ${e.message}`);
      continue;
    }
    if (tree === null || tree === undefined) {
      problems.push(`${id}: 返回空（组件不应返回 null 之外的假值）`);
      continue;
    }
    const treeProblems = validateTree(tree, id);
    problems.push(...treeProblems);
  }

  assertEqual(problems.length, 0,
    `${problems.length} 处渲染问题:\n${problems.slice(0, 12).join('\n')}`, problems);
});

test('client-render', 'render/state-setters-are-functions', 'useState 解构出的 setter 都是函数（防白屏 bug 复发）', async () => {
  // 历史 bug：`var setX = xS[1]` 把「值变量」当成 useState 返回数组，
  // 于是 setX 是 undefined（或数组元素），调用时抛错 → 整个对话页白屏。
  // 这里通过 hook 替身实际执行渲染，验证每个组件的状态槽都被正确使用。
  const { components, hooks } = collectComponents();
  const problems = [];

  for (const [id, { comp }] of components) {
    if (typeof comp !== 'function') continue;
    hooks.cursor = 0; hooks.states.length = 0; hooks.refs.length = 0; hooks.effects.length = 0;
    try {
      comp({ sessionId: 's', close: () => {}, size: 24 });
    } catch (e) {
      // 渲染期错误通常就是 setter/状态误用导致
      problems.push(`${id}: ${e.message}`);
    }
  }
  assertEqual(problems.length, 0, problems.join('; '));
});

test('client-render', 'render/effects-are-functions', 'useEffect 注册的都是可调用函数', async () => {
  const { components, hooks } = collectComponents();
  const problems = [];
  let totalEffects = 0;

  for (const [id, { comp }] of components) {
    if (typeof comp !== 'function') continue;
    hooks.cursor = 0; hooks.states.length = 0; hooks.refs.length = 0; hooks.effects.length = 0;
    try {
      comp({ sessionId: 's', close: () => {}, size: 24 });
    } catch { /* 已由上个用例覆盖 */ continue; }

    for (const eff of hooks.effects) {
      totalEffects++;
      if (typeof eff.fn !== 'function') {
        problems.push(`${id}: useEffect 收到非函数（${typeof eff.fn}）`);
      }
    }
  }
  assertEqual(problems.length, 0, problems.join('; '));
});

test('client-render', 'render/error-boundary-wraps-views', '所有视图注册都被错误边界包裹（防整页白屏）', async () => {
  // 客户端半用 guarded(view) 把视图包在 ErrorBoundary 里。
  // 若某个视图漏包，它渲染抛错会冒泡到根 → 整个对话页面空白。
  const src = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
  const registrations = [...src.matchAll(
    /slots\.register\(\s*\{[^}]*id:\s*["']([\w-]+)["'][^}]*\}\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g,
  )];
  assert(registrations.length > 0, '应解析到 slot 注册');

  const unwrapped = [];
  for (const [, id, compExpr] of registrations) {
    // 视图组件必须经 guarded(...) 包裹；非视图（如品牌标记）不强制
    const isView = /^(dcs-project|dcs-delivery|dcs-synapse|dcs-cloud)$/.test(id);
    if (!isView) continue;
    if (!/^guarded\(/.test(compExpr.trim())) {
      unwrapped.push(`${id} → ${compExpr}`);
    }
  }
  assertEqual(unwrapped.length, 0,
    `以下视图未用 guarded() 包裹错误边界（渲染抛错会导致整页白屏）: ${unwrapped.join(', ')}`);
});


test('client-render', 'render/all-chart-types-render', '全部图表类型都能渲染（含未知类型兜底）', async () => {
  // ChartView 按 chart.type 分发到各图表组件。若某个声明支持的类型没有分支，
  // 用户看到的是一张空白/报错卡片。这里逐个类型实际渲染。
  const ALL_TYPES = [
    'bar', 'line', 'pie', 'scatter', 'heatmap', 'stat', 'table', 'summary',
    'html', 'iframe', 'link', 'structure3d', 'image', 'video', 'audio',
  ];
  const { components, hooks } = extractInternalComponents(['ChartView']);
  const ChartView = components.ChartView;
  assertEqual(typeof ChartView, 'function', '应取到 ChartView');

  const problems = [];
  for (const type of [...ALL_TYPES, 'totally-unknown-type']) {
    hooks.cursor = 0; hooks.states.length = 0; hooks.refs.length = 0;
    try {
      const el = ChartView({ data: { type, data: [], title: 'T', caption: 'C' } });
      if (!el) { problems.push(`${type}: 返回空（应至少有兜底卡片）`); continue; }
      const p = validateTree(el, type);
      problems.push(...p);
    } catch (e) {
      problems.push(`${type}: ${e.message}`);
    }
  }
  assertEqual(problems.length, 0,
    `${problems.length} 个图表类型渲染异常:\n${problems.slice(0, 10).join('\n')}`, problems);
});

test('client-render', 'render/chart-types-match-declared', 'ChartView 覆盖工具 schema 声明的全部图表类型', async () => {
  // 防止「schema 说有某类型、UI 却不认识」的静默不一致。
  const idxSrc = readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8');
  const docM = idxSrc.match(/bar\/line\/pie\/scatter\/heatmap\/stat\/table\/summary\/image\/video\/audio\/iframe\/link\/html\/structure3d/);
  assert(docM, '应从工具 schema 描述中解析到图表类型清单');
  const declared = new Set(docM[0].split('/'));

  const cliSrc = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
  const cvStart = cliSrc.indexOf('function ChartView');
  assert(cvStart > 0, '应找到 ChartView');
  const cv = cliSrc.slice(cvStart, cliSrc.indexOf('function DeliveryView', cvStart));
  const handled = new Set([...cv.matchAll(/chart\.type === "([a-z0-9]+)"/g)].map((m) => m[1]));

  const missing = [...declared].filter((t) => !handled.has(t));
  assertEqual(missing.length, 0,
    `以下类型在 schema 中声明但 ChartView 未处理: ${missing.join(', ')}（用户会看到兜底卡片）`);
});


// ---------------------------------------------------------------- Markdown 注入防护

test('client-render', 'render/markdown-escapes-html', '客户端 Markdown 渲染转义 HTML（防 XSS）', async () => {
  // 与 lib/report.js 同类缺陷（本轮一并修复）：
  // 客户端 mdToHtml 的 inline() 只对**代码块**调了 esc()，行内内容直接套标记。
  // 而它的输入包括 project.plan.content 与交付文档各章节（findings/methods/…），
  // 这些由模型基于研究结果撰写、夹带上游数据与 DCS 返回文本 —— 属真实注入路径。
  // 结果经 dangerouslySetInnerHTML 注入，浏览器会执行其中的 <script>。
  const { components } = extractInternalComponents(['mdToHtml']);
  const mdToHtml = components.mdToHtml;
  assertEqual(typeof mdToHtml, 'function', '应取到 mdToHtml');

  const attacks = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<iframe src=//evil></iframe>',
    '[x](javascript:alert(1))',
    '[x](data:text/html,<script>1</script>)',
  ];
  const problems = [];
  for (const a of attacks) {
    const html = mdToHtml(a);
    if (/<script[^>]*>alert/i.test(html)) problems.push(`${JSON.stringify(a)}: 未转义 <script>`);
    if (/<img[^>]*onerror=/i.test(html)) problems.push(`${JSON.stringify(a)}: 未转义 onerror`);
    if (/<iframe/i.test(html)) problems.push(`${JSON.stringify(a)}: 未转义 <iframe>`);
    if (/<a[^>]*href="\s*(?:javascript|data):/i.test(html)) {
      problems.push(`${JSON.stringify(a)}: 危险协议仍渲染为可点击链接`);
    }
  }
  assertEqual(problems.length, 0, `客户端 Markdown 存在注入风险:\n${problems.join('\n')}`);
});

test('client-render', 'render/markdown-keeps-formatting', '客户端 Markdown 渲染保留正常格式', async () => {
  const { components } = extractInternalComponents(['mdToHtml']);
  const mdToHtml = components.mdToHtml;

  const html = mdToHtml([
    '# 标题',
    '**粗体** 与 *斜体* 与 `code` 与 ==高亮== 与 ~~删除~~',
    '',
    '[文档](https://example.com)',
    '',
    '- 项目一',
    '- 项目二',
  ].join('\n'));

  assertIncludes(html, '<strong>粗体</strong>', '粗体应保留');
  assertIncludes(html, '<em>斜体</em>', '斜体应保留');
  assertIncludes(html, '<code>code</code>', '行内代码应保留');
  assertIncludes(html, '<mark>高亮</mark>', '高亮应保留');
  assertIncludes(html, '<del>删除</del>', '删除线应保留');
  assert(/<a[^>]*href="https:\/\/example\.com"/.test(html), '正常 https 链接应渲染为 <a>');
  assertIncludes(html, '<li>', '列表应保留');
});


test('client-render', 'render/delivery-content-is-xss-safe-end-to-end', '交付内容端到端防注入（存储 → 渲染）', async () => {
  // 前面的用例只测渲染函数本身。本用例走**真实数据路径**：
  // 把含注入的交付内容存进项目库 → 取出 → 经客户端 mdToHtml 渲染。
  // 交付内容由 agent 撰写，会夹带上游数据/文件名/DCS 返回文本 ——
  // 这是最可能被注入的入口。
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const prev = process.env.DSH_HOME;
  const home = mkdtempSync(join(tmpdir(), 'xss-e2e-'));
  process.env.DSH_HOME = home;

  try {
    const projects = await import(join(ROOT, 'lib', 'projects.js') + `?e2e=${Date.now()}`);
    await projects.upsertProject({ project_id: 'X', title: 'T' }, 's');

    const PAYLOAD = [
      '## 结果',
      '<script>alert(document.cookie)</script>',
      '<img src=x onerror=alert(1)>',
      '[x](javascript:alert(1))',
    ].join('\n');
    await projects.updateDelivery('X', { sections: { findings: PAYLOAD } }, 's');

    // 1) 存储层应**原样保留**（渲染期才转义；此处不得篡改用户内容）
    const stored = projects.getProject('X').delivery.sections.findings;
    assertIncludes(stored, '<script>', '存储层应保留原文（转义发生在渲染期）');

    // 2) 渲染后不得含可执行脚本 / 危险链接
    const { components } = extractInternalComponents(['mdToHtml']);
    const html = components.mdToHtml(stored);

    assert(!/<script[^>]*>alert/i.test(html), '渲染后出现了可执行 <script>（XSS）');
    assert(!/<img[^>]*onerror=/i.test(html), '渲染后出现了 onerror 注入');
    assert(!/<a[^>]*href="\s*(?:javascript|data):/i.test(html), '渲染后出现了危险协议链接');

    // 3) 内容仍可读（转义而非丢弃）
    assertIncludes(html, 'alert(document.cookie)', '原始文本应仍可见（不应静默删除内容）');
    assertIncludes(html, '&lt;script&gt;', 'HTML 应被转义为实体');
  } finally {
    if (prev === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = prev;
    rmSync(home, { recursive: true, force: true });
  }
});
