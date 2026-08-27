// dsh-dcs-cloud — 宿主半（Host）。
// 面向 DCS Cloud 基因组/时空组学研究的编排插件：封装 BGI Research 的 `dcs` CLI，
// 提供数据检索、Genpilot 流程复用、在线容器、离线任务投递、脚本审计与学术报告生成，
// 并通过 systemPrompt 引导 agent 走「分解 → 研究 → 方案 → 数据 → 脚本 → 审计 → 执行 → 报告」流程。
//
// 依赖 dcs CLI（本机二进制）：PATH 里有则用，没有则按平台自动下载（含 SHA256 校验）。

import { readFileSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join, isAbsolute, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { defineTool } from '@deepseek-ai/dsh-tools';
import {
  loadCfg, saveCfg, runDcs, dcsLogin, dcsStatus, publicSearch,
  resolveDcsBinary, platformBinary, DCS_VERSION,
} from './dcs-client.js';
import { auditScript } from './audit.js';
import { generateReport } from './report.js';
import { generatePlan } from './plan.js';
import { loadTasks, upsertTask, updateStepStatus, getTask, mergeTask } from './tasks.js';
import {
  listProjects, getProject, upsertProject, mergeProject, upsertModule,
  startRun, updateRun, updateDelivery, deleteProject, DELIVERY_SECTIONS,
  reviewModule, approveAllGates, listPendingFeedback, replyFeedback,
} from './projects.js';
import {
  REGIONS, OMICS_TOOLS, KEYWORD_TO_CATEGORY, searchHints, genpilotHints,
  GENPILOT_PATTERN, CONTAINER_PUBLIC, PUBLIC_DATASETS, containerHints, GENPILOT_MODELS,
  SKILLS_BASE, SKILLS_SNAPSHOT, EXPERT_BASE, SKILL_TOP_DIRS, EXPERTS, skillsHints,
  API_KEY_SKILLS,
} from './atlas.js';

/** Cordis 插件名 —— 必须与 cordis.patch.yml 里的行 id 一致。 */
export const name = 'dsh-dcs-cloud';

/** 插件版本（从 package.json 动态读取，与 npm 版本保持同步）。 */
function readPluginVersion() {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return String(pkg.version || '2.0.0');
  } catch {
    return '2.0.0';
  }
}
const PLUGIN_VERSION = readPluginVersion();

/** 硬依赖的宿主服务。 */
export const inject = ['tools', 'systemPrompt', 'webServer', 'sessions', 'tokenMeter', 'sessionPersistence'];

const OUTPUT_CAP = 40000; // 单工具结果文本上限（字符）

// ---- DCS Harness v2：成本查询 ----

/** analysis consume 结果缓存（60s），避免 5 秒轮询打爆 DCS API。 */
const costCache = new Map(); // taskId -> { cost, at }

/** 图片下载 in-flight 去重（path -> Promise<localPath|null>），避免并发重复 terminal download。 */
const imageInFlight = new Map();
async function ensureImageCached(cfg, p, cacheFile) {
  if (existsSync(cacheFile)) return cacheFile;
  if (imageInFlight.has(p)) return imageInFlight.get(p);
  const job = (async () => {
    await runDcs(cfg, ['terminal', 'download', '-p', p, '-t', cacheFile], { timeoutMs: 90000 }).catch(() => null);
    imageInFlight.delete(p);
    return existsSync(cacheFile) ? cacheFile : null;
  })();
  imageInFlight.set(p, job);
  return job;
}

/** 离线任务详情缓存（60s）：analysis info 的 amount（费用）/资源/镜像/状态。 */
const taskInfoCache = new Map(); // taskId -> { info, at }

async function dcsTaskCost(cfg, taskId) {
  const hit = costCache.get(taskId);
  if (hit && Date.now() - hit.at < 60000) return hit.cost;
  try {
    const r = await runDcs(cfg, ['analysis', 'consume', String(taskId)], { timeoutMs: 30000 });
    let cost = null;
    if (r.ok && r.data) {
      const metrics = r.data.metrics || r.data;
      if (typeof metrics === 'object') {
        for (const k of ['amount', 'cost', 'fee', 'total_amount', 'totalCost']) {
          if (metrics[k] !== undefined && metrics[k] !== null) { cost = Number(metrics[k]); break; }
        }
      }
    }
    costCache.set(taskId, { cost, at: Date.now() });
    return cost;
  } catch {
    return null;
  }
}

/** 离线任务详情（费用 amount / 资源 computing_name / 镜像 / 状态），analysis consume 无数据时兜底。 */
async function dcsTaskInfo(cfg, taskId) {
  const hit = taskInfoCache.get(taskId);
  if (hit && Date.now() - hit.at < 60000) return hit.info;
  try {
    const r = await runDcs(cfg, ['analysis', 'info', String(taskId)], { timeoutMs: 30000 });
    let info = { taskId, amount: null, resource: '', image: '', status: '', createTime: '' };
    if (r.ok && r.data) {
      const recs = r.data.records || [];
      if (recs.length) {
        const s = recs[0];
        const amt = s.amount !== undefined && s.amount !== null ? Number(s.amount) : null;
        info = {
          taskId,
          amount: Number.isFinite(amt) ? amt : null,
          resource: s.computing_name || s.computingName || '',
          image: s.image_name || s.imageName || '',
          status: s.status || '',
          createTime: s.create_time || s.createTime || '',
        };
      }
    }
    taskInfoCache.set(taskId, { info, at: Date.now() });
    return info;
  } catch {
    return { taskId, amount: null, resource: '', image: '', status: '', createTime: '' };
  }
}

/** 读取某会话的 dsh token 消耗（tokenMeter 服务）。 */
function sessionTokens(ctx, sessionId) {
  try {
    const session = ctx.get('sessions') && ctx.get('sessions').get(sessionId);
    if (!session) return null;
    const meter = ctx.get('tokenMeter');
    if (!meter) return null;
    const m = meter.measure(session);
    return {
      totalTokens: m.totalTokens,
      surfaceTokens: m.surfaceTokens,
      baselineKind: m.baseline && m.baseline.kind,
      baselineTokens: m.baseline && m.baseline.tokens,
      logRevision: m.logRevision,
    };
  } catch {
    return null;
  }
}

function workspaceOf(exec) {
  return (exec && exec.agent && exec.agent.session && exec.agent.session.header && exec.agent.session.header.cwd) || process.cwd();
}

/** 从工具执行上下文取当前会话 id（用于任务按会话作用域）。 */
function sessionIdOf(exec) {
  return (exec && exec.agent && exec.agent.session && exec.agent.session.header && exec.agent.session.header.id) || '';
}

/** 读取本地图片文件 → base64 data-URI（用于交付 image 图表内嵌）。 */
function imageFileToB64(abs) {
  try {
    if (!abs) return null;
    const buf = readFileSync(abs);
    if (buf.length > 12 * 1024 * 1024) return null;
    return 'data:image/' + (extname(abs).toLowerCase().replace('.', '') || 'png') + ';base64,' + buf.toString('base64');
  } catch {
    return null;
  }
}

/** 本机图片持久化交付目录（容器图下载到本地，交付读本地，不再依赖远程容器）。 */
function localImgDir() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dcs-img-cache');
}

/** 本地图片文件路径（按远程路径生成稳定的本地文件名）。 */
function localImgPath(remotePath) {
  return join(localImgDir(), 'img-' + createHash('sha1').update(String(remotePath)).digest('hex').slice(0, 16) + (extname(remotePath) || '.png'));
}

/** 把容器/远程图片下载到本机交付目录，返回本地绝对路径；已存在则直接复用。 */
async function downloadContainerFile(cfg, remotePath) {
  try {
    mkdirSync(localImgDir(), { recursive: true });
    const local = localImgPath(remotePath);
    if (existsSync(local)) return local;
    const ok = await ensureImageCached(cfg, remotePath, local);
    return ok || null;
  } catch {
    return null;
  }
}

/** MIME 表：交付媒体文件服务（serve-local/chart-file）按扩展名返回。 */
const SERVE_MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.pdb': 'text/plain; charset=utf-8', '.ent': 'text/plain; charset=utf-8',
  '.cif': 'text/plain; charset=utf-8', '.mcif': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm', '.pdf': 'application/pdf',
};
function mimeOf(name) {
  return SERVE_MIME[String(extname(String(name || ''))).toLowerCase()] || 'application/octet-stream';
}

/** serve-local 文件名白名单：字母/数字/下划线/连字符开头，可含点扩展名；拒绝 .. 与隐藏文件（防路径穿越）。 */
function safeServeName(name) {
  const s = String(name || '');
  return (/^[A-Za-z0-9_-][A-Za-z0-9.-]*$/.test(s) && !s.includes('..')) ? s : null;
}

/** 把解析后的本机文件登记进交付缓存目录（按内容 key 去重），返回 serve-local 文件名。 */
function cacheServeFile(localAbs, srcKey) {
  const dir = localImgDir();
  mkdirSync(dir, { recursive: true });
  const ext = (extname(localAbs) || '.bin').toLowerCase().slice(0, 12);
  const name = 'file-' + createHash('sha1').update(String(srcKey || localAbs)).digest('hex').slice(0, 20) + ext;
  const target = join(dir, name);
  if (!existsSync(target)) copyFileSync(localAbs, target);
  return name;
}

/** 解析交付媒体路径：容器路径→下载到本地交付目录；相对路径→按工作区解析；本机绝对路径→原样。返回本机绝对路径或 null。 */
async function resolveMediaPath(cfg, p) {
  try {
    if (p.startsWith('/work/') || p.startsWith('/data/')) {
      return await downloadContainerFile(cfg, p);
    }
    if (!isAbsolute(p)) {
      return join(workspaceOf({ agent: { session: { header: { cwd: process.cwd() } } } }), p);
    }
    return p;
  } catch {
    return null;
  }
}

/** 从 terminal exec 结果里提取纯 stdout（命令输出），而非整段 CLI JSON 外壳。 */
function termStdout(r) {
  if (!r) return '';
  const d = r.data;
  if (d && typeof d === 'object' && (d.stdout !== undefined || d.output !== undefined)) {
    return String(d.stdout !== undefined ? d.stdout : d.output);
  }
  if (d && typeof d === 'string') return d;
  // 兜底：raw 是完整 JSON，尝试解析出 data.stdout
  if (r.raw) {
    try {
      const parsed = JSON.parse(r.raw);
      if (parsed && parsed.data && parsed.data.stdout !== undefined) return String(parsed.data.stdout);
      if (parsed && parsed.data && parsed.data.output !== undefined) return String(parsed.data.output);
    } catch { /* 非 JSON，直接用 raw */ }
    return String(r.raw);
  }
  return '';
}

/** 把 dcs 命令结果裁剪成稳定的文本视图。 */
function cliView(r) {
  let text;
  if (r.ok) {
    try { text = JSON.stringify(r.data, null, 2); } catch { text = r.raw; }
  } else {
    text = r.error || r.stderr || r.raw || '(无输出)';
  }
  let truncated = false;
  if (text.length > OUTPUT_CAP) { text = text.slice(0, OUTPUT_CAP) + '\n…（已截断）'; truncated = true; }
  // 只返回 schema 声明字段（ok/output/truncated/error）：把 exit_code/message/binary 折叠进文本，
  // 否则 DSH 工具框架的 additionalProperties:false 校验会拒绝返回。
  const meta = [];
  if (r.exit_code !== undefined && r.exit_code !== null && String(r.exit_code) !== '0') meta.push('exit_code=' + r.exit_code);
  if (r.binary) meta.push('binary=' + r.binary);
  if (meta.length) text += (text ? '\n' : '') + '(' + meta.join(', ') + ')';
  return {
    ok: r.ok,
    error: r.error || '',
    output: text,
    truncated,
  };
}

/** 通用 CLI 工具执行包装：build(args) → runDcs → cliView。 */
async function execCli(exec, build, timeoutMs) {
  const cfg = loadCfg();
  try {
    const r = await runDcs(cfg, build(), { signal: exec && exec.signal, timeoutMs: timeoutMs || 180000 });
    return cliView(r);
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), output: String(e && e.message || e), truncated: false };
  }
}

function str(v) { return v === undefined || v === null ? '' : String(v); }

/** 自动归一化 DCS 资源规格为 dcs 要求的 vf=*g,num_proc=* 格式。
 *  支持 "4c 16g" / "8核32G" / "16g 4c" / "vf=16g,num_proc=4" / 已合法格式。
 */
function normalizeDcsResource(resStr) {
  const s = String(resStr == null ? '' : resStr).trim();
  if (!s) return 'vf=16g,num_proc=4';
  // 已是合法格式
  if (/vf=[\d.]+g/i.test(s) && /num_proc=\d+/i.test(s)) return s.toLowerCase();
  // "4c 16g" / "8核32G"（核前内存后）
  let m = s.match(/(\d+)\s*(?:c|cores?|核)\s*(\d+)\s*(?:g|gb|G)/i);
  if (m) return 'vf=' + m[2] + 'g,num_proc=' + m[1];
  // "16g 4c"（内存前核后）
  m = s.match(/(\d+)\s*(?:g|gb|G)\s*(\d+)\s*(?:c|cores?|核)/i);
  if (m) return 'vf=' + m[1] + 'g,num_proc=' + m[2];
  return s;
}

/**
 * 在 DCS 在线容器里执行命令；容器未开（错误码 83006/83007 等）时自动 terminal open 后重试一次。
 * @param {object} cfg dcs 配置
 * @param {string[]} args 完整 dcs 参数（如 ['terminal','exec','-c',cmd,'--timeout','100']）
 * @param {object} opts { signal, timeoutMs, autoOpen=false 时禁止自动开容器 }
 */
async function termExec(cfg, args, opts) {
  const o = opts || {};
  const sig = o.signal;
  const run = () => runDcs(cfg, args, { signal: sig, timeoutMs: o.timeoutMs || 120000 });
  let r = await run();
  // 容器未就绪/未开/会话过期/超时（业务码 83006/83007/83008/83013 及常见文案）→ terminal open 后重试一次
  if (!r.ok && o.autoOpen !== false && /83006|83007|83008|83013|容器|workspace|not open|未就绪|未开|会话|超时|过时/i.test((r.error || '') + ' ' + (r.raw || '') + ' ' + (r.message || ''))) {
    await runDcs(cfg, ['terminal', 'open'], { signal: sig, timeoutMs: 180000 }).catch(() => null);
    await new Promise((res) => setTimeout(res, 5000));
    r = await run();
  }
  return r;
}

/** 从 dcs 登录状态取当前用户名（未登录/失败返回空串）。 */
async function currentUsername(cfg, signal) {
  try {
    const st = await dcsStatus(cfg, { signal, timeoutMs: 30000 });
    const pdata = (st && st.project && st.project.data) || {};
    const rdata = (st && st.region && st.region.data) || {};
    return pdata.username || rdata.username || '';
  } catch {
    return '';
  }
}

/**
 * 调用 DCS Genpilot 对话 LLM（在在线容器内执行，系统自动鉴权）。
 * dcs_llm 与 dcs_self_review（自批评节点）、dcs_skill_route（LLM 排序）共用。
 * @returns {Promise<{ok:boolean, model:string, content:string, error:string}>}
 */
async function genpilotChat(cfg, signal, prompt, system, model) {
  const payload = { system: str(system), prompt: str(prompt), model: str(model) };
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const py = `
import os, json, base64, urllib.request, urllib.error
def load_env(path):
    d = {}
    try:
        for line in open(path):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                d[k.strip()] = v.strip().strip('"').strip("'")
    except Exception:
        pass
    return d
env = {}
for p in ['.env', '/work/' + os.environ.get('USER', '') + '/.env']:
    env.update(load_env(p))
env.update({k: v for k, v in os.environ.items()})
base = os.environ.get('LLM_API_BASE') or env.get('LLM_API_BASE') or 'https://dcsapi.dcs.cloud/api/aigress/unified/v1/chat/completions'
model = env.get('LLM_MODEL') or 'deepseek-v4-pro'
key = os.environ.get('LLM_API_KEY') or env.get('LLM_API_KEY') or env.get('DCS_X_ACCESS_TOKEN') or ''
data = json.loads(base64.b64decode('${b64}').decode())
if data.get('model'):
    model = data['model']
msgs = []
if data.get('system'):
    msgs.append({'role': 'system', 'content': data['system']})
msgs.append({'role': 'user', 'content': data['prompt']})
body = json.dumps({'model': model, 'messages': msgs})
req = urllib.request.Request(base, data=body.encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key})
try:
    r = urllib.request.urlopen(req, timeout=180)
    d = json.loads(r.read())
    print('__MODEL__' + d.get('model', model))
    print(d['choices'][0]['message']['content'])
except urllib.error.HTTPError as e:
    print('__DCS_LLM_ERR__ ' + str(e.code) + ' ' + e.read().decode()[:300])
except Exception as e:
    print('__DCS_LLM_ERR__ ' + str(e)[:300])
`;
  const cmd = "python3 - <<'PYEOF'\n" + py + "\nPYEOF";
  try {
    const r = await termExec(cfg, ['terminal', 'exec', '-c', cmd, '--timeout', '300'], { signal, timeoutMs: 320000 });
    const out = r.ok ? termStdout(r) : (r.stderr || r.error || '');
    const errIdx = out.indexOf('__DCS_LLM_ERR__');
    if (errIdx !== -1) {
      return { ok: false, model: '', content: '', error: out.slice(errIdx + 16).trim() };
    }
    const mIdx = out.indexOf('__MODEL__');
    let mdl = 'deepseek-v4-pro';
    let content = out;
    if (mIdx !== -1) {
      const nl = out.indexOf('\n', mIdx);
      mdl = out.slice(mIdx + 9, nl === -1 ? out.length : nl).trim() || mdl;
      content = out.slice(nl === -1 ? out.length : nl + 1).trim();
    }
    return { ok: true, model: mdl, content: content || '(空响应)', error: '' };
  } catch (e) {
    return { ok: false, model: '', content: '', error: String(e && e.message || e) };
  }
}

