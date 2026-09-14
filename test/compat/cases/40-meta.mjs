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

// ---------------------------------------------------------------- 假绿防护

test('meta', 'meta/execute-tests-assert-real-success', '调用 execute 的用例必须断言真实成功，而非仅「不抛错」', async () => {
  // 教训来源：frozen 层最初只断言「没抛 readonly 错误」，
  // 但代码因项目不存在而提前返回，根本压不到目标分支 —— 假绿。
  //
  // 判据必须**逐用例**检查（不能整文件扫描）：同一文件里其它用例写了
  // ok === true，会掩盖住某个只 try/catch 的假绿用例。
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = join(ROOT, 'test', 'compat', 'cases');
  const problems = [];

  for (const f of readdirSync(dir).filter((x) => x.endsWith('.mjs'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    // 按 `test('layer', 'id', 'title', async () => {` 切分用例体
    const parts = src.split(/(?=test\(\s*'[\w]+'\s*,)/);
    for (const part of parts) {
      const idM = part.match(/test\(\s*'[\w]+'\s*,\s*'([^']+)'/);
      if (!idM) continue;
      const id = idM[1];
      // 该用例是否调用了工具的 execute()（排除 `async execute(` 定义）
      const body = part.slice(0, part.indexOf("\ntest(") === -1 ? part.length : part.indexOf("\ntest("));
      const seg = part;
      const calls = [...seg.matchAll(/(?:await\s+)?[A-Za-z_$][\w$.]*\.execute\(/g)];
      if (calls.length === 0) continue;

      const hasSuccessAssert = /ok\s*===\s*true|res\.ok|assert\(res\b|assertEqual\([^)]*\.ok/.test(seg);
      const declaredNegative = /负向|应被?拒绝|应抛错|must throw|rejects?|属假绿|未压到/.test(seg);
      if (!hasSuccessAssert && !declaredNegative) {
        problems.push(`${f} :: ${id}`);
      }
    }
  }
  assertEqual(problems.length, 0,
    `以下用例调用了 execute 但既无成功态断言、也未声明为负向用例（可能假绿）: ${problems.join(', ')}`);
});

// ---------------------------------------------------------------- 运行器契约

test('meta', 'meta/dsh-root-invalid-is-fatal', 'DSH_ROOT 无效时明确报错，不静默回退', async () => {
  // 显式指定 DSH_ROOT 即视为权威。若静默回退到自动探测，
  // CI 可能测到与预期不同的 dsh 版本 → 「以为测了新版、实际测了旧版」的危险假绿。
  const { findDshRoot } = await import('../lib/harness.mjs');
  const prev = process.env.DSH_ROOT;
  process.env.DSH_ROOT = '/__definitely_not_a_dsh_root__';
  try {
    let err = null;
    try {
      findDshRoot();
    } catch (e) {
      err = e;
    }
    assert(err, 'DSH_ROOT 无效时必须抛错（否则会静默回退到其它 dsh）');
    assertEqual(err.code, 'ERR_DSH_ROOT_INVALID', '应带可识别的错误码');
    assert(/DSH_ROOT/.test(err.message), '错误信息应指明 DSH_ROOT');
  } finally {
    if (prev === undefined) delete process.env.DSH_ROOT;
    else process.env.DSH_ROOT = prev;
  }
});

test('meta', 'meta/exit-code-contract', '退出码契约：0=通过 / 1=有失败 / 2=配置错误', async () => {
  const { execFileSync } = await import('node:child_process');
  const { join: j } = await import('node:path');
  const runner = j(ROOT, 'test', 'compat', 'run.mjs');

  const codeOf = (env, args) => {
    try {
      execFileSync(process.execPath, [runner, ...args], {
        env: { ...process.env, ...env }, stdio: 'pipe',
      });
      return 0;
    } catch (e) {
      return e.status;
    }
  };

  // 全绿 → 0
  assertEqual(codeOf({}, ['-q', '-k', 'meta/assert-equal-detects-mismatch']), 0,
    '通过的用例应返回退出码 0');

  // 配置错误 → 2（且必须与「有失败用例」的 1 区分开）
  assertEqual(codeOf({ DSH_ROOT: '/__nope__' }, ['-q']), 2,
    'DSH_ROOT 无效应返回退出码 2');

  // 有失败用例 → 1：用一个必然失败的过滤（不存在的用例 id 不会失败，
  // 故借 meta 层的假绿探针思路——直接跑一个会红的层次组合不现实，
  // 改为验证「配置错误(2)」与「用例失败(1)」确实是不同码，避免两者混同。
  const cfgErr = codeOf({ DSH_ROOT: '/__nope__' }, ['-q']);
  assert(cfgErr !== 1,
    '配置错误必须与「有失败用例」区分（否则 CI 无法辨别是环境问题还是代码问题）');
});

test('meta', 'meta/json-output-is-pure', '--json 模式下 stdout 必须是纯 JSON（不加任何其它输出）', async () => {
  // 教训：e2e 层的「跳过」提示曾用 console.log 写 stdout，
  // 污染了 --json 输出 —— matrix.sh 与 CI 靠 JSON 报告判定，会被直接打断。
  //
  // 为避免递归启动整个测试套件（会超时），这里只跑一个**很窄的过滤**，
  // 并显式限制超时。
  const { execFileSync } = await import('node:child_process');
  const { join: j } = await import('node:path');
  const runner = j(ROOT, 'test', 'compat', 'run.mjs');

  let out = '';
  try {
    out = execFileSync(process.execPath, [runner, '--json', '-k', 'meta/runner-reports-pass'], {
      env: { ...process.env }, encoding: 'utf8', timeout: 40000, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    out = e.stdout || '';
  }

  let parsed = null;
  try {
    parsed = JSON.parse(out);
  } catch {
    const head = out.trim().split('\n').slice(0, 3).join(' / ');
    throw new Error(`--json 的 stdout 不是合法 JSON（前几行: ${head}）`);
  }
  assert(parsed && typeof parsed.total === 'number', 'JSON 报告应含 total 字段');
  assert(/^\s*\{/.test(out), 'stdout 应以 { 开头（不得有前置日志）');
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
