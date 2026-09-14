// 升级演练层：会话格式迁移链。
//
// 为什么单列一层：dsh 升级时最容易被忽视、后果又最严重的是**历史会话打不开**。
// 插件通过 ctx.get('sessionPersistence') / ctx.get('sessions') 读取会话，
// 若会话格式链断裂，用户升级后会发现「昨天的项目记录没了」。
//
// 本层用 dsh 自带的 sessionFormatCatalog 验证：
//   1. 迁移链存在且能表达「旧版本 → 当前版本」的升级路径；
//   2. 对「更新版本」（用户降级 dsh）给出明确的 unsupported，而不是静默错读；
//   3. 对损坏/缺字段的头给出 malformed + 具体缺失字段（可诊断）；
//   4. 当前版本号可识别，供升级时比对。

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, assert, assertEqual, assertIncludes, findDshRoot, dshModulesDir, pkgJson } from '../lib/harness.mjs';

const DSH_ROOT = findDshRoot();
const MODS = dshModulesDir(DSH_ROOT);

/** 加载 dsh 会话格式目录（含迁移链）。 */
async function loadCatalog() {
  assert(DSH_ROOT, '未找到 dsh 安装根');
  const candidates = [
    join(MODS, '@deepseek-ai', 'dsh-session-format-catalog', 'lib', 'index.js'),
    join(DSH_ROOT, '@deepseek-ai', 'dsh-session-format-catalog', 'lib', 'index.js'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return import(c);
  }
  throw new Error(`未找到 dsh-session-format-catalog；查找过: ${candidates.join(', ')}`);
}

// ---------------------------------------------------------------- 迁移链存在性

test('upgrade', 'session/format-packages-present', '会话格式迁移链的包全部存在', async () => {
  assert(DSH_ROOT, '需要 dsh 安装根');
  const base = join(MODS, '@deepseek-ai');
  assert(existsSync(base), `dsh 模块目录不存在: ${base}`);

  const dirs = readdirSync(base);
  const chain = dirs.filter((d) => /^dsh-session-format-v\d+-to-v\d+$/.test(d));
  assert(chain.length > 0, '未发现任何会话格式迁移包（dsh 升级后历史会话可能打不开）');

  // 迁移包必须成链：v0→v1→v2→v3…
  const steps = chain.map((d) => {
    const m = d.match(/v(\d+)-to-v(\d+)/);
    return { from: Number(m[1]), to: Number(m[2]), pkg: d };
  }).sort((a, b) => a.from - b.from);

  for (let i = 0; i < steps.length; i++) {
    assertEqual(steps[i].to, steps[i].from + 1,
      `迁移步骤不连续: ${steps[i].pkg}（应为 v${steps[i].from} → v${steps[i].from + 1}）`);
    if (i > 0) {
      assertEqual(steps[i].from, steps[i - 1].to,
        `迁移链断裂: ${steps[i - 1].pkg} 止于 v${steps[i - 1].to}，但下一步从 v${steps[i].from} 开始`);
    }
  }
});

test('upgrade', 'session/catalog-version-identifiable', '当前会话格式版本可识别', async () => {
  const { sessionFormatCatalog } = await loadCatalog();
  assert(sessionFormatCatalog, 'catalog 应导出 sessionFormatCatalog');
  const v = sessionFormatCatalog.currentVersion;
  assert(Number.isSafeInteger(v) && v >= 0, `currentVersion 应为非负安全整数，实际 ${v}`);
});

test('upgrade', 'session/catalog-api-surface', 'catalog 提供插件所需的读头/恢复接口', async () => {
  const { sessionFormatCatalog } = await loadCatalog();
  for (const fn of ['readHeader', 'createRestore']) {
    assertEqual(typeof sessionFormatCatalog[fn], 'function', `catalog 缺少 ${fn}`);
  }
});

// ---------------------------------------------------------------- 迁移行为契约

test('upgrade', 'session/older-version-is-migratable', '旧版本头被判为可迁移（malformed=缺字段，而非 unsupported）', async () => {
  const { sessionFormatCatalog } = await loadCatalog();
  const current = sessionFormatCatalog.currentVersion;

  // 对每一个旧版本，catalog 应表达「这是旧格式，需要迁移」，
  // 而不是直接拒绝。判据：status 不得为 unsupported（unsupported 专指「比本 build 新」）。
  const problems = [];
  for (let v = 0; v < current; v++) {
    const r = sessionFormatCatalog.readHeader({ type: 'header', version: v });
    assert(r && typeof r === 'object', `v${v} 应返回结果对象`);
    if (r.status === 'unsupported') {
      problems.push(`v${v} 被判为 unsupported（旧版本应可迁移），原因: ${r.reason}`);
    }
    assertEqual(r.storedVersion, v, `应回报 storedVersion=v${v}`);
    assertEqual(r.targetVersion, current, `应回报 targetVersion=${current}`);
  }
  assertEqual(problems.length, 0, problems.join('; '));
});

test('upgrade', 'session/newer-version-refused-clearly', '更新的会话版本被明确拒绝（防静默错读）', async () => {
  const { sessionFormatCatalog } = await loadCatalog();
  const current = sessionFormatCatalog.currentVersion;

  // 用户降级 dsh 后，会读到「比本 build 新」的会话。
  // 必须明确 unsupported + 可读原因，绝不能静默按旧格式解析（会污染/损坏数据）。
  const r = sessionFormatCatalog.readHeader({ type: 'header', version: current + 1 });
  assertEqual(r.status, 'unsupported',
    `v${current + 1} 应为 unsupported，实际 ${r.status}`);
  assert(r.reason && r.reason.length > 0, 'unsupported 必须附带可读原因');
  assertIncludes(String(r.reason), String(current + 1),
    '原因中应包含被拒绝的版本号，便于用户诊断');
});

test('upgrade', 'session/malformed-header-is-diagnosable', '损坏/缺字段的头给出可定位的缺失字段', async () => {
  const { sessionFormatCatalog } = await loadCatalog();
  // 完全缺字段的头：应判 malformed 并指名缺哪个字段（而不是笼统报错）
  const r = sessionFormatCatalog.readHeader({ type: 'header', version: 0 });
  assertEqual(r.status, 'malformed', `应判 malformed，实际 ${r.status}`);
  assert(r.reason && r.reason.length > 0, 'malformed 必须附带原因');
  assert(/lacks required|missing|required/.test(String(r.reason)),
    `malformed 原因应指明缺失内容，实际: ${r.reason}`);
});

test('upgrade', 'session/negative-version-rejected', '非法版本号（负数）被拒绝而非崩溃', async () => {
  const { sessionFormatCatalog } = await loadCatalog();
  let r;
  try {
    r = sessionFormatCatalog.readHeader({ type: 'header', version: -1 });
  } catch (e) {
    throw new Error(`非法版本号应返回结构化结果而非抛错: ${e.message}`);
  }
  assert(r && r.status, '应返回带 status 的结果对象');
  assert(['malformed', 'unsupported'].includes(r.status),
    `负数版本应为 malformed/unsupported，实际 ${r.status}`);
});

// ---------------------------------------------------------------- 与插件的关联

test('upgrade', 'session/plugin-reads-via-declared-services', '插件通过声明的会话服务读取数据（未绕过平台 API）', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(join(ROOT_LIB(), 'index.js'), 'utf8');

  // 插件若绕过平台服务直接读会话文件，升级时格式一变就会静默读错。
  // 这里确保它走的是注入的服务。
  assertIncludes(src, "ctx.get('sessions')", '应通过 ctx.get("sessions") 读取会话');
  assertIncludes(src, "ctx.get('sessionPersistence')",
    '应通过 ctx.get("sessionPersistence") 读取持久化数据');

  // 反面检查：不应直接构造会话文件路径去 fs 读取
  const suspicious = /readFileSync\([^)]*session[^)]*\.jsonl/i;
  assert(!suspicious.test(src),
    '插件疑似直接读 .jsonl 会话文件——升级时会话格式变化会导致静默错读');
});

function ROOT_LIB() {
  return join(new URL('../../..', import.meta.url).pathname, 'lib');
}
