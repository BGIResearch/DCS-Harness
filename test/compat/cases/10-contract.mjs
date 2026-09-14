// 契约层用例：校验 dsh 平台对外契约（defineTool / schema DSL / 服务注入 / 客户端 slot）
// 与本插件的用法是否匹配。这是「版本升级后快速匹配」的核心——升级只需重跑本文件。

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  test, assert, assertEqual, assertIncludes, ROOT,
  findDshRoot, dshModulesDir, pkgJson, importDsh, readDshFile,
} from '../lib/harness.mjs';

const DSH_ROOT = findDshRoot();
const MODS = dshModulesDir(DSH_ROOT);

/** 解析 @deepseek-ai/<pkg> 的 package.json（在 modules dir 与顶层 root 两处查找）。 */
function dshPkgOf(pkg) {
  const cands = [join(MODS, '@deepseek-ai', pkg), join(DSH_ROOT, '@deepseek-ai', pkg)];
  for (const c of cands) if (existsSync(join(c, 'package.json'))) return pkgJson(c);
  return null;
}

/** 解析 @deepseek-ai/<pkg> 的目录（用于存在性检查）。 */
function dshDirOf(pkg) {
  const cands = [join(MODS, '@deepseek-ai', pkg), join(DSH_ROOT, '@deepseek-ai', pkg)];
  for (const c of cands) if (existsSync(c)) return c;
  return null;
}
const PLUGIN_PKG = pkgJson(ROOT) || {};

function requireDshRoot() {
  assert(DSH_ROOT, '未找到 dsh 安装目录；请设置 DSH_ROOT 或把 dsh 放到 PATH');
  return DSH_ROOT;
}

// ---------------------------------------------------------------- 平台版本

test('contract', 'platform/dsh-version', 'dsh 平台版本可识别且不低于最低支持版本', async () => {
  const root = requireDshRoot();
  const dshPkg = dshPkgOf('dsh');
  assert(dshPkg, '未找到 @deepseek-ai/dsh/package.json');
  const v = String(dshPkg.version || '');
  assert(/^\d+\.\d+\.\d+/.test(v), `dsh 版本号格式异常: ${v}`);
  const [maj, min] = v.split('.').map(Number);
  assert(maj > 0 || min >= 1, `dsh 版本过低: ${v}（插件要求 >= 0.1.x）`);
  // 记录到断言 detail，便于报告展示
  assertEqual(typeof v, 'string', '版本可读');
});

test('contract', 'platform/dsh-tools-version', 'dsh-tools 版本与插件 peerDependencies 兼容', async () => {
  const root = requireDshRoot();
  const toolsPkg = dshPkgOf('dsh-tools');
  assert(toolsPkg, '未找到 @deepseek-ai/dsh-tools/package.json');
  const v = String(toolsPkg.version || '');
  const peer = (PLUGIN_PKG.peerDependencies || {})['@deepseek-ai/dsh-tools'] || '';
  assert(v, 'dsh-tools 版本缺失');
  // peer 声明形如 ^0.1.1-rc.2；这里只校验主次版本线一致（0.1.x）
  const m = peer.match(/(\d+)\.(\d+)\./);
  if (m) {
    const [pmaj, pmin] = [Number(m[1]), Number(m[2])];
    const [amaj, amin] = v.split('.').map((x) => parseInt(x, 10));
    assert(
      amaj === pmaj && amin === pmin,
      `dsh-tools 实际 ${v} 超出 peerDependencies 声明的 ${peer} 主次版本线——升级 peerDependencies 或适配 API`,
    );
  }
});

// ---------------------------------------------------------------- defineTool

test('contract', 'defineTool/exported', 'dsh-tools 仍然导出 defineTool', async () => {
  const m = await importDsh('@deepseek-ai/dsh-tools', requireDshRoot());
  assertEqual(typeof m.defineTool, 'function', 'defineTool 必须是函数');
});

