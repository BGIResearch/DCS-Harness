// 端到端投递链路层：**真实投递** DCS 离线任务并验证结果落盘。
//
// 与 70-e2e.mjs 的分工（重要，勿混淆）：
//   70-e2e.mjs  —— **只读**层：登录态、二进制解析、命令面存在性、任务列表。
//                  默认就会跑（只需 dcs 二进制），并有写操作静态守卫。
//   75（本文件）—— **写操作**层：真实 `dcs analysis run` 投递、轮询、核对落盘文件。
//                  默认**跳过**；必须显式 DCS_E2E_SUBMIT=1 才执行。
//
// 为什么必须单独分层：投递任务**会产生真实费用**、会在用户项目里留下任务与
// /Files 目录。把这类副作用混进默认执行路径是不可接受的；但完全不测又意味着
// 「投递能不能用、结果能不能落盘」这个插件最核心的能力**始终没有真实证据**。
// 因此：显式开关 + 每次投递前打印费用提示 + 结果核对（不只看状态，还要看文件）。
//
// 启用：
//   DCS_E2E_SUBMIT=1 node test/compat/run.mjs -l e2e-submit
//   DCS_E2E_SUBMIT=1 npm run test:e2e-submit
//
// 可选环境变量：
//   DCS_E2E_IMAGE  指定镜像（默认自动从公共库解析一个可用镜像）
//   DCS_E2E_RESOURCE  资源规格（默认 vf=16g,num_proc=4，最小机型）
//   DCS_E2E_KEEP=1 保留投递产物（默认保留；不主动删远端数据）

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { test, assert, assertEqual, ROOT } from '../lib/harness.mjs';

const ENABLED = process.env.DCS_E2E_SUBMIT === '1' || process.env.DCS_E2E_SUBMIT === 'true';
const RESOURCE = process.env.DCS_E2E_RESOURCE || 'vf=16g,num_proc=4';
const IMAGE_OVERRIDE = process.env.DCS_E2E_IMAGE || '';
const PREFIX = '__dshe2e_' + Date.now().toString(36);

/** 检查是否具备真实投递条件；不具备则返回原因字符串。 */
function preflight() {
  if (!ENABLED) return '未启用（设置 DCS_E2E_SUBMIT=1 开启真实投递；会产生费用）';
  const cfgPath = join(homedir(), '.dsh', 'dcs-cloud.json');
  if (!existsSync(cfgPath)) return '未找到 ~/.dsh/dcs-cloud.json（请先 dcs_login）';
  try {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    if (!cfg.pat) return '配置中无 PAT（请先 dcs_login）';
  } catch {
    return '~/.dsh/dcs-cloud.json 不是合法 JSON';
  }
  return null;
}

const SKIP = preflight();
// 必须写 stderr：stdout 会污染 --json 的机器可读输出（与 70-e2e.mjs 同理）。
const skipMsg = (what) => process.stderr.write(
  `       ⏭ 跳过真实投递（${SKIP}）：${what}\n`);

// ---- 共用工具 ----

async function dcs() {
  return import(join(ROOT, 'lib', 'dcs-client.js'));
}

/** 轮询任务直到终态；返回 { state, status, info, elapsedMs }。 */
async function waitForTask(taskId, { timeoutMs = 480000, intervalMs = 15000 } = {}) {
  const { loadCfg, runDcs } = await dcs();
  const cfg = loadCfg();
  const started = Date.now();
  let status = '';
  let info = null;
  while (Date.now() - started < timeoutMs) {
    const r = await runDcs(cfg, ['analysis', 'info', taskId], { timeoutMs: 60000 });
    if (!r.ok) return { state: 'unknown', status: '', info: null, elapsedMs: Date.now() - started, error: r.error };
    info = r.data;
    const rec = (r.data && r.data.records && r.data.records[0]) || null;
    status = (rec && rec.status) || '';
    // 终态判定：中文状态串（平台返回中文）；"完成" 是唯一成功态。
    if (/完成|失败|错误|取消|终止/.test(status)) {
      const state = /完成/.test(status) ? 'completed'
        : /失败|错误/.test(status) ? 'failed' : 'canceled';
      return { state, status, info, elapsedMs: Date.now() - started };
    }
    await new Promise((s) => setTimeout(s, intervalMs));
  }
  return { state: 'timeout', status, info, elapsedMs: Date.now() - started };
}

/** 列出 /Files 目录项（-a 不是 data ls 的合法 flag，勿传）。 */
async function listFiles(path) {
  const { loadCfg, runDcs } = await dcs();
  const cfg = loadCfg();
  const r = await runDcs(cfg, ['data', 'ls', path, '--page-size', '200'], { timeoutMs: 90000 });
  const d = r.data || {};
  return { ok: r.ok, items: d.items || d.records || [], total: d.total, error: r.error };
}

