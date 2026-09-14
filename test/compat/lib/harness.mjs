// dsh 兼容性测试 —— 极简测试框架（零依赖，Node >= 18 ESM）。
//
// 设计目标：
//   1. 零依赖、零构建：直接 `node test/compat/run.mjs` 即可跑；
//   2. 分层用例：unit / contract / integration / lifecycle，可 -k 过滤；
//   3. 面向「版本升级后快速匹配」：一条命令给出 PASS/FAIL 与不兼容清单；
//   4. 机器可读输出：--json 产出报告，供 CI 与出题人对比。

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const require = createRequire(join(ROOT, 'package.json'));

// ---------- 断言 ----------

export class AssertionError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'AssertionError';
    this.detail = detail;
  }
}

export function assert(cond, message, detail) {
  if (!cond) throw new AssertionError(message, detail);
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new AssertionError(message || `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`, {
      actual, expected,
    });
  }
}

export function assertIncludes(haystack, needle, message) {
  const ok = typeof haystack === 'string' ? haystack.includes(needle) : Array.isArray(haystack) && haystack.includes(needle);
  if (!ok) throw new AssertionError(message || `期望包含 ${JSON.stringify(needle)}`, { haystack: summar(haystack) });
}

/** 断言不抛异常；返回抛出的错误（若有），供进一步检查。 */
export async function assertNoThrow(fn, message) {
  try {
    await fn();
    return null;
  } catch (e) {
    throw new AssertionError(`${message || '不应抛异常'}: ${e && e.message}`, { error: String(e && e.stack) });
  }
}

/** 断言抛异常，返回该错误。 */
export async function assertThrows(fn, message) {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new AssertionError(message || '应当抛异常但没有', null);
}

function summar(v) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s && s.length > 300 ? s.slice(0, 300) + '…' : s;
}

// ---------- 用例注册 ----------

const registry = [];

/**
 * 注册一个用例。
 * @param {string} layer 层次：unit | contract | integration | lifecycle | e2e
 * @param {string} id 稳定 id，如 contract/defineTool-params
 * @param {string} title 描述
 * @param {Function} fn async () => void
 */
export function test(layer, id, title, fn) {
  registry.push({ layer, id, title, fn });
}

export function cases() {
  return registry.slice();
}

// ---------- 运行器 ----------

const COLORS = {
  reset: '\u001b[0m', red: '\u001b[31m', green: '\u001b[32m',
  yellow: '\u001b[33m', cyan: '\u001b[36m', dim: '\u001b[2m', bold: '\u001b[1m',
};

function colorize(enabled, code, text) {
  return enabled ? code + text + COLORS.reset : text;
}

export async function run({ filter, layer, json, quiet, bail } = {}) {
  const useColor = !json && process.stdout.isTTY;
  const all = cases();
  const selected = all.filter((c) => {
    if (layer && c.layer !== layer) return false;
    if (filter && !(c.id.includes(filter) || c.title.includes(filter))) return false;
    return true;
  });

  const results = [];
  const startedAt = Date.now();
  let currentLayer = null;

  for (const c of selected) {
    if (!quiet && !json && c.layer !== currentLayer) {
      currentLayer = c.layer;
      process.stdout.write('\n' + colorize(useColor, COLORS.bold + COLORS.cyan, `── ${c.layer} ──`) + '\n');
    }
    const t0 = Date.now();
    let status = 'pass';
    let error = null;
    try {
      await c.fn();
    } catch (e) {
      status = 'fail';
      error = { message: e && e.message, name: e && e.name, detail: e && e.detail, stack: e && e.stack };
    }
    const ms = Date.now() - t0;
    results.push({ layer: c.layer, id: c.id, title: c.title, status, ms, error });
    if (!quiet && !json) {
      const tag = status === 'pass'
        ? colorize(useColor, COLORS.green, 'PASS')
        : colorize(useColor, COLORS.red, 'FAIL');
      process.stdout.write(`  ${tag} ${c.id} ${colorize(useColor, COLORS.dim, `(${ms}ms)`)}\n`);
      if (status === 'fail') {
        process.stdout.write(`       ${colorize(useColor, COLORS.red, error.message || '未知错误')}\n`);
        if (error.detail !== undefined && error.detail !== null) {
          process.stdout.write(`       ${colorize(useColor, COLORS.dim, summar(error.detail))}\n`);
        }
      }
    }
    if (bail && status === 'fail') break;
  }

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const summary = {
    total: results.length,
    passed,
    failed,
    durationMs: Date.now() - startedAt,
    byLayer: {},
    results,
  };
  for (const r of results) {
    summary.byLayer[r.layer] = summary.byLayer[r.layer] || { total: 0, passed: 0, failed: 0 };
    summary.byLayer[r.layer].total++;
    if (r.status === 'pass') summary.byLayer[r.layer].passed++;
    else summary.byLayer[r.layer].failed++;
  }

  if (json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } else if (!quiet) {
    const verdict = failed === 0
      ? colorize(useColor, COLORS.green + COLORS.bold, '✔ 全部通过')
      : colorize(useColor, COLORS.red + COLORS.bold, `✘ ${failed} 个用例失败`);
    process.stdout.write(`\n${verdict}  ${passed}/${results.length} 通过，耗时 ${summary.durationMs}ms\n`);
    for (const [l, s] of Object.entries(summary.byLayer)) {
      process.stdout.write(colorize(useColor, COLORS.dim, `   ${l}: ${s.passed}/${s.total}\n`));
    }
  }

  return summary;
}