test('contract', 'defineTool/parameter-spec', 'defineTool 接受插件使用的全部参数类型规格', async () => {
  const root = requireDshRoot();
  const { parameterSchemaSpecToJsonSchema } = await importDsh('@deepseek-ai/dsh-tools', root);
  // 插件 lib/index.js 实际用到的参数类型集合
  const spec = {
    aString: { type: 'string', description: 's' },
    aEnum: { type: 'string', enum: ['x', 'y'], description: 'e' },
    aNum: { type: 'number', description: 'n' },
    aBool: { type: 'boolean', description: 'b' },
    aArr: { type: 'array', items: { type: 'string' }, description: 'A' },
    aObj: { type: 'object', additionalProperties: true, description: 'O' },
    aJson: { type: 'json', description: 'J' },
    req: { type: 'string', required: true, description: 'R' },
  };
  const out = parameterSchemaSpecToJsonSchema(spec);
  assertEqual(out.type, 'object', '参数根应为 object');
  assertEqual(out.required && out.required[0], 'req', 'required: true 应映射到 required 列表');
  assert(out.properties && Object.keys(out.properties).length === 8, '全部 8 个参数应被保留');
});

test('contract', 'defineTool/output-spec', 'defineTool 接受 output.schema 值规格（含 required/嵌套/数组）', async () => {
  const root = requireDshRoot();
  const { valueSchemaSpecToJsonSchema } = await importDsh('@deepseek-ai/dsh-tools', root);
  const out = valueSchemaSpecToJsonSchema({
    type: 'object',
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean', required: true },
      rows: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, properties: { n: { type: 'string' } } },
      },
      nested: { type: 'object', additionalProperties: true, properties: { x: { type: 'number' } } },
    },
  });
  assertEqual(out.additionalProperties, false, 'additionalProperties 应被保留');
  assert(out.required && out.required.includes('ok'), '嵌套对象的 required 应被上提');
});

test('contract', 'defineTool/minimal-registration', '最小 defineTool 注册可被工具注册表接受', async () => {
  const root = requireDshRoot();
  const { defineTool } = await importDsh('@deepseek-ai/dsh-tools', root);
  const def = defineTool({
    name: 'compat_probe',
    description: 'probe',
    parameters: { x: { type: 'string' } },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { echo: { type: 'string' } } },
      render: (args, v) => [{ type: 'text', text: String(v && v.echo) }],
    },
    async execute(args) {
      return { echo: String(args.x || '') };
    },
  });
  assert(def && typeof def === 'object', 'defineTool 应返回工具定义对象');
  assertEqual(def.name, 'compat_probe', '工具名应被保留');
  assert(typeof def.execute === 'function', '应暴露 execute');
  assert(def.parameters && def.parameters.type === 'object', '应暴露编译后的 parameters JSON Schema');
  assert(def.output && typeof def.output.render === 'function', '应暴露 output.render');
});

test('contract', 'defineTool/execute-validates-args', 'defineTool 的 execute 会对参数做严格校验', async () => {
  const root = requireDshRoot();
  const { defineTool } = await importDsh('@deepseek-ai/dsh-tools', root);
  const def = defineTool({
    name: 'compat_strict',
    description: 'strict',
    parameters: { n: { type: 'number', required: true } },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' } } },
      render: () => [{ type: 'text', text: 'x' }],
    },
    async execute() { return { ok: true }; },
  });
  // 缺必填 / 类型错，都应抛错而不是静默通过
  let threw = false;
  try {
    await def.execute({ n: 'not-a-number' }, {});
  } catch {
    threw = true;
  }
  assert(threw, '类型错误的参数应被 execute 拒绝（否则插件会拿到脏输入）');
});

// ---------------------------------------------------------------- 插件契约