/**
 * 解析一个「真实可用」的镜像 URL。
 *
 * 关键事实（实测，容易踩坑）：公共库返回的镜像 `name`（如 `cellbin2`、`saw-8.3.0`）
 * **不是** `--image` 参数可用的值。必须用记录的 `more.url`
 * （形如 `public-library/<创建者>_<哈希>_public:latest`），否则后端报
 * `image_url不存在` / `imageId格式不正确`。
 *
 * 因此本函数走公共库 REST（带 more.url 的那一层），而不是 dcs_public_search 的
 * 精简投影（它丢掉了 more 字段）。取不到时回退到环境变量 DCS_E2E_IMAGE。
 */
async function resolveUsableImage() {
  if (IMAGE_OVERRIDE) return { url: IMAGE_OVERRIDE, source: 'env DCS_E2E_IMAGE' };
  const cfgPath = join(homedir(), '.dsh', 'dcs-cloud.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const base = String(cfg.baseUrl || 'https://www.dcs.cloud').replace(/\/$/, '');
  const res = await fetch(base + '/api/publib/dcsRes/search?name=cellbin2&page=1&pageSize=5', {
    headers: { Authorization: 'Bearer ' + cfg.pat, 'X-Client-App': 'dcs-cloud-cli' },
  });
  const j = await res.json();
  const recs = (j && j.data && j.data.records) || [];
  const hit = recs.find((x) => x.resType === 'img' && x.more && x.more.url);
  if (!hit) return null;
  return { url: hit.more.url, name: hit.name, source: '公共库 more.url' };
}

// ---------------------------------------------------------------- 契约自检（零成本）

test('e2e-submit', 'e2e-submit/resource-format-accepted', '投递用资源规格在 CLI 层合法', async () => {
  // 零成本守门：规格非法时后端返回「匹配不到计算资源」，排查方向会跑偏
  // （看起来像平台问题，实际是参数问题）。先本地校验。
  // normalizeDcsResource 定义在 lib/index.js（宿主半），不在 dcs-client.js —— 早期用例
  // 从 dcs() 里解构导致恒为 undefined，这里按真实位置导入。
  const { normalizeDcsResource } = await import(join(ROOT, 'lib', 'index.js'));
  const norm = normalizeDcsResource(RESOURCE);
  const RE = /^vf=[\d.]+g,num_proc=\d+(,gpu=.+)?$/;
  assert(RE.test(norm), `资源规格 ${JSON.stringify(RESOURCE)} 归一化后仍非法: ${norm}`);
  // 低于最小机型（4c 16g）会被后端拒绝，提前拦下
  const mem = Number((norm.match(/vf=([\d.]+)g/) || [])[1]);
  assert(mem >= 16, `内存 ${mem}g 低于平台最小机型（4c 16g），投递必然失败`);
});

test('e2e-submit', 'e2e-submit/image-url-resolvable', '能从公共库解析出 --image 可用的真实 URL', async () => {
  if (SKIP) { skipMsg('镜像解析'); return; }
  const img = await resolveUsableImage();
  assert(img && img.url, '未能解析出可用镜像；请用 DCS_E2E_IMAGE 显式指定');
  // 这是本层最容易踩的坑：name 不可用，必须 more.url
  assert(/^public-library\//.test(img.url),
    `镜像 URL 应形如 public-library/<owner>_<hash>_public:latest，实际 ${img.url}`);
  assert(/:[^/]+$/.test(img.url), `镜像 URL 应带 tag，实际 ${img.url}`);
});

// ---------------------------------------------------------------- 真实投递

test('e2e-submit', 'e2e-submit/submit-and-land-result', '真实投递离线任务：提交→运行→结果落盘到 /Files', async () => {
  if (SKIP) { skipMsg('真实投递（提交→运行→落盘）'); return; }
  const img = await resolveUsableImage();
  assert(img && img.url, '未解析到可用镜像（可用 DCS_E2E_IMAGE 指定）');

  const { loadCfg, runDcs } = await dcs();
  const cfg = loadCfg();

  const outDir = '/Files/ResultData/Notebook/' + PREFIX;
  // 关键：命令必须**真的写一个文件**。`echo hi` 只写 stdout，
  // 任务会「成功」但 /Files 下什么都没有 —— 那样就测不出「结果能否落盘」。
  const marker = 'landed_' + PREFIX;
  const cmd = [
    'set -e',
    'mkdir -p /data/work/out',
    `printf 'id,val\\n1,42\\n2,43\\n' > /data/work/out/${marker}.csv`,
    `printf '${marker}\\n' > /data/work/out/${marker}.txt`,
    `wc -l /data/work/out/${marker}.csv`,
    `echo SUBMIT_PATH_OK`,
  ].join(' && ');

  process.stderr.write('       💰 即将真实投递离线任务（会产生费用）: image=' + img.url + ' resource=' + RESOURCE + '\n');

  const sub = await runDcs(cfg, [
    'analysis', 'run',
    '-i', cmd,
    '-l', RESOURCE,
    '--image', img.url,
    '-n', PREFIX + '_land',
    '-o', outDir,
  ], { timeoutMs: 180000 });

  assert(sub.ok, `投递失败: ${sub.error || sub.message || ''}\n${String(sub.raw || '').slice(0, 400)}`);
  const taskId = sub.data && sub.data.task_id;
  assert(taskId, `投递未返回 task_id: ${JSON.stringify(sub.data)}`);

  // task_id 必须是 16+ 位数字（插件 parseTaskIdsFromResult 与窗口拉取都依赖这个形态）
  assert(/^\d{16,}$/.test(String(taskId)),
    `task_id 形态异常（预期 16+ 位数字串）: ${taskId}`);

  const res = await waitForTask(taskId, { timeoutMs: 480000 });
  assert(res.state !== 'unknown', `任务状态查询失败: ${res.error || ''}`);
  assertEqual(res.state, 'completed',
    `任务未成功完成（状态=${res.status}，耗时 ${(res.elapsedMs / 1000).toFixed(0)}s）`);

  // ---- 落盘核对：不只看任务状态，必须看到文件 ----
  const listing = await listFiles(outDir);
  assert(listing.ok, `/Files 目录不可读: ${outDir}（${listing.error || ''}）`);
  const names = listing.items.map((x) => x.name || '');
  const csv = names.find((n) => n.includes(marker) && n.endsWith('.csv'));
  assert(csv,
    `任务状态为「完成」但 ${outDir} 下未找到落盘文件 ${marker}.csv —— 「成功」是假成功。实际目录项: ${JSON.stringify(names)}`);

  // 用 data find 再确认一次（换一条查询路径，避免只信一个接口）
  const find = await runDcs(cfg, ['data', 'find', '-p', outDir, '-n', '*' + marker + '*'], { timeoutMs: 90000 });
  const found = (find.data && find.data.items) || [];
  assert(found.length > 0,
    `data find 在 ${outDir} 下未检索到 ${marker} 相关文件（data ls 看到了 ${names.join(',')}）—— 两条查询路径不一致`);

  // 记录证据，便于人工复核（不自动删除远端数据：删数据比留数据危险）
  process.stderr.write(
    `       ✅ 落盘证据: task=${taskId} dir=${outDir} files=${names.join(',')}\n`);
});

test('e2e-submit', 'e2e-submit/mounted-input-visible-in-container', '真实投递：-m 挂载的输入文件在容器内可见（/data/input/ 前缀）', async () => {
  if (SKIP) { skipMsg('挂载可见性'); return; }
  // 为什么单列：插件文档承诺「挂载文件（-m /Files/...）在容器内需补全 /data/input/ 前缀」。
  // 这是**离线容器最反直觉的一条**：若前缀假设错误，所有依赖挂载输入的任务
  // 都会「找不到文件」，而在线容器里验证同一个脚本却完全正常。
  // 需要一个真实的已存在 /Files 文件作为挂载源。
  const { loadCfg, runDcs } = await dcs();
  const cfg = loadCfg();

  // 找一个已存在的可挂载文件（优先 ResultData，其次 RawData）
  let mountFile = '';
  for (const dir of ['/Files/ResultData', '/Files/RawData', '/Files/ReferenceData', '/Files/ManualData']) {
    const r = await runDcs(cfg, ['data', 'ls', dir, '--page-size', '50'], { timeoutMs: 90000 });
    const items = (r.data && (r.data.items || r.data.records)) || [];
    const f = items.find((x) => x.is_directory === false && x.name);
    if (f) { mountFile = dir + '/' + f.name; break; }
  }
  if (!mountFile) {
    // 无法构造挂载源时**必须跳过而不是假绿**：没有输入文件就测不出可见性。
    process.stderr.write('       ⏭ 跳过：当前项目 /Files 下找不到可挂载的普通文件（无法构造挂载场景）\n');
    return;
  }

  const img = await resolveUsableImage();
  assert(img && img.url, '未解析到可用镜像');
  const outDir = '/Files/ResultData/Notebook/' + PREFIX + '_mount';
  const base = mountFile.split('/').pop();
  // 先探测两种前缀，把「哪种可见」作为证据输出，而不是只断言一种猜测。
  const cmd = [
    'echo "--- /data/input ---"; ls -l /data/input 2>&1 | head -5',
    `echo "--- direct ---"; ls -l ${mountFile} 2>&1 | head -3`,
    `test -e /data/input/${base} && echo MOUNT_AT_INPUT_PREFIX || echo NOT_AT_INPUT_PREFIX`,
    `test -e ${mountFile} && echo MOUNT_AT_ORIGINAL_PATH || echo NOT_AT_ORIGINAL_PATH`,
    'echo PROBE_DONE',
  ].join('; ');

  const sub = await runDcs(cfg, [
    'analysis', 'run', '-i', cmd, '-l', RESOURCE, '--image', img.url,
    '-n', PREFIX + '_mount', '-o', outDir, '-m', mountFile,
  ], { timeoutMs: 180000 });
  assert(sub.ok, `挂载投递失败: ${sub.error || ''}`);
  const taskId = sub.data && sub.data.task_id;
  assert(taskId, '挂载投递未返回 task_id');

  const res = await waitForTask(taskId, { timeoutMs: 480000 });
  assertEqual(res.state, 'completed', `挂载任务未完成（状态=${res.status}）`);

  // 拉取运行日志核对探测结论
  const log = await runDcs(cfg, ['analysis', 'log', taskId + '-1'], { timeoutMs: 90000 });
  const text = String((log.data && log.data.log) || '');
  assert(/PROBE_DONE/.test(text) || text.length > 0,
    `未能取到任务日志（无法确认挂载可见性）: ${JSON.stringify(log.data).slice(0, 200)}`);
  const atInput = /MOUNT_AT_INPUT_PREFIX/.test(text);
  const atOrig = /MOUNT_AT_ORIGINAL_PATH/.test(text);
  process.stderr.write(
    `       📎 挂载可见性证据: /data/input 前缀=${atInput} 原路径=${atOrig}（源 ${mountFile}）\n`);
  assert(atInput || atOrig,
    `挂载文件在容器内两种路径下都不可见（-m ${mountFile}）；日志片段: ${text.slice(0, 400)}`);
});

// ---------------------------------------------------------------- 副作用守卫

test('e2e-submit', 'e2e-submit/requires-explicit-optin', '真实投递层默认关闭（防误跑产生费用）', async () => {
  // 本层是全仓唯一会**花钱**的用例集。守卫其默认关闭这一性质本身：
  // 若有人把 ENABLED 改成默认 true，这个用例会红。
  const src = readFileSync(new URL(import.meta.url).pathname, 'utf8');
  assert(/process\.env\.DCS_E2E_SUBMIT === '1'/.test(src),
    'DCS_E2E_SUBMIT 开关被改动 —— 真实投递层的默认关闭语义已失效（会导致默认跑测试就花钱）');
  const isOptIn = /const ENABLED = process\.env\.DCS_E2E_SUBMIT === '1' \|\| process\.env\.DCS_E2E_SUBMIT === 'true';/
    .test(src);
  assert(isOptIn, '投递层开关不是「显式 opt-in」语义；请勿默认启用真实投递');
});

test('e2e-submit', 'e2e-submit/never-deletes-remote-data', '本层不删除远端数据（只投递与读取）', async () => {
  // 静态守卫：删远端数据是**不可逆**操作，测试永远不该做。
  // 允许 `analysis rm` 之外的一切；明确禁止 rm / data rm / 覆盖写 /Files 已有路径。
  const src = readFileSync(new URL(import.meta.url).pathname, 'utf8');
  const body = src.split('// ---------------------------------------------------------------- 契约自检')[1] || '';
  const cmds = [...body.matchAll(/runDcs\(cfg,\s*\[([^\]]*)\]/g)].map((m) => m[1]);
  assert(cmds.length > 0, '未提取到任何 dcs 命令（提取规则失效，守卫将空转）');
  const bad = [];
  for (const c of cmds) {
    for (const forbidden of ['"rm"', "'rm'", '"delete"', "'delete'", '"move"', "'move'"]) {
      if (c.includes(forbidden)) bad.push(`${c.trim()} 含 ${forbidden}`);
    }
    // 只允许投递到本层自建的 __dshe2e_* 前缀目录，避免覆盖用户既有数据
    for (const m of c.matchAll(/output_path|'-o'/g)) { /* 目录校验在下方断言 */ }
  }
  assertEqual(bad.length, 0, `投递层出现删除类操作（不可逆）: ${bad.join('; ')}`);

  // 输出目录必须带本层前缀，防止污染用户既有结果目录
  assert(/const PREFIX = '__dshe2e_'/.test(src),
    'PREFIX 前缀被改动：投递产物可能写进用户既有目录（应始终用 __dshe2e_ 隔离）');
});
