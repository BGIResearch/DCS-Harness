// HTTP 接口契约层：客户端调用与服务端路由必须一一对应。
//
// 为什么需要：客户端半用 fetch("/api/dcs-cloud" + path) 调服务端路由，
// 两边是**字符串约定**，没有任何类型检查。任一侧改名/加前缀都会导致
// UI 静默失效（面板空白、按钮无反应），且不会有编译期报错。
//
// 本层在**静态层面**比对两侧，并验证前缀拼接的正确性。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, assert, assertEqual, ROOT } from '../lib/harness.mjs';

const IDX = () => readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8');
const CLI = () => readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');

/** 路由前缀（客户端拼在 path 前，服务端注册时用作前缀路由）。 */
const PREFIX = '/api/dcs-cloud';

// ---------------------------------------------------------------- 提取

/** 服务端注册的全部路由（精确 + 前缀）。 */
function serverRoutes() {
  const src = IDX();
  const exact = new Set();
  const prefix = new Set();
  for (const m of src.matchAll(/path === '([^']+)'/g)) exact.add(m[1]);
  for (const m of src.matchAll(/path\.startsWith\('([^']+)'\)/g)) prefix.add(m[1]);
  return { exact, prefix };
}

/** 客户端调用的全部 path（经 api/apiPost/request 三个 helper）。 */
function clientCalls() {
  const src = CLI();
  const calls = new Map(); // path -> 调用点行号
  const re = /\b(?:api|apiPost|request)\(\s*"([^"]+)"/g;
  for (const m of src.matchAll(re)) {
    const raw = m[1];
    const line = src.slice(0, m.index).split('\n').length;
    // 去掉查询串；保留「模板拼接」的语义（如 "/v2/projects/" + id）
    const path = raw.split('?')[0];
    if (!calls.has(path)) calls.set(path, line);
  }
  // 拼接形态：api("/v2/projects/" + id) —— 视为前缀
  const reCat = /\b(?:api|apiPost|request)\(\s*"([^"]+)"\s*\+/g;
  for (const m of src.matchAll(reCat)) {
    const path = m[1].split('?')[0];
    const line = src.slice(0, m.index).split('\n').length;
    if (!calls.has(path)) calls.set(path + '*', line);
  }
  return calls;
}

// ---------------------------------------------------------------- 用例

test('http', 'http/prefix-consistent', '客户端与服务端使用同一个路由前缀', async () => {
  const cli = CLI();
  const idx = IDX();

  // 客户端必须把所有请求拼到 /api/dcs-cloud 下
  assert(/fetch\(\s*["']\/api\/dcs-cloud["']\s*\+/.test(cli) || cli.includes('"/api/dcs-cloud" + path'),
    '客户端 api() 应把 path 拼到 "/api/dcs-cloud" 前缀下');

  // 服务端必须注册该前缀路由
  assert(idx.includes(`path: '${PREFIX}'`) || new RegExp(`path:\\s*'${PREFIX}'`).test(idx),
    `服务端应注册 ${PREFIX} 前缀路由`);

  // 前缀不得出现在客户端 path 字面量里（否则会拼成 /api/dcs-cloud/api/dcs-cloud/...）
  const doubled = [...cli.matchAll(/\b(?:api|apiPost|request)\(\s*"(\/api\/[^"]*)"/g)]
    .map((m) => m[1]);
  assertEqual(doubled.length, 0,
    `客户端 path 字面量不应自带 /api 前缀（会与前缀拼接重复）: ${doubled.join(', ')}`);
});

test('http', 'http/client-calls-have-server-routes', '客户端调用的每个 path 都有服务端路由', async () => {
  const { exact, prefix } = serverRoutes();
  const calls = clientCalls();
  assert(calls.size > 0, '应解析到客户端调用');

  const missing = [];
  for (const [path, line] of calls) {
    const isPrefix = path.endsWith('*');
    const p = isPrefix ? path.slice(0, -1) : path;
    const hit = exact.has(p) || prefix.has(p)
      // 前缀路由：客户端调用以某个已注册前缀开头即算命中
      || [...prefix].some((pre) => p.startsWith(pre))
      // 前缀路由的子路径（如 /v2/projects/xxx）由 startsWith 覆盖
      || [...prefix].some((pre) => p.startsWith(pre.replace(/\/$/, '') + '/'));
    if (!hit) missing.push(`${path} (client.js:${line})`);
  }
  assertEqual(missing.length, 0,
    `以下客户端调用没有对应服务端路由（UI 会静默失效）: ${missing.join('; ')}`);
});

test('http', 'http/routes-shape-valid', '服务端路由满足 dsh WebRoute 契约', async () => {
  const src = IDX();
  const routeBlocks = [...src.matchAll(/webServer\.register\(\{([\s\S]{0,400}?)\}\)/g)];
  assert(routeBlocks.length > 0, '应注册至少一个 WebRoute');

  const problems = [];
  for (const [, body] of routeBlocks) {
    const kind = (body.match(/kind:\s*'([^']+)'/) || [])[1];
    const path = (body.match(/path:\s*'([^']+)'/) || [])[1];
    if (!kind) problems.push('缺少 kind');
    else if (!['exact', 'prefix'].includes(kind)) problems.push(`非法 kind: ${kind}`);
    if (!path) problems.push('缺少 path');
    else {
      if (!path.startsWith('/')) problems.push(`path 应以 / 开头: ${path}`);
      if (path.endsWith('/')) problems.push(`path 不应以 / 结尾: ${path}`);
    }
    if (!/handler\s*[:(]/.test(body)) problems.push(`path ${path} 缺少 handler`);
  }
  assertEqual(problems.length, 0, `WebRoute 契约问题: ${problems.join('; ')}`);
});

test('http', 'http/exact-routes-unique', '精确路由 path 不重复（平台对重复注册抛错）', async () => {
  const src = IDX();
  const seen = new Map();
  const dupes = [];
  for (const m of src.matchAll(/webServer\.register\(\{([\s\S]{0,400}?)\}\)/g)) {
    const body = m[1];
    const kind = (body.match(/kind:\s*'([^']+)'/) || [])[1];
    const path = (body.match(/path:\s*'([^']+)'/) || [])[1];
    if (!kind || !path) continue;
    const key = `${kind} ${path}`;
    if (seen.has(key)) dupes.push(key);
    seen.set(key, true);
  }
  assertEqual(dupes.length, 0,
    `以下路由被重复注册（dsh 会抛错）: ${dupes.join(', ')}`);
});

test('http', 'http/stream-route-is-exact', 'SSE 流式路由使用 exact（避免吞掉同级路由）', async () => {
  // 前缀路由会匹配其下全部子路径。若把 SSE 流做成 prefix，
  // 可能吞掉同前缀的其它接口。这里确认它被声明为 exact。
  const src = IDX();
  const m = src.match(/webServer\.register\(\{\s*kind:\s*'([^']+)',\s*path:\s*'([^']*stream[^']*)'/);
  if (!m) return; // 未使用该形态则跳过
  assertEqual(m[1], 'exact',
    `流式路由 ${m[2]} 应为 exact，实际 ${m[1]}（前缀会吞掉同级路由）`);
});
