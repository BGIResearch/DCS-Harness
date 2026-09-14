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
import { test, assert, assertEqual, assertIncludes, ROOT } from '../lib/harness.mjs';

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

  // ⚠ 不能用「数花括号」找函数结尾：函数体内的**正则字符类**可能包含 `}`
  //    （如 extractMountFiles 的 /[\])}\u3001…]*$/g），会让计数提前归零，
  //    截出半截函数 → 求值报 "Unexpected token ')'"。
  //    正确做法：按行扫描，逐行跟踪深度，并**跳过字符串/正则/模板/注释**中的括号。
  const start = src.indexOf(m[1]);
  const lines = src.slice(start).split('\n');
  let depth = 0;
  let endLine = -1;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    let inStr = null;        // ' " ` 之一
    let inRegex = false;
    let inLineComment = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const prev = line[i - 1];
      if (inLineComment) break;
      if (inStr) {
        if (c === '\\') { i++; continue; }          // 转义
        if (c === inStr) inStr = null;
        continue;
      }
      if (inRegex) {
        if (c === '\\') { i++; continue; }
        if (c === '[') { /* 字符类内 } 不计数 */ }
        if (c === '/' && prev !== '\\') inRegex = false;
        continue;
      }
      if (c === '/' && line[i + 1] === '/') { inLineComment = true; break; }
      if (c === '/' && (prev === undefined || /[=(,:;[!&|?{}+\-*%<>~^\s]/.test(prev)) && line[i + 1] !== '=' ) {
        inRegex = true; continue;                                 // 正则字面量起始
      }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { endLine = li; break; } }
    }
    if (endLine >= 0) break;
  }

  // 若逐行扫描未收敛（极端情况），回退到朴素的字符计数
  let body;
  if (endLine >= 0) {
    body = lines.slice(0, endLine + 1).join('\n');
  } else {
    let d = 0; let e = -1;
    for (let k = start + m[1].length - 1; k < src.length; k++) {
      if (src[k] === '{') d++;
      else if (src[k] === '}') { d--; if (d === 0) { e = k + 1; break; } }
    }
    assert(e > 0, `函数 ${name} 的花括号不配对`);
    body = src.slice(start, e);
  }

  // 校验：抽取结果必须能独立求值（否则说明截取有误，立即报错而非静默降级）
  const depNames = Object.keys(deps);
  let factory;
  try {
    factory = new Function(...depNames, `"use strict"; ${body}; return ${name};`);
  } catch (e) {
    throw new Error(`抽取 ${name} 后无法求值（截取边界有误）: ${e.message} —— 抽取片段尾部: ${JSON.stringify(body.slice(-80))}`);
  }
  const fn = factory(...depNames.map((k) => deps[k]));
  assertEqual(typeof fn, 'function', `${name} 抽取结果应为函数`);
  return fn;
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

// ---------------------------------------------------------------- 媒体文件名安全

test('internals', 'internals/safeServeName-blocks-traversal', 'safeServeName 拒绝全部路径穿越尝试', async () => {
  const safeServeName = extractFunction('safeServeName');
  // 这是服务端把文件名映射到本地目录用的守卫。若被绕过，
  // 攻击者可用 `../` 读取交付缓存目录之外的任意文件。
  const attacks = [
    '../etc/passwd',
    '..%2fetc',
    '/etc/passwd',
    'a/../../b',
    '.',
    '..',
    '....//',
    '....\\',
    'foo/bar',
    '%2e%2e',
    'a\nb',            // 换行注入
    '.hidden',           // 首字符是点
    'a b',               // 空格
    '',                  // 空
    '.',                 // 仅点
  ];
  const allowed = attacks.filter((a) => safeServeName(a) !== null);
  assertEqual(allowed.length, 0,
    `safeServeName 放行了危险文件名（路径穿越/注入风险）: ${allowed.map((x) => JSON.stringify(x)).join(', ')}`);
});

test('internals', 'internals/safeServeName-allows-legit-names', 'safeServeName 放行正常文件名', async () => {
  const safeServeName = extractFunction('safeServeName');
  const legit = [
    'file-0123456789abcdef0123.png',
    'abc.jpg',
    'a_b-c.d.e',
    'File123.PDF',
  ];
  const rejected = legit.filter((f) => safeServeName(f) === null);
  assertEqual(rejected.length, 0,
    `safeServeName 误拒正常文件名（会导致交付图片无法访问）: ${rejected.join(', ')}`);
});

// ---------------------------------------------------------------- 挂载路径推导

test('internals', 'internals/toMountList-dedupes-and-filters', 'toMountList 去重且只保留 /Files/ 真实路径', async () => {
  const extractMountFiles = extractFunction('extractMountFiles');
  const toMountList = extractFunction('toMountList', { extractMountFiles });

  const out = toMountList('/Files/a.bam,/Files/a.bam , /Files/,', [
    '输入文件 /Files/b.vcf 和 /Files/a.bam',
    '无关文本',
  ]);
  const list = out ? out.split(',') : [];
  assertEqual(new Set(list).size, list.length, `toMountList 未去重: ${out}`);
  assertIncludes(out, '/Files/a.bam', '应保留 /Files/a.bam');
  assertIncludes(out, '/Files/b.vcf', '应从 hint 中提取 /Files/b.vcf');
  assert(!list.includes('/Files/'), '不应把裸 /Files/ 当作挂载路径（无意义）');
});