/** 从 LLM 文本里提取第一个平衡 JSON 对象（容忍 ```json 围栏与前缀废话）。 */
function extractJsonObj(text) {
  if (!text) return null;
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/** 把自然语言任务拆成检索词：英文/数字词 + CJK 整词与双字词组。 */
function taskTerms(task) {
  const s = String(task || '').toLowerCase();
  const terms = [];
  const ascii = s.match(/[a-z0-9][a-z0-9_\-.+#]*/g) || [];
  for (const w of ascii) if (w.length >= 2) terms.push(w);
  const cjk = s.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const w of cjk) {
    if (w.length <= 4) terms.push(w);
    for (let i = 0; i < w.length - 1; i++) terms.push(w.slice(i, i + 2));
  }
  return [...new Set(terms)].filter(Boolean);
}

/** 术语打分：长词命中权重 2，短词/双字词命中权重 1。 */
function scoreText(terms, text) {
  const hay = String(text || '').toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (hay.includes(t)) score += t.length >= 4 ? 2 : 1;
  }
  return score;
}

// ---- DCS Genpilot 平台「原生技能库」读取（容器 /public/skills）----

/** 读取 skills_snapshot.json（973 条 {name, description, path, metadata}），并解析成数组。 */
async function skillCatalog(cfg, exec, includePersonal) {
  const py = `import json
p=${JSON.stringify(SKILLS_SNAPSHOT)}
try:
    d=json.load(open(p))
except Exception as e:
    print('ERROR', e); raise SystemExit
out=[]
for x in d:
    out.append({"name": str(x.get("name") or ""), "description": str(x.get("description") or "")[:240], "path": str(x.get("path") or "")})
print(json.dumps(out))`;
  const r = await termExec(cfg, ['terminal', 'exec', '-c', "python3 - <<'PYEOF'\n" + py + "\nPYEOF", '--timeout', '60'], { signal: exec && exec.signal, timeoutMs: 90000 });
  if (!r.ok) return { ok: false, error: r.error || r.raw || '读取技能快照失败' };
  let list = [];
  try {
    list = JSON.parse(termStdout(r));
  } catch (e) {
    return { ok: false, error: '解析技能快照失败: ' + String(e && e.message || e) };
  }
  // 个人技能：容器 /work/{user}/skills/<技能名>/SKILL.md（在线容器 cwd 默认即 /work/{user}，相对路径 skills 即可命中）
  if (includePersonal) {
    const py2 = `import os, json
out=[]
base='skills'
if os.path.isdir(base):
    for d in sorted(os.listdir(base)):
        f=os.path.join(base,d,'SKILL.md')
        if os.path.isfile(f):
            desc=''
            try:
                with open(f,encoding='utf-8',errors='ignore') as fp:
                    for ln in fp:
                        s=ln.strip()
                        if s and not s.startswith('#'):
                            desc=s[:240]; break
            except Exception: pass
            out.append({"name":"personal/"+d,"description":desc,"path":os.path.abspath(f)})
print(json.dumps(out))`;
    const r2 = await termExec(cfg, ['terminal', 'exec', '-c', "python3 - <<'PYEOF'\n" + py2 + "\nPYEOF", '--timeout', '60'], { signal: exec && exec.signal, timeoutMs: 90000 });
    if (r2.ok) {
      try { list = list.concat(JSON.parse(termStdout(r2))); } catch (e) { /* 个人技能解析失败不阻塞公共库 */ }
    }
  }
  return { ok: true, list };
}

/** 读容器内一个文件并返回文本（capped）。 */
async function catInContainer(cfg, exec, path, cap, timeoutMs) {
  const cmd = `f=${JSON.stringify(path)}; [ -f "$f" ] && cat "$f" 2>/dev/null | head -c ${cap || 20000} || echo '__NOT_FOUND__'`;
  const r = await termExec(cfg, ['terminal', 'exec', '-c', cmd, '--timeout', String(Math.min(60, Math.floor((timeoutMs || 60000) / 1000)))], { signal: exec && exec.signal, timeoutMs: timeoutMs || 60000 });
  if (!r.ok) return { ok: false, text: '', error: r.error || r.raw || '' };
  const t = termStdout(r);
  if (t.indexOf('__NOT_FOUND__') >= 0) return { ok: false, text: '', error: '未找到文件 ' + path };
  return { ok: true, text: t, error: '' };
}

// ---- DCS 技能 API key 管理（Genos / Genos-VEP 等，存储在 dcs-cloud.json apiKeys 字段）----

/** 从配置里读取已存储的 API key。name 可以是具体 skill（genos_vep）或系列（genos）。 */
function getApiKey(name) {
  const cfg = loadCfg();
  const keys = (cfg && cfg.apiKeys && typeof cfg.apiKeys === 'object') ? cfg.apiKeys : {};
  const n = str(name);
  if (keys[n] && typeof keys[n] === 'string') return keys[n];
  // 兜底：查别名——genos_vep / genos_mutation 最终都回退到 genos
  if (n !== 'genos' && keys.genos && typeof keys.genos === 'string') return keys.genos;
  return '';
}

/** 取得某 skill 对应的 env 变量名集合（如 Genos-VEP → {HG38_VCF_PREDICT_API_KEY: 'sk-...'}）。 */
function skillEnvVars(name) {
  const entry = API_KEY_SKILLS.find((s) => s.name === name || (Array.isArray(s.skills) && s.skills.some((sp) => sp.toLowerCase().includes(name.toLowerCase()))));
  if (!entry) return {};
  const key = getApiKey(name) || getApiKey(entry.name);
  return key ? { [entry.envVar]: key } : {};
}

// ---- 工具定义 ----

export function apply(ctx) {
  // ---------- 配置 / 登录 / 状态 ----------

  ctx.tools.register(defineTool({
    name: 'dcs_configure',
    description: '配置 dcs CLI 的本地参数（cliPath、autoInstall）与技能 API key（api_keys，如 genos_vep → HG38_VCF_PREDICT_API_KEY）。Genpilot 对话 LLM 鉴权由系统自动注入；Genos 预测模型需用户 API key（通过 dcs_api_key 或此处的 api_keys 配置）。PAT 登录请用 dcs_login。',
    parameters: {
      cliPath: { type: 'string', description: 'dcs 二进制路径或名称，默认 "dcs"（在 PATH 中查找）' },
      autoInstall: { type: 'string', enum: ['auto', 'never'], description: '找不到二进制时是否自动从 GitHub 下载：auto=自动下载（默认），never=不下载' },
      api_keys: { type: 'json', description: '技能 API key 映射（JSON 对象），如 {"genos_vep":"sk-...","genos":"sk-..."}。与 dcs_api_key 等价的批处理方式。' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          cliPath: { type: 'string', required: true },
          autoInstall: { type: 'string', required: true },
          platform: { type: 'string', required: true },
          apiKeys: { type: 'array', items: { type: 'string' }, description: '已配置 API key 的 skill 名列表' },
          error: { type: 'string' },
        },
      },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('✅ dcs 配置已保存：cliPath=' + v.cliPath + '，autoInstall=' + v.autoInstall + '（平台 ' + v.platform + '）。技能 API key：' + (v.apiKeys && v.apiKeys.length ? v.apiKeys.join(', ') : '（无）') + '（Genos 预测模型需 key，Genpilot 对话 LLM 系统自动鉴权）') : ('❌ 配置失败: ' + (v.error || '')) }]; },
    },
    async execute(args) {
      const cfg = loadCfg();
      const next = { ...cfg };
      if (str(args.cliPath)) next.cliPath = str(args.cliPath);
      if (args.autoInstall) next.autoInstall = args.autoInstall;
      if (args.api_keys && typeof args.api_keys === 'object' && !Array.isArray(args.api_keys)) {
        next.apiKeys = next.apiKeys || {};
        for (const [k, v] of Object.entries(args.api_keys)) {
          if (v && typeof v === 'string') next.apiKeys[k] = v;
          else if (v === null || v === '') delete next.apiKeys[k];
        }
      }
      saveCfg(next);
      const akList = Object.keys(next.apiKeys || {}).filter((k) => next.apiKeys[k] && next.apiKeys[k].length > 0);
      return { ok: true, cliPath: next.cliPath, autoInstall: next.autoInstall, platform: platformBinary() || (process.platform + '/' + process.arch), apiKeys: akList, error: '' };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_api_key',
    description: '管理 DCS 技能/模型的 API key（存储在 ~/.dsh/dcs-cloud.json 的 apiKeys 字段，600 权限）。支持 set / get / list / delete 操作。当前已知需 key 的技能：genos_vep（Genos-VEP）、genos_mutation（Genos-Mutation）、genos（Genos 全系）。key 从 DCS Cloud「个人资料→API_key 管理」申请。',
    parameters: {
      op: { type: 'string', enum: ['set', 'get', 'list', 'delete'], required: true, description: '操作：set 设置 / get 获取 / list 列出全部 / delete 删除' },
      name: { type: 'string', description: '技能名，如 genos_vep / genos_mutation / genos（set/get/delete 时必填）' },
      key: { type: 'string', description: 'API key 值（set 时必填，删除时传空或省略）' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          name: { type: 'string', description: '操作的技能名' },
          has_key: { type: 'boolean', description: 'key 是否已配置' },
          known: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, label: { type: 'string' }, envVar: { type: 'string' }, desc: { type: 'string' } } }, description: '已知需 key 的技能列表（list 时返回）' },
          output: { type: 'string', required: true },
          error: { type: 'string' },
        },
      },
      render(args, v) {
        if (args.op === 'list') {
          const lines = (v.known || []).map((s) => '• ' + s.name + '（' + (s.label || '') + '）→ env: ' + (s.envVar || '') + (s.has_key ? ' ✅ 已配置' : ' ⚠️ 未配置'));
          return [{ type: 'text', text: '🔑 DCS 技能 API key：\n' + (lines.join('\n') || '（无已知技能）') + '\n' + v.output }];
        }
        return [{ type: 'text', text: v.output }];
      },
    },
    async execute(args) {
      const cfg = loadCfg();
      const op = str(args.op);
      const name = str(args.name);
      const key = str(args.key);
      const keys = (cfg && cfg.apiKeys && typeof cfg.apiKeys === 'object') ? cfg.apiKeys : {};
      // list
      if (op === 'list') {
        const known = API_KEY_SKILLS.map((s) => ({ name: s.name, label: s.label, envVar: s.envVar, desc: s.desc, has_key: !!(keys[s.name] && keys[s.name].length > 0) }));
        const configured = Object.keys(keys).filter((k) => keys[k] && keys[k].length > 0);
        return { ok: true, known, output: '已配置: ' + (configured.length ? configured.join(', ') : '（无）') + '。用 dcs_api_key set <name> <key> 设置。', error: '' };
      }
      // get
      if (op === 'get') {
        if (!name) return { ok: false, name, has_key: false, output: '缺少 name 参数', error: 'missing name' };
        const has = !!(keys[name] && keys[name].length > 0);
        return { ok: true, name, has_key: has, output: name + ' API key: ' + (has ? '✅ 已配置（' + keys[name].slice(0, 8) + '...）' : '⚠️ 未配置。用 dcs_api_key set ' + name + ' <key> 设置，或 dcs_configure api_keys={"' + name + '":"<key>"}。'), error: '' };
      }
      // set
      if (op === 'set') {
        if (!name) return { ok: false, name, has_key: false, output: '缺少 name 参数', error: 'missing name' };
        if (!key) return { ok: false, name, has_key: false, output: '缺少 key 参数', error: 'missing key' };
        const next = { ...cfg };
        next.apiKeys = next.apiKeys || {};
        next.apiKeys[name] = key;
        saveCfg(next);
        return { ok: true, name, has_key: true, output: '✅ ' + name + ' API key 已保存（' + key.slice(0, 8) + '...）。调用 Genos-VEP 等技能时会自动注入。', error: '' };
      }
      // delete
      if (op === 'delete') {
        if (!name) return { ok: false, name, has_key: false, output: '缺少 name 参数', error: 'missing name' };
        const next = { ...cfg };
        if (next.apiKeys) { delete next.apiKeys[name]; saveCfg(next); }
        return { ok: true, name, has_key: false, output: '✅ ' + name + ' API key 已删除。', error: '' };
      }
      return { ok: false, output: '未知操作: ' + op, error: 'unknown op' };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_login',
    description: '登录 DCS Cloud：自动确保 dcs 二进制可用（缺失则下载校验），用个人访问令牌(PAT, 形如 dcs_pat_...)登录，可同时切换项目/片区。',
    parameters: {
      token: { type: 'string', required: true, description: 'DCS Cloud 个人访问令牌（dcs_pat_...），仅运行时使用，不落盘明文' },
      project_id: { type: 'string', description: '可选：切换到的项目 ID（如 P1871461072416366593）' },
      region: { type: 'string', description: '可选：切换到的片区（如 DCS-华南1）' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          username: { type: 'string', required: true },
          user_id: { type: 'string', required: true },
          region: { type: 'string', required: true },
          project: { type: 'string', required: true },
          binary: { type: 'string', required: true },
          error: { type: 'string' },
        },
      },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('✅ 已登录 DCS Cloud：' + v.username + '（' + v.region + '，项目 ' + v.project + '）') : ('❌ 登录失败: ' + (v.error || '')) }]; },
    },
    timeoutMs: 180000,
    async execute(args, exec) {
      const cfg = loadCfg();
      try {
        const bin = await resolveDcsBinary(cfg, exec && exec.signal);
        const r = await dcsLogin(cfg, args.token, { signal: exec && exec.signal });
        if (!r.ok) {
          return { ok: false, username: '', user_id: '', region: '', project: '', binary: bin.path, error: (r.error || r.message || '登录失败，PAT 可能无效或已过期') };
        }
        // 保存 PAT 供公共库直连检索（dcs_public_search）使用
        if (str(args.token)) { saveCfg({ ...cfg, pat: str(args.token) }); }
        if (str(args.region)) { await runDcs(cfg, ['region', 'switch', str(args.region)], { signal: exec && exec.signal, timeoutMs: 60000 }); }
        if (str(args.project_id)) { await runDcs(cfg, ['project', 'switch', '--id', str(args.project_id)], { signal: exec && exec.signal, timeoutMs: 60000 }); }
        const st = await dcsStatus(cfg, { signal: exec && exec.signal });
        const pdata = (st.project && st.project.data) || {};
        const rdata = (st.region && st.region.data) || {};
        const loginData = r.data || {};
        return {
          ok: true,
          username: loginData.username || pdata.username || '',
          user_id: String(loginData.user_id || pdata.user_id || ''),
          region: rdata.current_region || loginData.current_region || str(args.region),
          project: (pdata.current_project || loginData.current_project || str(args.project_id) || ''),
          binary: bin.path,
          error: '',
        };
      } catch (e) {
        return { ok: false, username: '', user_id: '', region: '', project: '', binary: '', error: String(e && e.message || e) };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_status',
    description: '查看 DCS Cloud 当前状态：登录用户、当前片区、当前项目、dcs 二进制来源与版本。',
    parameters: {},
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          username: { type: 'string', required: true },
          region: { type: 'string', required: true },
          project: { type: 'string', required: true },
          project_name: { type: 'string', required: true },
          binary: { type: 'string', required: true },
          error: { type: 'string' },
        },
      },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('DCS 状态：' + v.username + '｜片区 ' + v.region + '｜项目 ' + v.project + '（' + v.project_name + '）｜二进制 ' + v.binary) : ('⚠️ ' + (v.error || '未登录')) }]; },
    },
    timeoutMs: 90000,
    async execute(args, exec) {
      const cfg = loadCfg();
      try {
        const bin = await resolveDcsBinary(cfg, exec && exec.signal);
        const st = await dcsStatus(cfg, { signal: exec && exec.signal });
        const pdata = (st.project && st.project.data) || {};
        const rdata = (st.region && st.region.data) || {};
        return {
          ok: !!(pdata.current_project || rdata.current_region),
          username: pdata.username || rdata.username || '',
          region: rdata.current_region || '',
          project: pdata.current_project || '',
          project_name: pdata.current_project_name || '',
          binary: bin.path + '（' + bin.source + '，' + DCS_VERSION + '）',
          error: '',
        };
      } catch (e) {
        return { ok: false, username: '', region: '', project: '', project_name: '', binary: '', error: String(e && e.message || e) };
      }
    },
  }));

  // ---------- 数据（容器 /public 优先） ----------

  ctx.tools.register(defineTool({
    name: 'dcs_data_ls',
    description: '列出 DCS Cloud 数据管理目录（/Files 文件结构）内容。文件系统根目录含 ReferenceData/RawData/ManualData/ResultData 等。',
    parameters: {
      path: { type: 'string', description: '目录或文件路径，如 /Files、/Files/RawData；省略则列当前目录' },
      long: { type: 'boolean', description: '是否显示详细信息（大小/时间/创建者）' },
      time_sort: { type: 'boolean', description: '按时间倒序排序' },
      size_sort: { type: 'boolean', description: '按文件大小排序' },
      page: { type: 'integer', description: '页码，默认 1' },
      page_size: { type: 'integer', description: '每页条数，最大 200，默认 20' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '📁 数据目录：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    async execute(args, exec) {
      return execCli(exec, () => {
        const a = ['data', 'ls'];
        if (str(args.path)) a.push(str(args.path));
        if (args.long) a.push('-l');
        if (args.time_sort) a.push('-t');
        if (args.size_sort) a.push('-s');
        if (args.page) a.push('--page', String(args.page));
        if (args.page_size) a.push('--page-size', String(args.page_size));
        return a;
      }, 120000);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_data_find',
    description: '在 DCS Cloud 数据管理（/Files 文件结构）里按条件检索文件（平台项目/样本数据）。支持名称通配、类型、大小、实体/样本/SN/任务/流程/创建者/时间过滤。',
    parameters: {
      path: { type: 'string', description: '搜索路径，默认当前目录（可指定 /Files 全库）' },
      name: { type: 'string', description: '名称过滤，支持通配符，如 *.fq.gz、*.csv' },
      type: { type: 'string', enum: ['f', 'd'], description: '按类型过滤：f=文件，d=目录' },
      size: { type: 'string', description: '按大小过滤，如 +100M、-1G' },
      entity: { type: 'string', description: '按实体 ID 过滤' },
      sample: { type: 'string', description: '按样本 ID 过滤' },
      sn: { type: 'string', description: '按 SN 编号过滤' },
      task: { type: 'string', description: '按任务 ID 过滤' },
      workflow: { type: 'string', description: '按流程名（可带版本）过滤' },
      user: { type: 'string', description: '按创建者过滤' },
      time: { type: 'string', description: '按时间过滤，如 2024-01-01~2024-12-31 或单日' },
      page: { type: 'integer', description: '页码，默认 1' },
      page_size: { type: 'integer', description: '每页条数，最大 200' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '🔍 检索结果：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    async execute(args, exec) {
      return execCli(exec, () => {
        const a = ['data', 'find'];
        if (str(args.path)) a.push('-p', str(args.path));
        if (str(args.name)) a.push('-n', str(args.name));
        if (args.type) a.push('-t', args.type);
        if (str(args.size)) a.push('-s', str(args.size));
        if (str(args.entity)) a.push('-e', str(args.entity));
        if (str(args.sample)) a.push('-a', str(args.sample));
        if (str(args.sn)) a.push('-N', str(args.sn));
        if (str(args.task)) a.push('-k', str(args.task));
        if (str(args.workflow)) a.push('-w', str(args.workflow));
        if (str(args.user)) a.push('-u', str(args.user));
        if (str(args.time)) a.push('-T', str(args.time));
        if (args.page) a.push('--page', String(args.page));
        if (args.page_size) a.push('--page-size', String(args.page_size));
        return a;
      }, 120000);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_data_info',
    description: '查看 DCS Cloud 文件/目录的详细元数据（大小、时间、样本、SN 等）。',
    parameters: { path: { type: 'string', required: true, description: '文件或目录路径，如 /Files/RawData/V350099495_L04_read_2.fq.gz' } },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '📄 元数据：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    async execute(args, exec) { return execCli(exec, () => ['data', 'info', '-p', str(args.path)], 60000); },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_data_download',
    description: '从 DCS Cloud 下载文件/目录到本机（第二优先级：外部/本地数据获取，或拉取结果）。web 模式仅支持 ≤200MB 文本类文件；大文件用 ossutil/raysync 等。',
    parameters: {
      path: { type: 'string', required: true, description: '云平台路径，多个用英文逗号分隔' },
      target: { type: 'string', description: '本机目标目录（可选，默认当前目录）' },
      type: { type: 'string', enum: ['web', 'raysync', 'ossutil', 'tosutil', 'obsutil', 'aws', 'mount'], description: '下载方式，默认 web' },
      mode: { type: 'string', enum: ['client', 'command'], description: 'raysync 模式：command（默认）/client' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '⬇️ 下载：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 600000,
    async execute(args, exec) {
      return execCli(exec, () => {
        const a = ['data', 'download', '-T', str(args.type) || 'web', '-p', str(args.path)];
        if (str(args.target)) a.push('-t', str(args.target));
        if (str(args.mode)) a.push('-m', str(args.mode));
        return a;
      }, 600000);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_data_upload',
    description: '上传数据到 DCS Cloud 数据管理（/Files）。两种模式：本机文件用 type=web（服务端上传，≤100MB）或 type=oss（云存储 SDK 直传，大文件推荐）；集群文件/批量导入用 cluster_mode=other（多路径逗号分隔）或 cluster_mode=batch_import（批量导入表）。',
    parameters: {
      path: { type: 'string', required: true, description: '待上传路径：本机文件路径（type 模式），或集群文件路径/批量导入表路径（cluster_mode 模式）' },
      target: { type: 'string', required: true, description: '云平台目标目录，以 /Files 开头，如 /Files/RawData' },
      type: { type: 'string', enum: ['web', 'oss'], description: '本机文件上传：web=服务端 multipart（≤100MB），oss=云存储 SDK 直传（大文件推荐）' },
      cluster_mode: { type: 'string', enum: ['other', 'batch_import'], description: '集群上传：other=集群文件（逗号分隔多路径），batch_import=批量导入表' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '⬆️ 上传：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 600000,
    async execute(args, exec) {
      return execCli(exec, () => {
        const a = ['data', 'upload'];
        if (str(args.type)) a.push('--type', str(args.type));
        if (str(args.cluster_mode)) a.push('--cluster-mode', str(args.cluster_mode));
        a.push('-p', str(args.path), '-t', str(args.target));
        return a;
      }, 600000);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_data_push',
    description: '把在线容器内（/work）的分析结果推送到 DCS Cloud 数据管理（/Files），用于归档结果、供后续复用或交付。',
    parameters: {
      src: { type: 'string', required: true, description: '容器内源路径，如 /work/{user}/proj/output/result.csv' },
      dest: { type: 'string', required: true, description: '云平台目标路径，以 /Files 开头' },
      table: { type: 'boolean', description: '表格模式（-b），按行展示推送记录' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '📤 推送结果：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 300000,
    async execute(args, exec) {
      return execCli(exec, () => {
        const a = ['data', 'push', str(args.src), str(args.dest)];
        if (args.table) a.push('-b');
        return a;
      }, 300000);
    },
  }));

  // ---------- Genpilot 流程 / 脚本复用 ----------

  ctx.tools.register(defineTool({
    name: 'dcs_workflow_search',
    description: '检索 DCS Cloud 工作流（WDL 流程，即 Genpilot 现有脚本/方案，第一优先级复用）。-p 查公共库（官方/共享流程），默认查项目内流程；支持按名称/标签/创建者过滤。',
    parameters: {
      name: { type: 'string', description: '流程名，模糊匹配' },
      public: { type: 'boolean', description: 'true=查公共库（官方 DCS 流程），false=查项目内' },
      tag: { type: 'string', description: '按标签过滤，多个用逗号分隔' },
      user: { type: 'string', description: '按创建者过滤' },
      all: { type: 'boolean', description: '查询全部（自动翻页）' },
      page: { type: 'integer', description: '页码，默认 1' },
      page_size: { type: 'integer', description: '每页条数，最大 200' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '🧬 工作流/脚本：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    async execute(args, exec) {
      return execCli(exec, () => {
        const a = ['workflow', 'ls'];
        if (str(args.name)) a.push('-n', str(args.name));
        if (args.public) a.push('-p');
        if (str(args.tag)) a.push('-t', str(args.tag));
        if (str(args.user)) a.push('-u', str(args.user));
        if (args.all) a.push('-a');
        if (args.page) a.push('--page', String(args.page));
        if (args.page_size) a.push('--page-size', String(args.page_size));
        return a;
      }, 120000);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_workflow_info',
    description: '查看指定工作流的完整信息：流程详情 + 参数规格(check_parameter) + 多步执行规划(plan)。这是复用 Genpilot 现有脚本方案的核心入口，参数规格可直接用于 dcs_workflow_run 投递。',
    parameters: {
      name: { type: 'string', required: true, description: '工作流名称，如 SAW-ST-lasso、Stereo_Miner_Clustering' },
      version: { type: 'string', description: '指定版本，默认最新' },
      public: { type: 'boolean', description: 'true=查公共库，false=查项目内' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '🧬 工作流详情：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 180000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const sig = exec && exec.signal;
      // 仅 workflow info 支持 -p/--public；check_parameter 与 plan 只接受 -n/-v
      const base = ['-n', str(args.name)];
      if (str(args.version)) base.push('-v', str(args.version));
      const infoArgs = [...base];
      if (args.public) infoArgs.push('-p');
      try {
        const [info, param, plan] = await Promise.all([
          runDcs(cfg, ['workflow', 'info', ...infoArgs], { signal: sig, timeoutMs: 90000 }),
          runDcs(cfg, ['workflow', 'check_parameter', ...base], { signal: sig, timeoutMs: 90000 }),
          runDcs(cfg, ['workflow', 'plan', ...base], { signal: sig, timeoutMs: 90000 }),
        ]);
        const merged = {
          info: info.ok ? info.data : null,
          parameters: (param.ok && param.data && param.data.wdl_parameter) ? param.data.wdl_parameter : null,
          plan: (plan.ok && plan.data && plan.data.wdl_plan) ? plan.data.wdl_plan : null,
        };
        const text = JSON.stringify(merged, null, 2);
        let truncated = false;
        let out = text;
        if (out.length > OUTPUT_CAP) { out = out.slice(0, OUTPUT_CAP) + '\n…（已截断）'; truncated = true; }
        return { ok: info.ok || param.ok || plan.ok, output: out, truncated, error: info.ok ? '' : (info.error || '') };
      } catch (e) {
        return { ok: false, output: String(e && e.message || e), truncated: false, error: String(e && e.message || e) };
      }
    },
  }));

  // ---------- 执行：在线 / 离线 ----------

  ctx.tools.register(defineTool({
    name: 'dcs_terminal_exec',
    description: '在 DCS Cloud 在线容器（Genpilot 智能分析环境）里执行 shell 命令 —— 用于简单/交互式任务在线运行。容器未开时自动打开后重试一次。',
    parameters: {
      command: { type: 'string', required: true, description: '要在容器内执行的 shell 命令，如 "ls /work"、"python3 analysis.py"' },
      cwd: { type: 'string', description: '容器内工作目录，默认 /work/{用户名}' },
      timeout: { type: 'integer', description: '命令超时（秒），默认 120' },
      auto_open: { type: 'boolean', description: '容器未开时是否自动打开（默认 true）' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '🖥️ 在线执行：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 300000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const sig = exec && exec.signal;
      const build = () => {
        const a = ['terminal', 'exec', '-c', str(args.command)];
        if (str(args.cwd)) a.push('--cwd', str(args.cwd));
        if (args.timeout) a.push('--timeout', String(args.timeout));
        return a;
      };
      try {
        const r = await termExec(cfg, build(), { signal: sig, timeoutMs: (args.timeout || 120) * 1000 + 30000, autoOpen: args.auto_open !== false });
        return cliView(r);
      } catch (e) {
        return { ok: false, error: String(e && e.message || e), output: String(e && e.message || e), truncated: false };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_terminal_file',
    description: '在 DCS Cloud 在线容器里读写/编辑/上传下载文件 —— 用于在线环境里编写新脚本（第二优先级：重写脚本）或读写结果文件。',
    parameters: {
      op: { type: 'string', enum: ['read', 'create', 'edit', 'upload', 'download'], required: true, description: '操作：read 读文件 / create 创建写文件 / edit 精确替换编辑 / upload 本机上传 / download 下载到本机' },
      path: { type: 'string', required: true, description: '容器内绝对路径（read/create/edit 必填；download 为源路径）' },
      content: { type: 'string', description: 'create 时的文件内容' },
      old: { type: 'string', description: 'edit 时要替换的原文' },
      new: { type: 'string', description: 'edit 时的替换文本（可为空删除）' },
      replace_all: { type: 'boolean', description: 'edit 时是否替换全部匹配' },
      local: { type: 'string', description: 'upload 的本机源文件 / download 的本机目标文件' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '📝 容器文件：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 300000,
    async execute(args, exec) {
      return execCli(exec, () => {
        const op = args.op;
        const a = ['terminal', op];
        if (op === 'read' || op === 'create' || op === 'edit' || op === 'download') a.push('-p', str(args.path));
        if (op === 'create') a.push('-c', str(args.content));
        if (op === 'edit') { a.push('--old', str(args.old)); a.push('--new', str(args.new)); if (args.replace_all) a.push('--replace-all'); }
        if (op === 'upload') { a.push('-p', str(args.path)); a.push('-f', str(args.local)); }
        if (op === 'download') { a.push('-t', str(args.local)); }
        return a;
      }, 300000);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_offline_run',
    description: '投递 DCS Cloud 离线分析任务（shell 脚本）—— 用于耗时久、资源大、需并行的任务。支持单命令(-i)或批量文件(-p 每行一条任务，实现并行投递)。',
    parameters: {
      command: { type: 'string', description: '要执行的命令（如 "sh /data/work/test.sh"）；与 batch_file 二选一' },
      batch_file: { type: 'string', description: '批量投递文件路径，每行一条命令生成一个任务（并行）' },
      resource: { type: 'string', required: true, description: '资源规格，如 vf=32g,num_proc=8[,gpu=L4]（兼容 "4c 16g" 等自然语言，自动转换）' },
      image: { type: 'string', required: true, description: '容器镜像 registry 路径（如 stereonote/stereonote_conda_jupyterhub:latest）' },
      name: { type: 'string', description: '任务名称' },
      output_path: { type: 'string', description: '结果输出路径，以 /Files 开头' },
      mount: { type: 'string', description: '挂载数据路径，多个用逗号分隔' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          task_id: { type: 'string', description: '单命令投递的任务 ID（batch_file 时为空，见 task_ids）' },
          task_ids: { type: 'array', items: { type: 'string' }, description: '批量文件投递产生的任务 ID 列表（每条一行任务）' },
          output: { type: 'string', required: true },
          truncated: { type: 'boolean', required: true },
          error: { type: 'string' },
        },
      },
      render(args, v) { return [{ type: 'text', text: (v.ok ? ('🚀 离线任务已投递' + (v.task_id ? '：' + v.task_id : '') + '\n') : '❌ 投递失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 180000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const sig = exec && exec.signal;
      const build = () => {
        const a = ['analysis', 'run'];
        if (str(args.command)) a.push('-i', str(args.command));
        if (str(args.batch_file)) a.push('-p', str(args.batch_file));
        a.push('-l', normalizeDcsResource(args.resource));
        a.push('--image', str(args.image));
        if (str(args.name)) a.push('-n', str(args.name));
        if (str(args.output_path)) a.push('-o', str(args.output_path));
        if (str(args.mount)) a.push('-m', str(args.mount));
        return a;
      };
      try {
        const r = await runDcs(cfg, build(), { signal: sig, timeoutMs: 180000 });
        if (!r.ok) {
          return { ok: false, task_id: '', task_ids: [], error: r.error || r.message || '投递失败', output: r.error || r.message || '', truncated: false };
        }
        // 解析返回的 task_id（单命令 data.task_id / data 数组；批量 file 可能返回数组或空）
        let taskIds = [];
        const d = r.data;
        if (d) {
          if (Array.isArray(d)) {
            for (const item of d) {
              if (item && typeof item === 'object') {
                const t = item.task_id || item.taskId || item.id;
                if (t) taskIds.push(String(t));
              } else if (item) taskIds.push(String(item));
            }
          } else if (typeof d === 'object') {
            const t = d.task_id || d.taskId || d.id || d.parent_task_id;
            if (t) taskIds.push(String(t));
          }
        }
        // 文本兜底：从 output 文本里抓 task_id（batch 文件每条一行）
        if (!taskIds.length && r.raw) {
          const m = String(r.raw).match(/\d{16,}/g);
          if (m) taskIds = m;
        }
        const text = cliView(r).output;
        return {
          ok: true,
          task_id: taskIds[0] || '',
          task_ids: taskIds,
          output: text,
          truncated: text.length > OUTPUT_CAP,
          error: r.error || '',
        };
      } catch (e) {
        return { ok: false, task_id: '', task_ids: [], error: String(e && e.message || e), output: String(e && e.message || e), truncated: false };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_workflow_run',
    description: '投递 DCS Cloud 的 WDL 工作流任务（复用 Genpilot 现有流程）。用 -j json 文件、-e entity + -i 键值对、或 --table 表格三种方式传参。',
    parameters: {
      name: { type: 'string', required: true, description: '工作流名称' },
      version: { type: 'string', description: '流程版本，默认最新' },
      entity: { type: 'string', description: '实体 ID（用 -i 传参时必填）' },
      inputs: { type: 'array', items: { type: 'string' }, description: 'key=value 参数列表，数组参数用 JSON 形式' },
      json_file: { type: 'string', description: '参数 JSON 文件路径（含实体与参数）' },
      table: { type: 'string', description: '参数表格文件路径（.csv/.tsv/.xlsx）' },
      output_path: { type: 'string', description: '结果输出路径，以 /Files 开头' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '🚀 工作流已投递：\n' : '❌ 投递失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 180000,
    async execute(args, exec) {
      return execCli(exec, () => {
        const a = ['workflow', 'run', '-n', str(args.name)];
        if (str(args.version)) a.push('-v', str(args.version));
        if (str(args.entity)) a.push('-e', str(args.entity));
        if (Array.isArray(args.inputs)) for (const kv of args.inputs) a.push('-i', str(kv));
        if (str(args.json_file)) a.push('-j', str(args.json_file));
        if (str(args.table)) a.push('--table', str(args.table));
        if (str(args.output_path)) a.push('-o', str(args.output_path));
        return a;
      }, 180000);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_task_status',
    description: '查询 DCS Cloud 任务状态：离线分析任务(analysis)与 WDL 工作流任务(workflow)。给 task_id 查详情/日志；不给则按条件列任务。',
    parameters: {
      kind: { type: 'string', enum: ['analysis', 'workflow'], required: true, description: '任务类型：analysis=离线任务，workflow=WDL 流程任务' },
      task_id: { type: 'string', description: '任务 ID，提供则查详情与日志' },
      status: { type: 'string', description: '按状态过滤（waiting/running/completed/warning/cancel/error；仅 workflow 类型支持）' },
      name: { type: 'string', description: '按名称过滤' },
      user: { type: 'string', description: '按创建者过滤（仅 analysis 类型支持）' },
      all: { type: 'boolean', description: '查询全部' },
      with_log: { type: 'boolean', description: '查详情时是否附带日志' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '📊 任务状态：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 180000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const sig = exec && exec.signal;
      const kind = args.kind || 'analysis';
      try {
        let r;
        if (str(args.task_id)) {
          const infoCmd = kind === 'analysis' ? ['analysis', 'info', str(args.task_id)] : ['workflow', 'task_info', str(args.task_id)];
          const info = await runDcs(cfg, infoCmd, { signal: sig, timeoutMs: 120000 });
          let log = null;
          if (args.with_log) {
            const logCmd = kind === 'analysis' ? ['analysis', 'log', str(args.task_id)] : ['workflow', 'task_log', str(args.task_id)];
            log = await runDcs(cfg, logCmd, { signal: sig, timeoutMs: 120000 });
          }
          r = { ok: info.ok, exit_code: info.exit_code, message: info.message, error: info.error, data: { info: info.data, log: log ? log.data : null }, raw: '', stderr: '', binary: info.binary };
        } else {
          const isAnalysis = kind === 'analysis';
          const a = isAnalysis ? ['analysis', 'ls'] : ['workflow', 'tasks'];
          if (args.all) a.push('-a');
          if (str(args.name)) a.push('-n', str(args.name));
          // analysis ls 无 -s/--status；workflow tasks 无 -u/--user —— 按命令实际能力分别下发
          if (!isAnalysis && str(args.status)) a.push('-s', str(args.status));
          if (isAnalysis && str(args.user)) a.push('-u', str(args.user));
          r = await runDcs(cfg, a, { signal: sig, timeoutMs: 120000 });
        }
        return cliView(r);
      } catch (e) {
        return { ok: false, error: String(e && e.message || e), output: String(e && e.message || e), truncated: false };
      }
    },
  }));

  // ---------- 审计 / 报告 ----------

  ctx.tools.register(defineTool({
    name: 'dcs_audit_script',
    description: '在执行前静态审计脚本（shell/python/WDL）：检测危险命令、硬编码密钥、命令注入、资源与镜像配置等，输出分级审计报告（critical/high/medium/low/info）。',
    parameters: {
      path: { type: 'string', description: '本机脚本路径（与 text 二选一）' },
      text: { type: 'string', description: '脚本内容文本（与 path 二选一）' },
      type: { type: 'string', enum: ['auto', 'shell', 'python', 'wdl'], description: '脚本类型，auto 自动识别' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          language: { type: 'string', required: true },
          verdict: { type: 'string', required: true },
          summary: { type: 'json', required: true },
          output: { type: 'string', required: true },
          error: { type: 'string' },
        },
      },
      render(args, v) {
        const head = v.verdict === 'pass' ? '✅ 审计通过：' + v.output.split('\n')[0] : '⚠️ 审计发现风险项：';
        return [{ type: 'text', text: head + '\n' + v.output }];
      },
    },
    async execute(args, exec) {
      let text = str(args.text);
      let src = 'text';
      if (!text && str(args.path)) {
        try {
          const abs = isAbsolute(str(args.path)) ? str(args.path) : join(workspaceOf(exec), str(args.path));
          text = readFileSync(abs, 'utf8');
          src = abs;
        } catch (e) { return { ok: false, language: '', verdict: 'error', summary: {}, output: '读取脚本失败: ' + String(e.message), error: String(e.message) }; }
      }
      if (!text.trim()) return { ok: false, language: '', verdict: 'error', summary: {}, output: '未提供脚本内容或文件为空', error: '空输入' };
      const report = auditScript(text, args.type);
      const lines = ['脚本语言: ' + report.language, '结论: ' + report.verdictLabel, '分级统计: ' + JSON.stringify(report.summary), ''];
      for (const f of report.findings) lines.push('[' + f.severity.toUpperCase() + '] ' + f.message);
      return {
        ok: report.verdict === 'pass',
        language: report.language,
        verdict: report.verdict,
        summary: report.summary,
        output: lines.join('\n') + (report.findings.length === 0 ? '（未发现风险项）' : ''),
        error: '',
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_generate_report',
    description: '将研究方案、方法、结果、图表整理成自包含的 HTML 网页文件（图片 base64 内嵌），供用户检查。**图表混合插入**：在 results/methods/discussion 正文里用 %%chart:<id>%% 占位符把对应图插到该处；或给 figure 设 anchor=<章节名> 插到该章节末尾；未被引用的图统一放末尾「图表」section。返回网页文件路径。',
    parameters: {
      title: { type: 'string', required: true, description: '报告标题' },
      objective: { type: 'string', description: '研究目标（一句话）' },
      abstract: { type: 'string', description: '摘要（Markdown）' },
      introduction: { type: 'string', description: '引言与背景（Markdown）' },
      methods: { type: 'string', description: '研究方案与方法（Markdown），可在文中写 %%chart:fig1%% 插入图' },
      results: { type: 'string', description: '结果（Markdown），可在文中写 %%chart:fig1%% 插入图' },
      discussion: { type: 'string', description: '讨论（Markdown）' },
      references: { type: 'string', description: '参考文献（Markdown）' },
      appendix: { type: 'string', description: '附录（Markdown）' },
      figures: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', description: '图 id（用于 %%chart:<id>%% 占位符）' }, path: { type: 'string', required: true, description: '媒体路径（本机或容器 /work/...，容器自动下载；image 内嵌 base64）' }, caption: { type: 'string' }, kind: { type: 'string', description: 'image/video/audio/iframe/link，默认 image' }, anchor: { type: 'string', description: '可选：插入到指定章节名（如「结果」）末尾' } } }, description: '媒体列表，每项 {id, path, caption, kind, anchor}；正文用 %%chart:<id>%% 随文插入' },
      author: { type: 'string', description: '作者/单位' },
      output_path: { type: 'string', description: '输出网页路径（可选，默认 ~/.dsh/dcs-reports/）' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          path: { type: 'string', required: true },
          figures_embedded: { type: 'integer', required: true },
          total_figures: { type: 'integer', required: true },
          error: { type: 'string' },
        },
      },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('📄 报告已生成：' + v.path + '（内嵌图表 ' + v.figures_embedded + '/' + v.total_figures + '）') : ('❌ 生成失败: ' + (v.error || '')) }]; },
    },
    async execute(args, exec) {
      try {
        const res = await generateReport({
          title: args.title,
          objective: args.objective,
          abstract: args.abstract,
          introduction: args.introduction,
          methods: args.methods,
          results: args.results,
          discussion: args.discussion,
          references: args.references,
          appendix: args.appendix,
          figures: Array.isArray(args.figures) ? args.figures : [],
          metadata: { author: args.author, task: args.title },
        }, { workspace: workspaceOf(exec), outPath: str(args.output_path) || undefined, dcsCfg: loadCfg() });
        return { ok: true, path: res.path, figures_embedded: res.figures, total_figures: res.totalFigures, error: '' };
      } catch (e) {
        return { ok: false, path: '', figures_embedded: 0, total_figures: 0, error: String(e && e.message || e) };
      }
    },
  }));

  // ---------- 通用透传 ----------

  ctx.tools.register(defineTool({
    name: 'dcs_cli',
    description: '直接运行任意 dcs CLI 命令（高级/逃生舱）。args 传子命令与参数（不含 "dcs" 前缀），统一加 --output json。用于上述工具未覆盖的能力，如 project ls、billing ls、table ls、region ls、data copy/move/rm、terminal open/close 等。',
    parameters: {
      args: { type: 'string', required: true, description: 'dcs 子命令与参数，如 "project ls"、"billing ls"、"table ls"、"data rm /Files/old.csv"、"workflow cancel Wxxx"' },
      timeout: { type: 'integer', description: '超时秒数，默认 180' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, truncated: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '✅ dcs 执行结果：\n' : '❌ 失败：' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 300000,
    async execute(args, exec) {
      const argv = str(args.args).trim().split(/\s+/).filter(Boolean);
      if (argv.length === 0) return { ok: false, error: 'args 不能为空', output: 'args 不能为空', truncated: false };
      return execCli(exec, () => argv, (args.timeout || 180) * 1000);
    },
  }));

  // ---------- 数据库全图谱 / Genpilot 能力 ----------

  ctx.tools.register(defineTool({
    name: 'dcs_atlas',
    description: '查看 DCS Cloud「数据库全图谱」：11 个片区（BGI 中心 vs DCS 公共云）的公共库概况、官方组学工具库（8 大类）、关键词→组学类别映射、找数据/找流程优先级与 Genpilot 使用范式、DCS 原生技能库/专家库。用于快速定位该去哪里找数据、用哪个官方流程、可复用哪些 skill。',
    parameters: {
      section: { type: 'string', enum: ['all', 'regions', 'tools', 'keywords', 'datasets', 'hints', 'skills'], description: '返回哪部分：all=全部（默认），regions=片区公共库，tools=官方工具库，keywords=关键词映射，datasets=容器公共数据集，hints=检索与 Genpilot 使用范式，skills=原生技能/专家库' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: v.output }]; },
    },
    async execute(args) {
      const sec = args.section || 'all';
      const lines = [];
      const fmtRegions = () => {
        lines.push('## 片区（BGI 中心节点公共库更全）');
        lines.push('| 片区 | 类型 | 公共流程 | 官方 DCS | 备注 |');
        lines.push('| --- | --- | --- | --- | --- |');
        for (const r of REGIONS) lines.push('| ' + r.name + ' (' + r.id + ') | ' + (r.type === 'bgi-center' ? 'BGI 中心' : 'DCS 公共云') + ' | ' + (r.publicWorkflows == null ? '需建项目' : r.publicWorkflows) + ' | ' + (r.officialDcs == null ? '-' : r.officialDcs) + ' | ' + r.note + ' |');
      };
      const fmtTools = () => {
        lines.push('## 官方组学工具库（dcs project omics_tools）');
        for (const c of OMICS_TOOLS) {
          lines.push('### ' + c.label + '（' + c.code + '，' + c.tools.length + ' 个官方流程）');
          lines.push(c.tools.length ? c.tools.join(', ') : '（暂无官方流程）');
        }
      };
      const fmtKeywords = () => {
        lines.push('## 关键词 → 组学类别映射');
        for (const k of KEYWORD_TO_CATEGORY) lines.push('- ' + k.category + ' ← ' + k.keywords.join('/'));
      };
      const fmtDatasets = () => {
        lines.push('## 在线容器公共数据集（/public/database/CNGBdb）');
        lines.push('| 编号 | 名称 | 说明 |');
        lines.push('| --- | --- | --- |');
        for (const d of PUBLIC_DATASETS) lines.push('| ' + d.code + ' | ' + d.name + ' | ' + d.note + ' |');
      };
      const fmtSkills = () => {
        lines.push('## DCS Genpilot 原生技能库（容器 ' + SKILLS_BASE + '）');
        lines.push('顶级目录：' + SKILL_TOP_DIRS.join(' / '));
        lines.push('技能总数索引 skills_snapshot.json（973 条）。专家（' + EXPERT_BASE + '）：' + EXPERTS.join(' / '));
        lines.push('用法：发起分析前用 dcs_skills_list / dcs_skill_read / dcs_experts_list / dcs_expert_read 发现并复用 DCS 原生 skill / 专家模板。');
      };
      if (sec === 'all' || sec === 'regions') fmtRegions();
      if (sec === 'all' || sec === 'tools') { if (sec === 'all') lines.push(''); fmtTools(); }
      if (sec === 'all' || sec === 'keywords') { if (sec === 'all') lines.push(''); fmtKeywords(); }
      if (sec === 'all' || sec === 'datasets') { if (sec === 'all') lines.push(''); fmtDatasets(); }
      if (sec === 'all' || sec === 'skills') { if (sec === 'all') lines.push(''); fmtSkills(); }
      if (sec === 'all' || sec === 'hints') { if (sec === 'all') lines.push(''); lines.push('## 检索优先级\n' + searchHints()); lines.push('\n## Genpilot 使用范式\n' + genpilotHints()); lines.push('\n## 容器公共数据\n' + containerHints()); lines.push('\n## DCS 原生技能/专家\n' + skillsHints()); }
      return { ok: true, output: lines.join('\n'), error: '' };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_public_search',
    description: '搜索 DCS 公共库元数据（公共数据/公共流程/公共项目/AI模型），用于容器 /public 里没有的资源或跨片区检索。走公共库 REST API，按名称关键词检索，返回 resType 区分 dataset/workflow/proj/img/ai_model。需先 dcs_login（PAT）。',
    parameters: {
      name: { type: 'string', required: true, description: '名称关键词，如 "embryo"、"mouse"、"MOSTA"、"时空"、"Stereo-seq"' },
      page: { type: 'integer', description: '页码，默认 1' },
      page_size: { type: 'integer', description: '每页条数，默认 30' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, total: { type: 'integer', required: true }, output: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '🔍 公共库检索（共 ' + v.total + ' 条）：\n' : '❌ ' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 90000,
    async execute(args, exec) {
      const cfg = loadCfg();
      try {
        const r = await publicSearch(cfg, str(args.name), { page: args.page, pageSize: args.page_size || 30, signal: exec && exec.signal });
        const lines = r.records.map((x) => {
          const t = { dataset: '📊数据集', workflow: '🧬流程', proj: '📁项目', img: '🖼️镜像', ai_model: '🤖AI模型', tool_interactive: '🛠️工具', workspace_notebook: '📓notebook' }[x.resType] || x.resType;
          return t + ' ' + x.name + '（zone=' + x.zone + '，id=' + x.id + '）' + (x.intro ? ' — ' + x.intro : '');
        });
        return { ok: true, total: r.total, output: lines.join('\n') || '（无结果）', error: '' };
      } catch (e) {
        return { ok: false, total: 0, output: '', error: String(e && e.message || e) };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_container_ls',
    description: '列出 DCS 在线容器内的目录/文件（找公共数据的第一优先级入口）。默认列 /public（公共库挂载：database/demo/reference/tools）；也可列 /work/{user} 看已有分析、或 /public/database/CNGBdb/pub/SciRAID/stomics/ 看公共数据集。',
    parameters: {
      path: { type: 'string', description: '容器内路径，默认 /public' },
      max_depth: { type: 'integer', description: 'find 递归深度（可选，默认只列一层）' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '📁 容器目录：\n' : '❌ ' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 120000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const p = str(args.path) || '/public';
      const depth = args.max_depth ? ' -maxdepth ' + Math.max(1, Math.floor(args.max_depth)) : '';
      const cmd = args.max_depth ? 'find ' + p + depth + ' 2>/dev/null | head -100' : 'ls -la ' + p + ' 2>/dev/null';
      try {
        const r = await termExec(cfg, ['terminal', 'exec', '-c', cmd, '--timeout', '100'], { signal: exec && exec.signal, timeoutMs: 110000 });
        const out = r.ok ? termStdout(r) : (r.error || r.stderr || '');
        return { ok: r.ok, output: out.slice(0, OUTPUT_CAP), error: r.ok ? '' : (r.error || '') };
      } catch (e) {
        return { ok: false, output: '', error: String(e && e.message || e) };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_data_inspect',
    description: '快速查看容器内 h5ad（AnnData 单细胞/时空数据）或 csv 的结构：维度、obs 列（细胞类型 annotation / 脑区 region 等唯一值）、var 列（基因）。用 h5py 只读元数据，不加载表达矩阵，速度快。',
    parameters: {
      path: { type: 'string', required: true, description: '容器内 h5ad 或 csv 绝对路径，如 /public/.../E16.5_E1S3_cell_bin_whole_brain.h5ad' },
      obs_columns: { type: 'string', description: '要看的 obs 列（逗号分隔），默认 annotation,region,Slice' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '🔬 数据结构：\n' : '❌ ' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 240000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const p = str(args.path);
      const cols = (str(args.obs_columns) || 'annotation,region,Slice').split(',').map((s) => s.trim()).filter(Boolean);
      const pyCols = cols.map((c) => JSON.stringify(c)).join(',');
      // csv/tsv：pandas 快速探查（抽样前 10000 行）；h5ad：h5py 只读元数据，不加载表达矩阵
      const isTabular = /\.(csv|tsv|txt)$/i.test(p);
      const py = isTabular ? `import pandas as pd
p=${JSON.stringify(p)}
df=pd.read_csv(p, nrows=10000)
print('shape (rows sampled):', df.shape)
print('columns:', list(df.columns))
print('dtypes:', {k: str(v) for k, v in df.dtypes.items()})
for k in [${pyCols}]:
    if k in df.columns:
        vc=df[k].astype(str).value_counts()
        print('col['+k+'] nunique='+str(len(vc))+' -> '+str([(str(i),int(c)) for i,c in vc.head(20).items()]))
`
        : `import h5py, numpy as np
p=${JSON.stringify(p)}
f=h5py.File(p,'r')
print('shape: obs=', f['obs']['_index'].shape[0], 'var=', f['var']['_index'].shape[0])
print('obs keys:', list(f['obs'].keys()))
print('var keys:', list(f['var'].keys()))
for k in [${pyCols}]:
    if k in f['obs']:
        d=f['obs'][k]
        if 'categories' in d:
            cats=[c.decode() if isinstance(c,bytes) else c for c in d['categories'][:]]
            vals=[cats[i] for i in d['codes'][:]]
        else:
            v=d[()]
            vals=[x.decode() if isinstance(x,bytes) else x for x in v]
        uniq,cnt=np.unique(vals,return_counts=True)
        order=np.argsort(-cnt)
        print('obs['+k+'] nunique='+str(len(uniq))+' -> '+str([(uniq[i],int(cnt[i])) for i in order[:20]]))
f.close()`;
      try {
        const r = await termExec(cfg, ['terminal', 'exec', '-c', "python3 - <<'PYEOF'\n" + py + "\nPYEOF", '--timeout', '220'], { signal: exec && exec.signal, timeoutMs: 230000 });
        const out = r.ok ? termStdout(r) : (r.error || r.stderr || '');
        return { ok: r.ok, output: out.slice(0, OUTPUT_CAP), error: r.ok ? '' : (r.error || '') };
      } catch (e) {
        return { ok: false, output: '', error: String(e && e.message || e) };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_find_results',
    description: '查找 DCS 在线容器 /work/{user} 下已有的分析结果目录/文件（Genpilot 或之前会话已跑的分析），避免重复计算。返回目录树与 csv/png/html 产物清单。',
    parameters: {
      user: { type: 'string', description: '用户名，默认当前用户' },
      keyword: { type: 'string', description: '按关键词过滤目录名，如 RNA、variant、brain' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '📂 已有分析结果：\n' : '❌ ' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 120000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const u = str(args.user) || (await currentUsername(cfg, exec && exec.signal)) || '';
      const kw = str(args.keyword);
      const base = u ? '/work/' + u : '/work';
      const cmd = "find " + base + " -maxdepth 2 -type d 2>/dev/null | grep -v __pycache__ | head -60; echo '--- 产物文件(csv/png/html) ---'; find " + base + " -maxdepth 3 -type f \\( -name '*.csv' -o -name '*.png' -o -name '*.html' -o -name '*.npz' \\) 2>/dev/null | head -40";
      try {
        const r = await termExec(cfg, ['terminal', 'exec', '-c', cmd, '--timeout', '100'], { signal: exec && exec.signal, timeoutMs: 110000 });
        let out = r.ok ? termStdout(r) : (r.error || r.stderr || '');
        if (kw && r.ok) { out = out.split('\n').filter((l) => l.toLowerCase().includes(kw.toLowerCase())).join('\n') || '（无匹配 ' + kw + '）'; }
        return { ok: r.ok, output: out.slice(0, OUTPUT_CAP), error: r.ok ? '' : (r.error || '') };
      } catch (e) {
        return { ok: false, output: '', error: String(e && e.message || e) };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_llm',
    description: '调用 DCS 系统 Genpilot LLM（对话模型，如 deepseek-v4-pro，自动选模型）做变异解读、文献综合、方案撰写、论文润色等。在 DCS 在线容器内执行，鉴权由系统自动注入 LLM_API_KEY。注意：Genpilot chat 是对话模型，与 Genos 预测模型（VCF→RNA 信号，1.2B，需 dcs_api_key 配置）不同。',
    parameters: {
      prompt: { type: 'string', required: true, description: '用户提问/要完成的任务' },
      system: { type: 'string', description: '系统提示词（角色设定），可选' },
      model: { type: 'string', description: '模型名，可选；缺省由系统自动选择（默认 deepseek-v4-pro）' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          model: { type: 'string', required: true },
          content: { type: 'string', required: true },
          error: { type: 'string' },
        },
      },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('🤖 Genpilot LLM：\n' + v.content) : ('❌ 失败: ' + (v.error || '')) }]; },
    },
    timeoutMs: 360000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const r = await genpilotChat(cfg, exec && exec.signal, str(args.prompt), str(args.system), str(args.model));
      return { ok: r.ok, model: r.model, content: r.content, error: r.error };
    },
  }));

  // ---------- 执行中自批评 / 自适应 refine（Biomni 式长 loop 差距 1+3） ----------

  ctx.tools.register(defineTool({
    name: 'dcs_self_review',
    description: 'DCS Harness v2·自批评节点（Biomni 式执行中自评/自适应 refine）：输入模块目标 + 产物清单，自动 ①采集证据（容器产物文件存在性/大小/行数，本机文件 size）→ ②调 Genpilot LLM 自评 → ③输出 {verdict: pass/revise/rerun, evidence, risks, nextAction}。传 project_id/module_id/run_id 时把 verdict 与 OAA 三段式自动持久化进该运行（ReAct 循环在模块粒度上成立）。在失败/数据异常/长任务完成等关键节点后调用：verdict=pass 继续下一模块、revise 调整后续模块 desc/方案、rerun 用 dcs_run_start 重跑 v2。',
    parameters: {
      goal: { type: 'string', required: true, description: '本模块/本步的目标与验收标准（要完成什么、怎样算成功）' },
      artifacts: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { path: { type: 'string', description: '产物路径（容器 /work/... /data/... 或本机绝对路径）' }, note: { type: 'string', description: '该产物用途说明（可选）' } } }, description: '本次运行产生的产物清单 [{path, note}]，自动采集文件证据' },
      evidence: { type: 'string', description: '额外证据（统计量/显著性/日志摘要/报错信息等），与产物采集合并作为自评输入' },
      project_id: { type: 'string', description: '可选：所属项目 ID。提供时自评结果自动写入对应运行的 oaa + selfReview 字段' },
      module_id: { type: 'string', description: '可选：模块 ID（与 project_id 同传）' },
      run_id: { type: 'string', description: '可选：运行 ID（与 project_id 同传）' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          verdict: { type: 'string', required: true, description: 'pass 通过（继续下一模块）/ revise 需调整方案 / rerun 需重跑' },
          evidence: { type: 'string', required: true, description: '自评依据（产物证据 + 判据）' },
          risks: { type: 'array', items: { type: 'string' }, description: '发现的风险/隐患' },
          nextAction: { type: 'string', required: true, description: '明确的下一步动作' },
          oaa: { type: 'object', additionalProperties: false, properties: { observation: { type: 'string' }, assessment: { type: 'string' }, action: { type: 'string' } }, description: 'OAA 三段式（观察/评估/行动）' },
          persisted: { type: 'boolean', description: '是否已写入运行记录（提供 project/module/run_id 时为 true）' },
          error: { type: 'string' },
        },
      },
      render(args, v) {
        if (!v.ok) return [{ type: 'text', text: '❌ 自评失败: ' + (v.error || '') }];
        const vtxt = { pass: '✅ 通过 pass', revise: '🔄 需调整 revise', rerun: '🔁 需重跑 rerun' };
        const lines = [
          '🧭 dcs_self_review 自评：' + (vtxt[v.verdict] || v.verdict),
          '依据：' + (v.evidence || '（无）'),
        ];
        if (v.risks && v.risks.length) lines.push('风险：' + v.risks.join('；'));
        lines.push('下一步：' + (v.nextAction || '（无）'));
        lines.push(v.persisted ? '（已写入运行记录 oaa + selfReview）' : '（未持久化——提供 project_id/module_id/run_id 可自动写入运行）');
        return [{ type: 'text', text: lines.join('\n') }];
      },
    },
    timeoutMs: 360000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const sig = exec && exec.signal;
      const goal = str(args.goal);
      // ① 采集产物证据（best-effort，限量 6 个，单文件 40s）
      const artLines = [];
      const artifacts = Array.isArray(args.artifacts) ? args.artifacts.slice(0, 6) : [];
      for (const a of artifacts) {
        const p = str(a && a.path);
        if (!p) continue;
        const note = str(a && a.note);
        let got = '';
        if (p.startsWith('/work/') || p.startsWith('/data/') || p.startsWith('/public/')) {
          const cmd = `f=${JSON.stringify(p)}; echo "-- $f"; if [ -f "$f" ]; then ls -la "$f"; echo "lines: $(wc -l < "$f" 2>/dev/null)"; else echo '(file not found)'; fi; if [ -d "$f" ]; then ls -la "$f" | head -12; fi`;
          const r = await termExec(cfg, ['terminal', 'exec', '-c', cmd, '--timeout', '40'], { signal: sig, timeoutMs: 60000 }).catch(() => null);
          got = (r && r.ok) ? termStdout(r).slice(0, 400) : '(容器证据采集失败，请改用 dcs_terminal_exec 自查或用 evidence 参数补充)';
        } else if (isAbsolute(p)) {
          try {
            const st = statSync(p);
            got = st.isFile() ? ('本机文件，size=' + st.size + ' bytes') : '本机目录';
          } catch {
            got = '(本机路径不存在)';
          }
        } else {
          got = '(非容器/本机路径，跳过自动采集；离线任务请用 dcs_task_status 查状态)';
        }
        artLines.push('• ' + p + (note ? '（' + note + '）' : '') + '\n  ' + got.trim());
      }
      const evidenceInput = [
        '## 模块目标与验收标准',
        goal,
        '## 产物证据',
        artLines.length ? artLines.join('\n') : '（未提供产物清单）',
        args.evidence ? ('## 额外证据\n' + str(args.evidence)) : '',
      ].filter(Boolean).join('\n\n');
      // ② 调 Genpilot LLM 自评
      const sys = '你是 DCS Harness 的「执行中自批评节点」（严谨的生信研究导师）。根据模块目标、产物证据与验收标准，判断本步执行质量。必须只输出一个严格 JSON 对象：{"verdict":"pass|revise|rerun","evidence":"一句话依据（引用具体数值/文件/错误）","risks":["风险1","风险2"],"nextAction":"明确的下一步动作"}。verdict 定义：pass=目标达成、证据充分，可进入下一模块；revise=产物存在但不达标或方法需调整，应调整后续模块描述/方案后继续；rerun=执行异常、产物缺失或数据异常，需修复后重跑（dcs_run_start 新版本 v2）。用中文回答，不要输出 JSON 以外的内容。';
      const llm = await genpilotChat(cfg, sig, evidenceInput, sys, '');
      let verdict = 'revise', evidence = '', risks = [], nextAction = '';
      if (llm.ok) {
        const parsed = extractJsonObj(llm.content);
        if (parsed && parsed.verdict) {
          verdict = ['pass', 'revise', 'rerun'].includes(String(parsed.verdict).trim()) ? String(parsed.verdict).trim() : verdict;
          evidence = String(parsed.evidence || '').slice(0, 800);
          risks = Array.isArray(parsed.risks) ? parsed.risks.map(String).slice(0, 8) : [];
          nextAction = String(parsed.nextAction || '').slice(0, 600);
        } else {
          evidence = '(LLM 输出未按 JSON 解析：' + llm.content.slice(0, 200) + ')';
        }
      } else {
        evidence = 'LLM 自评调用失败：' + llm.error;
      }
      const oaa = {
        observation: artLines.join('\n') || '（无产物采集）',
        assessment: 'verdict=' + verdict + (evidence ? '；' + evidence : ''),
        action: nextAction || ('verdict=' + verdict),
      };
      // ③ 持久化到运行记录（OAA + selfReview）
      let persisted = false;
      if (str(args.project_id) && str(args.module_id) && str(args.run_id)) {
        const pr = await updateRun(str(args.project_id), str(args.module_id), str(args.run_id),
          { oaa, selfReview: { verdict, evidence, risks, nextAction } }, sessionIdOf(exec)).catch(() => ({ ok: false }));
        persisted = pr.ok === true;
      }
      return { ok: true, verdict, evidence: evidence || '（无）', risks, nextAction: nextAction || '（无）', oaa, persisted, error: '' };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_parallel_run',
    description: '并行投递多条离线任务（Genpilot 分片并行范式：command_template 里 {i} 会被替换为 0..count-1，每条生成一个独立离线任务并立即返回）。用于把大数据量分析按 shard 并行加速。',
    parameters: {
      command_template: { type: 'string', required: true, description: '命令模板，{i} 为分片序号占位符，如 "bash /work/xuxun/proj/scripts/step.sh {i}" 或 "python3 step.py --shard {i} --total 4"' },
      count: { type: 'integer', required: true, description: '并行任务数（分片数）' },
      resource: { type: 'string', required: true, description: '资源规格，如 vf=32g,num_proc=8[,gpu=L4]（兼容 "4c 16g" 等自然语言，自动转换）' },
      image: { type: 'string', required: true, description: '镜像 registry 路径，常用 ubuntu:24.04-python3.12' },
      name: { type: 'string', description: '任务名前缀' },
      output_path: { type: 'string', description: '结果输出路径，以 /Files 开头' },
      mount: { type: 'string', description: '挂载数据路径，逗号分隔' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          submitted: { type: 'integer', required: true },
          task_ids: { type: 'array', items: { type: 'string' }, description: '投递成功的离线任务 ID 列表' },
          output: { type: 'string', required: true },
          error: { type: 'string' },
        },
      },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '🚀 已并行投递 ' + v.submitted + ' 条离线任务：\n' : '❌ 失败: ' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 600000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const sig = exec && exec.signal;
      const count = Math.max(1, Math.min(64, Math.floor(args.count || 1)));
      const tpl = str(args.command_template);
      const results = [];
      const allTaskIds = [];
      let submitted = 0;
      for (let i = 0; i < count; i++) {
        const cmd = tpl.indexOf('{i}') !== -1 ? tpl.split('{i}').join(String(i)) : tpl;
        const a = ['analysis', 'run', '-i', cmd, '-l', normalizeDcsResource(args.resource), '--image', str(args.image)];
        if (str(args.name)) a.push('-n', str(args.name) + '-' + i);
        if (str(args.output_path)) a.push('-o', str(args.output_path));
        if (str(args.mount)) a.push('-m', str(args.mount));
        try {
          const r = await runDcs(cfg, a, { signal: sig, timeoutMs: 120000 });
          const tid = r.ok && r.data ? (r.data.task_id || r.data.taskId || r.data.parent_task_id || (Array.isArray(r.data) ? r.data[0] : null) || '') : '';
          if (r.ok) { submitted++; if (tid) allTaskIds.push(String(tid)); }
          results.push('分片 ' + i + ': ' + (r.ok ? ('✅ 已投递 ' + (tid || '') + ' ' + (r.message || '')) : ('❌ ' + (r.error || r.message || '投递失败'))) + '  [' + cmd.slice(0, 60) + ']');
        } catch (e) {
          results.push('分片 ' + i + ': ❌ ' + String(e && e.message || e));
        }
      }
      return { ok: submitted === count, submitted, task_ids: allTaskIds, output: results.join('\n'), error: '' };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_plan',
    description: '生成/更新 DCS Genpilot 风格的 Plan.md 执行计划文档（步骤进度表 + 产物路径汇总 + 方法学 + 总结），作为研究方案与过程追踪的活文档。',
    parameters: {
      title: { type: 'string', required: true, description: '计划标题（研究任务名）' },
      steps: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { status: { type: 'string' }, desc: { type: 'string', required: true }, detail: { type: 'string' } } }, description: '步骤列表 [{status: 完成/进行中/待执行, desc: 步骤描述, detail: 进度详情}]' },
      outputs: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string', required: true }, path: { type: 'string' }, desc: { type: 'string' } } }, description: '产物列表 [{name, path, desc}]' },
      methodology: { type: 'string', description: '计算科学方法学概述（Markdown）' },
      summary: { type: 'string', description: '执行总结（Markdown）' },
      output_path: { type: 'string', description: '输出路径（可选，默认 ~/.dsh/dcs-plans/）' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, path: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('📝 Plan.md 已生成：' + v.path) : ('❌ 失败: ' + (v.error || '')) }]; },
    },
    async execute(args, exec) {
      try {
        const res = generatePlan({
          title: args.title,
          steps: Array.isArray(args.steps) ? args.steps : [],
          outputs: Array.isArray(args.outputs) ? args.outputs : [],
          methodology: args.methodology,
          summary: args.summary,
        }, { workspace: workspaceOf(exec), outPath: str(args.output_path) || undefined });
        return { ok: true, path: res.path, error: '' };
      } catch (e) {
        return { ok: false, path: '', error: String(e && e.message || e) };
      }
    },
  }));

  // ---------- DCS 任务面板（数据写入工具） ----------

  ctx.tools.register(defineTool({
    name: 'dcs_task_update',
    description: '创建/更新「DCS 任务」面板里的分析任务：记录分析计划、数据源、各步骤（含依赖关系=逻辑关系、状态、进度、细节）。写入后浏览器「DCS 任务」tab 实时显示。这是把分析过程可视化、追踪进展的入口。',
    parameters: {
      task_id: { type: 'string', description: '任务 ID（更新已有任务时提供；省略则新建）' },
      title: { type: 'string', required: true, description: '任务标题' },
      objective: { type: 'string', description: '研究目标（一句话）' },
      model: { type: 'string', description: 'Genpilot 模型选择：auto（自动，默认）或具体模型（deepseek-v4-pro/deepseek-v4-flash/qwen3.7-max/glm-5.2/kimi-k3 等）' },
      resources: { type: 'string', description: '计算资源规格，如 4c 16g、vf=32g,num_proc=8' },
      data_sources: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string', required: true }, path: { type: 'string' }, type: { type: 'string' }, desc: { type: 'string' } } }, description: '数据源列表 [{name, path, type, desc}]' },
      steps: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', required: true }, title: { type: 'string', required: true }, status: { type: 'string', enum: ['pending', 'running', 'done', 'failed', 'blocked'] }, detail: { type: 'string' }, dependsOn: { type: 'array', items: { type: 'string' } }, outputs: { type: 'array', items: { type: 'string' } }, deliverables: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string', required: true }, type: { type: 'string', enum: ['dataset', 'result', 'chart', 'report', 'file'] }, path: { type: 'string' }, desc: { type: 'string' } } } }, progress: { type: 'integer' } } }, description: '分析步骤列表 [{id, title, status, detail, dependsOn(依赖步骤id=逻辑关系), outputs, deliverables(交付物[{name,type(dataset/result/chart/report/file),path,desc}]), progress(0-100)}]' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          task_id: { type: 'string', required: true },
          n_steps: { type: 'integer', required: true },
          error: { type: 'string' },
        },
      },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('✅ DCS 任务已更新：' + v.task_id + '（' + v.n_steps + ' 步），浏览器「DCS 任务」tab 可查看') : ('❌ 失败: ' + (v.error || '')) }]; },
    },
    async execute(args, exec) {
      try {
        const r = await upsertTask(args, sessionIdOf(exec));
        return { ok: true, task_id: r.task.id, n_steps: r.task.steps.length, error: '' };
      } catch (e) {
        return { ok: false, task_id: '', n_steps: 0, error: String(e && e.message || e) };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_step_status',
    description: '轻量更新「DCS 任务」面板中单个步骤的状态/进度/细节（agent 逐步推进时调用，无需重传全部步骤）。',
    parameters: {
      task_id: { type: 'string', required: true, description: '任务 ID' },
      step_id: { type: 'string', required: true, description: '步骤 ID' },
      status: { type: 'string', enum: ['pending', 'running', 'done', 'failed', 'blocked'], description: '新状态' },
      detail: { type: 'string', description: '更新细节说明' },
      progress: { type: 'integer', description: '进度 0-100' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: v.ok ? '✅ 步骤状态已更新' : ('❌ ' + (v.error || '')) }]; },
    },
    async execute(args, exec) {
      const r = await updateStepStatus(str(args.task_id), str(args.step_id), args.status, args.detail, args.progress, sessionIdOf(exec));
      return { ok: r.ok, error: r.error || '' };
    },
  }));

  // ---------- DCS Harness v2.0：项目 / 模块 / 运行 / 交付 ----------

  ctx.tools.register(defineTool({
    name: 'dcs_project_update',
    description: 'DCS Harness v2：创建/更新研究项目（一个对话=一个项目）。记录研究目标、Genpilot 模型选择（auto=由 agent 决定最佳模型）、计算资源、节点（片区）、总体状态。可通过 customData.items 登记用户提供的自有数据地址（本地路径/容器路径/链接，不限类型，每项 {path, desc}，非必须）。写入后「项目管理/结果交付」窗口实时更新。',
    parameters: {
      project_id: { type: 'string', description: '项目 ID（更新已有项目时提供；省略则新建）' },
      title: { type: 'string', description: '项目标题（研究任务名）' },
      objective: { type: 'string', description: '研究目标（一句话）' },
      model: { type: 'string', description: 'Genpilot 模型选择：auto（默认，agent 决定）或 deepseek-v4-pro/deepseek-v4-flash/qwen3.7-max/glm-5.2/kimi-k3 等' },
      resources: { type: 'string', description: '计算资源规格，如 4c 16g、vf=32g,num_proc=8' },
      region: { type: 'string', description: 'DCS 节点（片区），如 BGI-时空、DCS-华南1' },
      status: { type: 'string', enum: ['pending', 'running', 'done', 'failed', 'blocked'], description: '项目总体状态' },
      customData: {
        type: 'object', additionalProperties: false,
        properties: {
          items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { path: { type: 'string', description: '数据地址（本地路径或容器 /work/... 或链接）' }, desc: { type: 'string', description: '对该数据的描述/说明' } } }, description: '用户提交的数据地址列表（每一项 {path, desc}，不限类型）' },
          note: { type: 'string', description: '数据来源/整体说明' },
        },
        description: '用户自有数据地址（非必须，可留空——无自有数据时分析将优先用 DCS 公共库 /public 数据）',
      },
      plan: {
        type: 'object', additionalProperties: false,
        properties: {
          content: { type: 'string', description: '分析计划 Markdown（步骤/方法/数据/产出）' },
          planStatus: { type: 'string', enum: ['drafting', 'awaiting_review', 'approved'], description: '计划互动状态：drafting 草拟 / awaiting_review 待用户确认 / approved 已批准' },
        },
        description: '分析计划（规划阶段产出，供用户审阅修改）',
      },
      milestones: {
        type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, status: { type: 'string', enum: ['pending', 'running', 'done', 'failed', 'blocked'] }, check: { type: 'string' } } },
        description: '里程碑质检清单（关键节点：数据就绪/主分析完成/结论可信等）',
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, project_id: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('✅ 项目已更新：' + v.project_id + '，三个窗口已同步') : ('❌ 失败: ' + (v.error || '')) }]; },
    },
    async execute(args, exec) {
      try {
        const p = await upsertProject(args, sessionIdOf(exec));
        return { ok: true, project_id: p.id, error: '' };
      } catch (e) {
        return { ok: false, project_id: '', error: String(e && e.message || e) };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_module_update',
    description: 'DCS Harness v2：在项目里创建/更新一个分析模块（任务分解的最小可执行单元，如「数据预处理」「差异表达分析」「可视化」）。模块是「项目管理」窗口的核心条目。规划时写入全部模块（含 name/desc/dependsOn）供用户批量审核；修订人工反馈时必须传 replyFeedback 说明做了什么改动（反馈自动闭环）。不要使用 isGate 闸门——计划批准后全自动执行，不再设审查节点。',
    parameters: {
      project_id: { type: 'string', required: true, description: '所属项目 ID' },
      module_id: { type: 'string', description: '模块 ID（更新已有模块时提供；省略则新建）' },
      name: { type: 'string', description: '模块名称' },
      desc: { type: 'string', description: '模块说明（做什么/用什么方法）' },
      status: { type: 'string', enum: ['pending', 'running', 'done', 'failed', 'blocked'], description: '模块状态（通常由运行状态驱动，手动设置仅用于初始化）' },
      isGate: { type: 'boolean', description: '已弃用：计划批准后全自动执行，不要设置闸门节点（仅为兼容旧数据保留）' },
      review: { type: 'string', enum: ['none', 'gate', 'reviewing', 'approved', 'rejected'], description: '审阅状态（一般由用户在窗口操作产生，AI 仅在修订后把 rejected/gate 的模块改回 gate 待复审）' },
      dependsOn: { type: 'array', items: { type: 'string' }, description: '依赖的模块 ID 列表（声明此模块需在哪些模块完成后才能开始）' },
      replyFeedback: { type: 'string', description: '对人工反馈的修订说明（做了什么改动、为什么；传入后该模块未处理的用户反馈自动标记为已处理，并在时间线留痕 actor=ai）' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, module_id: { type: 'string', required: true }, resolved: { type: 'number' }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('✅ 模块已更新：' + v.module_id + (v.resolved ? '（闭环 ' + v.resolved + ' 条人工反馈）' : '')) : ('❌ 失败: ' + (v.error || '')) }]; },
    },
    async execute(args, exec) {
      try {
        const sid = sessionIdOf(exec);
        const r = await upsertModule(str(args.project_id), args, sid);
        if (!r.ok) return { ok: false, module_id: '', resolved: 0, error: r.error || '' };
        let resolved = 0;
        if (args.replyFeedback !== undefined && String(args.replyFeedback).trim() !== '') {
          const rr = await replyFeedback(str(args.project_id), r.module.id, String(args.replyFeedback), sid);
          resolved = rr.ok ? (rr.resolved || 0) : 0;
        }
        return { ok: true, module_id: r.module.id, resolved, error: '' };
      } catch (e) {
        return { ok: false, module_id: '', resolved: 0, error: String(e && e.message || e) };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_module_feedback',
    description: 'DCS Harness v2：列出项目里所有「未被 AI 处理的人工反馈」。用户在「项目管理」窗口对模块提想法/纠正/提设想（propose/correct/comment/veto）后会留在这里，直到 AI 修订模块并用 dcs_module_update 的 replyFeedback 参数闭环。收到用户消息（如「继续」「处理反馈」）或准备推进任何模块前，先调用本工具检查待处理反馈。',
    parameters: {
      project_id: { type: 'string', required: true, description: '所属项目 ID' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          total: { type: 'number', required: true },
          projectTitle: { type: 'string' },
          modules: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                moduleId: { type: 'string' }, name: { type: 'string' }, desc: { type: 'string' },
                status: { type: 'string' }, review: { type: 'string' },
                pending: {
                  type: 'array',
                  items: {
                    type: 'object', additionalProperties: false,
                    properties: {
                      id: { type: 'string' }, at: { type: 'number' }, actor: { type: 'string' },
                      action: { type: 'string' }, text: { type: 'string' }, addressed: { type: 'boolean' }, replyTo: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          error: { type: 'string' },
        },
      },
      render(args, v) {
        if (!v.ok) return [{ type: 'text', text: '❌ 失败: ' + (v.error || '') }];
        return [{ type: 'text', text: v.total ? ('📥 ' + v.total + ' 条人工反馈待处理（涉及 ' + (v.modules || []).length + ' 个模块，详见结果 JSON）') : '✅ 没有待处理的人工反馈' }];
      },
    },
    async execute(args, exec) {
      try {
        const r = await listPendingFeedback(str(args.project_id), sessionIdOf(exec));
        if (!r.ok) return { ok: false, total: 0, error: r.error || '' };
        return { ok: true, total: r.total, ...r };
      } catch (e) {
        return { ok: false, total: 0, error: String(e && e.message || e) };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_plan_update',
    description: 'DCS Harness v2：更新项目「分析计划」并在规划阶段与用户互动。用户提出问题后：① 先做学术检索+数据资源调研，② 产出分析计划（步骤/方法/数据/产出），③ 用 planStatus=awaiting_review 交给用户确认，④ 用户修改后 planStatus=approved 再开始执行。同时可配套登记里程碑质检清单（关键节点 check）。',
    parameters: {
      project_id: { type: 'string', required: true, description: '所属项目 ID' },
      content: { type: 'string', description: '分析计划 Markdown（科学问题→数据→方法步骤→预期产出；含为何用 DCS 公共库而非自有数据的判断）' },
      planStatus: { type: 'string', enum: ['drafting', 'awaiting_review', 'approved'], description: '互动状态：drafting 草拟中 / awaiting_review 待用户确认 / approved 已批准可执行' },
      milestones: {
        type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, status: { type: 'string', enum: ['pending', 'running', 'done', 'failed', 'blocked'] }, check: { type: 'string' } } },
        description: '里程碑质检清单（关键节点，如：数据就绪/主分析完成/结论统计学可信）',
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, project_id: { type: 'string', required: true }, planStatus: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) {
        const label = { drafting: '草拟中', awaiting_review: '待用户确认', approved: '已批准' };
        return [{ type: 'text', text: v.ok ? ('📋 分析计划已更新：' + v.project_id + '｜状态 ' + (label[v.planStatus] || v.planStatus)) : ('❌ 失败: ' + (v.error || '')) }];
      },
    },
    async execute(args, exec) {
      try {
        const sid = sessionIdOf(exec);
        const patch = {};
        if (args.content !== undefined) patch.plan = { ...((args.plan) || {}), content: String(args.content), planStatus: args.planStatus || 'drafting' };
        else if (args.planStatus) patch.plan = { ...((args.plan) || {}), planStatus: String(args.planStatus) };
        if (Array.isArray(args.milestones)) patch.milestones = args.milestones;
        if (patch.plan === undefined && patch.milestones === undefined) {
          return { ok: false, project_id: str(args.project_id), planStatus: '', error: '至少提供 content / planStatus / milestones 之一' };
        }
        const r = await mergeProject(str(args.project_id), patch, sid);
        if (!r.ok) return { ok: false, project_id: str(args.project_id), planStatus: '', error: r.error };
        return { ok: true, project_id: str(args.project_id), planStatus: (r.project.plan && r.project.plan.planStatus) || 'drafting', error: '' };
      } catch (e) {
        return { ok: false, project_id: str(args.project_id), planStatus: '', error: String(e && e.message || e) };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_run_start',
    description: 'DCS Harness v2：启动模块的一次新运行。每次运行自动生成新版本号（v1/v2/…按时间先后排列），模块可重复运行、历史版本全部保留。可附带本次运行的代码/输入/输出文件清单与关联的 DCS 离线任务 ID。',
    parameters: {
      project_id: { type: 'string', required: true, description: '所属项目 ID' },
      module_id: { type: 'string', required: true, description: '模块 ID' },
      run_id: { type: 'string', description: '运行 ID（省略自动生成）' },
      dcs_task_ids: { type: 'array', items: { type: 'string' }, description: '本次运行关联的 DCS 离线任务 ID 列表（用于费用/状态跟踪）' },
      files: { type: 'object', additionalProperties: false, properties: { code: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, path: { type: 'string' }, desc: { type: 'string' } } } }, input: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, path: { type: 'string' }, desc: { type: 'string' } } } }, output: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, path: { type: 'string' }, desc: { type: 'string' } } } } }, description: '文件清单 {code: 代码文件, input: 输入文件, output: 输出文件}' },
      notes: { type: 'string', description: '本次运行的说明/计划' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, run_id: { type: 'string', required: true }, version: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('🚀 已启动模块运行 v' + v.version + '（' + v.run_id + '）') : ('❌ 失败: ' + (v.error || '')) }]; },
    },
    async execute(args, exec) {
      try {
        const r = await startRun(str(args.project_id), str(args.module_id), args, sessionIdOf(exec));
        return { ok: r.ok, run_id: r.ok ? r.run.id : '', version: r.ok ? r.run.version : '', error: r.error || '' };
      } catch (e) {
        return { ok: false, run_id: '', version: '', error: String(e && e.message || e) };
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_run_update',
    description: 'DCS Harness v2：更新一次模块运行的状态/进度/文件清单/资源消耗（dsh token 消耗与 DCS 任务费用，可由 agent 从 dcs_task_status / dcs 账单信息填入或留空由窗口自动拉取）/备注。**执行阶段强制写 OAA 三段式**（观察→评估→行动，Biomni 式 ReAct 自批评轨迹），可一并带 self_review（与 dcs_self_review 输出一致）。',
    parameters: {
      project_id: { type: 'string', required: true, description: '所属项目 ID' },
      module_id: { type: 'string', required: true, description: '模块 ID' },
      run_id: { type: 'string', required: true, description: '运行 ID' },
      status: { type: 'string', enum: ['pending', 'running', 'done', 'failed', 'blocked'], description: '运行状态' },
      progress: { type: 'integer', description: '进度 0-100' },
      files: { type: 'object', additionalProperties: false, properties: { code: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, path: { type: 'string' }, desc: { type: 'string' } } } }, input: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, path: { type: 'string' }, desc: { type: 'string' } } } }, output: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, path: { type: 'string' }, desc: { type: 'string' } } } } }, description: '文件清单' },
      dcs_cost: { type: 'number', description: '本次运行的 DCS 任务费用（可选，窗口也会自动拉取）' },
      dsh_tokens: { type: 'number', description: '本次运行的 dsh token 消耗（可选）' },
      notes: { type: 'string', description: '运行结果/备注' },
      oaa: { type: 'object', additionalProperties: false, properties: { observation: { type: 'string', description: '观察：产物/证据的客观事实（文件是否存在、大小/行数、显著性数值、任务状态等）' }, assessment: { type: 'string', description: '评估：对照目标判断是否达标、异常及其原因' }, action: { type: 'string', description: '行动：下一步动作（继续下一模块 / 调整后续模块 desc / 重跑 v2 等）' } }, description: '执行轨迹三段式（OAA）：观察→评估→行动。每个模块完成后必须写（可直接用 dcs_self_review 生成）' },
      self_review: { type: 'object', additionalProperties: false, properties: { verdict: { type: 'string', enum: ['pass', 'revise', 'rerun'], description: 'pass 通过 / revise 需调整 / rerun 需重跑' }, evidence: { type: 'string' }, risks: { type: 'array', items: { type: 'string' } }, nextAction: { type: 'string' } }, description: '自评结果（与 dcs_self_review 输出一致，可手填或由该工具自动写入）' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: v.ok ? '✅ 运行已更新' : ('❌ ' + (v.error || '')) }]; },
    },
    async execute(args, exec) {
      // 归一化：self_review（snake）→ selfReview（存储 camelCase），oaa 直接透传
      const patch = { ...args };
      if (args.self_review !== undefined && args.self_review !== null) patch.selfReview = args.self_review;
      const r = await updateRun(str(args.project_id), str(args.module_id), str(args.run_id), patch, sessionIdOf(exec));
      return { ok: r.ok, error: r.error || '' };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_delivery_update',
    description: 'DCS Harness v2：整体梳理并更新「结果交付」文档（论文写作逻辑，8 个章节）。每次调用递增修订号——**关键节点整体重写对应章节，不是打补丁**。在项目里程碑（如完成数据探索、完成主要分析、得出结论）时必须调用。',
    parameters: {
      project_id: { type: 'string', required: true, description: '所属项目 ID' },
      sections: {
        type: 'object', additionalProperties: false,
        properties: {
          question: { type: 'string', description: '科学问题' },
          hypothesis: { type: 'string', description: '科学假说' },
          decomposition: { type: 'string', description: '科学问题分解（可检验子问题/任务模块）' },
          data: { type: 'string', description: '原始数据（来源/路径/规模/质量）' },
          methods: { type: 'string', description: '分析方法（流程/工具/参数/统计方法，Markdown）' },
          findings: { type: 'string', description: '科学发现与主要结论（Markdown，含证据）' },
          novelty: { type: 'string', description: '创新性与已有科研结果的关系分析' },
          nextSteps: { type: 'string', description: '下一步计划与建议' },
          trajectory: { type: 'string', description: '执行轨迹（ReAct 推理图可读产物）；通常不手写，用 includeTrajectory=true 自动汇总各模块 OAA/自评/产物' },
        },
        description: '要更新的章节（只提交本次梳理覆盖的章节；未提供的保留原样）',
      },
      includeTrajectory: { type: 'boolean', description: '为 true 时自动把各模块运行的 OAA（观察→评估→行动）/自评 verdict/产物汇总成「执行轨迹」章节（Biomni 式推理图的可读产物），与手动 sections 合并，无需手写。关键节点（调整过模块、主要分析完成、收尾）建议开启。' },
      charts: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', description: '图表 id，可在正文用 %%chart:<id>%% 占位符随文插入（不写则放末尾数据图表区）' }, title: { type: 'string' }, caption: { type: 'string' }, type: { type: 'string', description: 'bar/line/pie/scatter/heatmap/stat/table/summary/image/video/audio/iframe/link/html/structure3d（image/video/audio 路径自动下载内嵌；structure3d 为可拖拽 3D 分子结构）' }, data: { type: 'json', description: '数据。bar/line: {labels, values} 或 {labels, series:[{name,values}]}；pie/scatter: [[label,value]] 或 {labels,values}；stat: {items:[{label,value,unit}]} 或 KV；summary: {labels,values} 或 KV；table: {columns:[],rows:[[..]]}；image/video/audio: 路径或 href；structure3d: {structures:[{pdb:"/work/.../x.pdb", label, color}], style:"cartoon|stick|sphere|surface", colorBy:"spectrum|chain|plddt|custom", layout:"sideBySide|overlay", height:480}（data 也可直接是单个 PDB 路径字符串；PDB 的 B-factor 列为 pLDDT 时用 colorBy:"plddt" 可视化预测置信度）' } } }, description: '多模态图表/媒体列表（type: bar/line/pie/scatter/heatmap/stat/table/summary/image/video/audio/iframe/link/html/structure3d）；正文用 %%chart:<id>%% 随文插入' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, revision: { type: 'integer', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('📄 交付文档已整体梳理，修订 v' + v.revision) : ('❌ 失败: ' + (v.error || '')) }]; },
    },
    async execute(args, exec) {
      try {
        // 防御性规范化：工具参数（args.charts 元素）可能被框架冻结（Object.freeze），
        // 任何赋值都会抛 "Cannot assign to read only property"。统一展开为新对象副本再处理。
        const payload = { ...args };
        if (Array.isArray(args && args.charts)) {
          payload.charts = args.charts.map(function (c0) {
            return { ...c0, data: (c0 && c0.data && typeof c0.data === 'object') ? { ...c0.data } : (c0 ? c0.data : undefined) };
          });
        }
        // image 类型图表：容器/远程图片路径 → 下载到本机交付目录（dcs-img-cache），charts 存本地绝对路径。
        // 前端经 /v2/chart-image 读本地文件，不再依赖 DCS 远程容器在线。
        if (Array.isArray(payload.charts)) {
          const cfg = loadCfg();
          const nextCharts = [];
          for (const c0 of payload.charts) {
            // 不原地修改图表对象（工具参数可能被冻结，c.data 赋值会抛 readonly 错误）→ 用展开创建新对象
            const c = { ...c0 };
            if (!c || c.type !== 'image' || !c.data) { nextCharts.push(c0); continue; }
            let raw = null;
            if (typeof c.data === 'string') raw = c.data;
            else if (typeof c.data === 'object') raw = c.data.path || c.data.src || c.data.url || '';
            if (!raw) { nextCharts.push(c0); continue; }
            // 已是 base64 data-URI 则保留（通常来自本地文件，可直接内嵌）
            if (raw.indexOf('data:') === 0) { nextCharts.push(c); continue; }
            let local = null;
            if (/^\/?\/*(work|data)\//.test(raw)) {
              // 容器路径 → 下载到本机永久目录
              local = await downloadContainerFile(cfg, raw.startsWith('/') ? raw : '/' + raw);
            } else if (isAbsolute(raw)) {
              // 本机绝对路径 → 直接复制进交付缓存目录（自包含：源文件被删/改名后交付仍完整）。
              // 此前错误地走 downloadContainerFile（用 dcs CLI 下载本机路径，必然失败），导致 charts 一直存外部引用。
              if (raw.startsWith(localImgDir())) { local = raw; }
              else {
                try {
                  mkdirSync(localImgDir(), { recursive: true });
                  const cached = localImgPath(raw);
                  if (!existsSync(cached)) copyFileSync(raw, cached);
                  local = cached;
                } catch { local = null; }
              }
            } else {
              const abs = join(workspaceOf(exec), raw);
              local = abs.startsWith(localImgDir()) ? abs : (await downloadContainerFile(cfg, abs));
            }
            if (local && existsSync(local)) nextCharts.push({ ...c, data: local }); // 新对象存本机绝对路径
            else nextCharts.push(c);
          }
          payload.charts = nextCharts;
        }
        const r = await updateDelivery(str(payload.project_id), payload, sessionIdOf(exec));
        return { ok: r.ok, revision: r.ok ? r.delivery.revision : 0, error: r.error || '' };
      } catch (e) {
        return { ok: false, revision: 0, error: String(e && e.message || e) };
      }
    },
  }));

  // ---------- DCS Genpilot 原生技能库 / 专家 / Genpilot 项目立项 ----------

  ctx.tools.register(defineTool({
    name: 'dcs_skills_list',
    description: '列出/检索 DCS Genpilot 平台的技能库：公共库（容器 /public/skills：dcs-skills / builtin_skills / OmicsClaw / LabClaw / bioSkills / claude-scientific-skills / ClawBio，共 973 条）+ 个人技能（容器 /work/{user}/skills/<技能名>/SKILL.md，用户自建，以 personal/ 前缀标记）。支持按范围、类别、关键词、仅原生过滤。用于在发起分析前发现可复用的 skill。',
    parameters: {
      scope: { type: 'string', description: '技能范围：public=公共库（默认）/ personal=仅个人技能（/work/{user}/skills）/ all=两者合并' },
      category: { type: 'string', description: '顶级类别过滤（公共库）：dcs-skills / builtin_skills / OmicsClaw / LabClaw / bioSkills / claude-scientific-skills / ClawBio' },
      keyword: { type: 'string', description: '在名称+描述里搜索的关键词，如 "mutation"、"batch"、"单细胞"、"VEP"' },
      native: { type: 'boolean', description: '仅显示 DCS 原生技能（dcs-skills / builtin_skills；true 时忽略 category）' },
      limit: { type: 'integer', description: '返回条数上限，默认 40' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, count: { type: 'integer', required: true }, output: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '📚 DCS 技能（' + v.count + ' 条）：\n' : '❌ ' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 120000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const scope = str(args.scope) || 'public';
      const cat = str(args.category);
      const kw = str(args.keyword).toLowerCase();
      const nativeOnly = !!args.native;
      const limit = Math.min(Math.max(1, Math.floor(args.limit || 40)), 100);
      const catalog = await skillCatalog(cfg, exec, scope !== 'public');
      if (!catalog.ok) return { ok: false, count: 0, output: catalog.error, error: catalog.error };
      let list = catalog.list;
      if (scope === 'personal') list = list.filter((x) => /^personal\//.test(x.name || ''));
      if (nativeOnly) list = list.filter((x) => /^(dcs-skills|builtin_skills)\//.test(x.name || ''));
      else if (cat) list = list.filter((x) => (x.name || '').split('/')[0] === cat);
      if (kw) list = list.filter((x) => ((x.name || '') + ' ' + (x.description || '')).toLowerCase().includes(kw));
      const total = list.length;
      const top = list.slice(0, limit);
      const lines = top.map((x) => '• ' + x.name + (x.description ? '\n    ' + x.description : ''));
      const out = (lines.join('\n') || '（无匹配）') + '\n[' + (total > limit ? ('共 ' + total + ' 条，已显示 ' + limit + ' 条') : ('共 ' + total + ' 条')) + ']';
      return { ok: true, count: total, output: out.slice(0, OUTPUT_CAP), error: '' };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_skill_read',
    description: '读取一个技能的完整内容（SKILL.md，其次 README.md/AGENTS.md）。name 支持：① 公共库路径如 "dcs-skills/genos-mutation"、"OmicsClaw/bulkrna-bulkrna-de"（相对 /public/skills）；② 个人技能 "personal/<技能名>"（容器 /work/{user}/skills/<技能名>/SKILL.md）；③ 容器绝对路径（/work/... 或 /Files/...）；④ 只传叶子名（如 "genos-mutation"）会在公共库+个人技能里自动定位。',
    parameters: {
      name: { type: 'string', required: true, description: '技能路径或名称：公共路径（dcs-skills/xxx）/ 个人（personal/xxx）/ 容器绝对路径 / 叶子名' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, path: { type: 'string', required: true }, output: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? ('📖 ' + v.path + '：\n') : '❌ ' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 120000,
    async execute(args, exec) {
      const cfg = loadCfg();
      let name = str(args.name).replace(/^\/+/, '').replace(/^public\/skills\//, '').replace(/\/+$/, '');
      if (!name) return { ok: false, path: '', output: '', error: '缺少技能名称 name' };
      // ① 容器绝对路径（个人目录 /work/{user}/skills 或 /Files 下的技能文件）→ 直接读
      if (/^(\/work\/|\/Files\/)/.test(name)) {
        const base = '/' + name;
        let got = await catInContainer(cfg, exec, base + '/SKILL.md', 20000, 60000);
        if (!got.ok) got = await catInContainer(cfg, exec, base + '/README.md', 16000, 60000);
        if (!got.ok) got = await catInContainer(cfg, exec, base + '/AGENTS.md', 16000, 60000);
        if (!got.ok) return { ok: false, path: base, output: got.error, error: got.error };
        return { ok: true, path: base, output: got.text.slice(0, OUTPUT_CAP), error: '' };
      }
      // ② 个人技能 personal/<技能名> → 容器 cwd(/work/{user})/skills/<技能名>
      if (name.indexOf('personal/') === 0) {
        const sub = name.slice('personal/'.length).replace(/\/+$/, '');
        const base = 'skills/' + sub;
        let got = await catInContainer(cfg, exec, base + '/SKILL.md', 20000, 60000);
        if (!got.ok) got = await catInContainer(cfg, exec, base + '/README.md', 16000, 60000);
        if (!got.ok) got = await catInContainer(cfg, exec, base + '/AGENTS.md', 16000, 60000);
        if (!got.ok) return { ok: false, path: base, output: got.error, error: got.error };
        return { ok: true, path: '/work/{user}/' + base, output: got.text.slice(0, OUTPUT_CAP), error: '' };
      }
      // ③ 公共库路径 / 叶子名（叶子名在公共+个人里自动定位）
      let rel = name;
      if (!name.includes('/')) {
        const catalog = await skillCatalog(cfg, exec, true);
        if (catalog.ok) {
          const leaf = name.toLowerCase();
          const hit = catalog.list.find((x) => (x.name || '').split('/').pop().toLowerCase() === leaf);
          if (hit) {
            if (/^personal\//.test(hit.name)) {
              const sub = hit.name.slice('personal/'.length);
              const base = 'skills/' + sub;
              let got = await catInContainer(cfg, exec, base + '/SKILL.md', 20000, 60000);
              if (!got.ok) got = await catInContainer(cfg, exec, base + '/README.md', 16000, 60000);
              if (!got.ok) got = await catInContainer(cfg, exec, base + '/AGENTS.md', 16000, 60000);
              if (!got.ok) return { ok: false, path: base, output: got.error, error: got.error };
              return { ok: true, path: '/work/{user}/' + base, output: got.text.slice(0, OUTPUT_CAP), error: '' };
            }
            rel = (hit.path || '').replace(SKILLS_BASE + '/', '').replace(/\/SKILL\.md$/i, '') || hit.name;
          }
        }
      }
      const base = SKILLS_BASE + '/' + rel;
      let got = await catInContainer(cfg, exec, base + '/SKILL.md', 20000, 60000);
      if (!got.ok) got = await catInContainer(cfg, exec, base + '/README.md', 16000, 60000);
      if (!got.ok) got = await catInContainer(cfg, exec, base + '/AGENTS.md', 16000, 60000);
      if (!got.ok) return { ok: false, path: base, output: got.error, error: got.error };
      return { ok: true, path: base, output: got.text.slice(0, OUTPUT_CAP), error: '' };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_experts_list',
    description: '列出 DCS Genpilot 平台的「专家」（专家库 /public/skills/experts）。每个专家含 AGENTS.md + SOUL.md 与若干子技能（SCRNA / Stereo-seq / WGS-WES-germline / CIMA / HCC-multiomics-pathology）。用于决定是否用某专家建模/指导方向。',
    parameters: {
      keyword: { type: 'string', description: '按专家名或说明关键词过滤' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '🧠 DCS 专家库：\n' : '❌ ' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 90000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const kw = str(args.keyword).toLowerCase();
      const cmd = `cd ${EXPERT_BASE} && for d in */; do n=$(basename "$d"); s=$(find "$d" -maxdepth 1 -type d | wc -l); echo "###EXPERT $n sub=$((s-1))"; if [ -f "$d/AGENTS.md" ]; then sed -n "1,10p" "$d/AGENTS.md"; fi; echo; done`;
      let r;
      try {
        r = await termExec(cfg, ['terminal', 'exec', '-c', cmd, '--timeout', '60'], { signal: exec && exec.signal, timeoutMs: 90000 });
      } catch (e) { return { ok: false, output: '', error: String(e && e.message || e) }; }
      if (!r.ok) return { ok: false, output: '', error: r.error || r.raw || '' };
      let txt = termStdout(r);
      const blocks = txt.split(/###EXPERT\s+/).filter(Boolean);
      const rendered = [];
      for (const b of blocks) {
        const first = b.split('\n')[0] || '';
        const name = first.split(' sub=')[0] || '';
        const body = b.slice(first.length).trim();
        if (kw && !((name + ' ' + body).toLowerCase().includes(kw))) continue;
        rendered.push('### ' + name + (first.indexOf('sub=') >= 0 ? first.replace(name, '') : '') + (body ? '\n' + body : ''));
      }
      return { ok: true, output: (rendered.join('\n') || '（无匹配专家）').slice(0, OUTPUT_CAP), error: '' };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_expert_read',
    description: '读取一个 DCS Genpilot 专家的完整定义（AGENTS.md + SOUL.md），可选列出其绑定的子技能。用于把专家的思路/流程模板融入本研究的方案与产出。',
    parameters: {
      name: { type: 'string', required: true, description: '专家名：scrna-seq-expert / stereo-seq-expert / wgs-wes-germline-expert / cima-expert / hcc-multiomics-pathology-expert' },
      include_skills: { type: 'boolean', description: '是否列出该专家下的子技能（默认 true）' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, output: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? '🧠 专家定义：\n' : '❌ ' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 90000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const name = str(args.name).replace(/^\/+/, '').replace(/^experts\//, '').replace(/\/+$/, '');
      if (!name) return { ok: false, output: '', error: '缺少专家名称 name' };
      const base = EXPERT_BASE + '/' + name;
      let out = '';
      const a = await catInContainer(cfg, exec, base + '/AGENTS.md', 16000, 60000);
      const s = await catInContainer(cfg, exec, base + '/SOUL.md', 16000, 60000);
      out += (a.ok ? ('===== AGENTS.md =====\n' + a.text) : '（无 AGENTS.md）') + '\n\n';
      out += (s.ok ? ('===== SOUL.md =====\n' + s.text) : '（无 SOUL.md）') + '\n';
      if (args.include_skills !== false) {
        const listCmd = 'cd ' + base + ' && for d in */; do [ -d "$d" ] && echo "  - $(basename "$d")"; done';
        const lr = await termExec(cfg, ['terminal', 'exec', '-c', listCmd, '--timeout', '40'], { signal: exec && exec.signal, timeoutMs: 60000 });
        if (lr.ok) {
          const subs = termStdout(lr).split('\n').filter(Boolean).map((x) => x.trim()).join('\n');
          if (subs) out += '\n===== 子技能 =====\n' + subs;
        }
      }
      if (!a.ok && !s.ok && out.indexOf('无') >= 0) return { ok: false, output: '', error: '未找到专家 ' + name + '（可用 dcs_experts_list 查看可选专家）' };
      return { ok: true, output: out.slice(0, OUTPUT_CAP), error: '' };
    },
  }));

  // ---------- Biomni 公共数据库查询（B1）：插件内置 dcs_db_query + 自动生成个人 skill ----------

  // 个人 skill「biomni-db-query」内容（插件内置，首次使用时自动写入容器 /work/{user}/skills/，
  // 用户零操作即可获得；生成后可被 dcs_skill_read / dcs_skill_route 读取与路由，也可自行编辑）。
  const BIOMNI_SKILL_MD = [
    '---',
    'name: biomni-db-query',
    'description: 公共生物医学数据库只读查询（Biomni 式）：UniProt 蛋白检索 / GWAS Catalog 关联 SNP / Ensembl 基因注释 / DrugBank 药物-靶点 / OpenTargets 疾病-基因-药物交叉。用法：python3 query_db.py --db uniprot --query "BRCA1 human"',
    'license: MIT',
    'metadata:',
    '  author: Biomni-inspired (Stanford Snap Lab) / DCS Harness',
    '  source: https://github.com/snap-stanford/Biomni',
    '  version: "1.0.0"',
    '---',
    '',
    '# biomni-db-query — 公共生物医学数据库查询（自动生成，可编辑）',
    '',
    '只读查询 5 个公共数据库（REST API，需容器可联网）：',
    '',
    '| db | 数据库 | 典型查询 | 返回 |',
    '|----|--------|----------|------|',
    '| uniprot | UniProt | --query "BRCA1 human" | 蛋白 ID/名称/功能 |',
    '| gwas | GWAS Catalog | --query "type 2 diabetes" | 关联 SNP/基因/效应 |',
    '| ensembl | Ensembl | --query "BRCA2" | 基因位置/转录本/物种 |',
    '| drugbank | DrugBank（公开子集） | --query "metformin" | 药物/靶点/适应症 |',
    '| opentargets | OpenTargets | --query "breast cancer" | 疾病相关基因/药物 |',
    '',
    '## 用法',
    '```bash',
    'python3 /work/{user}/skills/biomni-db-query/query_db.py --db uniprot --query "BRCA1 human" --limit 5',
    '```',
    '',
    '## 输出约定',
    '- JSON 输出：{"ok": true, "db": "...", "results": [...], "total": N}',
    '- 失败：{"ok": false, "error": "..."}',
    '- 与 DCS 计划流衔接：检索结果写进模块 run 产物（dcs_run_update files.output），供交付引用；',
    '  适合变异解读、基因-疾病关联、药物靶点挖掘等跨库交叉场景；某库不可用时改用 DCS 公共库 /public 数据。',
  ];
  const BIOMNI_SKILL_PY = [
    '#!/usr/bin/env python3',
    '"""biomni-db-query: 公共生物医学数据库只读查询（自动生成的个人 skill）。"""',
    'import argparse, json, urllib.parse, urllib.request',
    'UA = {"User-Agent": "dcs-harness-biomni-db-query/1.0"}',
    '',
    'def http_get(url, timeout=30):',
    '    req = urllib.request.Request(url, headers=UA)',
    '    with urllib.request.urlopen(req, timeout=timeout) as r:',
    '        return json.loads(r.read().decode("utf-8", "replace"))',
    '',
    'def query_uniprot(q, limit):',
    '    url = "https://rest.uniprot.org/uniprotkb/search?" + urllib.parse.urlencode({"query": q, "size": limit, "format": "json"})',
    '    d = http_get(url)',
    '    out = []',
    '    for it in d.get("results", []):',
    '        rec = (it.get("proteinDescription") or {}).get("recommendedName") or {}',
    '        out.append({"id": it.get("primaryAccession", ""), "name": (rec.get("fullName") or {}).get("value", ""),',
    '                    "gene": ((it.get("genes") or [{}])[0].get("geneName") or {}).get("value", "")})',
    '    return out',
    '',
    'def query_gwas(q, limit):',
    '    url = ("https://www.ebi.ac.uk/gwas/rest/api/efoTraits/search/findByEfoTrait?"',
    '           + urllib.parse.urlencode({"trait": q, "page": 0, "size": limit}))',
    '    d = http_get(url)',
    '    out = []',
    '    for it in (d.get("_embedded", {}).get("efoTraits", []) if isinstance(d, dict) else []):',
    '        uri = it.get("uri", "")',
    '        out.append({"id": uri.rsplit("/", 1)[-1] if uri else "", "name": it.get("trait", "")})',
    '    if not out: out.append({"note": "GWAS Catalog EFO 无结果，可改用 opentargets"})',
    '    return out',
    '',
    'def query_ensembl(q, limit):',
    '    url = ("https://rest.ensembl.org/xrefs/symbol/human/" + urllib.parse.quote(q) + "?content-type=application/json")',
    '    try:',
    '        d = http_get(url)',
    '        if not isinstance(d, list): d = []',
    '    except Exception as e:',
    '        return [{"note": "Ensembl 查询失败: " + str(e)[:120]}]',
    '    return [{"id": it.get("id", ""), "gene": it.get("display_id", q), "description": it.get("description", "")[:160]} for it in d[:limit]]',
    '',
    'def query_drugbank(q, limit):',
    '    return [{"note": "DrugBank 完整 API 需机构授权；可改用 opentargets 查询药物-靶点关联", "query": q}]',
    '',
    'def query_opentargets(q, limit):',
    '    body = {"query": "query($q: String!, $s: Int!) { search(queryString: $q, page: {size: $s}) { total hits { id entity { id name } object { id name } } } }",',
    '            "variables": {"q": q, "s": limit}}',
    '    url = "https://api.platform.opentargets.org/api/v4/graphql"',
    '    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={**UA, "Content-Type": "application/json"})',
    '    try:',
    '        with urllib.request.urlopen(req, timeout=30) as r: d = json.loads(r.read().decode("utf-8", "replace"))',
    '    except Exception as e:',
    '        return [{"note": "OpenTargets 查询失败: " + str(e)[:120]}]',
    '    return [{"id": h.get("id", ""), "type": (h.get("object") or {}).get("id", ""), "name": (h.get("entity") or {}).get("name", "")}',
    '            for h in ((d.get("data", {}).get("search", {}).get("hits")) or [])]',
    '',
    'DBS = {"uniprot": query_uniprot, "gwas": query_gwas, "ensembl": query_ensembl, "drugbank": query_drugbank, "opentargets": query_opentargets}',
    '',
    'def main():',
    '    ap = argparse.ArgumentParser()',
    '    ap.add_argument("--db", required=True, choices=list(DBS.keys()))',
    '    ap.add_argument("--query", required=True)',
    '    ap.add_argument("--limit", type=int, default=5)',
    '    a = ap.parse_args()',
    '    try:',
    '        r = DBS[a.db](a.query, max(1, min(a.limit, 20)))',
    '        print(json.dumps({"ok": True, "db": a.db, "results": r, "total": len(r)}))',
    '    except Exception as e:',
    '        print(json.dumps({"ok": False, "db": a.db, "error": str(e)[:300]}))',
    '',
    'if __name__ == "__main__":',
    '    main()',
  ];

  // 幂等写入个人 skill（容器 /work/{user}/skills/biomni-db-query/），失败静默（不阻塞主功能）
  async function ensureBiomniSkill(cfg, exec) {
    try {
      const got = await catInContainer(cfg, exec, 'skills/biomni-db-query/query_db.py', 200, 20000);
      if (got.ok) return { ok: true, created: false };
      const md = Buffer.from(BIOMNI_SKILL_MD.join('\n'), 'utf8').toString('base64');
      const py = Buffer.from(BIOMNI_SKILL_PY.join('\n'), 'utf8').toString('base64');
      const cmd = 'mkdir -p skills/biomni-db-query && echo ' + md + ' | base64 -d > skills/biomni-db-query/SKILL.md && echo ' + py + ' | base64 -d > skills/biomni-db-query/query_db.py && echo __BIOMNI_OK__';
      const r = await termExec(cfg, ['terminal', 'exec', '-c', cmd, '--timeout', '90'], { signal: exec && exec.signal, timeoutMs: 100000 });
      return { ok: r.ok && termStdout(r).indexOf('__BIOMNI_OK__') >= 0, created: true };
    } catch (e) { return { ok: false, created: false, error: String(e && e.message || e) }; }
  }

  // 插件本机直连兜底（容器不可用时；uniprot 实测可用，部分库网络受限时返回可读提示）
  async function nodeDbQuery(db, query, limit) {
    const q = String(query || '');
    const n = Math.max(1, Math.min(20, limit || 5));
    const to = AbortSignal.timeout(20000);
    try {
      if (db === 'uniprot') {
        const r = await fetch('https://rest.uniprot.org/uniprotkb/search?' + new URLSearchParams({ query: q, size: n, format: 'json' }).toString(), { signal: to });
        const d = await r.json();
        return (d.results || []).map(function (it) {
          return { id: it.primaryAccession || '', name: (((it.proteinDescription || {}).recommendedName || {}).fullName || {}).value || '', gene: ((it.genes || [{}])[0].geneName || {}).value || '' };
        });
      }
      if (db === 'opentargets') {
        const r = await fetch('https://api.platform.opentargets.org/api/v4/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query($q:String!,$s:Int!){ search(queryString:$q,page:{size:$s}){ hits{ id entity{ id name } object{ id name } } } }', variables: { q: q, s: n } }), signal: to });
        const d = await r.json();
        return ((d.data || {}).search || {}).hits || [];
      }
      if (db === 'ensembl') {
        const r = await fetch('https://rest.ensembl.org/xrefs/symbol/human/' + encodeURIComponent(q) + '?content-type=application/json', { headers: { Accept: 'application/json' }, signal: to });
        const d = await r.json();
        return Array.isArray(d) ? d.slice(0, n) : [];
      }
      if (db === 'gwas') {
        const r = await fetch('https://www.ebi.ac.uk/gwas/rest/api/efoTraits/search/findByEfoTrait?' + new URLSearchParams({ trait: q, page: 0, size: n }).toString(), { signal: to });
        const d = await r.json();
        return (((d._embedded || {}).efoTraits) || []).map(function (it) { return { id: (it.uri || '').split('/').pop(), name: it.trait || '' }; });
      }
      return [{ note: 'DrugBank 完整 API 需机构授权；可改用 opentargets 查询药物-靶点关联', query: q }];
    } catch (e) {
      return [{ note: db + ' 本机直连失败（网络受限或超时）: ' + String(e && e.message || e) }];
    }
  }

  // ---------- 工具级动态编排（Biomni ToolRetriever 差距 2）----------

  ctx.tools.register(defineTool({
    name: 'dcs_skill_route',
    description: 'DCS Harness v2·技能路由（Biomni ToolRetriever 式统一检索）：输入任务/模块目标（自然语言），自动并行检索 ①DCS 原生技能库（973 条）②公共 WDL 工作流 ③专家库，按术语相关度打分合并去重排序，输出候选清单（名称/类别/用途/读取命令）→ agent 精读选用。执行阶段不确定用什么方法/流程/专家时先探测（软约束，不强制）。可选 llm_rank=true 用 Genpilot LLM 对候选做二次相关性排序。',
    parameters: {
      task: { type: 'string', required: true, description: '任务/模块目标（自然语言），如 "单细胞数据差异表达分析"、"VCF 变异功能注释"、"时空转录组聚类"、去批次等' },
      top_k: { type: 'integer', description: '返回候选条数上限，默认 8，最大 15' },
      native_only: { type: 'boolean', description: 'true=技能候选只看 DCS 原生（dcs-skills / builtin_skills）' },
      include_personal: { type: 'boolean', description: '是否包含个人技能（/work/{user}/skills/，含自动生成的 biomni-db-query），默认 true' },
      include_workflows: { type: 'boolean', description: '是否检索公共 WDL 工作流，默认 true' },
      include_experts: { type: 'boolean', description: '是否检索专家库，默认 true' },
      llm_rank: { type: 'boolean', description: 'true=再用 Genpilot LLM 对候选做相关性排序（Biomni ToolRetriever 的 LLM 选工具），默认 false' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          count: { type: 'integer', required: true },
          candidates: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                kind: { type: 'string', description: 'skill / workflow / expert' },
                name: { type: 'string' },
                category: { type: 'string' },
                purpose: { type: 'string' },
                score: { type: 'number', description: '术语相关度得分' },
                readAction: { type: 'string', description: '读取/复用的下一步命令提示' },
              },
            },
          },
          output: { type: 'string', required: true },
          error: { type: 'string' },
        },
      },
      render(args, v) { return [{ type: 'text', text: (v.ok ? ('🧭 技能路由（' + v.count + ' 条候选）：\n') : '❌ ' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 300000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const sig = exec && exec.signal;
      const task = str(args.task);
      if (!task) return { ok: false, count: 0, candidates: [], output: '', error: '缺少任务描述 task' };
      const terms = taskTerms(task);
      const topK = Math.min(Math.max(1, Math.floor(args.top_k || 8)), 15);
      const candidates = [];
      // ① 技能库（本地打分，无需逐个容器读取；含个人技能，自动生成的 biomni-db-query 也在候选池）
      const catalog = await skillCatalog(cfg, exec, args.include_personal !== false);
      if (catalog.ok) {
        let list = catalog.list;
        if (args.include_personal === false) list = list.filter((x) => !/^personal\//.test(x.name || ''));
        if (args.native_only) list = list.filter((x) => /^(dcs-skills|builtin_skills)\//.test(x.name || ''));
        const scored = [];
        for (const x of list) {
          const sc = scoreText(terms, (x.name || '') + ' ' + (x.description || ''));
          if (sc > 0) scored.push({
            kind: 'skill', name: x.name, category: (x.name || '').split('/')[0],
            purpose: String(x.description || '').slice(0, 200), score: sc,
            readAction: 'dcs_skill_read name=' + x.name,
          });
        }
        scored.sort((a, b) => b.score - a.score);
        candidates.push(...scored.slice(0, topK * 4));
      }
      // ② 公共 WDL 工作流（CLI 检索，失败静默降级）
      if (args.include_workflows !== false) {
        try {
          const r = await runDcs(cfg, ['workflow', 'ls', '-p', '--page-size', '50'], { signal: sig, timeoutMs: 90000 });
          if (r.ok && r.data) {
            const recs = Array.isArray(r.data) ? r.data : (r.data.records || r.data.list || r.data.workflows || []);
            const scored = [];
            for (const w of recs) {
              const name = String(w.name || w.workflow_name || w.wf_name || w.workflowName || '');
              const desc = String(w.description || w.desc || w.summary || w.remark || '');
              if (!name) continue;
              const sc = scoreText(terms, name + ' ' + desc);
              if (sc > 0) scored.push({
                kind: 'workflow', name, category: 'workflow',
                purpose: desc.slice(0, 200), score: sc,
                readAction: 'dcs_workflow_info name=' + name,
              });
            }
            scored.sort((a, b) => b.score - a.score);
            candidates.push(...scored.slice(0, topK * 2));
          }
        } catch { /* 静默降级 */ }
      }
      // ③ 专家库（容器列出 + 本地打分）
      if (args.include_experts !== false) {
        try {
          const cmd = `cd ${EXPERT_BASE} && for d in */; do n=$(basename "$d"); echo "###EXPERT $n"; if [ -f "$d/AGENTS.md" ]; then sed -n "1,10p" "$d/AGENTS.md"; fi; echo; done`;
          const r = await termExec(cfg, ['terminal', 'exec', '-c', cmd, '--timeout', '60'], { signal: sig, timeoutMs: 90000 });
          if (r.ok) {
            const blocks = termStdout(r).split(/###EXPERT\s+/).filter(Boolean);
            const scored = [];
            for (const b of blocks) {
              const name = ((b.split('\n')[0] || '').split(' sub=')[0] || '').trim();
              const body = b.slice((b.split('\n')[0] || '').length).trim();
              if (!name) continue;
              const sc = scoreText(terms, name + ' ' + body);
              if (sc > 0) scored.push({
                kind: 'expert', name, category: 'expert',
                purpose: body.slice(0, 200), score: sc,
                readAction: 'dcs_expert_read name=' + name,
              });
            }
            scored.sort((a, b) => b.score - a.score);
            candidates.push(...scored.slice(0, topK));
          }
        } catch { /* 静默降级 */ }
      }
      // 合并去重 + 排序
      const seen = new Set();
      const uniq = candidates.filter((c) => {
        const k = c.kind + '|' + c.name;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      uniq.sort((a, b) => b.score - a.score);
      let top = uniq.slice(0, topK);
      // ④ 可选：LLM 二次相关性排序（Biomni ToolRetriever 的 LLM 选工具）
      if (args.llm_rank && top.length > 1) {
        const listJson = JSON.stringify(top.map((c, i) => ({ i, kind: c.kind, name: c.name, purpose: (c.purpose || '').slice(0, 80) })));
        const r2 = await genpilotChat(cfg, sig,
          '任务：' + task + '\n候选工具：' + listJson + '\n按与任务的相关性从高到低，只输出候选下标 JSON 数组（如 [3,0,1,2]），不要输出其他内容。',
          '你是工具检索排序器（ToolRetriever），只输出 JSON 数组。', '');
        if (r2.ok) {
          const arr = r2.content.match(/\[[\d,\s]+\]/);
          if (arr) {
            try {
              const order = JSON.parse(arr[0]).filter((n) => Number.isInteger(n));
              const byIdx = {};
              top.forEach((c, i) => { byIdx[i] = c; });
              const reordered = order.map((i) => byIdx[i]).filter(Boolean);
              const rest = top.filter((c, i) => order.indexOf(i) === -1);
              top = reordered.concat(rest).slice(0, topK);
            } catch { /* 保持原序 */ }
          }
        }
      }
      const lines = top.map((c, i) =>
        (i + 1) + '. [' + c.kind + '] ' + c.name + '（' + c.category + '，相关度 ' + c.score + '）\n    ' + (c.purpose || '') + '\n    → ' + c.readAction);
      const output = (lines.length ? lines.join('\n') : '（未找到相关候选，可换关键词重试或直接用 dcs_skills_list / dcs_workflow_search 人工检索）') + '\n[共 ' + top.length + ' 条]';
      return { ok: true, count: top.length, candidates: top, output: output.slice(0, OUTPUT_CAP), error: '' };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_db_query',
    description: 'DCS Harness v2·公共生物医学数据库只读查询（Biomni 式 B1 落地）：uniprot（蛋白）/ gwas（GWAS Catalog 关联）/ ensembl（基因注释）/ drugbank（药物-靶点，公开子集）/ opentargets（疾病-基因-药物交叉）。执行时自动确保个人技能 biomni-db-query 已生成（容器 /work/{user}/skills/，幂等、可编辑），优先容器执行（网络更稳），容器不可用时插件本机直连兜底。适合变异解读、基因-疾病关联、药物靶点挖掘等跨库交叉场景；某库不可用时改用 DCS 公共库 /public 数据。',
    parameters: {
      db: { type: 'string', required: true, description: '数据库：uniprot / gwas / ensembl / drugbank / opentargets' },
      query: { type: 'string', required: true, description: '查询词，如 "BRCA1 human"、"type 2 diabetes"、"BRCA2"' },
      limit: { type: 'integer', description: '返回条数上限，默认 5，最大 20' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, db: { type: 'string', required: true }, total: { type: 'integer', required: true }, via: { type: 'string' }, output: { type: 'string', required: true }, error: { type: 'string' } } },
      render(args, v) { return [{ type: 'text', text: (v.ok ? ('🔬 ' + v.db + ' 查询（' + v.total + ' 条，via ' + (v.via || '') + '）：\n') : '❌ ' + (v.error || '') + '\n') + v.output }]; },
    },
    timeoutMs: 180000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const db = str(args.db);
      const query = str(args.query);
      const limit = Math.max(1, Math.min(20, Math.floor(args.limit || 5)));
      if (!db || !query) return { ok: false, db: db, total: 0, output: '', error: '缺少 db 或 query' };
      let results = null;
      let via = '';
      // 主路径：确保个人 skill 存在（自动生成，幂等）→ 容器执行
      const ensured = await ensureBiomniSkill(cfg, exec);
      if (ensured.ok) {
        const cmd = 'python3 skills/biomni-db-query/query_db.py --db ' + db + ' --query ' + JSON.stringify(query) + ' --limit ' + limit;
        const r = await termExec(cfg, ['terminal', 'exec', '-c', cmd, '--timeout', '150'], { signal: exec && exec.signal, timeoutMs: 160000 });
        if (r.ok) {
          try {
            const j = JSON.parse(termStdout(r).trim());
            if (j.ok) { results = j.results; via = '容器（个人 skill biomni-db-query' + (ensured.created ? '，已自动生成' : '') + '）'; }
            else via = '容器错误: ' + String(j.error || '').slice(0, 100);
          } catch (e) { via = '容器输出解析失败'; }
        } else via = '容器执行失败';
      }
      // 兜底：容器不可用 → 插件本机直连
      if (!results) {
        results = await nodeDbQuery(db, query, limit);
        via = '插件本机直连（' + (via || '容器不可用') + ' 的兜底）';
      }
      const lines = results.map((x) => JSON.stringify(x));
      return { ok: true, db: db, total: results.length, via: via, output: (lines.join('\n') || '（无结果）').slice(0, OUTPUT_CAP), error: '' };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'dcs_project_create',
    description: '在 DCS Genpilot 平台创建一个真实项目（dcs project create，在当前片区创建；成功后自动设为当前项目并从计费组扣费）。用于「一次使用=一个 Genpilot 项目」的立项。billing_group 缺省自动取第一个授权计费组；创建成功后把返回的项目 code 作为 project_id 传给 dcs_project_update，以登记到「项目管理」窗口。',
    parameters: {
      name: { type: 'string', required: true, description: '项目名称（英文字母/数字，如 LungCancerWGS）' },
      desc: { type: 'string', description: '项目描述' },
      billing_group: { type: 'string', description: '授权计费组名；缺省用 dcs billing ls 的第一个' },
      omics: { type: 'string', description: '预设组学技术，逗号分隔（可用 dcs project omics 查）' },
      tag: { type: 'string', description: '项目标签，格式 category:subtag，逗号分隔（可用 dcs project tags 查）' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          project_code: { type: 'string', required: true },
          project_name: { type: 'string', required: true },
          billing_group: { type: 'string', required: true },
          region: { type: 'string', required: true },
          output: { type: 'string', required: true },
          error: { type: 'string' },
        },
      },
      render(args, v) { return [{ type: 'text', text: v.ok ? ('🚀 Genpilot 项目已创建：' + v.project_code + '（' + v.project_name + '，' + v.region + '）。\n请把 project_id=' + v.project_code + ' 传给 dcs_project_update 登记到「项目管理」窗口。\n' + v.output) : ('❌ 创建失败：' + (v.error || '') + '\n' + v.output) }]; },
    },
    timeoutMs: 120000,
    async execute(args, exec) {
      const cfg = loadCfg();
      const sig = exec && exec.signal;
      const name = str(args.name).trim();
      if (!name) return { ok: false, project_code: '', project_name: '', billing_group: '', region: '', output: '', error: '缺少项目名称 name' };
      let bg = str(args.billing_group).trim();
      if (!bg) {
        const br = await runDcs(cfg, ['billing', 'ls'], { signal: sig, timeoutMs: 60000 });
        const pick = (arr) => {
          if (!Array.isArray(arr) || !arr.length) return '';
          const first = arr[0];
          if (typeof first === 'string') return first;
          if (first && typeof first === 'object') return str(first.billing_group || first.name || first.group_name || first.billingGroup || '');
          return '';
        };
        if (br.ok) {
          bg = Array.isArray(br.data) ? pick(br.data) : ((br.data && (br.data.records || br.data.list)) ? pick(br.data.records || br.data.list) : (br.data && typeof br.data === 'object' ? pick([br.data]) : ''));
        }
      }
      if (!bg) return { ok: false, project_code: '', project_name: name, billing_group: '', region: '', output: '', error: '未找到可用计费组，请用 dcs_cli 调 billing ls 查看后传 billing_group' };
      const build = () => {
        const a = ['project', 'create', '-n', name, '-b', bg];
        if (str(args.desc)) a.push('-d', str(args.desc));
        if (str(args.omics)) a.push('--omics', str(args.omics).split(',').map((s) => s.trim()).filter(Boolean).join(','));
        if (str(args.tag)) a.push('-t', str(args.tag).split(',').map((s) => s.trim()).filter(Boolean).join(','));
        return a;
      };
      const r = await runDcs(cfg, build(), { signal: sig, timeoutMs: 90000 });
      if (!r.ok) return { ok: false, project_code: '', project_name: name, billing_group: bg, region: '', output: r.raw || r.error || '', error: r.error || r.message || '创建失败' };
      let code = '';
      const d = r.data;
      if (d) {
        if (typeof d === 'object') code = str(d.project_id || d.id || d.code || d.project_code || d.projectId || '');
        else code = String(d);
      }
      if (!code && r.raw) { const m = String(r.raw).match(/P\d{16,}/); if (m) code = m[0]; }
      const region = (await runDcs(cfg, ['region', 'current'], { signal: sig, timeoutMs: 30000 }).then((x) => ((x.data && x.data.current_region) || '')).catch(() => '')) || '';
      return { ok: true, project_code: code, project_name: name, billing_group: bg, region, output: code ? ('项目代码：' + code + '；计费组：' + bg) : String(r.raw || ''), error: '' };
    },
  }));

  // ---------- DCS 任务面板 HTTP 路由（供浏览器 tab 读取） ----------

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/api/dcs-cloud',
    handler: async (req, res) => {
      const url = new URL(req.url || '', 'http://localhost');
      const path = url.pathname.replace(/^\/api\/dcs-cloud/, '') || '/';
      const sessionId = url.searchParams.get('sessionId') || '';
      const json = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      const readBody = (req) => new Promise((resolve) => {
        const chunks = [];
        let size = 0;
        req.on('data', (c) => { size += c.length; if (size > 1024 * 1024) { req.destroy(); resolve(null); return; } chunks.push(c); });
        req.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
          catch { resolve(null); }
        });
        req.on('error', () => resolve(null));
      });
      // 当前登录状态快照（用户名/片区/项目）
      const statusSnapshot = async (cfg) => {
        try {
          const st = await dcsStatus(cfg, { timeoutMs: 30000 });
          const pdata = (st && st.project && st.project.data) || {};
          const rdata = (st && st.region && st.region.data) || {};
          return {
            loggedIn: !!(pdata.current_project || rdata.current_region),
            username: pdata.username || rdata.username || '',
            region: rdata.current_region || '',
            project: pdata.current_project || '',
            projectName: pdata.current_project_name || '',
          };
        } catch {
          return { loggedIn: false, username: '', region: '', project: '', projectName: '' };
        }
      };
      try {
        if (req.method === 'GET' && (path === '/' || path === '/tasks')) {
          json(200, { ok: true, tasks: loadTasks(sessionId) });
          return;
        }
        if (req.method === 'GET' && path.startsWith('/tasks/')) {
          const id = decodeURIComponent(path.slice('/tasks/'.length));
          const t = getTask(id, sessionId);
          if (t) json(200, { ok: true, task: t });
          else json(404, { ok: false, error: '任务不存在' });
          return;
        }
        if (req.method === 'POST' && path === '/tasks') {
          readBody(req).then(async (body) => {
            if (!body) { json(400, { ok: false, error: '无效 JSON' }); return; }
            try {
              const r = await upsertTask(body, body.sessionId || sessionId);
              json(200, { ok: true, task: r.task });
            } catch (e) { json(400, { ok: false, error: String(e.message) }); }
          });
          return;
        }
        // ---- 局部更新任务（如模型选择） ----
        if ((req.method === 'PATCH' || req.method === 'POST') && path.startsWith('/tasks/')) {
          const id = decodeURIComponent(path.slice('/tasks/'.length));
          const body = await readBody(req);
          if (!body) { json(400, { ok: false, error: '无效 JSON' }); return; }
          const r = await mergeTask(id, body, body.sessionId || sessionId);
          if (r.ok) json(200, { ok: true, task: r.task });
          else json(404, { ok: false, error: r.error });
          return;
        }
        // ---- 设置页：读取配置与登录状态 ----
        if (req.method === 'GET' && path === '/config') {
          const cfg = loadCfg();
          const keys = (cfg && cfg.apiKeys && typeof cfg.apiKeys === 'object') ? cfg.apiKeys : {};
          const genosKey = keys.genos || keys.genos_vep || '';
          json(200, {
            ok: true,
            patSet: !!cfg.pat,
            patHint: cfg.pat ? ('…' + String(cfg.pat).slice(-4)) : '',
            cliPath: cfg.cliPath,
            autoInstall: cfg.autoInstall,
            genosKey: genosKey,
            genosKeySet: !!genosKey,
            status: await statusSnapshot(cfg),
          });
          return;
        }
        // ---- 设置页：保存 PAT 并登录 ----
        if (req.method === 'POST' && path === '/config') {
          const body = await readBody(req);
          if (!body) { json(400, { ok: false, error: '无效 JSON' }); return; }
          const cfg = loadCfg();
          const next = { ...cfg };
          if (typeof body.cliPath === 'string') next.cliPath = body.cliPath.trim() || 'dcs';
          if (body.autoInstall === 'auto' || body.autoInstall === 'never') next.autoInstall = body.autoInstall;
          if (typeof body.pat === 'string' && body.pat) {
            next.pat = body.pat;
            saveCfg(next);
            await dcsLogin(next, body.pat, { timeoutMs: 60000 }).catch(() => {});
          }
          // Genos API key（Genos-VEP / Genos-Mutation 预测模型，VCF→RNA 信号）
          if (typeof body.genosKey === 'string') {
            next.apiKeys = next.apiKeys || {};
            if (body.genosKey.trim()) {
              next.apiKeys.genos = body.genosKey.trim();
              next.apiKeys.genos_vep = body.genosKey.trim();
              next.apiKeys.genos_mutation = body.genosKey.trim();
            } else {
              delete next.apiKeys.genos;
              delete next.apiKeys.genos_vep;
              delete next.apiKeys.genos_mutation;
            }
          }
          saveCfg(next);
          json(200, { ok: true, patSet: !!next.pat, genosKeySet: !!(next.apiKeys && next.apiKeys.genos), status: await statusSnapshot(next) });
          return;
        }
        // ---- 设置页：测试连接 ----
        if (req.method === 'POST' && path === '/test') {
          json(200, { ok: true, status: await statusSnapshot(loadCfg()) });
          return;
        }
        // ---- Genpilot 模型列表 ----
        if (req.method === 'GET' && path === '/models') {
          json(200, { ok: true, models: GENPILOT_MODELS });
          return;
        }
        // ---- 离线任务状态与资源消耗 ----
        if (req.method === 'GET' && path === '/offline-tasks') {
          const cfg = loadCfg();
          const ls = await runDcs(cfg, ['analysis', 'ls', '-a'], { timeoutMs: 90000 }).catch(() => null);
          const recs = (ls && ls.ok && ls.data && ls.data.records) || [];
          // 取前 10 个父任务，逐个查详情拿状态与资源
          const tasks = [];
          for (const r of recs.slice(0, 10)) {
            const info = await runDcs(cfg, ['analysis', 'info', String(r.task_id)], { timeoutMs: 60000 }).catch(() => null);
            const subs = (info && info.ok && info.data && info.data.records) || [];
            tasks.push({
              id: r.task_id,
              name: r.task_name || r.name || '',
              createTime: r.create_time || '',
              subtasks: subs.map((s) => ({
                id: s.task_id,
                name: s.task_name,
                status: s.status,
                resource: s.computing_name || '',
                amount: s.amount !== undefined ? String(s.amount) : '',
                image: s.image_name || '',
                command: (s.code || '').slice(0, 120),
              })),
            });
          }
          json(200, { ok: true, tasks });
          return;
        }

        // ================= DCS Harness v2.0 路由 =================

        // ---- 健康检查（启动器探测用） ----
        if (req.method === 'GET' && path === '/v2/health') {
          json(200, { ok: true, version: PLUGIN_VERSION, time: Date.now() });
          return;
        }
        // ---- 项目列表 / 单个项目 ----
        if (req.method === 'GET' && path === '/v2/projects') {
          json(200, { ok: true, projects: listProjects(sessionId) });
          return;
        }
        if (req.method === 'GET' && path.startsWith('/v2/projects/')) {
          const id = decodeURIComponent(path.slice('/v2/projects/'.length));
          const p = getProject(id, sessionId);
          if (p) json(200, { ok: true, project: p });
          else json(404, { ok: false, error: '项目不存在' });
          return;
        }
        // ---- 项目局部更新（模型选择/标题/目标/资源/状态） ----
        if ((req.method === 'PATCH' || req.method === 'POST') && path.startsWith('/v2/projects/')) {
          const id = decodeURIComponent(path.slice('/v2/projects/'.length));
          const body = await readBody(req);
          if (!body) { json(400, { ok: false, error: '无效 JSON' }); return; }
          const r = await mergeProject(id, body, body.sessionId || sessionId);
          if (r.ok) json(200, { ok: true, project: r.project });
          else json(404, { ok: false, error: r.error });
          return;
        }
        // ---- 当前会话 dsh token 消耗 ----
        if (req.method === 'GET' && path === '/v2/tokens') {
          json(200, { ok: true, tokens: sessionTokens(ctx, sessionId) });
          return;
        }
        // ---- 各运行版本的具体任务费用统计（缓存 60s） ----
        // 费用口径：`dcs analysis info <taskId>` 返回的 records[].amount 是 DCS 官方结算费用
        // （按资源档位 computing_name 与运行时长计费，如 4c16g ≈ 1 元/小时）；
        // `dcs analysis consume` 提供 CPU/内存资源消耗曲线，amount 缺失时作为兜底（读其 metrics.amount）。
        if (req.method === 'GET' && path === '/v2/costs') {
          const projectId = url.searchParams.get('projectId') || '';
          const cfg = loadCfg();
          const project = getProject(projectId, sessionId);
          const out = { ok: true, costs: {}, error: '' };
          if (project) {
            for (const m of project.modules) {
              for (const run of m.runs) {
                if (run.dcsTaskIds && run.dcsTaskIds.length) {
                  const list = await Promise.all(run.dcsTaskIds.map(async (tid) => {
                    const info = await dcsTaskInfo(cfg, tid);
                    let cost = info.amount;
                    if (cost === null || cost === undefined) cost = await dcsTaskCost(cfg, tid);
                    return { taskId: tid, cost, resource: info.resource, image: info.image, status: info.status };
                  }));
                  out.costs[run.id] = list;
                }
              }
            }
          }
          json(200, out);
          return;
        }
        // ---- 项目总览聚合：里程碑质检 + 分片任务进度 + 任务状态汇总（供项目管理窗口） ----
        if (req.method === 'GET' && path === '/v2/project-overview') {
          const projectId = url.searchParams.get('projectId') || '';
          const cfg = loadCfg();
          const project = getProject(projectId, sessionId);
          const out = { ok: true, milestones: [], sharded: {}, taskSummary: { total: 0, running: 0, done: 0, failed: 0, cost: 0 }, error: '' };
          if (!project) { json(200, out); return; }
          out.milestones = project.milestones || [];
          let total = 0, running = 0, done = 0, failed = 0, cost = 0;
          // 分片任务进度：并发拉取每个 run 下所有分片任务的状态
          for (const m of project.modules) {
            for (const run of m.runs) {
              if (!run.dcsTaskIds || !run.dcsTaskIds.length) continue;
              const shardList = await Promise.all(run.dcsTaskIds.map(async (tid) => {
                const info = await dcsTaskInfo(cfg, tid);
                const st = String(info.status || '');
                return { taskId: tid, status: st, amount: info.amount || null, progress: run.progress || 0 };
              }));
              for (const s of shardList) {
                total++;
                if (/完成|成功|done|completed/i.test(s.status)) done++;
                else if (/运行|进行|running/i.test(s.status)) running++;
                else if (/失败|错误|fail|error/i.test(s.status)) failed++;
                else running++;
                if (s.amount != null) cost += Number(s.amount);
              }
              out.sharded[run.id] = {
                total: shardList.length,
                done: shardList.filter((s) => /完成|成功|done|completed/i.test(s.status)).length,
                name: m.name,
                status: m.status,
                shards: shardList,
              };
            }
          }
          out.taskSummary = { total, running, done, failed, cost: Math.round(cost * 100) / 100 };
          json(200, out);
          return;
        }
        // ---- 项目余额（project detail）----
        if (req.method === 'GET' && path === '/v2/billing') {
          const cfg = loadCfg();
          let balance = null;
          let projectName = '';
          let projectCode = '';
          try {
            const st = await dcsStatus(cfg, { timeoutMs: 30000 });
            const pdata = (st.project && st.project.data) || {};
            projectCode = pdata.current_project || '';
            const d = await runDcs(cfg, ['project', 'detail'], { timeoutMs: 30000 });
            if (d.ok && d.data) {
              if (d.data.balance !== undefined && d.data.balance !== null) balance = Number(d.data.balance);
              projectName = d.data.name || pdata.current_project_name || '';
            }
          } catch { /* 未登录/无权限时忽略 */ }
          json(200, { ok: true, balance, projectName, projectCode });
          return;
        }
        // ---- 单张媒体图：本地/容器路径 → base64 data-URI（供交付窗口展示） ----
        // 优先读本机交付目录；容器路径仅在本地无缓存时才触发下载（下载后即本地化，离线可用）。
        if (req.method === 'GET' && path === '/v2/chart-image') {
          const p = url.searchParams.get('path') || '';
          if (!p) { json(400, { ok: false, data: '', error: '缺少 path' }); return; }
          const cfg = loadCfg();
          let local = p;
          try {
            if (p.startsWith('/work/') || p.startsWith('/data/')) {
              // 容器路径 → 下载/复用本地交付目录
              local = await downloadContainerFile(cfg, p);
            } else if (!isAbsolute(p)) {
              local = join(workspaceOf({ agent: { session: { header: { cwd: process.cwd() } } } }), p);
            }
            // local 此时是本机绝对路径（容器路径已被下载到本地交付目录）
            const buf = existsSync(local) ? readFileSync(local) : null;
            if (!buf || buf.length > 12 * 1024 * 1024) { json(200, { ok: false, data: '', error: '图片读取失败或过大' }); return; }
            // P2：按扩展名给 MIME——svg/html 路径也能走 base64 内嵌（此前一律 image/*）
            const lext = extname(local).toLowerCase().replace('.', '');
            const mime = (lext === 'html' || lext === 'htm') ? 'text/html'
              : lext === 'svg' ? 'image/svg+xml'
              : lext === 'json' ? 'application/json'
              : 'image/' + (lext || 'png');
            const dataUri = 'data:' + mime + ';base64,' + buf.toString('base64');
            json(200, { ok: true, data: dataUri });
            return;
          } catch (e) {
            json(200, { ok: false, data: '', error: String(e && e.message || e) });
            return;
          }
        }
        // ---- P0：交付媒体文件服务——容器/本机 HTML/PDB 等 → 本地化 → 可访问 URL ----
        // GET /v2/chart-file?path=<容器或本机路径> → { ok, url: "/v2/serve-local/<name>" }
        // 与 /v2/chart-image 对称：容器路径走 downloadContainerFile 本地化（离线可用），本机/相对路径直接解析。
        if (req.method === 'GET' && path === '/v2/chart-file') {
          const p = url.searchParams.get('path') || '';
          if (!p) { json(400, { ok: false, url: '', error: '缺少 path' }); return; }
          try {
            const cfg = loadCfg();
            const local = await resolveMediaPath(cfg, p);
            if (!local || !existsSync(local)) { json(200, { ok: false, url: '', error: '文件不存在: ' + p }); return; }
            const st = statSync(local);
            if (!st.isFile()) { json(200, { ok: false, url: '', error: '不是常规文件: ' + p }); return; }
            if (st.size > 64 * 1024 * 1024) { json(200, { ok: false, url: '', error: '文件过大（>64MB）' }); return; }
            const name = cacheServeFile(local, p);
            json(200, { ok: true, url: '/api/dcs-cloud/v2/serve-local/' + name, name, size: st.size });
          } catch (e) {
            json(200, { ok: false, url: '', error: String(e && e.message || e) });
          }
          return;
        }
        // GET /v2/serve-local/<name>：按白名单文件名读取交付缓存目录，按扩展名给 MIME
        if (req.method === 'GET' && path.startsWith('/v2/serve-local/')) {
          const name = safeServeName(path.slice('/v2/serve-local/'.length).split('?')[0]);
          if (!name) { json(400, { ok: false, error: '非法文件名' }); return; }
          const file = join(localImgDir(), name);
          // 双保险：解析后必须仍在缓存目录内
          if (!existsSync(file) || !statSync(file).isFile() || !file.startsWith(localImgDir())) {
            json(404, { ok: false, error: '文件不存在' });
            return;
          }
          const body = readFileSync(file);
          res.writeHead(200, { 'content-type': mimeOf(name), 'content-length': body.length, 'cache-control': 'no-cache' });
          res.end(body);
          return;
        }
        // GET /v2/vendor/3dmol.js：本地打包的 3Dmol.js（structure3d 渲染引擎，免外网 CDN）
        if (req.method === 'GET' && path === '/v2/vendor/3dmol.js') {
          const vendorFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', '3Dmol-min.js');
          if (!existsSync(vendorFile)) { json(404, { ok: false, error: '3Dmol.js 未随插件打包（assets/3Dmol-min.js 缺失）' }); return; }
          const body = readFileSync(vendorFile);
          res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'content-length': body.length, 'cache-control': 'max-age=86400' });
          res.end(body);
          return;
        }
        // ---- 项目运行产物中的分析图（下载缓存后 base64 返回，供结果交付窗口展示） ----
        if (req.method === 'GET' && path === '/v2/delivery-images') {
          const projectId = url.searchParams.get('projectId') || '';
          const project = getProject(projectId, sessionId);
          const images = [];
          if (project) {
            const seen = new Set();
            const imgCacheDir = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dcs-img-cache');
            mkdirSync(imgCacheDir, { recursive: true });
            const addImage = async (p) => {
              if (!p || seen.has(p)) return;
              seen.add(p);
              try {
                let local = p;
                if (p.startsWith('/work/') || p.startsWith('/data/')) {
                  // 容器路径 → 下载/复用本机交付目录（本地化后离线可用）
                  local = await downloadContainerFile(loadCfg(), p);
                } else if (!isAbsolute(p)) {
                  local = join(workspaceOf({ agent: { session: { header: { cwd: process.cwd() } } } }), p);
                }
                if (!local || !existsSync(local)) return;
                const buf = readFileSync(local);
                if (buf.length > 10 * 1024 * 1024) return;
                images.push({
                  name: basename(p),
                  path: p,
                  base64: 'data:image/' + (extname(p).toLowerCase().replace('.', '') || 'png') + ';base64,' + buf.toString('base64'),
                });
              } catch { /* 单张失败跳过 */ }
            };
            // 收集候补图路径 + 候补扫描目录
            const scanDirs = new Set();
            // 1) run.files.output：登记的 png 直接取；登记的是目录则记入 scanDirs
            for (const m of project.modules) {
              for (const run of m.runs) {
                const outs = (run.files && run.files.output) || [];
                for (const f of outs) {
                  const p = f.path || '';
                  if (/\.(png|jpe?g|gif|webp)$/i.test(p)) { await addImage(p); continue; }
                  if (p.startsWith('/work/') || p.startsWith('/data/') || p.startsWith('/out')) {
                    // 登记的本就是目录（如 .../output）
                    if (p.startsWith('/work/') || p.startsWith('/data/')) scanDirs.add(p.replace(/[\/]+$/, ''));
                    else scanDirs.add('/work/xuxun/' + p.replace(/\/+$/, ''));
                  }
                }
              }
            }
            // 2) 交付文档 charts 里的 image 类型（data 为路径字符串 或 {path} 对象）
            if (Array.isArray(project.delivery && project.delivery.charts)) {
              for (const c of project.delivery.charts) {
                if (!c || c.type !== 'image' || !c.data) continue;
                let imgPath = null;
                if (typeof c.data === 'string') imgPath = c.data;
                else if (typeof c.data === 'object' && !c.data.data) imgPath = c.data.path || c.data.src || c.data.url || '';
                if (imgPath && imgPath.indexOf('data:') !== 0 && /\.(png|jpe?g|gif|webp)$/i.test(imgPath)) {
                  await addImage(imgPath);
                }
              }
            }
            // 3) 从 output 路径（csv/html 等文件）提取父目录、notes 里的 /work 路径 → 统一扫描
            for (const m of project.modules) {
              for (const run of m.runs) {
                const outs = (run.files && run.files.output) || [];
                for (const f of outs) {
                  const p = f.path || '';
                  if (p.startsWith('/work/') || p.startsWith('/data/')) {
                    // basename 含扩展名视为文件，取父目录；否则视为目录本身
                    const fn = p.split('/').pop() || '';
                    if (/\.\w+$/.test(fn)) scanDirs.add(p.replace(/\/[^\/]+$/, ''));
                    else scanDirs.add(p.replace(/[\/]+$/, ''));
                  }
                }
                const mdir = (run.notes || '').match(/\/work\/[\w\-\/]+/g);
                if (mdir) for (const dd of mdir) scanDirs.add(dd);
              }
            }
            // 统一扫描所有候选目录下的 png
            if (!images.length) {
              for (const d of scanDirs) {
                try {
                  const q = d.replace(/\/$/, '');
                  const r = await runDcs(loadCfg(), ['terminal', 'exec', '-c', 'ls "' + q + '" 2>/dev/null | grep -iE "\\.(png|jpe?g|webp)$"'], { timeoutMs: 60000 });
                  const data = (r && r.data) || {};
                  const names = String(data.stdout || data.output || (r && r.raw) || '');
                  for (const name of names.split(/\r?\n/)) {
                    const nm = name.trim();
                    if (/\.(png|jpe?g|gif|webp)$/i.test(nm)) await addImage(q + '/' + nm);
                  }
                } catch { /* 目录不可达跳过 */ }
                if (images.length) break;
              }
            }
          }
          json(200, { ok: true, images });
          return;
        }
        // ---- 节点（片区）列表与当前节点 ----
        if (req.method === 'GET' && path === '/v2/regions') {
          const cfg = loadCfg();
          const st = await dcsStatus(cfg, { timeoutMs: 30000 }).catch(() => null);
          const rdata = (st && st.region && st.region.data) || {};
          const cur = rdata.current_region || '';
          const rcur = REGIONS.find((r) => r.name === cur);
          json(200, {
            ok: true,
            regions: REGIONS.map((r) => ({ id: r.id, name: r.name, type: r.type || '', note: r.note || '' })),
            current: cur,
            status: await statusSnapshot(cfg),
            // 节点联动提示：当前节点的公共库特色 + 若项目数据在别的片区则提示
            hint: rcur
              ? ('当前节点「' + cur + '」（' + (rcur.type || '') + '）。' + (rcur.note || '') + '；找公共数据优先查容器 /public。')
              : ('当前节点「' + cur + '」。查公共数据优先容器 /public；公共库最全的片区是 BGI-时空（官方流程多）与 DCS-华南1/华北2（公共流程多）。'),
          });
          return;
        }
        // ---- 切换节点（片区），可保存到项目 ----
        if (req.method === 'POST' && path === '/v2/region') {
          const body = await readBody(req);
          if (!body) { json(400, { ok: false, error: '无效 JSON' }); return; }
          const cfg = loadCfg();
          const region = String(body.region || '').trim();
          const projectId = body.projectId ? String(body.projectId) : '';
          if (!region) { json(400, { ok: false, error: '缺少 region' }); return; }
          const r = await runDcs(cfg, ['region', 'switch', region], { timeoutMs: 60000 });
          if (!r.ok) { json(400, { ok: false, error: r.error || '节点切换失败' }); return; }
          let project = null;
          if (projectId) {
            const m = await mergeProject(projectId, { region }, body.sessionId || sessionId);
            if (m.ok) project = m.project;
          }
          json(200, { ok: true, region, project, status: await statusSnapshot(cfg) });
          return;
        }

        // ---- Human-in-the-loop（批量审核制）----
        // best-effort 唤醒：向会话注入一条 plugin 来源的用户消息，让 agent 感知窗口里的操作。
        // 只在「项目级」动作（修正计划/批准执行）时唤醒；模块级意见只记录，等用户统一提交。
        const wakeSession = (sid, text) => {
          try {
            const s = ctx.get('sessions');
            const live = s && typeof s.get === 'function' ? s.get(sid) : null;
            if (live && typeof live.append === 'function') {
              live.append('user/message', {
                content: [{ type: 'text', text }],
                source: { kind: 'plugin', label: 'dcs-project-review' },
              });
              return true;
            }
          } catch (e) { /* 唤醒失败不影响保存，前端有对话窗口兜底提示 */ }
          return false;
        };

        // POST /v2/module/review  body: { projectId, moduleId, action, text, opts }
        // 模块级意见（批准/纠正/否决/设想/评论）：仅记录留痕，不唤醒 AI——
        // 用户审核完全部模块后通过项目级「根据意见重新修正计划」统一触发修订。
        if (req.method === 'POST' && path === '/v2/module/review') {
          const body = await readBody(req);
          if (!body || !body.projectId || !body.moduleId) { json(400, { ok: false, error: '缺少 projectId/moduleId' }); return; }
          const r = await reviewModule(
            String(body.projectId), String(body.moduleId),
            body.action, body.text, body.opts || null,
            body.sessionId || sessionId,
          );
          if (r.ok) json(200, { ok: true, module: r.module, project: r.project });
          else json(404, { ok: false, error: r.error });
          return;
        }
        // POST /v2/project/revise-request  body: { projectId }
        // 用户审核完全部模块后点击：唤醒 AI 读取全部反馈并逐条修订，修订完再次等人工复审（不执行）。
        if (req.method === 'POST' && path === '/v2/project/revise-request') {
          const body = await readBody(req);
          if (!body || !body.projectId) { json(400, { ok: false, error: '缺少 projectId' }); return; }
          const p = await getProject(String(body.projectId), body.sessionId || sessionId);
          if (!p) { json(404, { ok: false, error: '项目不存在: ' + body.projectId }); return; }
          const fb = await listPendingFeedback(String(body.projectId), body.sessionId || sessionId);
          const n = fb.ok ? fb.total : 0;
          const woken = wakeSession(body.sessionId || sessionId,
            '[项目管理] 用户已完成本轮模块审核并点击「根据意见重新修正计划」（待处理意见 ' + n + ' 条）。请立即：'
            + '① 用 dcs_module_feedback 读取该项目全部待处理反馈（含每条原文）；'
            + '② 逐条针对性修订对应模块——改 desc / 拆分新增子模块 / 调整 dependsOn，必要时用 dcs_plan_update 同步修订分析计划；没有意见的模块保持原样；'
            + '③ 每修订一个模块，用 dcs_module_update 传 replyFeedback 说明改了什么、为什么（反馈随之闭环）；'
            + '④ 全部修订完成后停下来，明确告诉用户「修订完成，请在项目管理窗口复审」，等待用户再次审核或批准。本轮不要开始执行分析。'
            + '严禁只回复文字而不修订模块数据。');
          json(200, { ok: true, pendingFeedback: n, woken });
          return;
        }
        // POST /v2/project/approve-plan  body: { projectId }
        // 用户批准计划：planStatus=approved + 唤醒 AI 全自动执行——不得再设闸门/暂停/请示，直到全部完成。
        if (req.method === 'POST' && path === '/v2/project/approve-plan') {
          const body = await readBody(req);
          if (!body || !body.projectId) { json(400, { ok: false, error: '缺少 projectId' }); return; }
          const m = await mergeProject(String(body.projectId), { status: 'running', plan: { planStatus: 'approved' } }, body.sessionId || sessionId);
          if (!m.ok) { json(404, { ok: false, error: m.error }); return; }
          const woken = wakeSession(body.sessionId || sessionId,
            '[项目管理] 用户已批准计划（planStatus=approved）。请进入全自动执行模式：'
            + '① 按 dependsOn 顺序依次执行全部模块（数据准备→分析→可视化→报告），每个模块用 dcs_run_start 开启运行、dcs_run_update 更新状态与产物；'
            + '② 不再设置任何审查节点（isGate），不暂停等待人工确认，不中途请示；遇到可自行决策的问题选择合理默认并继续；'
            + '③ 全部模块完成后用 dcs_delivery_update 汇总结果，并向用户报告交付。若个别模块失败，记录原因并继续其余模块，最后统一说明。');
          json(200, { ok: true, project: m.project, woken });
          return;
        }
        // POST /v2/module/approve-all  body: { projectId, text }
        if (req.method === 'POST' && path === '/v2/module/approve-all') {
          const body = await readBody(req);
          if (!body || !body.projectId) { json(400, { ok: false, error: '缺少 projectId' }); return; }
          const r = await approveAllGates(String(body.projectId), body.text, body.sessionId || sessionId);
          if (r.ok) json(200, { ok: true, count: r.count, project: r.project });
          else json(404, { ok: false, error: r.error });
          return;
        }
        // ---- 会话事件（供 Synapse 会话地图读取；支持 fromSeq 增量拉取） ----
        if (req.method === 'GET' && path === '/v2/session-events') {
          const sid = sessionId || url.searchParams.get('id') || '';
          if (!sid) { json(400, { ok: false, error: '缺少 sessionId' }); return; }
          try {
            const persistence = ctx.get('sessionPersistence');
            if (!persistence) { json(500, { ok: false, error: 'sessionPersistence 服务不可用' }); return; }
            const fromSeq = Math.max(0, parseInt(url.searchParams.get('fromSeq') || '0', 10) || 0);
            // readFrom 读的是磁盘上已持久化的后缀；write-behind 延迟（200ms）内的
            // 事件还未落盘，需要从活跃 Session 的内存日志补充。
            const result = await persistence.readFrom(sid, fromSeq);
            let rawEvents = (result && result.events) || [];
            const maxPersistedSeq = rawEvents.length ? rawEvents[rawEvents.length - 1].seq : (fromSeq > 0 ? fromSeq - 1 : -1);
            // 补充内存中未落盘的事件（当前正在进行的轮次）
            const sessions = ctx.get('sessions');
            const liveSession = sessions && sessions.get(sid);
            if (liveSession) {
              const allLive = [...liveSession.events]; // Session.events getter 返回完整日志
              const tail = allLive.filter((e) => e.seq > maxPersistedSeq);
              if (tail.length) rawEvents = rawEvents.concat(tail);
            }
            // 首次全量拉取时截断头部，避免超大响应；增量拉取不截断
            if (fromSeq === 0 && rawEvents.length > 300) rawEvents = rawEvents.slice(-300);
            // nextSeq 基于已持久化的最大 seq（而非合并后的），避免内存尾部事件
            // 导致 nextSeq 跳过头，使后续增量轮询永远拉不到新持久化事件
            const nextSeq = maxPersistedSeq + 1;
            // ContentBlock[] → 纯文本（只取 text 块）
            const textOf = (blocks) => {
              if (typeof blocks === 'string') return blocks;
              if (!Array.isArray(blocks)) return '';
              const out = [];
              for (const b of blocks) if (b && b.type === 'text' && typeof b.text === 'string') out.push(b.text);
              return out.join('\n');
            };
            const clip = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…（截断）' : s; };
            const events = [];
            const toolByCall = new Map(); // 服务端按 callId 折叠 call+result
            let title = '';
            for (const ev of rawEvents) {
              const t = ev.type;
              const d = ev.data || {};
              if (t === 'session/title') { if (d.title) title = String(d.title); continue; }
              if (t === 'user/message') {
                // source.kind 区分真人消息（user）与插件注入的上下文（plugin 等）
                const srcKind = (d.source && d.source.kind) || 'user';
                const text = clip(textOf(d.content), 400);
                if (text) events.push({ seq: ev.seq, at: ev.time || 0, kind: 'user', source: srcKind, text });
              } else if (t === 'assistant/message') {
                const msg = d.message || {};
                const text = clip(textOf(msg.content), 400);
                if (text || d.interrupted) events.push({ seq: ev.seq, at: ev.time || 0, kind: 'assistant', text, interrupted: !!d.interrupted });
              } else if (t === 'tool/call') {
                const entry = { seq: ev.seq, at: ev.time || 0, kind: 'tool', callId: String(d.callId || ''), name: String(d.name || ''), args: clip(d.arguments || '', 240), result: null, isError: false, pending: true };
                events.push(entry);
                if (entry.callId) toolByCall.set(entry.callId, entry);
              } else if (t === 'tool/result') {
                const msg = d.message || {};
                const blk = Array.isArray(msg.content) ? msg.content[0] : null;
                const callId = String((blk && blk.toolCallId) || (msg.source && msg.source.callId) || '');
                const resText = clip(textOf(blk && blk.content), 800);
                const isError = !!(blk && blk.isError) || !!d.error;
                const open = callId ? toolByCall.get(callId) : null;
                if (open) { open.result = resText; open.isError = isError; open.pending = false; }
                else events.push({ seq: ev.seq, at: ev.time || 0, kind: 'tool', callId, name: '', args: '', result: resText, isError, resultOnly: true });
              }
              // 其余事件类型（chunk/turn 边界/压缩等）对会话地图无意义，跳过
            }
            json(200, { ok: true, sessionId: sid, title, events, nextSeq: nextSeq, live: !!liveSession });
          } catch (e) {
            json(500, { ok: false, error: String(e && e.message || e) });
          }
          return;
        }
        // ---- 会话 fork 关系（供 Synapse 分支可视化） ----
        if (req.method === 'GET' && path === '/v2/session-forks') {
          const sid = sessionId || url.searchParams.get('id') || '';
          try {
            const sessions = ctx.get('sessions');
            const persistence = ctx.get('sessionPersistence');
            const titleSvc = ctx.get('sessionTitle'); // 可选服务：折叠活跃会话标题
            const liveIds = new Set();
            const forks = [];
            const seen = new Set();
            // 内存中活跃会话（SessionHeader 无 title 字段；标题从 sessionTitle 服务折叠）
            if (sessions) {
              for (const s of sessions.list()) {
                const h = s.header || {};
                liveIds.add(h.id);
                if (h.parentSession && !seen.has(h.id)) {
                  seen.add(h.id);
                  let title = '';
                  try { const snap = titleSvc && titleSvc.get(s); if (snap && snap.title) title = String(snap.title); } catch { /* 标题折叠失败不阻塞 */ }
                  forks.push({ id: h.id, parentId: h.parentSession, title, cwd: h.cwd || '', createdAt: h.createdAt || 0, live: true });
                }
              }
            }
            // 持久化历史会话（含已归档；标题留空，避免为取标题全量解析每个日志）
            if (persistence) {
              try {
                const persisted = await persistence.list();
                for (const h of persisted) {
                  if (h.parentSession && !seen.has(h.id)) {
                    seen.add(h.id);
                    forks.push({ id: h.id, parentId: h.parentSession, title: '', cwd: h.cwd || '', createdAt: h.createdAt || 0, live: liveIds.has(h.id) });
                  }
                }
              } catch { /* 持久化读取失败不影响内存结果 */ }
            }
            // 只返回与当前会话相关的分支：自己是 fork、或自己的子分支、或同父的兄弟分支
            let filtered = forks;
            if (sid) {
              const self = forks.find((f) => f.id === sid);
              filtered = forks.filter((f) => f.id === sid || f.parentId === sid || (self && f.parentId === self.parentId));
            }
            filtered.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            json(200, { ok: true, forks: filtered, currentId: sid });
          } catch (e) {
            json(500, { ok: false, error: String(e && e.message || e) });
          }
          return;
        }
        json(404, { ok: false, error: 'not found' });
      } catch (e) {
        json(500, { ok: false, error: String(e && e.message || e) });
      }
    },
  }));

  // ===== 会话地图 SSE 实时推送 + 工作区持久化（Synapse 式能力） =====

  // SSE 客户端池：每 30s 清理断开的连接
  const sseClients = new Set();
  const sseInterval = setInterval(() => {
    for (const c of sseClients) {
      try { c.res.write(':keepalive\n\n'); } catch { sseClients.delete(c); }
    }
  }, 30000);
  ctx.on('dispose', () => clearInterval(sseInterval));

  /**
   * 归一化单条 DSH 会话事件为客户端格式。
   * 与 /v2/session-events 的投影逻辑完全一致。
   */
  const textOf = (blocks) => {
    if (typeof blocks === 'string') return blocks;
    if (!Array.isArray(blocks)) return '';
    const out = [];
    for (const b of blocks) if (b && b.type === 'text' && typeof b.text === 'string') out.push(b.text);
    return out.join('\n');
  };
  const clip = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…（截断）' : s; };

  function projectEvent(ev) {
    const t = ev.type, d = ev.data || {};
    if (t === 'session/title') return { kind: 'title', title: String(d.title || '') };
    if (t === 'user/message') {
      const srcKind = (d.source && d.source.kind) || 'user';
      const text = clip(textOf(d.content), 400);
      if (!text) return null;
      return { seq: ev.seq, at: ev.time || 0, kind: 'user', source: srcKind, text };
    }
    if (t === 'assistant/message') {
      const msg = d.message || {};
      const text = clip(textOf(msg.content), 400);
      if (!text && !d.interrupted) return null;
      return { seq: ev.seq, at: ev.time || 0, kind: 'assistant', text, interrupted: !!d.interrupted };
    }
    if (t === 'tool/call') {
      return { seq: ev.seq, at: ev.time || 0, kind: 'tool', callId: String(d.callId || ''), name: String(d.name || ''), args: clip(d.arguments || '', 240), result: null, isError: false, pending: true };
    }
    if (t === 'tool/result') {
      const msg = d.message || {};
      const blk = Array.isArray(msg.content) ? msg.content[0] : null;
      const callId = String((blk && blk.toolCallId) || (msg.source && msg.source.callId) || '');
      const resText = clip(textOf(blk && blk.content), 800);
      const isError = !!(blk && blk.isError) || !!d.error;
      return { seq: ev.seq, at: ev.time || 0, kind: 'tool', callId, name: '', args: '', result: resText, isError, resultOnly: true };
    }
    return null;
  }

  // SSE 端点：客户端建立长连接，服务端通过 session/event 监听实时推送
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dcs-cloud/v2/session-events/stream',
    handler: (req, res) => {
      const sid = (new URL(req.url || '', 'http://localhost')).searchParams.get('sessionId') || '';
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
        'x-accel-buffering': 'no',
      });
      res.write(':ok\n\n');
      const client = { res, sessionId: sid };
      sseClients.add(client);

      // 推送当前会话的已提交事件（全量回放）
      const pushEvent = (ev) => {
        const proj = projectEvent(ev);
        if (!proj) return;
        try { res.write('data: ' + JSON.stringify(proj) + '\n\n'); } catch { sseClients.delete(client); }
      };

      let disposeListener = null;
      if (sid) {
        const sessions = ctx.get('sessions');
        const session = sessions && sessions.get(sid);
        if (session) {
          // 回放已有事件
          for (const ev of session.events) pushEvent(ev);
          // 订阅后续事件
          const handler = (s, ev) => { if (s.id === sid) pushEvent(ev); };
          ctx.on('session/event', handler);
          disposeListener = () => ctx.off('session/event', handler);
        }
      }

      // 同时推送 fork 关系
      const pushForks = () => {
        try {
          const sessions = ctx.get('sessions');
          const persistence = ctx.get('sessionPersistence');
          const forks = [];
          const seen = new Set();
          if (sessions) {
            for (const s of sessions.list()) {
              const h = s.header || {};
              if (h.parentSession && !seen.has(h.id)) {
                seen.add(h.id);
                forks.push({ id: h.id, parentId: h.parentSession, cwd: h.cwd || '', createdAt: h.createdAt || 0 });
              }
            }
          }
          if (persistence) {
            persistence.list().then((persisted) => {
              for (const h of persisted) {
                if (h.parentSession && !seen.has(h.id)) {
                  seen.add(h.id);
                  forks.push({ id: h.id, parentId: h.parentSession, cwd: h.cwd || '', createdAt: h.createdAt || 0 });
                }
              }
              try { res.write('event: forks\ndata: ' + JSON.stringify(forks) + '\n\n'); } catch {}
            }).catch(() => {});
          } else {
            try { res.write('event: forks\ndata: ' + JSON.stringify(forks) + '\n\n'); } catch {}
          }
        } catch {}
      };
      pushForks();

      req.on('close', () => {
        sseClients.delete(client);
        // 插件重载/进程关闭时 Cordis 上下文可能已销毁，ctx.off 会抛
        // "cannot get property 'off' without inject"——吞掉即可，listener 随进程消亡自然回收。
        try { if (disposeListener) disposeListener(); } catch {}
      });
    },
  }));

  // 实时事件订阅：session/event 触发时推送到所有匹配的 SSE 客户端
  ctx.on('session/event', (session, event) => {
      const proj = projectEvent(event);
      if (!proj) return;
      const data = 'data: ' + JSON.stringify(proj) + '\n\n';
      for (const c of sseClients) {
        if (!c.sessionId || c.sessionId === session.id) {
          try { c.res.write(data); } catch { sseClients.delete(c); }
        }
      }
    });
    // 会话创建时推送 fork 更新
    ctx.on('session/created', () => {
      // fork 关系变更：广播给所有客户端
      const sessions = ctx.get('sessions');
      if (!sessions) return;
      const forks = [];
      const seen = new Set();
      for (const s of sessions.list()) {
        const h = s.header || {};
        if (h.parentSession && !seen.has(h.id)) {
          seen.add(h.id);
          forks.push({ id: h.id, parentId: h.parentSession, cwd: h.cwd || '', createdAt: h.createdAt || 0 });
        }
      }
      const data = 'event: forks\ndata: ' + JSON.stringify(forks) + '\n\n';
      for (const c of sseClients) {
        try { c.res.write(data); } catch { sseClients.delete(c); }
      }
    });
  // session/created 结束

  // ---------- 编排引导（systemPrompt） ----------

  ctx.systemPrompt.section({
    name: 'dcs-cloud',
    order: 160,
    text: () => `【DCS 云研究（DCS Harness v2·Genpilot 默认）】本会话已接入 DCS Cloud（通过 dcs CLI，https://github.com/BGIResearch/dcs_cli）。**默认引擎 = DCS Genpilot**：你是「使用科学家」导师，只负责分解科学问题、制定方案、指导与监督；**一切分析计算默认交由 DCS Genpilot 智能交互执行**（在线容器交互 / 离线并行 / dcs_llm 对话），**不自上而下手写整套分析代码**。**每次使用均为独立的 Genpilot 项目**（一次使用=一个 DCS 项目）。遵循以下流程（**用户输入问题后，先规划、再执行，绝不直接开跑**）：
  - ⚠️ 模型区分：Genpilot LLM（对话/写作，deepseek-v4-pro 等，系统自动鉴权）≠ Genos 预测模型（VCF→RNA 信号，1.2B 参数，需用户 API key——用 dcs_api_key set genos_vep <key> 配置）。
0. 立项（Genpilot 项目 + 数据确认）：先用 dcs_project_create 在 genpilot 创建本项目（name 用研究任务英文名，如 E16.5MouseSpatial；billing_group 缺省自动取第一个授权计费组），返回的 project_code 作为 project_id 传给 dcs_project_update 建立本地记录（title + objective + model，模型默认 auto=由你决定最佳；如用户指定 deepseek-v4-pro/deepseek-v4-flash/qwen3.7-max/glm-5.2/kimi-k3 则用指定值）。**第一时间主动询问用户是否提供自有数据**：在对话窗口用 ask_user_question 提出"你是否有想用的数据？"（本地路径/容器 /work/.../链接/公共库编号，不限类型），并请用户附上每份数据的用途描述；用户给出后用 customData.items 登记（每项 {path, desc}）。若用户无自有数据，说明将优先用 DCS 公共库 /public 数据，并继续。**数据确认是规划的第一步，不要跳过**。
0.5. 优先复用 DCS skill / 专家：发起分析前，先 dcs_skills_list（按 category/keyword/native/scope 检索）→ dcs_skill_read 读 SKILL.md，复用可用的 skill；用户自建的个人技能位于容器 /work/{user}/skills/<技能名>/SKILL.md（dcs_skills_list scope=personal 列出，dcs_skill_read 传 personal/<技能名> 或叶子名读取）——个人技能优先级高于同名公共技能；需要某方向专家（单细胞/空间/WGS-WES/临床肝癌/感染等）用 dcs_experts_list → dcs_expert_read 读取 AGENTS.md/SOUL.md，把该专家的思路与流程模板融入研究方案与产出。**不确定用什么 skill/工作流/专家时，直接 dcs_skill_route task=<模块目标> 一步探测**（内部合并技能库+公共工作流+专家库并按相关度排序，可选 llm_rank 二次排序）——软约束，不强制，别拖慢执行。
   - 技能 API key 管理：若技能需要 API key（如 Genos‑VEP / Genos‑Mutation 需要 HG38_VCF_PREDICT_API_KEY），用 dcs_api_key set genos_vep <key> 或 dcs_configure api_keys={"genos_vep":"sk-..."} 配置。key 持久化于 ~/.dsh/dcs-cloud.json（600 权限），调用技能时自动注入。首次使用前提示用户从 DCS Cloud「个人资料→API_key 管理」申请。
A. **学术检索**：先了解整个研究背景。用 web_search / 子代理检索该领域的关键文献、物种/疾病背景、已知结果与常用分析范式；用 dcs_atlas 查「数据库全图谱」（片区公共库 + 官方组学工具库 + 关键词映射 + 容器公共数据集）+ dcs_container_ls 列 /public、dcs_public_search 搜公共库元数据、dcs_find_results 看 /work 已有分析——**摸清"这个领域有什么可用的数据资源、有哪些成熟流程可复用"**。
B. **给出分析计划（第二步）**：综合检索结果，用 dcs_plan_update 产出分析计划（科学问题 → 数据来源（公共库 or 自有数据）→ 方法步骤（分成几个模块）→ 预期产出），**planStatus 设为 awaiting_review**，把计划清晰呈现给用户。
C. **与用户互动修改计划（第三步）**：把计划清晰呈现给用户（对话里给摘要，模块明细在「项目管理」窗口）。用户可以在对话里提需求，也可以在窗口对模块逐个提意见；**计划的批准以窗口「🚀 批准计划并自动执行」按钮为准**（planStatus 由系统自动置为 approved），AI 不要自行把 planStatus 置为 approved，也不要用 ask_user_question 反复追问确认；用户在对话里对计划提出修改时，直接修订模块/计划后再请用户复审。
C2. **human-in-the-loop 批量审核制（规划人机共创 + 执行全自动）**：分两个阶段——
（规划阶段·人机共创）用户提出问题后，检索调研并形成模块规划：用 dcs_module_update 写入全部模块（含 name/desc/dependsOn），用 dcs_plan_update 提交分析计划（planStatus=awaiting_review）。然后停下，请用户在「项目管理」窗口逐个模块审核（可提纠正/设想/意见，可跳过）。**不要再使用 isGate 闸门节点**——审核以项目为单位一次性完成。用户审核后会点「🔄 根据意见重新修正计划」，此时：① 用 dcs_module_feedback 读出全部待处理反馈（含原文）；② 逐条针对性修订对应模块（改 desc / 拆分新增子模块 / 调整 dependsOn，必要时用 dcs_plan_update 同步计划），无意见的模块保持原样；③ 每修订一个模块用 dcs_module_update 传 replyFeedback 说明改了什么、为什么（反馈随之自动闭环）；④ 全部修订完明确告诉用户「修订完成，请复审」，停下等待——不要自行开始执行。此循环可多轮，直到用户满意。
（执行阶段·全自动+自批评长循环）用户点「🚀 批准计划并自动执行」后（planStatus=approved）：按 dependsOn 顺序依次完成全部模块（dcs_run_start / dcs_run_update 登记每次运行与产物），**不再设任何审查节点、不暂停、不请示**——可自行决策的问题选合理默认并继续。**每个模块完成后强制「评估-调整循环」**（对标 Biomni 长 loop，纯执行阶段增强，不动批量审核制）：
   ① **检查产物**：离线任务用 dcs_task_status 看状态/费用，容器产物用 dcs_terminal_exec 验证文件是否存在/大小/行数/关键数值；
   ② **写 OAA**：在 dcs_run_update 的 oaa 字段写结构化三段（observation 观察=客观证据 / assessment 评估=对照目标判断 / action 行动=下一步），notes 同步简述；关键节点（失败/数据异常/长任务完成）再用 dcs_self_review 自评，输出 verdict（pass 通过 / revise 需调整 / rerun 需重跑）；
   ③ **自适应调整**：发现异常 → 允许用 dcs_module_update 调整**后续未开始模块**的 desc/顺序（不新增模块、不触发人审），并把调整理由记入交付「执行轨迹」章节；
   ④ **失败语义**：先 dcs_self_review 分析原因——可修的改方案继续；需重跑的用 dcs_run_start 重开 v2（历史版本保留）；个别模块实在失败则记录原因并继续其余模块，最后统一说明。
   全部完成后用 dcs_delivery_update（includeTrajectory=true）汇总交付并向用户报告。
D. 执行（全自动+自批评）：计划批准后，按 dependsOn 顺序依次执行全部模块；每个模块一次执行用 dcs_run_start 开启新版本（v1/v2…，可重复运行，历史版本全部保留），用 dcs_run_update 登记状态/进度/产物/OAA；中途不停顿、不设审查节点、不需人工干预，全部完成后统一汇总交付。
1. 定方向：用 dcs_atlas 查「数据库全图谱」（片区公共库 + 官方组学工具库 + 关键词映射 + 容器公共数据集）。
2. 找数据（容器 /public 第一优先级）：用 dcs_container_ls 列 /public（公共库挂载）——**优先在 BGI Center 片区节点（BGI-时空等）的容器 /public 里找**，公共数据集在 /public/database/CNGBdb/pub/SciRAID/stomics/（STDS 编号）；用 dcs_data_inspect 看 h5ad/csv 结构；容器 /public 里没有时再用 dcs_public_search 搜公共库元数据、dcs_data_find 查 /Files；避免重复：先 dcs_find_results 看 /work 里 Genpilot 是否已跑过；外部数据下载（dcs_data_download）是最后手段。**若用户提供了自有数据（customData），优先用用户数据，DCS 公共库仅作补充/对照**。
3. 深度研究：用 web_search / 子代理检索文献；需求不明用 ask_user_question 与用户确认，形成研究方案并写入交付文档 question/hypothesis/decomposition。
4. 方案（第一优先级 = 交给 DCS Genpilot 智能执行）：**分析计算一律优先交由 DCS Genpilot 在线容器交互完成**（dcs_terminal_exec / dcs_terminal_file，写 stepN_*.py 由 Genpilot 环境执行），或复用现有 WDL 流程（dcs_workflow_search / dcs_workflow_info / dcs_workflow_run）；**你只做方案设计与结果把关，不自上而下手写整套分析代码**。仅在 Genpilot 无法覆盖的极少数场景，才用 dcs_audit_script 审计后自行补充。
5. 执行（监督与登记）：指导 Genpilot 用 dcs_terminal_exec 在线跑分析；**长任务/并行 → dcs_offline_run（资源 "4c 16g" 或 "vf=32g,num_proc=8" 均可，插件自动转换；会返回 task_id）或 dcs_parallel_run（返回 task_ids）**；标准镜像 ubuntu:24.04-python3.12。每个模块的每次运行：dcs_run_start 开启 → 监督执行 → dcs_run_update 更新状态/进度/文件清单（code/input/output）/notes/**oaa**，**并把离线任务返回的 task_id / task_ids 填入 dcs_task_ids 字段**（供「项目管理」窗口拉取实时费用）。**OAA 是硬性要求**：每个模块完成后必须写 observation/assessment/action 三段；失败或数据异常先 dcs_self_review 定位原因，再决定重跑 v2（dcs_run_start 自动 v2）还是调整后续模块。
6. 审计（监督）：执行前用 dcs_audit_script 审计脚本，确认无 critical/high 风险。
7. 解读与写作：用 dcs_llm 调 DCS Genpilot LLM（对话模型，deepseek-v4-pro 等，自动选模型，系统自动鉴权）做变异解读/文献综合/论文写作；dsh 负责把关与整合。如需 Genos 预测（VCF→RNA 信号），用 dcs_api_key 配置后调用 Genos‑VEP / genos‑mutation skill。
8. 交付（结果交付窗口）：**在关键节点（立项、数据就绪、主要分析完成、得出初步结论、项目收尾）用 dcs_delivery_update 按论文逻辑整体梳理更新**：科学问题 → 科学假说 → 科学问题分解 → 原始数据 → 分析方法 → 科学发现与主要结论 → 创新性与已有研究的关系 → 下一步计划与建议 → 执行轨迹。每次调用是整体梳理（revision 递增），不是零碎打补丁；**调整过模块顺序/desc、主要分析完成、收尾时带 includeTrajectory=true，自动把各模块 OAA/自评/产物汇总成「执行轨迹」章节**（Biomni 式推理图的可读产物，调整理由也要写进该章）。**核心要求：结果必须"图文一体"——每张图/表都嵌进它对应的那条具体结果里，紧跟文字解读，而不是堆到末尾**。做法：
   - 先在 charts 参数里为每张图/表起唯一 id，type 用 image（分析生成的 fig*.png，传容器路径自动内嵌）/ bar / line / scatter / heatmap / summary / table 等；
   - 在 sections 正文里，用「%%chart:图id%%」把图/表**插到该结果块的文字中间**，紧随其后写 2-4 句解读（图中最关键的数值、趋势、生物学含义），形成"结论句 → 图表 → 解读句"的紧凑结构。示例（clear 写法）：
     「### 发现 2：窗口 GC 近正态分布 …… 100kb 窗口 GC 呈近正态（籼稻 43.6±2.1%，粳稻 43.7±2.8%）。\[%%chart:fig2_window%%\] ……（解读）粳稻波动更大、存在 62% 的极端富集窗口，末端 GC 明显升高，与端粒附近基因密度高一致。」
   - 每个「### 发现 N」结果块都应至少内嵌 1 张对应图；未被正文引用的图会自动归入末尾「数据图表」区（尽量不用，保证图文一体）。
   - 图表 data 结构：bar/line 用 {labels, values} 或 {labels, series:[{name,values}]}；summary 用 {labels,values} 或 KV；table 用 {columns:[], rows:[[..]]}；image 传容器图片路径（如 /work/.../fig1.png，**插件会自动下载到本机交付目录，交付展示离线可用**，无需你手动处理 base64）。把分析生成的 fig*.png 也登记到对应 run 的 files.output 里。
   - **3D 分子结构（structure3d）**：蛋白/复合物结构（AlphaFold、PDB、叠合对比）用 type:"structure3d"，data 为 {structures:[{pdb:"/work/.../x.pdb", label:"BRCA1 AF", color:"#e74c3c"}], style:"cartoon|stick|sphere|surface", colorBy:"spectrum|chain|plddt|custom", layout:"sideBySide|overlay", height:480}（data 直接给单个 PDB 路径字符串也可以）。AlphaFold 结果用 colorBy:"plddt"（B-factor 列=置信度，蓝高红低）；多结构对比用 layout:"overlay" + 工具栏「结构叠合」（Cα 最小二乘）。PDB 文件也会自动本地化，容器离线后仍可查看。
9. 报告：用 dcs_generate_report 出 HTML 网页（figures 可传容器图片路径，自动内嵌；图表随文插入对应章节）、dcs_plan 更新 Plan.md，按学术逻辑交付。
- 登录/状态：首次用 dcs_login（PAT），用 dcs_status 看当前项目/片区；模型与**节点（片区）**都可在「项目管理」窗口切换（写入项目 model / region 字段）；切换节点即 dcs region switch，影响该项目的后续数据/流程/容器操作所在片区。`,
  });
}