test('contract', 'plugin/host-exports', '宿主入口导出 name / inject / apply', async () => {
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  assertEqual(mod.name, 'dsh-dcs-cloud', '插件名必须与 cordis.patch.yml 的 id 一致');
  assert(Array.isArray(mod.inject), 'inject 必须是数组');
  assertEqual(typeof mod.apply, 'function', 'apply 必须是函数');
});

test('contract', 'plugin/host-inject-services', '宿主 inject 声明的服务在 dsh 平台均存在', async () => {
  const root = requireDshRoot();
  const mod = await import(join(ROOT, 'lib', 'index.js'));
  // 服务名 -> 提供该服务的 dsh 包（用于静态存在性校验）
  const SERVICE_PROVIDERS = {
    tools: 'dsh-tools',
    systemPrompt: 'dsh-system-prompt',
    webServer: 'dsh-host-webserver',
    sessions: 'dsh-session',
    tokenMeter: 'dsh-token-meter',
    sessionPersistence: 'dsh-session-persistence',
  };
  const missing = [];
  for (const svc of mod.inject) {
    const provider = SERVICE_PROVIDERS[svc];
    if (!provider) continue; // 未登记的第三方服务，跳过
    if (!dshDirOf(provider)) missing.push(`${svc} (${provider})`);
  }
  assertEqual(missing.length, 0, `inject 的服务提供方缺失: ${missing.join(', ')}`);
});

test('contract', 'plugin/compat-declaration-matches-runtime', 'dsh.compat 声明的已测版本与运行时一致', async () => {
  const compat = PLUGIN_PKG.dsh && PLUGIN_PKG.dsh.compat;
  assert(compat, 'package.json 应声明 dsh.compat（记录已测的 dsh 版本）');
  assert(compat.tested, 'dsh.compat.tested 必需');

  const root = requireDshRoot();
  const runtime = pkgJson(join(join(root, '@deepseek-ai', 'dsh'), ''));
  const actual = runtime && runtime.version;

  // 不强制相等（rc 迭代快），但必须显著：运行时比声明的新时给出提示，
  // 因为「声明已测的版本」是给用户与 CI 做兼容判断的依据。
  assert(actual, '应能读到运行中的 dsh 版本');
  const norm = (v) => String(v).replace(/-.*$/, '');
  const [amaj, amin] = norm(actual).split('.').map(Number);
  const [tmaj, tmin] = norm(compat.tested).split('.').map(Number);
  assert(amaj === tmaj,
    `运行时 dsh 主版本 ${actual} 与已测声明 ${compat.tested} 主版本不一致，请重跑兼容性测试并更新声明`);
  // 次版本不一致时给出明确提示（不失败，但写入 detail 便于报告）
  if (amin !== tmin) {
    process.stderr.write(
      `  [提示] 运行时 dsh=${actual} 与 dsh.compat.tested=${compat.tested} 次版本不同，建议更新声明\n`);
  }
});

test('contract', 'plugin/cordis-patch-id', 'cordis.patch.yml 的 id 与插件 name 一致', async () => {
  const patch = readFileSync(join(ROOT, 'cordis.patch.yml'), 'utf8');
  assertIncludes(patch, 'dsh-dcs-cloud', 'patch 文件应引用插件 id');
  const ids = [...patch.matchAll(/id:\s*([\w-]+)/g)].map((m) => m[1]);
  assert(ids.length > 0, 'patch 文件应至少有一个 id');
  for (const id of ids) assertEqual(id, 'dsh-dcs-cloud', `patch id 不一致: ${id}`);
});

