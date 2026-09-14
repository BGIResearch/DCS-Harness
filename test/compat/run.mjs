#!/usr/bin/env node
// dsh 兼容性测试入口。
//
// 用法：
//   node test/compat/run.mjs                  # 全量
//   node test/compat/run.mjs -k defineTool    # 关键词过滤
//   node test/compat/run.mjs -l contract      # 只跑某一层
//   node test/compat/run.mjs --json > r.json  # 机器可读
//   node test/compat/run.mjs --bail           # 首个失败即停
//
// 层次：unit（纯函数） / contract（平台契约） / integration（插件装载与工具注册）
//       / lifecycle（模块加载顺序与幂等） / upgrade（会话格式迁移链演练）
//       / frozen（冻结参数不可变性） / e2e（真实 dcs 调用，可选）
//       / client-render（客户端组件真实渲染） / http（HTTP 接口契约）
//       / consistency（内部常量自洽性） / embedded（内嵌 Python 语法）
//       / meta（测试自身有效性）

import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, findDshRoot, ROOT, require as req } from './lib/harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/** 插件的 peerDependencies（需宿主提供）—— 用于前置自检提示。 */
const PLUGIN_PEER_DEPS = (() => {
  try {
    const { readFileSync } = req('node:fs');
    return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).peerDependencies || {};
  } catch { return {}; }
})();

const args = process.argv.slice(2);
const opts = { filter: undefined, layer: undefined, json: false, quiet: false, bail: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-k' || a === '--filter') opts.filter = args[++i];
  else if (a === '-l' || a === '--layer') opts.layer = args[++i];
  else if (a === '--json') opts.json = true;
  else if (a === '-q' || a === '--quiet') opts.quiet = true;
  else if (a === '--bail') opts.bail = true;
  else if (a === '-h' || a === '--help') {
    process.stdout.write(`dsh 兼容性测试

  -k, --filter <s>   只跑 id/标题包含 s 的用例
  -l, --layer <s>    unit|contract|integration|lifecycle|upgrade|frozen|e2e
                     |client-render|http|consistency|embedded|meta
      --json         输出 JSON 报告
  -q, --quiet        只输出汇总
      --bail         首个失败即停

环境变量：DSH_ROOT 指定 dsh 安装根（缺省自动探测）。
`);
    process.exit(0);
  }
}

// 先解析 dsh 安装根：配置错误应在跑用例前就以清晰信息暴露，
// 而不是等到某个用例里抛出难读的堆栈。
let dshRoot = null;
try {
  dshRoot = findDshRoot();
} catch (e) {
  if (e && e.code === 'ERR_DSH_ROOT_INVALID') {
    process.stderr.write('❌ 环境配置错误\n' + e.message + '\n');
    process.exit(2);
  }
  throw e;
}
if (!dshRoot) {
  process.stderr.write(
    '❌ 未找到 dsh 安装目录。\n'
    + '   请设置 DSH_ROOT=<node_modules 路径>（内含 @deepseek-ai/dsh），\n'
    + '   或确保 dsh 在 PATH 中。\n');
  process.exit(2);
}

// 载入全部用例文件（按文件名排序，保证顺序稳定）
const caseDir = join(here, 'cases');
const files = readdirSync(caseDir).filter((f) => f.endsWith('.mjs')).sort();
for (const f of files) {
  await import(join(caseDir, f));
}

// 前置自检：插件的 peerDependencies（@deepseek-ai/dsh-tools / react）必须可解析，
// 否则大量用例会以「Cannot find package」失败 —— 那是**环境未安装依赖**，
// 不是插件不兼容。提前给出可操作的提示，避免误读报告。
(function preflightPeerDeps() {
  const { createRequire } = req('node:module');
  const resolver = createRequire(join(ROOT, 'package.json'));
  const missing = [];
  for (const dep of Object.keys(PLUGIN_PEER_DEPS)) {
    try { resolver.resolve(dep + '/package.json'); } catch { missing.push(dep); }
  }
  if (missing.length > 0) {
    process.stderr.write(
      `⚠ 依赖未安装: ${missing.join(', ')}\n`
      + `  这些是插件的 peerDependencies，需由宿主 dsh 提供或在项目内安装。\n`
      + `  请先执行 npm install（或 pnpm install）后重试；\n`
      + `  相关用例会因「找不到包」失败，属环境问题而非兼容性缺陷。\n\n`);
  }
})();

if (!opts.json && !opts.quiet) {
  process.stdout.write(`dsh 兼容性测试  (dsh 根: ${dshRoot})\n`);
}

const summary = await run(opts);
process.exit(summary.failed === 0 ? 0 : 1);
