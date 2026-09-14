// 内嵌脚本层：验证插件里内嵌的 Python / shell 片段语法合法。
//
// 为什么需要：插件把多段 Python 通过 heredoc 送进容器执行
// （例如扫描 /public/skills、解析 h5ad、生成图表）。
// 这些脚本是**模板字符串**，JS 解析器不会检查其中的 Python 语法；
// 只有真正在容器里跑起来才会暴露语法错误 —— 而那时已经消耗了容器启动时间，
// 且错误信息来自容器、难以归因。
//
// 本层在**测试期**就把它们抽出来做语法校验（本机 python3 -m py_compile / ast）。

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, assert, assertEqual, ROOT } from '../lib/harness.mjs';

const SRC = () => readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8');

/** 本机是否有可用的 python3（无则跳过校验）。 */
function hasPython() {
  try {
    execFileSync('python3', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 抽取内嵌的 Python 片段。
 *
 * 实际形态有两种，必须都覆盖：
 *   A) 模板字面量：`const py = \`import os ...\`;`   （Python 源码直接在模板里）
 *   B) 字符串拼接：`"python3 - <<'PYEOF'\\n" + py + "\\nPYEOF"` ——
 *      此时 Python 在 A 的模板里，heredoc 只是外壳。
 *
 * 早期版本只匹配 `<<'PYEOF'\n...\nPYEOF` 的**字面**形态，
 * 但源码里写的是 `"<<'PYEOF'\\n" + py + ...`（转义 + 拼接），
 * 因此一个都没提取到，用例形同虚设 —— 靠「片段内容过少」断言才发现。
 */
function extractHeredocPython() {
  const src = SRC();
  const out = [];
  // A) const pyN = `...`;  （模板字面量，以反引号+分号结束）
  const reTemplate = /const\s+py\d*\s*=\s*`([\s\S]*?)`;/g;
  for (const m of src.matchAll(reTemplate)) out.push(m[1]);
  return out;
}

/**
 * 把模板字符串里的 `${...}` 插值替换为语法等价的占位符，
 * 以便对 Python 部分做语法检查（插值本身的内容由 JS 负责，这里不关心）。
 */
function neutralizeInterpolations(code) {
  return code
    // ${JSON.stringify(x)} → ["a","b"] 形态；替换为 python list 字面量
    .replace(/\$\{JSON\.stringify\([^}]*\)\}/g, '["__placeholder__"]')
    // ${SKILLS_BASE} 等简单插值 → 字符串占位
    .replace(/\$\{[A-Za-z_$][\w$.]*(?:\([^)]*\))?\}/g, '__placeholder__')
    // 其余复杂插值兜底
    .replace(/\$\{/g, '__placeholder__');
}

/** 用 python3 的 ast 模块做纯语法校验（不执行、不依赖容器）。 */
function checkPythonSyntax(code, label) {
  const dir = mkdtempSync(join(tmpdir(), 'dcs-py-'));
  const file = join(dir, 'snippet.py');
  try {
    writeFileSync(file, code, 'utf8');
    execFileSync('python3', ['-c',
      'import ast,sys; ast.parse(open(sys.argv[1],encoding="utf-8").read())', file,
    ], { stdio: 'pipe' });
    return null;
  } catch (e) {
    const msg = String((e && e.stderr) || (e && e.message) || e).slice(0, 400);
    return `${label}: ${msg}`;
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------- 用例

test('embedded', 'embedded/heredoc-python-syntax', '内嵌 Python 片段语法合法', async () => {
  const snippets = extractHeredocPython();
  assert(snippets.length > 0,
    `未提取到任何 PYEOF heredoc 片段（提取规则可能失效）`);

  if (!hasPython()) {
    process.stderr.write('       ⏭ 跳过（本机无 python3）\n');
    // 即使无 python3，也验证片段非空且看起来是 Python
    for (const [i, code] of snippets.entries()) {
      assert(code.trim().length > 20, `片段 ${i} 内容过短: ${JSON.stringify(code.slice(0, 60))}`);
    }
    return;
  }

  const problems = [];
  for (const [i, raw] of snippets.entries()) {
    const code = neutralizeInterpolations(raw);
    const err = checkPythonSyntax(code, `片段 #${i + 1}`);
    if (err) problems.push(err);
  }
  assertEqual(problems.length, 0,
    `${problems.length}/${snippets.length} 个内嵌 Python 片段语法错误:\n${problems.join('\n')}`);
});

test('embedded', 'embedded/python-snippets-substantive', '内嵌 Python 片段都有实质内容（非空壳）', async () => {
  const snippets = extractHeredocPython();
  const tooShort = [];
  for (const [i, code] of snippets.entries()) {
    const effective = neutralizeInterpolations(code)
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#'))
      .join('\n');
    if (effective.length < 30) tooShort.push(`#${i + 1} (${effective.length} 字符)`);
  }
  assertEqual(tooShort.length, 0, `以下片段内容过少，疑似被误删: ${tooShort.join(', ')}`);
});

test('embedded', 'embedded/heredoc-markers-paired', 'PYEOF heredoc 外壳成对出现', async () => {
  // 源码里 heredoc 以 "python3 - <<'PYEOF'\n" + py + "\nPYEOF" 形式拼接，
  // 因此两个标记都出现在**字符串字面量**中（各一次），而不是独占行。
  const src = SRC();
  const opens = (src.match(/<<'PYEOF'/g) || []).length;
  // 结束标记写作 "\nPYEOF"（转义后的换行 + PYEOF），不带反斜杠的裸 PYEOF 应同样多
  const closes = (src.match(/\\nPYEOF/g) || []).length;
  assert(opens > 0, '未找到任何 PYEOF heredoc 起点');
  assertEqual(opens, closes,
    `PYEOF 标记不成对（open=${opens}, close=${closes}）—— 会导致 heredoc 永不结束、容器命令挂起`);
});

test('embedded', 'embedded/module-parses-and-loads', '含内嵌脚本的模块可正常解析并加载', async () => {
  // 注意：不能用「反引号计数为偶数」判断模板是否闭合 ——
  // 提示词正文里本身就含反引号（如 `dcs task run`、`dcs data ls`），
  // 会与模板字面量的分隔符混在一起，统计结果恒为奇数（早期版本据此误报）。
  // 可靠判据是「模块能否被解析并求值」：node --check + 实际 import 双确认。
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync(process.execPath, ['--check', join(ROOT, 'lib', 'index.js')], { stdio: 'pipe' });
  } catch (e) {
    throw new Error(`lib/index.js 语法检查失败: ${String((e && e.stderr) || e.message).slice(0, 300)}`);
  }
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  assertEqual(typeof mod.apply, 'function', '模块应可正常导入并导出 apply');
  assertEqual(mod.name, 'dsh-dcs-cloud', '插件名应保持不变');
});