test('contract', 'plugin/package-manifest', 'package.json 的 dsh 字段与导出声明完整', async () => {
  assert(PLUGIN_PKG.dsh, 'package.json 缺少 dsh 字段');
  assert(PLUGIN_PKG.dsh.bundle && PLUGIN_PKG.dsh.bundle.patch, 'dsh.bundle.patch 缺失');
  assert(PLUGIN_PKG.dsh.client, 'dsh.client 缺失（客户端半无法被发现）');
  assert(Array.isArray(PLUGIN_PKG.dsh.client.inject), 'dsh.client.inject 应为数组');
  assert(PLUGIN_PKG.dsh.client.inject.length > 0, 'dsh.client.inject 不应为空（客户端装载顺序无保障）');
  for (const dep of PLUGIN_PKG.dsh.client.inject) {
    assert(dep.startsWith('@deepseek-ai/'), `dsh.client.inject 应为 dsh 包名: ${dep}`);
  }
  assert(PLUGIN_PKG.exports && PLUGIN_PKG.exports['.'], 'exports["."] 缺失');
  assert(PLUGIN_PKG.exports['./client'], 'exports["./client"] 缺失');
});

// ---------------------------------------------------------------- 客户端契约

test('contract', 'client/module-loader-envelope', '客户端半使用 window.__ModuleLoader__.load 包裹且 id 正确', async () => {
  const src = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
  assertIncludes(src, 'window.__ModuleLoader__.load', '客户端半应使用 __ModuleLoader__.load 信封');
  const m = src.match(/load\(\{\s*id:\s*["']([\w-]+)["']/);
  assert(m, '未能解析 __ModuleLoader__.load 的 id');
  assertEqual(m[1], 'dsh-dcs-cloud', '__ModuleLoader__.load 的 id 必须与插件名一致');
});

test('contract', 'client/slots-exist', '客户端使用的 slot 在 dsh 客户端均存在', async () => {
  const root = requireDshRoot();
  const src = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
  const used = [...src.matchAll(/slots\.(?:inject|register)\(\s*["']([\w.]+)["']/g)].map((m) => m[1]);
  const unique = [...new Set(used)];
  assert(unique.length > 0, '未在客户端代码中找到 slot 使用');
  const missing = [];
  for (const slot of unique) {
    // 在 dsh 客户端包中检索该 slot 名的注册/渲染点
    const found = searchInDsh(root, slot);
    if (!found) missing.push(slot);
  }
  assertEqual(missing.length, 0, `以下 slot 在 dsh ${DSH_VERSION_LABEL(root)} 中不存在: ${missing.join(', ')}`);
});

function searchInDsh(root, needle) {
  // 只在 client-ui-* / client-* 包中搜索，避免全量扫描
  const base = join(dshModulesDir(root), '@deepseek-ai');
  if (!existsSync(base)) return false;
  const dirs = readdirSync(base).filter((d) => d.startsWith('dsh-client'));
  for (const d of dirs) {
    const libDir = join(base, d, 'lib');
    if (!existsSync(libDir)) continue;
    for (const f of readdirSync(libDir)) {
      if (!f.endsWith('.js')) continue;
      const txt = readFileSync(join(libDir, f), 'utf8');
      if (txt.includes(`"${needle}"`) || txt.includes(`'${needle}'`)) return true;
    }
  }
  return false;
}

function DSH_VERSION_LABEL(root) {
  try {
    return dshPkgOf('dsh').version;
  } catch {
    return '(未知版本)';
  }
}

test('contract', 'client/exports-apply-inject', '客户端半导出 apply 且声明 slots 注入', async () => {
  const src = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
  assertIncludes(src, 'apply', '客户端半应导出 apply');
  assertIncludes(src, 'inject: ["slots"]', '客户端半应声明 inject slots');
});

// ---------------------------------------------------------------- 会话格式

test('contract', 'session/format-migrators-present', 'dsh 提供会话格式迁移链（升级不会丢历史会话）', async () => {
  const root = requireDshRoot();
  const base = join(dshModulesDir(root), '@deepseek-ai');
  const migrators = readdirSync(base)
    .filter((d) => d.startsWith('dsh-session-format') && /v\d+-to-v\d+/.test(d));
  assert(migrators.length > 0, '未发现任何 session-format 迁移包');
});
