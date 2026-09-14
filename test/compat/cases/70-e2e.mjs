// 端到端层（可选）：真实调用 dcs CLI。
//
// 默认**跳过**：需要已登录的 DCS 环境（dcs 二进制 + 有效 PAT）。
// 启用方式：
//   DCS_E2E=1 npm test            # 跑真实调用
//   DCS_E2E=1 npm run test:e2e
//
// 设计原则：本层只做**只读**操作（status / 列目录 / 搜索），绝不投递任务、
// 不写远端数据 —— 避免测试产生副作用或费用。
//
// 为什么值得有：前六层用的都是测试替身与契约断言，能证明「接口没变」，
// 但证明不了「真实环境下还能跑通」。当环境可用时，本层提供最后一公里的保障。

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { test, assert, assertEqual, ROOT } from '../lib/harness.mjs';

const ENABLED = process.env.DCS_E2E === '1' || process.env.DCS_E2E === 'true';

/** 检查是否具备真实运行条件；不具备则返回原因字符串。 */
function preflight() {
  if (!ENABLED) return '未启用（设置 DCS_E2E=1 开启真实调用）';
  const cfgPath = join(homedir(), '.dsh', 'dcs-cloud.json');
  if (!existsSync(cfgPath)) return '未找到 ~/.dsh/dcs-cloud.json（请先 dcs_login）';
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  } catch {
    return '~/.dsh/dcs-cloud.json 不是合法 JSON';
  }
  if (!cfg.pat) return '配置中无 PAT（请先 dcs_login）';
  return null;
}

const SKIP = preflight();
// 注意：必须写 stderr —— 写 stdout 会污染 --json 模式的机器可读输出
// （matrix.sh 与 CI 都靠 JSON 报告判定，曾被此问题打断）。
const skipMsg = (what) => process.stderr.write(
  `       ⏭ 跳过真实调用（${SKIP}）：${what}\n`);

/** 无副作用地运行一条 dcs 命令。 */
async function runDcs(args, timeoutMs = 60000) {
  const { loadCfg, runDcs: exec } = await import(join(ROOT, 'lib', 'dcs-client.js'));
  const cfg = loadCfg();
  return exec(cfg, args, { timeoutMs });
}

// ---------------------------------------------------------------- 连接

test('e2e', 'e2e/login-status', '真实 dcs status 可返回登录态', async () => {
  if (SKIP) { skipMsg('dcs status'); return; }
  const { dcsStatus } = await import(join(ROOT, 'lib', 'dcs-client.js'));
  const { loadCfg } = await import(join(ROOT, 'lib', 'dcs-client.js'));
  const st = await dcsStatus(loadCfg(), { timeoutMs: 30000 });
  assert(st, 'dcsStatus 应返回结果对象');
  assert(st.ok !== false || st.user || st.project,
    `dcs status 未返回可用信息: ${JSON.stringify(st).slice(0, 200)}`);
});

test('e2e', 'e2e/binary-resolvable', '真实环境下 dcs 二进制可解析', async () => {
  if (SKIP) { skipMsg('resolveDcsBinary'); return; }
  const { loadCfg, resolveDcsBinary } = await import(join(ROOT, 'lib', 'dcs-client.js'));
  const p = await resolveDcsBinary(loadCfg());
  const path = typeof p === 'string' ? p : (p && p.path);
  assert(path, `未解析到 dcs 二进制: ${JSON.stringify(p)}`);
  assert(existsSync(path), `解析到的二进制不存在: ${path}`);
});

// ---------------------------------------------------------------- 只读查询

