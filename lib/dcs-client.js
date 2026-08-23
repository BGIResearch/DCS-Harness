// dsh-dcs-cloud — DCS 云平台客户端（Host 侧，纯 Node）。
// 封装 BGI Research 发布的 `dcs` CLI（Go 二进制，https://github.com/BGIResearch/dcs_cli）：
//   - 二进制管理：检测/下载（含 SHA256 校验）到 ~/.dsh/dcs-bin/dcs
//   - PAT 登录：dcs auth login --token <PAT>
//   - 命令执行：execFile 运行 dcs 命令，统一 --output json，解析 {data,error,exit_code,...}
//
// 配置持久化于 ~/.dsh/dcs-cloud.json；PAT 交给 dcs 自身加密存储（~/.dcs/config.yaml），
// 本插件不落盘明文 PAT（仅运行时使用）。

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';

// ---- dcs CLI 发行版（v1.1.0）----
// SHA256 取自官方发布页 v1.1.0 的 SHA256SUMS（2026-08-20 核实，与实测下载的二进制一致）。
export const DCS_VERSION = 'v1.1.0';
export const DCS_RELEASE_BASE = 'https://github.com/BGIResearch/dcs_cli/releases/download/' + DCS_VERSION;
const RELEASE_SHA = {
  'dcs-linux-amd64': '0ee3b225fe1ed3b631981cd118b6fc3740d085e0f0f4e4fb24e26b7da4e6ec30',
  'dcs-darwin-amd64': 'b1b74a4241bb7947978050d1f08af438a6696418f7cf39d8559b1f0a3fb87c80',
  'dcs-darwin-arm64': '6eeec4d32330d9876b0be376191b2e2de3c24896af999764162ee0e7ab1b30e3',
  'dcs-darwin-universal': '4c62c78011c6302493026a76c18c6dd010e84f2904c2936da707d82f92076f9f',
  'dcs.exe': 'fcd8afd473b2c607c11ec931157e192139a1d57e37bdbbd78a29d557e6cb5799',
};

export const DEFAULT_CFG = {
  // dcs CLI 二进制路径或名称；默认 'dcs'（在 PATH 中查找，找不到则自动下载）。
  cliPath: 'dcs',
  // 自动下载开关：auto（找不到就下载）| never（只用已有二进制）
  autoInstall: 'auto',
  // dcs_pat（个人访问令牌）：仅用于直连 DCS 公共库 API（dcs_public_search）。
  // 由 dcs_login 写入本地配置，与 dcs 自身加密存储的 token 一致（同一 PAT）。
  pat: '',
  // DCS API base（公共库/元数据接口），默认中国主站。
  baseUrl: 'https://www.dcs.cloud',
  // API keys 映射：skill/服务名 → 其 API key（如 genos_vep → HG38_VCF_PREDICT_API_KEY）。
  // 由 dcs_api_key 工具管理，写入 ~/.dsh/dcs-cloud.json（600 权限）。
  // 模型/技能 API key 以此统一管理，使用时自动注入。
  apiKeys: {},
};

// ---- 配置 ----
export function cfgPath() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dcs-cloud.json');
}

export function loadCfg() {
  let file = {};
  try { file = JSON.parse(readFileSync(cfgPath(), 'utf8')); } catch { /* 无文件 */ }
  return {
    ...DEFAULT_CFG,
    ...file,
    cliPath: process.env.DCS_CLI_PATH || file.cliPath || DEFAULT_CFG.cliPath,
    pat: process.env.DCS_PAT || file.pat || '',
  };
}

export function saveCfg(next) {
  mkdirSync(dirname(cfgPath()), { recursive: true });
  writeFileSync(cfgPath(), JSON.stringify(next, null, 2));
  // 配置文件可能含 PAT，收紧为仅本用户可读写。
  try { chmodSync(cfgPath(), 0o600); } catch { /* 平台不支持时忽略 */ }
}

