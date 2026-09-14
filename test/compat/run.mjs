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
//       / frozen（冻结参数不可变性） / meta（测试自身有效性）

import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, findDshRoot } from './lib/harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));

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
  -l, --layer <s>    只跑某一层：unit|contract|integration|lifecycle|upgrade|frozen|meta
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

if (!opts.json && !opts.quiet) {
  process.stdout.write(`dsh 兼容性测试  (dsh 根: ${dshRoot})\n`);
}

const summary = await run(opts);
process.exit(summary.failed === 0 ? 0 : 1);
