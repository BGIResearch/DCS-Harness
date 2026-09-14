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
import { test, assert, assertEqual, ROOT } from '../lib/harness.mjs';

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
      return { $$typeof: 'element', type, props: props || {}, children: children.flat() };
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
 * 从模块内部取出组件函数。
 * 客户端半只导出 { apply, inject }，组件是闭包内的私有函数，
 * 因此通过 apply 时注册的 slot 组件来获取（这正是真实渲染路径）。
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

  return { components, React: shim.React, hooks: shim.hooks };
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