// ---- 平台 / 二进制 ----
export function platformBinary() {
  const p = process.platform; // darwin | linux | win32
  const a = process.arch; // arm64 | x64 | ...
  if (p === 'darwin' && a === 'arm64') return 'dcs-darwin-arm64';
  if (p === 'darwin' && a === 'x64') return 'dcs-darwin-amd64';
  if (p === 'darwin') return 'dcs-darwin-universal';
  if (p === 'linux' && a === 'x64') return 'dcs-linux-amd64';
  if (p === 'win32') return 'dcs.exe';
  return null;
}

export function managedBinDir() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dcs-bin');
}
export function managedBinPath() {
  const name = platformBinary();
  return name ? join(managedBinDir(), name) : null;
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** 下载 dcs 二进制并校验 SHA256，返回落盘路径；失败抛错。 */
export async function downloadDcsBinary(signal) {
  const name = platformBinary();
  if (!name) throw new Error('当前平台无可用 dcs 二进制（' + process.platform + '/' + process.arch + '）');
  const url = DCS_RELEASE_BASE + '/' + name;
  const out = managedBinPath();
  mkdirSync(managedBinDir(), { recursive: true });
  const t = AbortSignal.timeout(300000);
  const sig = signal ? AbortSignal.any([signal, t]) : t;
  const res = await fetch(url, { signal: sig });
  if (!res.ok) throw new Error('下载失败: HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const expect = RELEASE_SHA[name];
  const got = sha256(buf);
  if (expect && got !== expect) throw new Error('SHA256 校验失败：期望 ' + expect + '，实际 ' + got);
  writeFileSync(out, buf);
  chmodSync(out, 0o755);
  return out;
}

function isExecutable(p) {
  return new Promise((resolve) => {
    try {
      execFile(p, ['--version'], { timeout: 20000 }, (err) => resolve(!err));
    } catch { resolve(false); }
  });
}

/** 解析可用二进制路径：cliPath → PATH → 已下载 → 自动下载。 */
export async function resolveDcsBinary(cfg, signal) {
  const candidates = [];
  if (cfg.cliPath && cfg.cliPath !== 'dcs') candidates.push(cfg.cliPath);
  candidates.push('dcs'); // PATH 查找
  const managed = managedBinPath();
  if (managed) candidates.push(managed);

  for (const c of candidates) {
    if (await isExecutable(c)) return { path: c, source: c === managed ? 'managed' : 'configured' };
  }
  if (cfg.autoInstall !== 'never') {
    const p = await downloadDcsBinary(signal);
    return { path: p, source: 'downloaded' };
  }
  throw new Error('未找到 dcs CLI，且 autoInstall=never。请用 dcs_configure 指定 cliPath 或安装 dcs。');
}

// ---- 命令执行 ----

/**
 * 运行 dcs 命令（统一追加 --output json）。
 * @param {string[]} args 不含二进制名的参数（如 ['data','ls','/Files']）
 * @param {object} opts { signal, timeoutMs, output: 'json'|'table'|'ndjson', cwd, env }
 */
export async function runDcs(cfg, args, opts) {
  const o = opts || {};
  const bin = await resolveDcsBinary(cfg, o.signal);
  const out = o.output || 'json';
  const fullArgs = [...args, '--output', out];
  if (o.noHistory !== false) fullArgs.push('--no-history');
  const result = await new Promise((resolve) => {
    let child;
    try {
      child = execFile(bin.path, fullArgs, {
        timeout: o.timeoutMs || 180000,
        maxBuffer: 40 * 1024 * 1024,
        cwd: o.cwd,
        env: { ...process.env, ...(o.env || {}) },
      }, (err, stdout, stderr) => {
        resolve({ err, stdout: String(stdout || ''), stderr: String(stderr || '') });
      });
      if (o.signal) {
        o.signal.addEventListener('abort', () => { try { child.kill('SIGKILL'); } catch {} }, { once: true });
      }
    } catch (e) {
      resolve({ err: e, stdout: '', stderr: String(e.message || e) });
    }
  });

  let parsed = null;
  try { parsed = JSON.parse(result.stdout); } catch { /* 非 JSON（table 等） */ }
  // dcs 失败响应里 error 是嵌套对象 {type, detail:{business_code,message}, hint, retryable}，
  // 统一压平为可读字符串，避免上层对非字符串调用 slice 等崩溃。
  let errText = '';
  if (parsed && parsed.error !== null && parsed.error !== undefined && parsed.error !== '') {
    const e = parsed.error;
    if (typeof e === 'string') errText = e;
    else if (typeof e === 'object') {
      const detail = (e.detail && typeof e.detail === 'object') ? e.detail : {};
      errText = String(detail.message || e.hint || e.type || JSON.stringify(e));
      if (detail.business_code) errText += '（错误码 ' + detail.business_code + '）';
    } else errText = String(e);
  }
  return {
    ok: !result.err && parsed !== null && (parsed.exit_code === 0 || parsed.exit_code === undefined),
    exit_code: parsed ? parsed.exit_code : (result.err ? (result.err.code || 1) : 0),
    data: parsed ? parsed.data : null,
    error: errText,
    message: parsed ? parsed.message : '',
    raw: result.stdout,
    stderr: result.stderr,
    binary: bin.path,
    source: bin.source,
  };
}

/** 登录（dcs auth login --token <PAT>）。 */
export async function dcsLogin(cfg, token, opts) {
  return runDcs(cfg, ['auth', 'login', '--token', String(token || '')], { ...(opts || {}), timeoutMs: 60000 });
}

/** 通用状态快照（当前用户/区域/项目）。 */
export async function dcsStatus(cfg, opts) {
  const [project, region] = await Promise.all([
    runDcs(cfg, ['project', 'current'], { ...(opts || {}), timeoutMs: 60000 }).catch(() => null),
    runDcs(cfg, ['region', 'current'], { ...(opts || {}), timeoutMs: 60000 }).catch(() => null),
  ]);
  return { project, region };
}

// ---- 公共库（publib）直连 API ----
// dcs CLI v1.1.0 未暴露「公共数据」命令，但公共库有独立 REST API：
//   GET {baseUrl}/api/publib/dcsRes/search?name=<关键词>&page=&pageSize=
// 返回 resources（resType: dataset/workflow/img/proj/ai_model 等）。需 dcs_pat + X-Client-App。

/** 搜索 DCS 公共库（公共数据/流程/项目/AI模型）。 */
export async function publicSearch(cfg, name, opts) {
  const o = opts || {};
  const base = (cfg.baseUrl || DEFAULT_CFG.baseUrl).replace(/\/$/, '');
  const pat = cfg.pat || '';
  if (!pat) throw new Error('未配置 PAT。请先 dcs_login（PAT 会写入本地配置）再检索公共库。');
  const params = new URLSearchParams();
  if (name) params.set('name', String(name));
  params.set('page', String(o.page || 1));
  params.set('pageSize', String(o.pageSize || 30));
  const t = AbortSignal.timeout(o.timeoutMs || 60000);
  const sig = o.signal ? AbortSignal.any([o.signal, t]) : t;
  const res = await fetch(base + '/api/publib/dcsRes/search?' + params.toString(), {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + pat, 'X-Client-App': 'dcs-cloud-cli' },
    signal: sig,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* 非 JSON */ }
  if (!res.ok || (data && data.code && data.code !== 0)) {
    const msg = data && data.msg ? data.msg : ('HTTP ' + res.status);
    throw new Error('公共库检索失败: ' + msg);
  }
  const recs = (data && data.data && data.data.records) || [];
  return {
    total: (data && data.data && data.data.total) || recs.length,
    records: recs.map((r) => ({
      name: r.name, resType: r.resType, intro: (r.intro || '').slice(0, 200),
      zone: r.srcZone, id: r.rawId, tags: r.tags || [], omics: r.omics || [],
      officialTag: r.official_tag || '', creator: r.createdBy,
    })),
  };
}

// 注：Genpilot LLM 与 Genos 模型为 DCS 系统自带、自动鉴权、模型自动选择，
// 由 dcs_llm 工具在在线容器内调用（读系统注入的 LLM_API_KEY / DCS_X_ACCESS_TOKEN），无需本地配置 key。