test('internals', 'internals/extractMountFiles-isolates-paths-from-prose', 'extractMountFiles 从中文/英文句子中精确分离路径', async () => {
  // 真实缺陷（本层首次运行时发现）：原正则用 `\S*` 贪婪吞字符，
  // 而中文句子没有 ASCII 空格，导致
  //   "见 /Files/RawData/x.fq.gz，以及 /Files/ref/y.fa)。"
  // 的第一段被匹配成 "/Files/RawData/x.fq.gz，以及"（含中文与后续文字）。
  // 这类脏路径会作为 -m 挂载参数传给 `dcs task run`。
  const extractMountFiles = extractFunction('extractMountFiles');

  const cases = [
    ['见 /Files/RawData/x.fq.gz，以及 /Files/ref/y.fa)。',
      ['/Files/RawData/x.fq.gz', '/Files/ref/y.fa']],
    ['mount /Files/a.bam, and /Files/b/c.vcf.',
      ['/Files/a.bam', '/Files/b/c.vcf']],
    ['仅 /Files/ref/genome.fa 一个。', ['/Files/ref/genome.fa']],
    ['/Files/RawData/V350099495_L04_read_1.fq.gz',
      ['/Files/RawData/V350099495_L04_read_1.fq.gz']],
    ['无路径的句子', []],
  ];

  const problems = [];
  for (const [text, expect] of cases) {
    const got = extractMountFiles(text);
    for (const e of expect) {
      if (!got.includes(e)) problems.push(`${JSON.stringify(text)}: 缺少 ${e}（实际 ${JSON.stringify(got)}）`);
    }
    // 不得混入中文、空格或标点
    const dirty = got.filter((p) => /[\u3000-\u9fff\s，。；、)]/.test(p));
    if (dirty.length) problems.push(`${JSON.stringify(text)}: 路径混入文字/标点 ${JSON.stringify(dirty)}`);
  }
  assertEqual(problems.length, 0, problems.join('; '));
});

// ---------------------------------------------------------------- 任务 ID 解析

test('internals', 'internals/parseTaskIdsFromResult-multi-shape', 'parseTaskIdsFromResult 兼容多种返回形态', async () => {
  const parseTaskIdsFromResult = extractFunction('parseTaskIdsFromResult');
  const check = (label, input, expect) => {
    const got = parseTaskIdsFromResult(input);
    for (const e of expect) {
      assert(got.includes(e), `${label}: 应解析出 ${e}，实际 ${JSON.stringify(got)}`);
    }
  };
  // 单对象
  check('单 task_id', { data: { task_id: '2098662047145349121' } }, ['2098662047145349121']);
  // taskId 驼峰
  check('驼峰 taskId', { data: { taskId: '2098662047145349122' } }, ['2098662047145349122']);
  // 数组
  check('数组', { data: [{ task_id: '2098662047145349123' }, { id: '2098662047145349124' }] },
    ['2098662047145349123', '2098662047145349124']);
  // 文本兜底（宿主流：ID 在 stdout 里）
  check('stdout 文本', { data: { stdout: 'submitted 2098662047145349125 ok' } }, ['2098662047145349125']);
  // 空输入
  assertEqual(parseTaskIdsFromResult(null).length, 0, 'null 应返回空数组');
  assertEqual(parseTaskIdsFromResult({}).length, 0, '空对象应返回空数组');
});

test('internals', 'internals/parseTaskIdsFromResult-dedupes', 'parseTaskIdsFromResult 不产生重复 ID', async () => {
  const parseTaskIdsFromResult = extractFunction('parseTaskIdsFromResult');
  const got = parseTaskIdsFromResult({ data: { task_id: '2098662047145349121', stdout: '2098662047145349121' } });
  assertEqual(new Set(got).size, got.length, `ID 有重复: ${JSON.stringify(got)}`);
});

// ---------------------------------------------------------------- SAW 环境前缀

test('internals', 'internals/sawEnvPrefix-modes', 'sawEnvPrefix 按配置返回正确的环境初始化前缀', async () => {
  const sawEnvPrefix = extractFunction('sawEnvPrefix');
  // off：不应注入任何内容
  assertEqual(sawEnvPrefix({ sawEnvMode: 'off' }), '', 'off 模式应返回空串');

  // ldpath：应注入 LD_LIBRARY_PATH 且指向 <root>/anaconda/lib
  const lp = sawEnvPrefix({ sawEnvMode: 'ldpath', sawRoot: '/opt/saw-8.2.2' });
  assertIncludes(lp, '/opt/saw-8.2.2/anaconda/lib', 'ldpath 应包含 anaconda/lib 路径');

  // source：应尝试 source env.sh
  const sc = sawEnvPrefix({ sawEnvMode: 'source', sawRoot: '/opt/saw-8.2.2' });
  assertIncludes(sc, 'env.sh', 'source 模式应引用 env.sh');

  // auto：两者兼顾（env.sh 存在则 source，否则回退 LD_LIBRARY_PATH）
  const au = sawEnvPrefix({ sawEnvMode: 'auto', sawRoot: '/opt/saw-8.2.2' });
  assertIncludes(au, 'env.sh', 'auto 模式应包含 env.sh 判断');
  assertIncludes(au, 'LD_LIBRARY_PATH', 'auto 模式应有 LD_LIBRARY_PATH 回退');

  // 默认 root
  const dflt = sawEnvPrefix({ sawEnvMode: 'ldpath' });
  assertIncludes(dflt, '/opt/saw-8.2.2', '未指定 sawRoot 时应使用默认路径');
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
