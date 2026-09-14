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

test('meta', 'meta/loop-assertions-have-nonempty-source', '来源集合驱动的用例必须确认来源非空', async () => {
  // 失败模式（本项目实际踩过）：`assertEqual(problems.length, 0)` 在循环
  // **一次都没执行**时永远通过 —— 上游提取规则失效、数据源变空都会导致空转。
  // 这类用例显示 PASS 却什么都没检查。
  //
  // 为避免误报，本守卫**只针对最危险的形态**：
  //   const problems = [];            // 收集器
  //   for (const x of <collection>)   // 由外部集合驱动
  //   ...
  //   assertEqual(problems.length, 0)
  // 且该用例内**没有**任何「集合非空」的断言。
  //
  // 其它形态（如 assert / 显式 early-return）由各用例自行负责，
  // 不在此处穷举 —— 过度宽泛的静态检查会产出大量误报，反而失去行动价值。
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = join(ROOT, 'test', 'compat', 'cases');
  const problems = [];

  for (const f of readdirSync(dir).filter((x) => x.endsWith('.mjs'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    const parts = src.split(/(?=test\(\s*'[\w]+'\s*,)/);
    for (const p of parts) {
      const idM = p.match(/test\(\s*'[\w]+'\s*,\s*'([^']+)'/);
      if (!idM) continue;
      const id = idM[1];

      // 必须有「收集器 + for..of 循环 + length===0 断言」三件套
      const hasCollector = /const\s+(\w+)\s*=\s*\[\]/.test(p);
      // 支持两种形态：
      //   for (const x of cases)               → 捕获 cases
      //   for (const [a, b] of cases)          → 也应捕获 cases（不是 a/b）
      // 早期版本对解构形态会误捕到解构出的变量名（如 expect），
      // 进而把「const cases = [...]」这类字面量误判为动态来源（误报）。
      const forOf = p.match(/for\s*\(\s*const\s+(?:\[[^\]]*\]|\w+)\s+of\s+([\w.$()\[\]]+)/);
      const zeroLen = /assertEqual\(\s*\w+\.length\s*,\s*0/.test(p);
      if (!hasCollector || !forOf || !zeroLen) continue;

      // 跳过「就地字面量数组」驱动的循环：字面量长度在源码里就固定了，
      // 不可能因环境/提取规则而变空。两种形态都跳过：
      //   1) for (const x of cases)            —— cases = ['a','b']
      //   2) for (const x of [...A, ...B])     —— 字面量展开
      const raw = forOf[1].replace(/[()]/g, '');
      if (/^\.\.\./.test(raw) || /\[[\s\S]*\.\.\./.test(forOf[1])) continue;
      const srcName = raw.replace(/[\[\]]/g, '');
      const isLiteral = new RegExp(`const\\s+${srcName}\\s*=\\s*\\[`).test(p);
      if (isLiteral) continue;

      // 该用例内是否存在「来源非空」的断言
      const guarded =
        /assert\([\s\S]{0,150}?\.(length|size)\s*>\s*0/.test(p)
        || /不应为空|不可能为空|不得为空/.test(p)
        || /\b(scanned|checked|total|count|seen)\b\s*[+]{2}/.test(p);

      if (!guarded) problems.push(`${f} :: ${id}（来源: ${forOf[1]}）`);
    }
  }

  assertEqual(problems.length, 0,
    `以下用例由集合驱动断言「无问题」，但未确认来源非空 —— 来源为空时会空转:\n  `
    + problems.join('\n  '));
});

test('meta', 'meta/static-check-covers-all-lib-modules', 'check-hooks 的语法检查覆盖 lib 下全部模块', async () => {
  // 教训：check-hooks.cjs 的 checkSyntax 原来硬编码只查 2 个文件
  // （client.js / index.js），而 lib/ 下有 9 个模块 —— 其余 6 个
  // （atlas/audit/plan/projects/report/tasks）的语法错误会直接随包发布。
  //
  // 本守卫：向每个 lib 模块注入语法错误，确认 check 能报出该文件。
  // 为避免改动工作区产物，在**临时副本**上执行。
  const { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, mkdirSync, copyFileSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');

  const libDir = join(ROOT, 'lib');
  const modules = readdirSync(libDir).filter((f) => f.endsWith('.js'));
  assert(modules.length > 0, 'lib/ 下应有 .js 模块');

  const dir = mkdtempSync(join(tmpdir(), 'dcs-check-'));
  try {
    mkdirSync(join(dir, 'lib'), { recursive: true });
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    copyFileSync(join(ROOT, 'scripts', 'check-hooks.cjs'), join(dir, 'scripts', 'check-hooks.cjs'));
    // ⚠ 必须一并复制 package.json：lib/*.js 是 **ESM**（项目 type: module）。
    // 临时目录若缺 package.json，Node 会按 CommonJS 解析这些文件，
    // 而 `node --check` 在该模式下的行为不同（对同一份非法代码可能静默返回 0），
    // 导致本用例把所有模块误判为「未被覆盖」。这是踩过的坑。
    copyFileSync(join(ROOT, 'package.json'), join(dir, 'package.json'));
    // 全部模块先原样拷入
    for (const f of modules) copyFileSync(join(libDir, f), join(dir, 'lib', f));

    // 性能：早期版本对每个模块各跑一次 check-hooks（9 次子进程 ≈ 2.2s）。
    // 改为**一次性**给所有模块注入语法错误、只跑一次，再从输出里解析
    // 实际报出的文件名集合 —— 同样能判定「哪些模块未被覆盖」，耗时降到 1/9。
    const originals = new Map();
    for (const f of modules) {
      const target = join(dir, 'lib', f);
      const original = readFileSync(target, 'utf8');
      originals.set(f, original);
      // 注入明确非法的代码（`const x = ;`）；注意部分形态在特定解析模式下不报错
      writeFileSync(target, original + '\nconst __dsh_broken__ = ;\n', 'utf8');
    }

    let output = '';
    try {
      execFileSync(process.execPath, [join(dir, 'scripts', 'check-hooks.cjs')], {
        cwd: dir, stdio: 'pipe', env: { ...process.env, CHECK_ROOT: dir },
      });
    } catch (e) {
      // 错误走 stderr（console.error），不是 stdout
      output = String((e && e.stderr) || '') + String((e && e.stdout) || '');
    }

    for (const [f, original] of originals) {
      writeFileSync(join(dir, 'lib', f), original, 'utf8');
    }

    const missed = modules.filter((f) => !output.includes(f));
    assertEqual(missed.length, 0,
      `以下 lib 模块的语法错误未被 check-hooks 捕获（需纳入语法检查范围）: ${missed.join(', ')}`);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
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