// ---------- dsh 环境探测 ----------

/** 找到正在使用的 dsh 安装目录（含 node_modules/@deepseek-ai/*）。 */
export function findDshRoot() {
  const candidates = [];
  // 1) 环境变量显式指定 —— 显式指定即视为权威：无效时直接报错，
  //    绝不静默回退到自动探测（否则 CI 可能测到与预期不同的 dsh 版本，
  //    产生「以为测了新版、实际测了旧版」的危险假绿）。
  if (process.env.DSH_ROOT) {
    const explicit = process.env.DSH_ROOT;
    if (!existsSync(join(explicit, '@deepseek-ai', 'dsh', 'package.json'))) {
      const err = new Error(
        `DSH_ROOT 指向的目录不是有效的 dsh 安装根: ${explicit}\n` +
        `  期望存在: ${join(explicit, '@deepseek-ai', 'dsh', 'package.json')}\n` +
        `  请修正 DSH_ROOT，或取消该环境变量以启用自动探测。`);
      err.code = 'ERR_DSH_ROOT_INVALID';
      throw err;
    }
    return explicit;
  }
  // 2) 当前 dsh 可执行文件所在包的根（bin 通常是符号链接，必须 realpath）
  try {
    const bin = process.env.DSH_BIN || 'dsh';
    const { execSync } = require('node:child_process');
    const which = execSync(`command -v ${bin}`, { encoding: 'utf8' }).trim();
    if (which) {
      let real = which;
      try {
        real = execSync(`realpath ${JSON.stringify(which)}`, { encoding: 'utf8' }).trim() || which;
      } catch {
        try {
          real = require('node:fs').realpathSync(which);
        } catch { /* keep which */ }
      }
      // .../lib/node_modules/@deepseek-ai/dsh/lib/bin.js -> .../lib/node_modules
      candidates.push(real.replace(/[\\/]@deepseek-ai[\\/]dsh[\\/]lib[\\/]bin\.js$/, ''));
      candidates.push(dirname(dirname(dirname(dirname(real))))); // 退化：上溯 4 层
    }
  } catch { /* ignore */ }
  // 3) 常见 nvm / 全局路径
  const home = process.env.HOME || '';
  for (const nv of [process.version, `v${process.versions.node}`]) {
    candidates.push(join(home, '.nvm', 'versions', 'node', nv, 'lib', 'node_modules'));
  }
  candidates.push(
    join(home, '.local/share/pnpm/global/5/node_modules'),
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
    join(home, 'AppData/Roaming/npm/node_modules'),
  );

  // dsh 的依赖可能装在 <dshRoot>/@deepseek-ai 下（npm 全局布局），
  // 也可能装在 <dshRoot>/@deepseek-ai/dsh/node_modules/@deepseek-ai 下（bundle 布局）。
  const isRoot = (c) => {
    if (!c) return false;
    if (!existsSync(join(c, '@deepseek-ai', 'dsh', 'package.json'))) return false;
    return existsSync(join(c, '@deepseek-ai', 'dsh-tools'))
      || existsSync(join(c, '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-tools'));
  };

  for (const c of candidates) {
    if (isRoot(c)) return c;
  }
  // 4) 兜底：从 dsh 包自身用 createRequire 解析（处理非常规布局）
  try {
    const req = createRequire(join(ROOT, 'package.json'));
    const resolved = req.resolve('@deepseek-ai/dsh/package.json');
    const guess = resolved.replace(/[\\/]@deepseek-ai[\\/]dsh[\\/]package\.json$/, '');
    if (isRoot(guess)) return guess;
  } catch { /* ignore */ }
  return null;
}

/**
 * 返回 @deepseek-ai/* 依赖实际所在的目录。
 * 兼容两种布局：
 *   <root>/@deepseek-ai/*                              （npm 全局）
 *   <root>/@deepseek-ai/dsh/node_modules/@deepseek-ai/*（dsh bundle）
 */
export function dshModulesDir(dshRoot = findDshRoot()) {
  if (!dshRoot) return null;
  const nested = join(dshRoot, '@deepseek-ai', 'dsh', 'node_modules');
  if (existsSync(join(nested, '@deepseek-ai', 'dsh-tools'))) return nested;
  if (existsSync(join(dshRoot, '@deepseek-ai', 'dsh-tools'))) return dshRoot;
  return dshRoot;
}

/** 读取目标包的 package.json。 */
export function pkgJson(dir) {
  const p = join(dir, 'package.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(require('node:fs').readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 动态 import 一个 dsh 内部包（优先用 dsh 安装目录里的版本，避免解析到项目内的旧 devDep）。
 * @param {string} name 如 '@deepseek-ai/dsh-tools'
 * @param {string} [dshRoot] 已探测的 dsh 安装根
 */
export async function importDsh(name, dshRoot = findDshRoot()) {
  const tried = [];
  const mods = dshModulesDir(dshRoot);
  const specs = [];
  if (mods) specs.push(join(mods, name));
  specs.push(name);
  for (const s of specs) {
    try {
      return await import(s);
    } catch (e) {
      tried.push(`${s}: ${e.message}`);
    }
  }
  const err = new Error(`无法加载 ${name}；尝试过：\n  ${tried.join('\n  ')}`);
  err.tried = tried;
  throw err;
}

/** 读取某个 dsh 包的类型定义/源码文本（用于契约文本断言）。 */
export function readDshFile(dshRoot, rel) {
  const p = join(dshRoot, rel);
  if (!existsSync(p)) return null;
  return require('node:fs').readFileSync(p, 'utf8');
}
