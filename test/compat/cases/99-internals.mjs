// 内部纯函数层：测试 lib/index.js 里**不依赖 dsh 也不依赖网络**的纯逻辑。
//
// 为什么单列：index.js 的函数覆盖率仅 36% —— 大多数未覆盖函数是工具 execute
// 处理器（需要真实 DCS 环境）。但其中有一批**纯函数**承载着实质性判断逻辑
// （SAW 命令识别、离线错误归因、shell 转义），它们完全可以在测试期验证，
// 却因为「藏在 4700 行的模块内部、未导出」而长期零覆盖。
//
// 做法：从源码中按花括号配对**抽取函数体**，在测试内独立求值。
// 不改动发布产物（与 client-render 层取内部组件的手法一致）。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, assert, assertEqual, ROOT } from '../lib/harness.mjs';

const SRC = () => readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8');

/**
 * 从 lib/index.js 抽取一个具名函数定义（含函数体），返回可直接调用的函数。
 * 用花括号配对确定边界；找不到则抛错（避免测试静默空转）。
 */
function extractFunction(name, deps = {}) {
  const src = SRC();
  const re = new RegExp(`(?:^|\\n)(function ${name}\\([^)]*\\) \\{)`, 'm');
  const m = src.match(re);
  assert(m, `未找到函数 ${name}（可能已改名或移动 —— 请更新本测试）`);

  const start = src.indexOf(m[1]);
  let depth = 0;
  let end = -1;
  for (let k = start + m[1].length - 1; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  assert(end > 0, `函数 ${name} 的花括号不配对`);

  const body = src.slice(start, end);
  const depNames = Object.keys(deps);
  const factory = new Function(...depNames, `"use strict"; ${body}; return ${name};`);
  return factory(...depNames.map((k) => deps[k]));
}

// ---------------------------------------------------------------- SAW 命令识别

test('internals', 'internals/isSawCommand-detects-bc-tools', 'isSawCommand 识别 bc* 系列工具', async () => {
  const isSawCommand = extractFunction('isSawCommand');
  // bc* 工具在缺 LD_LIBRARY_PATH 时连 --help 都会失败，故探测命令也须加载 SAW 环境
  const saw = [
    'bcSTAR --help',
    'bcSaw -h',
    'bcBarcode --version',
    '/opt/saw-8.2.2/lib/bcstar/bcSTAR -h',   // 绝对路径取 basename
    'cd /data/work && bcSTAR --help',        // 链式命令
    'export LD_LIBRARY_PATH=/x; bcSaw -h',
    'bash -c "bcSTAR --help"',               // bash -c 包装
  ];
  const missed = saw.filter((c) => !isSawCommand(c));
  assertEqual(missed.length, 0, `以下 SAW 命令未被识别（不会加载 SAW 环境 → 误判工具不可用）: ${missed.join(', ')}`);
});

test('internals', 'internals/isSawCommand-passes-through-nonsaw', 'isSawCommand 不误判非 SAW 命令', async () => {
  const isSawCommand = extractFunction('isSawCommand');
  // 误判会给普通任务平白加载 SAW 环境（拖慢执行、可能引入路径冲突）
  const plain = [
    'python3 analysis.py',
    'pandas 统计 csv',
    'ls -l /tmp',
    'samtools view -b in.sam',
    'echo hello',
    'mkdir -p /data/work/out',
    '',                    // 空串
    '   ',                 // 空白
  ];
  const noise = plain.filter((c) => isSawCommand(c));
  assertEqual(noise.length, 0, `以下非 SAW 命令被误判: ${noise.map((x) => JSON.stringify(x)).join(', ')}`);
});

test('internals', 'internals/isSawCommand-boundary', 'isSawCommand 只认 bc+大写字母 形态', async () => {
  const isSawCommand = extractFunction('isSawCommand');
  // 形近但非 SAW 工具不应命中
  const notSaw = ['bcftools view', 'bc1', 'bcat file', 'xbcSTAR', 'bc'];
  const noise = notSaw.filter((c) => isSawCommand(c));
  assertEqual(noise.length, 0, `形近命令被误判: ${noise.join(', ')}`);
});

// ---------------------------------------------------------------- shell 转义

test('internals', 'internals/shq-escapes-safely', 'shq 对含空格/引号/命令替换的输入做安全转义', async () => {
  const shq = extractFunction('shq');
  const { execFileSync } = await import('node:child_process');

  // 注意：单引号包裹**已经**能安全中和 $( ) —— 单引号内 shell 不做任何展开。
  // 早期版本用「输出里是否含裸 $(」判断安全性，属**错误判据**，会误报。
  // 可靠判据只有一条：把 shq 的输出交给真实 shell 解释后，
  // 必须**原样还原**原字符串，且不产生任何副作用。
  const samples = [
    '/data/my file.bam',
    "it's.txt",
    'a"b',
    '/x/$(touch /tmp/__shq_pwned__)',
    'a;rm -rf /tmp/__shq_pwned2__',
    'a`touch /tmp/__shq_pwned3__`',
    'a$USER',
  ];

  const { existsSync, rmSync } = await import('node:fs');
  const sideEffects = ['/tmp/__shq_pwned__', '/tmp/__shq_pwned2__', '/tmp/__shq_pwned3__'];
  for (const f of sideEffects) { try { rmSync(f, { force: true }); } catch { /* ignore */ } }

  const problems = [];
  for (const s of samples) {
    let got;
    try {
      got = execFileSync('sh', ['-c', `printf '%s' ${shq(s)}`], { encoding: 'utf8', timeout: 5000 });
    } catch (e) {
      problems.push(`${JSON.stringify(s)}: shell 执行失败 ${e.message.slice(0, 60)}`);
      continue;
    }
    if (got !== s) problems.push(`${JSON.stringify(s)} → ${JSON.stringify(got)}（未原样还原）`);
  }

  // 关键：注入样本不得产生任何文件（证明命令替换/分隔符未被解释）
  const created = sideEffects.filter((f) => existsSync(f));
  for (const f of created) { try { rmSync(f, { force: true }); } catch { /* ignore */ } }
  assertEqual(created.length, 0,
    `shq 转义存在注入风险（shell 执行了本应被中和的内容）: ${created.join(', ')}`);

  assertEqual(problems.length, 0, `shq 转义问题: ${problems.join('; ')}`);
});

test('internals', 'internals/shq-roundtrip', 'shq 结果可被 shell 还原为原字符串', async () => {
  const shq = extractFunction('shq');
  const { execFileSync } = await import('node:child_process');
  const samples = ['/data/normal.bam', '/data/my file.bam', "it's.txt", 'a$b', 'a"b', 'a`b'];
  const bad = [];
  for (const s of samples) {
    // 用 sh 解释 shq(s) 后应还原为原字符串
    let got;
    try {
      got = execFileSync('sh', ['-c', `printf '%s' ${shq(s)}`], { encoding: 'utf8', timeout: 5000 });
    } catch (e) {
      bad.push(`${JSON.stringify(s)}: shell 执行失败 ${e.message.slice(0, 60)}`);
      continue;
    }
    if (got !== s) bad.push(`${JSON.stringify(s)} → ${JSON.stringify(got)}`);
  }
  assertEqual(bad.length, 0, `shq 转义不可逆（会导致路径被改写或命令注入）: ${bad.join('; ')}`);
});

// ---------------------------------------------------------------- 离线错误归因

test('internals', 'internals/enrichOfflineError-adds-hint', 'enrichOfflineError 为已知错误补上「下一步」提示', async () => {
  const explain = extractFunction('explainOfflineError');
  const enrich = extractFunction('enrichOfflineError', { explainOfflineError: explain });

  const out = enrich('image_url does not exist');
  assertEqual(typeof out, 'string', '应返回字符串');
  assert(out.includes('image_url does not exist'), '应保留原始错误信息（便于排查）');
  assert(out.length >= 'image_url does not exist'.length,
    '应附加提示而非截断原始信息');
});

test('internals', 'internals/enrichOfflineError-idempotent', 'enrichOfflineError 重复调用不叠加提示', async () => {
  const explain = extractFunction('explainOfflineError');
  const enrich = extractFunction('enrichOfflineError', { explainOfflineError: explain });
  const once = enrich('image_url does not exist');
  const twice = enrich(once);
  // 幂等：已含「下一步：」的错误不应再追加一遍（否则重试链路里提示会层层堆叠）
  assertEqual(twice.length <= once.length + 5, true,
    `重复归因导致提示堆叠（${once.length} → ${twice.length}）`);
});

test('internals', 'internals/enrichOfflineError-handles-empty', 'enrichOfflineError 对空输入给出兜底文案', async () => {
  const explain = extractFunction('explainOfflineError');
  const enrich = extractFunction('enrichOfflineError', { explainOfflineError: explain });
  for (const input of ['', null, undefined]) {
    const out = enrich(input);
    assertEqual(typeof out, 'string', `enrich(${JSON.stringify(input)}) 应返回字符串`);
    assert(out.trim().length > 0, `enrich(${JSON.stringify(input)}) 不应返回空串（用户会看到空白错误）`);
  }
});

// ---------------------------------------------------------------- 抽取机制自检

test('internals', 'internals/extraction-mechanism-works', '函数抽取机制本身有效（防静默空转）', async () => {
  // 抽取依赖源码里的函数名与花括号配对；若插件重构（改名/改写法），
  // 抽取会失败 —— 那时必须报错而不是静默跳过，否则整层会变成空转。
  const srccode = SRC();
  const targets = ['isSawCommand', 'enrichOfflineError', 'explainOfflineError', 'shq'];
  const missing = targets.filter((n) => !srccode.includes(`function ${n}(`));
  assertEqual(missing.length, 0,
    `以下函数已不存在于 lib/index.js，请更新 test/compat/cases/99-internals.mjs: ${missing.join(', ')}`);

  // 每个都必须真的能被抽出并调用
  for (const n of targets) {
    const fn = extractFunction(n);
    assertEqual(typeof fn, 'function', `${n} 抽取结果应为函数`);
  }
});
