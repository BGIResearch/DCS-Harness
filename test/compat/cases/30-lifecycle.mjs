// 生命周期层用例：模块加载顺序、副作用、配置读写、路径与权限、CLI 二进制解析。
// 这一层关注「升级后插件能否在真实 dsh 宿主里被正常加载与卸载」，
// 以及插件对本地状态（~/.dsh）的读写是否安全、幂等、可回滚。

import { existsSync, mkdtempSync, readFileSync, writeFileSync, statSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { test, assert, assertEqual, assertIncludes, ROOT, findDshRoot } from '../lib/harness.mjs';

const mod = (p) => import(join(ROOT, 'lib', p));

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