test('e2e', 'e2e/dcs-command-surface-exists', '插件调用的每个 dcs 子命令都真实存在', async () => {
  // 这是 dcs CLI 侧的兼容性维度：dsh 升级可能带来插件 API 变化，
  // 但 dcs CLI 自身升级也会让命令改名/移除 —— 插件会静默失效。
  //
  // 注意：dcs atlas 是**插件本地工具**（读内置图谱），不是 dcs 子命令；
  // 早期版本的本用例误把它当成 CLI 命令，导致误报。务必以插件源码里
  // 真实构造的命令数组为准。
  const src = readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8');

  // 提取插件构造的 dcs 命令。命令可能出现在多种形态：
  //   runDcs(cfg, ['analysis','ls', ...])      —— 直接内联
  //   const a = ['analysis','ls']; runDcs(cfg, a) —— 先赋值（含三元表达式）
  //   execCli 的 build(): const a = ['terminal','exec', ...]
  // 因此统一抽取「以两个小写词开头的字符串数组字面量」，
  // 覆盖以上全部形态（早期只匹配 runDcs(cfg,[...])，漏掉了变量形态的 workflow tasks）。
  // 注意：不能简单匹配所有 `['x','y']` —— schema 里的
  // `enum: ['analysis','workflow']` 会被误当成命令。
  // 也不能用大段正则剔除 schema 块（会连带吃掉后续代码行）。
  // 稳妥做法：**逐行**判断，跳过位于 parameters/schema 块内的行，并排除 enum 字面量。
  const lines = src.split('\n');
  let schemaDepth = 0;
  const cmds = new Set();
  const TOP = /^(analysis|auth|billing|config|data|history|login|logout|project|region|table|terminal|workflow)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    // 跟踪是否处于 schema 区块内（parameters: { 或 schema: { 开始）
    if (/^(parameters|schema):\s*\{/.test(trimmed)) { schemaDepth = 1; continue; }
    if (schemaDepth > 0) {
      schemaDepth += (line.match(/\{/g) || []).length;
      schemaDepth -= (line.match(/\}/g) || []).length;
      if (schemaDepth <= 0) schemaDepth = 0;
      continue;
    }
    if (trimmed.startsWith('//')) continue;
    // 排除 enum 字面量（它们是取值集合，不是命令）
    if (/\benum\s*:/.test(trimmed)) continue;

    for (const m of trimmed.matchAll(/\[\s*'([a-z_-]+)'\s*,\s*'([a-z_-]+)'/g)) {
      if (TOP.test(m[1])) cmds.add(`${m[1]} ${m[2]}`);
    }
  }
  assert(cmds.size >= 12,
    `应提取到至少 10 个 dcs 命令，实际 ${cmds.size}（提取规则可能失效）: ${[...cmds].join(', ')}`);

  // 该检查只需 dcs 二进制、不需登录，也不发网络请求（纯 --help），
  // 因此即便未启用 DCS_E2E 也尽力执行；二进制不可得时才跳过。
  const { loadCfg, resolveDcsBinary } = await import(join(ROOT, 'lib', 'dcs-client.js'));
  let bin = null;
  try {
    const p = await resolveDcsBinary(loadCfg());
    bin = typeof p === 'string' ? p : (p && p.path);
  } catch { /* 见下 */ }
  if (!bin) {
    skipMsg(`校验 ${cmds.size} 个 dcs 子命令（dcs 二进制不可得）`);
    return;
  }

  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);

  // ⚠ 不能用 `<cmd> --help` 判断子命令是否存在：dcs 对未知子命令会**静默打印父命令
  //   帮助并以 0 退出**（实测 `dcs workflow taskz --help` 退出码 0，无 "unknown command"）。
  //   可靠做法是解析**父命令**帮助里的 "Available Commands" 子命令表。
  const subcommandsOf = async (parent) => {
    const out = await run(bin, [...parent, '--help'], { timeout: 20000 })
      .then((r) => r.stdout).catch((e) => String((e && (e.stdout || e.stderr)) || ''));
    const m = out.match(/Available Commands:\s*\n([\s\S]*?)(?:\n\s*\n|$)/);
    if (!m) return null;
    return new Set(m[1].split('\n')
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((x) => x && /^[a-z][\w_-]*$/.test(x)));
  };

  const parents = [...new Set([...cmds].map((c) => c.split(' ')[0]))];
  const tables = new Map();
  for (const parent of parents) tables.set(parent, await subcommandsOf([parent]));

  const missing = [];
  for (const cmd of cmds) {
    const [parent, sub] = cmd.split(' ');
    const table = tables.get(parent);
    if (table === null) { missing.push(`${cmd}（父命令 ${parent} 无子命令表）`); continue; }
    if (table && !table.has(sub)) missing.push(cmd);
  }
  assertEqual(missing.length, 0,
    `以下 dcs 子命令在 CLI 中不存在（插件会静默失效）: ${missing.join(', ')}`);
});
test('e2e', 'e2e/task-status-list', '只读：可列出分析任务', async () => {
  if (SKIP) { skipMsg('任务列表'); return; }
  const r = await runDcs(['analysis', 'ls']);
  assert(r, '应返回结果对象');
  assert(r.ok === true || r.data !== undefined,
    `任务列表查询失败: ${JSON.stringify(r).slice(0, 300)}`);
});

// ---------------------------------------------------------------- 副作用防护

test('e2e', 'e2e/tools-are-readonly-in-this-layer', '本层不得调用任何写操作（防测试产生副作用/费用）', async () => {
  // 静态自检：本文件不应出现投递/写入类命令
  const src = readFileSync(new URL(import.meta.url).pathname, 'utf8');
  const forbidden = [
    'task', 'run',            // dcs task run / dcs run
    'submit',                 // 投递
    'upload', 'push',         // 写入
    'rm ', 'delete',          // 删除
  ];
  const body = src.split('// ---------------------------------------------------------------- 连接')[1] || '';
  // 只检查真正会执行的命令数组，不检查注释与说明文字
  const cmds = [...body.matchAll(/runDcs\(\[([^\]]*)\]/g)].map((m) => m[1]);
  const problems = [];
  for (const c of cmds) {
    for (const bad of ['task', 'submit', 'upload', 'push', 'copy', 'rm', 'move']) {
      if (new RegExp(`['"]${bad}\\b`).test(c)) problems.push(`${c.trim()} 含写操作 ${bad}`);
    }
  }
  assertEqual(problems.length, 0,
    `e2e 层出现了写操作（会污染真实环境/产生费用）: ${problems.join('; ')}`);
});
