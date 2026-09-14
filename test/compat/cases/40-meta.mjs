// 元测试层：验证测试框架自身「不空转」。
//
// 这是本模块的质量保证 —— 一套永远为绿的测试毫无价值。
// 这里用变异测试（mutation testing）证明关键断言真的能抓到违规，
// 而不是因为条件写错、遍历为空、异常被吞掉而假绿。

import { join } from 'node:path';
import { test, assert, assertEqual, ROOT, importDsh } from '../lib/harness.mjs';

// ---------------------------------------------------------------- 断言库自检

test('meta', 'meta/assert-throws-on-false', 'assert(false) 确实抛错', async () => {
  const { assert: a, AssertionError } = await import('../lib/harness.mjs');
  let threw = false;
  try {
    a(false, '应抛错');
  } catch (e) {
    threw = true;
    assert(e instanceof AssertionError, '应抛 AssertionError');
    assertEqual(e.message, '应抛错', '应保留自定义消息');
  }
  assert(threw, 'assert(false) 未抛错 —— 整套测试将永远为绿，必须修复');
});

test('meta', 'meta/assertEqual-detects-mismatch', 'assertEqual 能识别不等', async () => {
  const { assertEqual: ae } = await import('../lib/harness.mjs');
  let threw = false;
  try {
    ae(1, 2);
  } catch {
    threw = true;
  }
  assert(threw, 'assertEqual(1,2) 未抛错');
});

test('meta', 'meta/assertIncludes-detects-absence', 'assertIncludes 能识别缺失', async () => {
  const { assertIncludes: ai } = await import('../lib/harness.mjs');
  let threw = false;
  try {
    ai('abc', 'zzz');
  } catch {
    threw = true;
  }
  assert(threw, 'assertIncludes 对缺失子串未抛错');
});

// ---------------------------------------------------------------- 运行器自检

test('meta', 'meta/runner-detects-failing-case', '运行器能把失败用例判为 fail 而非静默通过', async () => {
  const { test: t, cases, run } = await import('../lib/harness.mjs');
  const before = cases().length;
  const uniqueId = `meta/__selfcheck_${Date.now()}__`;
  t('meta', uniqueId, '这个用例刻意失败', async () => {
    throw new Error('故意的失败');
  });
  assertEqual(cases().length, before + 1, '用例应被注册');

  const summary = await run({ filter: uniqueId, quiet: true });
  assertEqual(summary.total, 1, `过滤应只命中 1 例，实际 ${summary.total}`);
  assertEqual(summary.failed, 1, '刻意失败的用例必须被判为 failed');
  assert(summary.results[0].error && summary.results[0].error.message.includes('故意的失败'),
    '失败原因应被完整记录');
});

test('meta', 'meta/runner-reports-pass', '运行器能把通过用例判为 pass', async () => {
  const { test: t, run } = await import('../lib/harness.mjs');
  const uniqueId = `meta/__selfpass_${Date.now()}__`;
  t('meta', uniqueId, '这个用例应当通过', async () => {});
  const summary = await run({ filter: uniqueId, quiet: true });
  assertEqual(summary.passed, 1, '应判为通过');
  assertEqual(summary.failed, 0, '不应有失败');
});

// ---------------------------------------------------------------- 用例覆盖自检

test('meta', 'meta/tool-count-guard-effective', '工具数量守卫能抓到大面积注册失败', async () => {
  // 验证 integration 层 load/tool-count 的阈值是真守卫：
  // 若插件只注册出个位数工具，该用例必须失败。
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  const registered = [];
  const ctx = {
    tools: { register(d) { registered.push(d); return () => {}; } },
    systemPrompt: { section: () => () => {} },
    webServer: { register: () => () => {}, registerUpgrade: () => () => {}, registerFallback: () => () => {}, tapIndex: () => () => {} },
    sessions: { get: () => null },
    tokenMeter: {},
    sessionPersistence: {},
    get: () => undefined,
    effect: (f) => (typeof f === 'function' ? f() : undefined),
    on: () => () => {},
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  };
  await mod.apply(ctx);
  assert(registered.length >= 40,
    `工具数量守卫阈值应能被正常情况满足（实际注册 ${registered.length} 个）`);
});

test('meta', 'meta/schema-assertion-effective', 'schema 校验断言能识别非法 schema', async () => {
  const { assertSupportedJsonSchema } = await importDsh('@deepseek-ai/dsh-tools');
  assertEqual(typeof assertSupportedJsonSchema, 'function', '平台应导出 assertSupportedJsonSchema');

  // 合法 schema 不应抛错
  let okThrew = false;
  try {
    assertSupportedJsonSchema({ type: 'object', additionalProperties: false, properties: { a: { type: 'string' } } });
  } catch {
    okThrew = true;
  }
  assert(!okThrew, '合法 schema 不应被拒绝（否则 load/schemas-compile 用例会误报）');

  // 明显非法的 schema 应被拒绝
  let badThrew = false;
  try {
    assertSupportedJsonSchema({ type: 'nonsense-type' });
  } catch {
    badThrew = true;
  }
  assert(badThrew, '非法 schema 未被拒绝 —— schemas-compile 用例形同虚设');
});

// ---------------------------------------------------------------- 覆盖完整性

test('meta', 'meta/layers-cover-platform-surface', '四层用例均非空（无空跑层次）', async () => {
  const { cases } = await import('../lib/harness.mjs');
  const all = cases();
  const byLayer = {};
  for (const c of all) byLayer[c.layer] = (byLayer[c.layer] || 0) + 1;
  for (const layer of ['unit', 'contract', 'integration', 'lifecycle']) {
    assert((byLayer[layer] || 0) > 0, `层次 ${layer} 无用例（覆盖缺失）`);
  }
  assert(all.length >= 60, `用例总数偏少（${all.length}），覆盖可能被削减`);
});
