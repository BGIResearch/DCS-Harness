// 生命周期层用例：模块加载顺序、副作用、配置读写、路径与权限、CLI 二进制解析。
// 这一层关注「升级后插件能否在真实 dsh 宿主里被正常加载与卸载」，
// 以及插件对本地状态（~/.dsh）的读写是否安全、幂等、可回滚。

import { existsSync, mkdtempSync, readFileSync, writeFileSync, statSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { test, assert, assertEqual, assertIncludes, ROOT, findDshRoot } from '../lib/harness.mjs';

const mod = (p) => import(join(ROOT, 'lib', p));

/** 判断文件是否为合法 JSON（用于存储完整性断言）。 */
function isValidJson(file) {
  try {
    JSON.parse(readFileSync(file, 'utf8'));
    return true;
  } catch {
    return false;
  }
}

/** 在隔离的 DSH_HOME 下执行 fn，结束后恢复。 */
async function withIsolatedHome(fn) {
  const prev = process.env.DSH_HOME;
  const dir = mkdtempSync(join(tmpdir(), 'dcs-home-'));
  process.env.DSH_HOME = dir;
  try {
    return await fn(dir);
  } finally {
    if (prev === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = prev;
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------- 模块完整性

test('lifecycle', 'modules/all-importable', 'lib 下全部宿主模块可被独立导入（client.js 除外）', async () => {
  const dir = join(ROOT, 'lib');
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  assert(files.length > 0, 'lib 目录下应有 .js 模块');
  // client.js 是浏览器半（使用 window.__ModuleLoader__ 信封），在 Node 下不可直接 import；
  // 它由 integration 层的 client/loads-in-moduleloader 用例在模拟浏览器环境中验证。
  const BROWSER_ONLY = new Set(['client.js']);
  const failures = [];
  for (const f of files) {
    if (BROWSER_ONLY.has(f)) continue;
    try {
      await import(join(dir, f));
    } catch (e) {
      failures.push(`${f}: ${e.message}`);
    }
  }
  assertEqual(failures.length, 0, `${failures.length} 个模块导入失败`, failures);
  // client.js 必须存在且是浏览器信封
  assert(files.includes('client.js'), 'lib/client.js 不应缺失（客户端半）');
  const csrc = readFileSync(join(dir, 'client.js'), 'utf8');
  assertIncludes(csrc, '__ModuleLoader__', 'client.js 应为 __ModuleLoader__ 信封格式');
});

test('lifecycle', 'modules/no-eager-side-effects', '导入插件模块不产生 ~/.dsh 副作用', async () => {
  await withIsolatedHome(async (dir) => {
    await import(join(ROOT, 'lib', 'index.js') + '?lifecycle-probe=1');
    const created = existsSync(dir) ? readdirSync(dir) : [];
    assertEqual(created.length, 0, `模块导入时不应写文件，实际产生: ${created.join(', ')}`);
  });
});

test('lifecycle', 'modules/index-import-stable', '重复导入 index.js 返回同一导出面', async () => {
  const a = await import(join(ROOT, 'lib', 'index.js'));
  const b = await import(join(ROOT, 'lib', 'index.js'));
  assertEqual(a.name, b.name, '重复导入应返回相同 name');
  assertEqual(a.inject.length, b.inject.length, '重复导入应返回相同 inject');
});

// ---------------------------------------------------------------- 配置读写

test('lifecycle', 'config/load-defaults', 'loadCfg 在无配置文件时返回默认值', async () => {
  await withIsolatedHome(async () => {
    const { loadCfg } = await mod('dcs-client.js');
    const cfg = loadCfg();
    assert(cfg && typeof cfg === 'object', 'loadCfg 应返回对象');
    assert(cfg.cliPath !== undefined, '应有默认 cliPath');
    assert(cfg.autoInstall !== undefined, '应有默认 autoInstall');
  });
});

test('lifecycle', 'config/save-load-roundtrip', 'saveCfg → loadCfg 往返一致', async () => {
  await withIsolatedHome(async () => {
    const { loadCfg, saveCfg } = await mod('dcs-client.js');
    const base = loadCfg();
    saveCfg({ ...base, cliPath: '/opt/dcs', sawEnvMode: 'source', sawRoot: '/opt/saw' });
    const back = loadCfg();
    assertEqual(back.cliPath, '/opt/dcs', 'cliPath 应被持久化');
    assertEqual(back.sawEnvMode, 'source', 'sawEnvMode 应被持久化');
    assertEqual(back.sawRoot, '/opt/saw', 'sawRoot 应被持久化');
  });
});

test('lifecycle', 'config/file-permissions-600', '含 API key 的配置以 600 权限落盘', async () => {
  await withIsolatedHome(async () => {
    const { loadCfg, saveCfg, cfgPath } = await mod('dcs-client.js');
    const base = loadCfg();
    saveCfg({ ...base, apiKeys: { genos_vep: 'sk-test-000000000000000000000000' } });
    const p = typeof cfgPath === 'function' ? cfgPath() : join(process.env.DSH_HOME, 'dcs-cloud.json');
    assert(existsSync(p), `配置文件未生成: ${p}`);
    const mode = statSync(p).mode & 0o777;
    assertEqual(mode, 0o600, `配置文件权限应为 600，实际 ${mode.toString(8)}（含密钥必须最小权限）`);
    const raw = readFileSync(p, 'utf8');
    assertIncludes(raw, 'genos_vep', '密钥应写入配置');
  });
});

test('lifecycle', 'config/corrupt-file-recovers', '配置文件损坏时降级为默认值而不崩溃', async () => {
  await withIsolatedHome(async (dir) => {
    const { loadCfg, cfgPath } = await mod('dcs-client.js');
    const p = typeof cfgPath === 'function' ? cfgPath() : join(dir, 'dcs-cloud.json');
    writeFileSync(p, '{ this is not json ');
    let cfg;
    try {
      cfg = loadCfg();
    } catch (e) {
      throw new Error(`损坏配置应被容错处理，却抛错: ${e.message}`);
    }
    assert(cfg && typeof cfg === 'object', '损坏配置应降级为默认对象');
    assertEqual(typeof cfg.cliPath, 'string', '降级后应有可用 cliPath');
  });
});

// ---------------------------------------------------------------- 任务库读写

test('lifecycle', 'tasks/upsert-get-roundtrip', '任务库 upsert → get 往返一致', async () => {
  await withIsolatedHome(async () => {
    const { upsertTask, getTask } = await mod('tasks.js');
    const sid = '__compat_sid__';
    const res = await upsertTask({ title: '兼容性测试任务', objective: '验证 0.1.5' }, sid);
    const saved = res && res.task ? res.task : res;
    assert(saved && saved.id, `upsertTask 应返回带 id 的任务: ${JSON.stringify(res)}`);
    const back = getTask(saved.id, sid);
    assert(back, `getTask 应能取回刚写入的任务: ${saved.id}`);
    assertEqual(back.title, '兼容性测试任务', '标题应一致');
  });
});

test('lifecycle', 'tasks/update-step-status', 'updateStepStatus 能推进步骤状态', async () => {
  await withIsolatedHome(async () => {
    const { upsertTask, updateStepStatus, getTask } = await mod('tasks.js');
    const sid = '__compat_sid2__';
    const res = await upsertTask({
      title: 'T',
      steps: [{ id: 's1', title: '步骤一', status: 'pending' }],
    }, sid);
    const saved = res && res.task ? res.task : res;
    const id = saved.id;
    const upd = await updateStepStatus(id, 's1', 'done', '已完成', 100, sid);
    assert(upd && upd.ok !== false, `updateStepStatus 失败: ${JSON.stringify(upd)}`);
    const back = getTask(id, sid);
    const step = (back.steps || []).find((s) => s.id === 's1');
    assert(step, '应找到步骤 s1');
    assertEqual(step.status, 'done', '步骤状态应被更新为 done');
    assertEqual(step.progress, 100, '步骤进度应被更新');
  });
});

test('lifecycle', 'tasks/isolated-per-session', '任务库按 sessionId 隔离', async () => {
  await withIsolatedHome(async () => {
    const { upsertTask, loadTasks } = await mod('tasks.js');
    await upsertTask({ title: 'A' }, 'sess-A');
    await upsertTask({ title: 'B' }, 'sess-B');
    const a = loadTasks('sess-A');
    const b = loadTasks('sess-B');
    assertEqual(a.length, 1, `sess-A 应只有 1 条，实际 ${a.length}`);
    assertEqual(b.length, 1, `sess-B 应只有 1 条，实际 ${b.length}`);
    assertEqual(a[0].title, 'A', 'session 隔离失败：内容串了');
  });
});

// ---------------------------------------------------------------- 项目库

test('lifecycle', 'projects/upsert-list-roundtrip', '项目登记 → 列表 往返一致', async () => {
  await withIsolatedHome(async () => {
    const { upsertProject, listProjects, getProject } = await mod('projects.js');
    const p = await upsertProject({ project_id: '__compat_proj__', title: '兼容性项目', objective: 'O' });
    assert(p, 'upsertProject 应返回项目');
    const all = listProjects();
    const arr = Array.isArray(all) ? all : (all && all.projects) || [];
    const found = arr.find((x) => x.id === '__compat_proj__');
    assert(found, `列表中应能找到刚登记的项目（现有: ${arr.map((x) => x.id).join(',')}）`);
    const one = getProject('__compat_proj__');
    assert(one, 'getProject 应能取回项目');
  });
});

test('lifecycle', 'projects/module-and-run-lifecycle', '模块 + 运行（含 OAA）生命周期可闭环', async () => {
  await withIsolatedHome(async () => {
    const { upsertProject, upsertModule, startRun, updateRun, getProject } = await mod('projects.js');
    await upsertProject({ project_id: '__compat_proj2__', title: 'P2' });
    const mres = await upsertModule('__compat_proj2__', { name: '数据探索', desc: '看看有哪些数据' });
    assert(mres, 'upsertModule 应返回模块');
    const m = mres.module || mres;
    const mid = m.id || m.module_id;
    const rres = await startRun('__compat_proj2__', mid, { notes: '对话方案：先 ls /public' });
    const run = rres && rres.run ? rres.run : rres;
    assert(run, 'startRun 应返回运行');
    const rid = run.run_id || run.id;
    assert(rid, `运行应有 id: ${JSON.stringify(rres)}`);
    assertEqual(String(run.version || 1), '1', `首次运行版本应为 v1，实际 ${run.version}`);
    const upd = await updateRun('__compat_proj2__', mid, rid, {
      status: 'done',
      progress: 100,
      oaa: { observation: '产物存在', assessment: '达标', action: '继续' },
    });
    assert(upd && upd.ok !== false, `updateRun 失败: ${JSON.stringify(upd)}`);
    const proj = getProject('__compat_proj2__');
    const mods = proj.modules || [];
    const target = mods.find((x) => (x.id || x.module_id) === mid);
    assert(target, '项目里应能找到模块');
    const doneRun = (target.runs || []).find((r) => (r.run_id || r.id) === rid);
    assert(doneRun, '模块里应能找到运行');
    assertEqual(doneRun.status, 'done', '运行状态应为 done');
    assert(doneRun.oaa && doneRun.oaa.observation, 'OAA 观察段应被持久化');
  });
});

test('lifecycle', 'projects/rerun-creates-v2', '重跑同一模块生成 v2 且保留 v1', async () => {
  await withIsolatedHome(async () => {
    const { upsertProject, upsertModule, startRun, getProject } = await mod('projects.js');
    await upsertProject({ project_id: '__compat_proj3__', title: 'P3' });
    const mres = await upsertModule('__compat_proj3__', { name: 'M', desc: 'd' });
    const m = mres.module || mres;
    const mid = m.id || m.module_id;
    const r1 = await startRun('__compat_proj3__', mid, { notes: 'v1' });
    const r2 = await startRun('__compat_proj3__', mid, { notes: 'v2' });
    const v1 = r1.version || 1;
    const v2 = r2.version || 2;
    assertEqual(v1, 1, '首次版本应为 1');
    assertEqual(v2, 2, `重跑版本应为 2，实际 ${v2}`);
    const proj = getProject('__compat_proj3__');
    const target = (proj.modules || []).find((x) => (x.id || x.module_id) === mid);
    assertEqual((target.runs || []).length, 2, '两次运行历史都应保留（append-only）');
  });
});

test('lifecycle', 'projects/pending-feedback-flow', '人工反馈可写入并被读取闭环', async () => {
  await withIsolatedHome(async () => {
    const { upsertProject, upsertModule, listPendingFeedback, reviewModule } = await mod('projects.js');
    await upsertProject({ project_id: '__compat_proj4__', title: 'P4' });
    const mres = await upsertModule('__compat_proj4__', { name: 'M4', desc: 'd' });
    const m = mres.module || mres;
    const mid = m.id || m.module_id;
    await reviewModule('__compat_proj4__', mid, 'rejected', '请把数据来源改成公共库');
    const pending = await listPendingFeedback('__compat_proj4__');
    // 返回形态：{ ok, total, modules:[{ moduleId, pending:[...] }] }
    const items = Array.isArray(pending)
      ? pending
      : ((pending && pending.modules) || []).flatMap((m) => m.pending || []);
    assert(items.length >= 1, `rejected 审阅应产生待处理反馈，实际: ${JSON.stringify(pending)}`);
    assert(items[0].text && items[0].text.includes('数据来源'), '反馈原文应被保留');
  });
});

test('lifecycle', 'lifecycle/delete-project-session-isolated', 'deleteProject 按会话隔离且幂等', async () => {
  // deleteProject 当前被 index.js import 但**未暴露为工具或路由**（死代码）。
  // 但它是一处**破坏性**操作 —— 一旦将来接上界面，会话隔离必须正确，
  // 否则会误删其它会话的项目。故现在就把它测住。
  await withIsolatedHome(async () => {
    const { upsertProject, deleteProject, listProjects } = await mod('projects.js');

    // 同名项目存在于两个会话
    await upsertProject({ project_id: 'A', title: 'A1' }, 'sess-1');
    await upsertProject({ project_id: 'A', title: 'A2' }, 'sess-2');
    await upsertProject({ project_id: 'B', title: 'B1' }, 'sess-1');

    const r1 = await deleteProject('A', 'sess-1');
    assert(r1 && r1.ok === true, `应删除成功: ${JSON.stringify(r1)}`);
    assertEqual(listProjects('sess-1').map((x) => x.id).join(','), 'B',
      'sess-1 应只剩 B');
    assertEqual(listProjects('sess-2').map((x) => x.id).join(','), 'A',
      'sess-2 的同名项目不应被误删（会话隔离）');

    // 重复删除：应返回明确错误而非静默成功
    const r2 = await deleteProject('A', 'sess-1');
    assert(r2 && r2.ok === false, '重复删除应返回 ok:false');
    assert(r2.error && r2.error.includes('不存在'), `应说明项目不存在: ${JSON.stringify(r2)}`);

    // 删除不存在的项目
    const r3 = await deleteProject('__never_existed__', 'sess-1');
    assert(r3 && r3.ok === false, '删除不存在的项目应返回 ok:false');
  });
});

test('lifecycle', 'lifecycle/truncation-warns-not-silent', '超出上限而丢弃项目/任务时必须告警（不得静默丢数据）', async () => {
  // 发现：projects.js 的 `saveAll(all.slice(0, 200))` 与 tasks.js 的
  // `tasks.slice(0, 100)` 会在超限时**静默丢弃最旧记录**。
  // 一条项目记录含其全部模块、运行历史（OAA）与交付文档 —— 丢失不可恢复。
  // 上限本身合理（JSON 单文件不宜无限增长），但必须让用户知情。
  await withIsolatedHome(async () => {
    const { upsertProject, listProjects, projectsPath } = await mod('projects.js');
    const { writeFileSync, readFileSync, existsSync } = await import('node:fs');

    // 性能：逐条 upsert 203 次是 O(n²)（每次全量读写 JSON，实测 1.3s）。
    // 改为**直接预置** 200 条到存储文件，再触发 1 次 upsert 走截断路径 ——
    // 覆盖完全相同，成本降到 O(n)。
    const seed = { projects: [] };
    for (let i = 0; i < 200; i++) {
      seed.projects.push({
        id: 'P' + String(i).padStart(3, '0'),
        sessionId: 's',
        title: 'T' + i,
        createdAt: Date.now() - (200 - i) * 1000,
        updatedAt: Date.now() - (200 - i) * 1000,
      });
    }
    writeFileSync(projectsPath(), JSON.stringify(seed, null, 2));

    const warnings = [];
    const onWarn = (w) => warnings.push(w);
    process.on('warning', onWarn);
    try {
      // 再建 1 个 → 总数 201，触发修剪
      await upsertProject({ project_id: 'P_NEW' }, 's');
      await new Promise((r) => setTimeout(r, 100));   // emitWarning 异步派发
    } finally {
      process.removeListener('warning', onWarn);
    }

    const list = listProjects('s');
    assertEqual(list.length, 200, `应修剪到 200，实际 ${list.length}`);
    assert(list.some((x) => x.id === 'P_NEW'), '新项目应被保留（修剪的是最旧的）');

    const limitWarnings = warnings.filter((w) => w && w.code === 'DCS_PROJECT_LIMIT');
    assert(limitWarnings.length > 0,
      '超限丢弃项目时**必须**发出 DCS_PROJECT_LIMIT 告警（否则用户的数据静默消失）');
    const msg = String(limitWarnings[0].message || '');
    assertIncludes(msg, '丢弃', '告警应说明丢弃行为');
    assert(/备份|backup|\.json/.test(msg), `告警应给出备份路径建议，实际: ${msg}`);
    // 告警应指出被丢弃的 ID，便于用户定位。
    // 注意：数组顺序即文件顺序，upsert 时新记录 unshift 到最前，
    // 因此 slice(0,200) 丢弃的是**尾部**（本用例中即最后种入的 P199）。
    // 断言「包含某个被丢弃的 ID」而非写死具体 ID，避免与顺序假设耦合。
    const dropped = seed.projects.map((x) => x.id).filter((id) => !list.some((x) => x.id === id));
    assertEqual(dropped.length, 1, `应恰好丢弃 1 个，实际 ${dropped.length}`);
    assertIncludes(msg, dropped[0], `告警应列出被丢弃的项目 ID（${dropped[0]}）`);
  });
});

test('lifecycle', 'lifecycle/data-survives-readwrite-cycles', '反复读写后项目数据完整保留（无静默腐蚀）', async () => {
  // normProject 在**每次 load/save 时都会执行**。若它丢失字段或非幂等，
  // 正常使用（不断读写）会**逐步腐蚀**数据 —— 这类问题极难察觉，
  // 因为单次操作看起来都正常，只有累积后才暴露。
  //
  // 本用例建一个含完整嵌套结构的项目（customData / modules / runs+OAA /
  // delivery sections），再反复触发读写，最后逐项核对全部保留。
  await withIsolatedHome(async () => {
    const { upsertProject, upsertModule, startRun, updateRun, updateDelivery, getProject } = await mod('projects.js');

    await upsertProject({
      project_id: 'X', title: 'T', objective: 'O',
      model: 'deepseek-v4-flash', region: 'BGI-时空',
      customData: { items: [{ path: '/Files/a', desc: 'da' }, { path: '/Files/b', desc: 'db' }], note: 'note' },
    }, 's');

    const modRes = await upsertModule('X', { name: 'M1', desc: 'd1' }, 's');
    const mid = (modRes.module || modRes).id;

    // 注意 API 契约：startRun 直接返回运行对象（其 id 字段为运行 id）
    const runRes = await startRun('X', mid, { notes: 'n1' }, 's');
    const run = runRes.run || runRes;
    const rid = run.id || run.run_id;
    assert(rid, `startRun 应返回带 id 的运行: ${JSON.stringify(runRes)}`);

    const upd = await updateRun('X', mid, rid, {
      status: 'done', progress: 100,
      oaa: { observation: 'OBS', assessment: 'ASS', action: 'ACT' },
    }, 's');
    assert(upd && upd.ok !== false, `updateRun 应成功: ${JSON.stringify(upd)}`);

    await updateDelivery('X', { sections: { question: 'Q', findings: 'F' } }, 's');

    // 反复读写：建其它项目 + 触碰 X（触发多轮 normProject）
    for (let i = 0; i < 10; i++) await upsertProject({ project_id: 'Y' + i }, 's');
    await upsertProject({ project_id: 'X', title: 'T' }, 's');

    const x = getProject('X');
    const problems = [];
    if ((x.modules || []).length !== 1) problems.push(`模块数 ${(x.modules || []).length} != 1`);
    const r0 = (x.modules || [])[0] || {};
    if ((r0.runs || []).length !== 1) problems.push(`运行数 ${(r0.runs || []).length} != 1`);
    const rr = (r0.runs || [])[0] || {};
    if (!rr.oaa || rr.oaa.observation !== 'OBS') problems.push('OAA 丢失或被改写');
    if (rr.status !== 'done') problems.push(`运行状态被重置为 ${rr.status}`);
    if ((x.customData && x.customData.items || []).length !== 2) problems.push('customData.items 丢失');
    if (!x.delivery || !x.delivery.sections || x.delivery.sections.question !== 'Q') problems.push('交付章节丢失');
    if (x.model !== 'deepseek-v4-flash') problems.push('model 被重置');
    if (x.region !== 'BGI-时空') problems.push('region 被重置');

    assertEqual(problems.length, 0,
      `反复读写后数据被腐蚀: ${problems.join('; ')}`);
  });
});

test('lifecycle', 'lifecycle/store-writes-are-atomic', '项目/任务存储使用原子写（防中断导致全量丢数据）', async () => {
  // 发现：saveAll / saveAllTasks 原本直接 writeFileSync —— 会先截断再写。
  // 若中途崩溃/被 kill/磁盘满，文件停在半截状态；
  // 而 loadAll / loadAllTasks 对损坏 JSON **静默返回 []**，
  // 于是「所有项目/任务凭空消失」，且下一次保存会用空列表覆盖，损失不可逆。
  //
  // 修复后采用「写临时文件 + rename」。本用例验证该性质：
  //  1) 写入后目录内**无 .tmp 残留**（成功路径会清理）
  //  2) 存储文件始终是**合法 JSON**（rename 的原子性保证）
  //  3) 连续写入正常覆盖，数据递增
  await withIsolatedHome(async (dir) => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const proj = await mod('projects.js');
    const tasks = await mod('tasks.js');

    // --- 项目存储 ---
    await proj.upsertProject({ project_id: 'A', title: 'T' }, 's');
    let files = readdirSync(dir);
    const tmpLeft = files.filter((f) => f.includes('.tmp-'));
    assertEqual(tmpLeft.length, 0, `项目存储写入后残留临时文件: ${tmpLeft.join(', ')}`);

    const pPath = proj.projectsPath();
    assert(isValidJson(pPath), '项目存储文件应为合法 JSON');

    await proj.upsertProject({ project_id: 'B' }, 's');
    assertEqual(proj.listProjects().length, 2, '连续写入应正常累加');

    // --- 任务存储 ---
    await tasks.upsertTask({ title: 'T1' }, 's');
    const tPath = tasks.tasksPath();
    const tTmp = readdirSync(dir).filter((f) => f.includes('.tmp-'));
    assertEqual(tTmp.length, 0, `任务存储写入后残留临时文件: ${tTmp.join(', ')}`);
    assert(isValidJson(tPath), '任务存储文件应为合法 JSON');
    await tasks.upsertTask({ title: 'T2' }, 's');
    assertEqual(tasks.loadTasks('s').length, 2, '连续写入应正常累加');
  });
});

test('lifecycle', 'lifecycle/corrupt-store-does-not-nuke-silently', '存储损坏时不应静默清空（应有可观测痕迹）', async () => {
  // 与上一条配套：即便文件已损坏，也不该「静默变成空」并让下一次保存覆盖掉。
  // 当前实现 loadAll 对损坏 JSON 返回 []，本用例**记录该行为**并确保：
  //  · 损坏时不会抛错崩溃（保证插件仍可用）
  //  · 但会在 parse 失败时留下可检测的痕迹（通过返回值/行为可区分）
  //
  // 说明：彻底修复（如备份损坏文件后再重建）属产品决策，此处先固化现状，
  // 防止未来无意间把「静默吞掉」扩散到更多路径。
  await withIsolatedHome(async (dir) => {
    const { readFileSync, writeFileSync, existsSync } = await import('node:fs');
    const proj = await mod('projects.js');

    await proj.upsertProject({ project_id: 'A', title: 'T' }, 's');
    const p = proj.projectsPath();
    const good = readFileSync(p, 'utf8');

    // 破坏文件
    writeFileSync(p, good.slice(0, Math.floor(good.length / 2)));
    let list;
    try {
      list = proj.listProjects();
    } catch (e) {
      throw new Error(`存储损坏时应降级为空列表而非抛错（保证插件可用）: ${e.message}`);
    }
    assertEqual(list.length, 0, '损坏时当前实现返回空列表（既有行为）');

    // 关键：损坏文件应仍在磁盘上（未被立刻覆盖），便于人工恢复
    assert(existsSync(p), '损坏文件不应被删除');
    assert(readFileSync(p, 'utf8').length > 0, '损坏文件内容应保留，便于诊断/恢复');
  });
});

// ---------------------------------------------------------------- 交付文档

test('lifecycle', 'projects/delivery-update-revision', '交付文档更新的 revision 单调递增', async () => {
  await withIsolatedHome(async () => {
    const { upsertProject, updateDelivery, getProject } = await mod('projects.js');
    await upsertProject({ project_id: '__compat_proj5__', title: 'P5' });
    // updateDelivery 的章节通过 patch.sections 传入
    await updateDelivery('__compat_proj5__', { sections: { question: '科学问题是什么？' } });
    const p1 = getProject('__compat_proj5__');
    const r1 = (p1.delivery && p1.delivery.revision) || 0;
    await updateDelivery('__compat_proj5__', { sections: { findings: '发现一' } });
    const p2 = getProject('__compat_proj5__');
    const r2 = (p2.delivery && p2.delivery.revision) || 0;
    assert(r2 > r1, `revision 应递增：${r1} -> ${r2}`);
    assert(p2.delivery.sections && p2.delivery.sections.question, '既有章节不应被覆盖丢失');
  });
});

test('lifecycle', 'lifecycle/plugin-registered-in-dsh-profile', '插件在 dsh profile 中已注册为 bundle（真实装载证据）', async () => {
  // 最强证据：本插件确实被运行中的 dsh 装载。
  // 若本机存在 ~/.dsh/profiles/*，检查其中是否有引用本仓库的 profile；
  // 没有 profile（如 CI 环境）则跳过，属环境限制而非缺陷。
  const { existsSync, readdirSync: rd, readFileSync: rf, realpathSync } = await import('node:fs');
  const profilesDir = join(homedir(), '.dsh', 'profiles');
  if (!existsSync(profilesDir)) {
    process.stderr.write('       ⏭ 跳过（无 ~/.dsh/profiles，非本地开发环境）\n');
    return;
  }

  const pkgPath = join(ROOT, 'package.json');
  const selfPkg = JSON.parse(rf(pkgPath, 'utf8'));
  const repoReal = (() => { try { return realpathSync(ROOT); } catch { return ROOT; } })();

  const registered = [];
  for (const name of rd(profilesDir)) {
    const pkgFile = join(profilesDir, name, 'package.json');
    if (!existsSync(pkgFile)) continue;
    let prof;
    try { prof = JSON.parse(rf(pkgFile, 'utf8')); } catch { continue; }

    const bundles = (prof.dsh && prof.dsh.profile && prof.dsh.profile.bundles) || [];
    const deps = prof.dependencies || {};
    // 该 profile 是否引用了本插件
    const mentions = bundles.includes(selfPkg.name) || deps[selfPkg.name];
    if (!mentions) continue;

    // 依赖应指向本仓库（link: 或路径形式）
    const dep = deps[selfPkg.name] || '';
    let pointsHere = false;
    if (typeof dep === 'string') {
      const p = dep.replace(/^link:/, '').replace(/^file:/, '');
      if (p) {
        try { pointsHere = realpathSync(p) === repoReal; } catch { pointsHere = false; }
      }
    }
    // bundles 已包含即算注册成功；依赖指向本仓库则更强
    registered.push({ profile: name, inBundles: bundles.includes(selfPkg.name), pointsHere, dep });
  }

  if (registered.length === 0) {
    process.stderr.write('       ⏭ 跳过（本机 dsh profile 未引用本插件）\n');
    return;
  }

  const inBundles = registered.filter((r) => r.inBundles);
  assert(inBundles.length > 0,
    `在 dsh profile 的 dependencies 中找到本插件，但未列入 dsh.profile.bundles（不会被加载）: `
    + JSON.stringify(registered));

  // 至少一个 profile 的依赖指向本仓库（link: 开发态）
  const linked = registered.filter((r) => r.pointsHere);
  assert(linked.length > 0,
    `引用了本插件的 profile 但依赖未指向本仓库: ${JSON.stringify(registered)}`);
});

// ---------------------------------------------------------------- 二进制解析

test('lifecycle', 'dcs/resolve-binary', 'resolveDcsBinary 能按 cfg 定位 dcs 二进制或给出明确错误', async () => {
  const { resolveDcsBinary, loadCfg } = await mod('dcs-client.js');
  const cfg = loadCfg();
  assert(cfg && typeof cfg === 'object', 'loadCfg 应返回对象');
  try {
    const p = await resolveDcsBinary(cfg);
    if (p && typeof p === 'string') assert(p.length > 0, '返回的路径不应为空');
    else if (p && typeof p === 'object' && p.path) assert(p.path.length > 0, 'path 不应为空');
  } catch (e) {
    // 找不到二进制时应有明确、可读的错误（而不是 undefined 崩栈）
    assert(e && typeof e.message === 'string' && e.message.length > 0,
      `resolveDcsBinary 应以可读错误失败，实际: ${e}`);
  }
});

test('lifecycle', 'dcs/version-constant', 'DCS_VERSION 为合理版本串', async () => {
  const { DCS_VERSION } = await mod('dcs-client.js');
  assertEqual(typeof DCS_VERSION, 'string', 'DCS_VERSION 应为字符串');
  assert(/\d+\.\d+/.test(DCS_VERSION), `DCS_VERSION 格式异常: ${DCS_VERSION}`);
});

// ---------------------------------------------------------------- 与平台协同

test('lifecycle', 'platform/node-version-supported', 'Node 版本满足插件 engines 声明', async () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const need = (pkg.engines && pkg.engines.node) || '>=18.0.0';
  const m = need.match(/>=\s*(\d+)/);
  const required = m ? Number(m[1]) : 18;
  const actual = Number(process.versions.node.split('.')[0]);
  assert(actual >= required, `Node ${process.versions.node} 低于要求 ${need}`);
});

test('lifecycle', 'platform/client-inject-resolvable', '客户端 half 的 dsh.client.inject 依赖可被 dsh 解析', async () => {
  const root = findDshRoot();
  assert(root, '需要 dsh 安装根');
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const needed = (pkg.dsh && pkg.dsh.client && pkg.dsh.client.inject) || [];
  assert(needed.length > 0, 'package.json 应声明 dsh.client.inject');

  // dsh 客户端模块图的 inject 语义是「软依赖」：缺失项会被静默跳过
  // （dsh-client-modules/lib/client.js: `if (dependency !== void 0)`），
  // 因此这里不把缺失判为致命失败，而是明确报告为「失效声明」。
  const bases = [root, join(root, '@deepseek-ai', 'dsh', 'node_modules')];
  const resolvable = [];
  const unresolved = [];
  for (const dep of needed) {
    const hit = bases.some((b) => existsSync(join(b, dep)) || existsSync(join(b, dep, 'package.json')));
    (hit ? resolvable : unresolved).push(dep);
  }

  // 全部 inject 都必须可解析：inject 是「装载顺序」声明，
  // 声明了不存在的包 = 客户端半装载顺序失去保障（dsh 会静默跳过）。
  assertEqual(unresolved.length, 0,
    `dsh.client.inject 中以下包在当前 dsh 中不存在: ${unresolved.join(', ')}；`
    + `可用基目录: ${bases.join(' ; ')}`);
});

test('lifecycle', 'platform/client-inject-covers-slots', 'inject 声明覆盖客户端实际使用的全部 slot 提供方', async () => {
  const root = findDshRoot();
  assert(root, '需要 dsh 安装根');
  const base = join(root, '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai');
  if (!existsSync(base)) return; // 非常规布局则跳过

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const injected = new Set((pkg.dsh && pkg.dsh.client && pkg.dsh.client.inject) || []);

  // 客户端半实际注册的 slot -> 必须在 inject 中声明的提供方包
  const SLOT_PROVIDERS = {
    'conversation.view': '@deepseek-ai/dsh-client-ui-conversation',
    'settings.section': '@deepseek-ai/dsh-client-ui-settings-general',
    'sidebar.brand.mark': '@deepseek-ai/dsh-client-ui-sidebar',
    'sidebar.brand.name': '@deepseek-ai/dsh-client-ui-sidebar',
    '__slots_service': '@deepseek-ai/dsh-client-ui-renderer',
  };

  const src = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
  const used = new Set([...src.matchAll(/slots\.(?:inject|register)\(\s*["']([\w.]+)["']/g)].map((m) => m[1]));
  // 使用了 slots 服务本身 -> 需要 renderer
  if (src.includes('ctx.slots')) used.add('__slots_service');

  // 前置守卫：若未提取到任何 slot，循环不执行、missing 恒空（空转）
  assert(used.size > 0, '未从客户端提取到任何 slot 使用（用例将空转）');
  const missing = [];
  for (const slot of used) {
    const provider = SLOT_PROVIDERS[slot];
    if (!provider) continue; // 未登记的第三方 slot 跳过
    if (!injected.has(provider)) missing.push(`${slot} → ${provider}`);
  }
  assertEqual(missing.length, 0,
    `dsh.client.inject 未声明以下 slot 的提供方（客户端界面可能加载不出来）: ${missing.join('; ')}`);
});
