// dsh-dcs-cloud — 学术报告生成（Host 侧，纯 Node）。
// 将研究方案、方法、结果、图表整理成自包含的 HTML 网页，供用户检查。
// 图片以 base64 内嵌，报告可脱离工作区独立打开。
// 图片路径支持：本机绝对/相对路径，或 DCS 容器路径（/work/...、/data/...，自动 terminal download 到缓存）。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

// 容器图片下载缓存目录
const imgCacheDir = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dcs-img-cache');

// 复用 dcs-client 的二进制解析/命令执行，避免临时从 PATH 找不到 dcs 二进制。
// 在调用时动态 import（report.js 被单独打包，不静态依赖 dcs-client 的副作用）。
async function dcsDownload(cfg, remotePath, localPath) {
  try {
    const { runDcs, resolveDcsBinary } = await import('./dcs-client.js');
    const bin = await resolveDcsBinary(cfg || {}, null);
    const r = await runDcs(cfg || {}, ['terminal', 'download', '-p', remotePath, '-t', localPath], { timeoutMs: 90000 });
    return r && r.ok ? true : false;
  } catch {
    return false;
  }
}

/** 从 DCS 容器下载文件到本机缓存目录，返回本地路径或 null。 */
async function downloadContainerFile(cfg, remotePath) {
  try {
    mkdirSync(imgCacheDir, { recursive: true });
    const key = 'img-' + createHash('sha1').update(String(remotePath)).digest('hex').slice(0, 16) + (extname(remotePath) || '.png');
    const local = join(imgCacheDir, key);
    if (!existsSync(local)) {
      const ok = await dcsDownload(cfg, remotePath, local);
      if (!ok) return null;
    }
    return existsSync(local) ? local : null;
  } catch {
    return null;
  }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 极简 Markdown → HTML（支持标题、粗体、行内代码、代码块、列表、表格、链接）。
function mdToHtml(md) {
  const src = String(md == null ? '' : md);
  const lines = src.split(/\r?\n/);
  const out = [];
  let inCode = false;
  let codeBuf = [];
  let inTable = false;
  let tableBuf = [];
  let listStack = 0;

  const closeList = () => { while (listStack > 0) { out.push('</ul>'); listStack--; } };
  const closeTable = () => {
    if (inTable) {
      let html = '<table><thead><tr>';
      const header = tableBuf[0] || [];
      for (const h of header) html += '<th>' + inline(h) + '</th>';
      html += '</tr></thead><tbody>';
      for (let i = 2; i < tableBuf.length; i++) {
        const row = tableBuf[i] || [];
        html += '<tr>';
        for (const c of row) html += '<td>' + inline(c) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
      out.push(html);
      tableBuf = [];
      inTable = false;
    }
  };

  function inline(s) {
    return String(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  function splitRow(line) {
    return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
  }
  function isTableSep(line) { return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.indexOf('-') !== -1; }

  const flushCode = () => {
    if (inCode) {
      out.push('<pre><code>' + esc(codeBuf.join('\n')) + '</code></pre>');
      codeBuf = [];
      inCode = false;
    }
  };

  for (let line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) { flushCode(); }
      else { closeList(); closeTable(); inCode = true; codeBuf = []; }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    if (isTableSep(line)) {
      if (!inTable) { closeList(); inTable = true; tableBuf = []; tableBuf.push(splitRow(lines[lines.indexOf(line) - 1] || '')); }
      tableBuf.push([]); // 分隔行占位
      continue;
    }
    if (/^\s*\|/.test(line)) {
      closeList();
      if (!inTable) { inTable = true; tableBuf = []; }
      tableBuf.push(splitRow(line));
      continue;
    }
    closeTable();

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { closeList(); const n = h[1].length; out.push('<h' + n + '>' + inline(h[2]) + '</h' + n + '>'); continue; }

    if (/^\s*[-*+]\s+/.test(line)) {
      if (listStack === 0) { out.push('<ul>'); listStack = 1; }
      out.push('<li>' + inline(line.replace(/^\s*[-*+]\s+/, '')) + '</li>');
      continue;
    }
    closeList();

    if (line.trim() === '') { out.push(''); continue; }
    out.push('<p>' + inline(line) + '</p>');
  }
  flushCode();
  closeList();
  closeTable();
  return out.join('\n');
}

function imageToB64(abs) {
  try {
    const buf = readFileSync(abs);
    if (buf.length > 8 * 1024 * 1024) return null; // 跳过超大图
    return 'data:image/' + (extname(abs).toLowerCase().replace('.', '') || 'png') + ';base64,' + buf.toString('base64');
  } catch {
    return null;
  }
}

function resolvePath(p, workspace) {
  if (!p) return null;
  return isAbsolute(p) ? p : join(workspace || process.cwd(), p);
}

/** 容器路径识别：/work/、/data/、/public/ 等 DCS 容器内路径。 */
function isContainerPath(p) {
  return /^\/(work|data|public|home|root|tmp|opt|Files)\//.test(p);
}

/**
 * 生成学术报告 HTML。
 * @param {object} r 报告结构
 *   r.title, r.objective, r.abstract, r.introduction,
 *   r.methods (markdown), r.results (markdown),
 *   r.figures [{path,caption}], r.discussion, r.references (markdown),
 *   r.appendix (markdown), r.metadata {author, date, task}
 * @param {object} opts { workspace, outDir, outPath, dcsCfg } — dcsCfg 用于容器图片下载
 * @returns {{path, html, figures}} 落盘路径、HTML 文本、成功内嵌图片数
 */
export async function generateReport(r, opts) {
  const workspace = (opts && opts.workspace) || process.cwd();
  const outDir = (opts && opts.outDir) || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dcs-reports');
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = (opts && opts.outPath) || join(outDir, 'dcs-report-' + stamp + '.html');
  const cfg = (opts && opts.dcsCfg) || null;

  // 逐图解析：本机路径直接读；容器路径先下载再内嵌
  const figures = [];
  for (const f of (r.figures || [])) {
    const raw = f.path || '';
    const kind = f.kind || 'image'; // image/video/audio/iframe/link
    let abs = null;
    let b64 = null;
    if (kind === 'image') {
      if (isContainerPath(raw)) {
        abs = await downloadContainerFile(cfg, raw);
        b64 = abs ? imageToB64(abs) : null;
        if (!b64) b64 = imageToB64(resolvePath(raw, workspace)); // 兜底：本地也有一份
      } else {
        abs = resolvePath(raw, workspace);
        b64 = abs ? imageToB64(abs) : null;
      }
    }
    figures.push({
      id: f.id || 'fig' + (figures.length + 1),
      caption: f.caption || '',
      src: b64,
      path: raw,
      kind,
      ok: kind === 'image' ? !!b64 : !!raw,  // 媒体类型无需 base64，有路径即可
      anchor: f.anchor || '',   // 可选：插入到含该关键字（章节标题/序号）的 section 之后
    });
  }

  const figToHtml = (f) => {
    const cap = f.caption ? '<figcaption>' + esc(f.caption) + '</figcaption>' : '';
    if (!f.ok) return '<figure class="fig missing"><div class="fig-ph">媒体缺失：' + esc(f.path || '') + '</div>' + cap + '</figure>';
    if (f.kind === 'video') return '<figure class="fig"><video src="' + esc(f.path) + '" controls preload="metadata" style="max-width:100%;border-radius:8px"></video>' + cap + '</figure>';
    if (f.kind === 'audio') return '<figure class="fig"><audio src="' + esc(f.path) + '" controls style="width:100%"></audio>' + cap + '</figure>';
    if (f.kind === 'iframe') return '<figure class="fig"><div style="position:relative;padding-top:62.5%;border-radius:8px;overflow:hidden"><iframe src="' + esc(f.path) + '" style="position:absolute;inset:0;width:100%;height:100%;border:0" allowfullscreen loading="lazy"></iframe></div>' + cap + '</figure>';
    if (f.kind === 'link') return '<figure class="fig"><a href="' + esc(f.path) + '" target="_blank" rel="noopener noreferrer">' + esc(f.caption || '打开链接') + '</a></figure>';
    return '<figure class="fig"><img src="' + f.src + '" alt="' + esc(f.caption) + '">' + cap + '</figure>';
  };
  // 未被正文引用的图，统一放末尾「图表」附录 section
  const figHtml = figures.map(figToHtml).join('\n');

  const tocItems = [];
  const tocLink = (label) => { const id = 'sec-' + tocItems.length; tocItems.push({ id, label }); return id; };

  const meta = r.metadata || {};
  const metaHtml = [
    meta.author ? '<div class="meta-author">' + esc(meta.author) + '</div>' : '',
    meta.date ? '<div class="meta-date">' + esc(meta.date) + '</div>' : '',
    meta.task ? '<div class="meta-task">任务：' + esc(meta.task) + '</div>' : '',
  ].filter(Boolean).join('');

  const tocHtml = tocItems.length
    ? '<nav class="toc"><h2>目录</h2><ul>' + tocItems.map((t) => '<li><a href="#' + t.id + '">' + esc(t.label) + '</a></li>').join('') + '</ul></nav>'
    : '';

  const figByAnchor = {};   // anchor 关键字 -> [figure html]
  const figById = {};       // id -> figure html
  for (const f of figures) {
    const h = figToHtml(f);
    figById[f.id] = h;
    if (f.anchor) {
      (figByAnchor[f.anchor] = figByAnchor[f.anchor] || []).push(h);
    }
  }

  // 渲染一个 section 的正文：把 %%fig:id%% / %%chart:id%% 占位符替换为对应 figure HTML（图随文插入）
  // 注：与交付窗口（client.js）统一使用 %%chart:id%%；%%fig:id%% 保留向后兼容。
  // 修复 Genos #12：占位符若嵌在行内（如 [%%chart:fig1%%] 或 **…%%chart:fig1%%…**），
  // 直接在 mdToHtml 之后 replace 会把 <div>（块级）插进 <p>/<strong>，产生 <p>[<div…>]</p> 与残留括号。
  // 因此先在 markdown 层把占位符剥掉包裹符号、拆到独立块，再做 mdToHtml，最后按块替换。
  const renderBody = (md) => {
    const src = String(md || '')
      .replace(/\[?\s*%{2}(fig|chart):([^%\s]+)%{2}\s*\]?/g, '\n\n%%$1:$2%%\n\n');
    let body = mdToHtml(src);
    for (const id in figById) {
      const escId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const figureHtml = '<div class="fig-inline">' + figById[id] + '</div>';
      // 独立成段的占位符：mdToHtml 会包成 <p>%%chart:id%%</p>，直接整段替换为 figure 块
      body = body.replace(new RegExp('<p>%{2}(?:fig|chart):' + escId + '%{2}</p>', 'g'), figureHtml);
      // 兜底：字节级残留（多图横排时相邻 div 之间的孤行）再做一次裸替换
      body = body.replace(new RegExp('%{2}(?:fig|chart):' + escId + '%{2}', 'g'), figureHtml);
    }
    // 删除残留的未定义占位符
    body = body.replace(/%{2}(?:fig|chart):[^%]+%{2}/g, '');
    return body;
  };

  // 正文中出现过 %%fig:id%% / %%chart:id%% 的图视为"随文引用"，不再放入末尾附录
  const allBody = [r.abstract, r.introduction, r.methods, r.results, r.discussion, r.appendix].join('\n');
  const referenced = new Set();
  for (const f of figures) {
    if (figById[f.id] && (allBody.indexOf('%%fig:' + f.id + '%%') !== -1 || allBody.indexOf('%%chart:' + f.id + '%%') !== -1)) referenced.add(f.id);
  }
  // 未被正文引用、且无 anchor 的图，放末尾「图表」附录
  const leftover = figures.filter((f) => !referenced.has(f.id) && !f.anchor);
  const leftoverHtml = leftover.map(figToHtml).join('\n');

  const section = (label, md) => {
    let body = renderBody(md);
    // anchor：本 section 标题匹配则把带该 anchor 的图追加到正文末尾（图随章节插入，非末尾堆积）
    if (figByAnchor[label]) body += figByAnchor[label].join('\n');
    return '<section id="' + tocLink(label) + '"><h2>' + esc(label) + '</h2>' + body + '</section>';
  };

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.title || 'DCS Cloud 研究报告')}</title>
<style>
:root{--fg:#1a1a2e;--muted:#5b6172;--accent:#0f62fe;--line:#e3e6ee;--bg:#f6f7fb;--card:#ffffff;}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;color:var(--fg);background:var(--bg);line-height:1.7}
.wrap{max-width:900px;margin:0 auto;padding:40px 28px 80px}
header.titlepage{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:36px 40px;margin-bottom:28px}
h1.report-title{font-size:30px;line-height:1.35;margin:0 0 16px}
.subtitle{color:var(--muted);font-size:14px}
.meta{display:flex;flex-wrap:wrap;gap:8px 20px;color:var(--muted);font-size:13px;margin-top:18px}
.badge{display:inline-block;background:var(--accent);color:#fff;border-radius:999px;padding:2px 12px;font-size:12px;letter-spacing:.5px}
nav.toc{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px 26px;margin-bottom:28px}
nav.toc h2{font-size:14px;margin:0 0 10px;color:var(--muted)}
nav.toc ul{list-style:none;margin:0;padding:0}
nav.toc li{margin:4px 0}
nav.toc a{color:var(--accent);text-decoration:none;font-size:14px}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:26px 34px;margin-bottom:22px}
section h2{font-size:20px;margin:0 0 14px;border-left:4px solid var(--accent);padding-left:12px}
section h3{font-size:16px;margin:20px 0 8px}
section h4{font-size:15px;margin:16px 0 6px}
p{margin:10px 0}
code{background:#eef1f7;border-radius:4px;padding:1px 6px;font-family:"SF Mono",Menlo,Consolas,monospace;font-size:.9em}
pre{background:#0f1220;color:#e6e9f2;border-radius:8px;padding:16px;overflow:auto}
pre code{background:none;color:inherit;padding:0}
table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px}
th,td{border:1px solid var(--line);padding:8px 12px;text-align:left}
th{background:#f0f3fa}
figure.fig{margin:18px 0;text-align:center}
figure.fig .fig-inline{display:inline-block}
figure.fig img{max-width:100%;border:1px solid var(--line);border-radius:8px}
figure.fig figcaption{color:var(--muted);font-size:13px;margin-top:8px}
figure.fig .fig-ph{background:#fff3f3;border:1px dashed #e0a;border-radius:8px;padding:30px;color:#b03}
.fig-inline{margin:4px 0}
a{color:var(--accent)}
footer{margin-top:34px;color:var(--muted);font-size:12px;text-align:center}
@page{size:A4;margin:18mm 16mm}
@media print{body{background:#fff;word-break:keep-all;overflow-wrap:break-word}section,header.titlepage,nav.toc{border:none;box-shadow:none;orphans:3;widows:3}header.titlepage{page-break-after:always}h1,h2,h3,h4{page-break-after:avoid}figure.fig,.fig-inline,pre,table{page-break-inside:avoid}nav.toc{page-break-after:always}footer{position:fixed;bottom:0;width:100%;text-align:center}section{page-break-inside:auto}}
</style>
</head>
<body>
<div class="wrap">
<header class="titlepage">
  <div class="subtitle">DCS Cloud 研究报告 · 由 dsh-dcs-cloud 自动生成</div>
  <h1 class="report-title">${esc(r.title || '研究报告')}</h1>
  ${r.objective ? '<div class="subtitle">研究目标：' + esc(r.objective) + '</div>' : ''}
  <div class="meta">${metaHtml || '<span class="subtitle">' + esc(r.title || '') + '</span>'}</div>
</header>
${tocHtml}
${r.abstract ? section('摘要', r.abstract) : ''}
${r.introduction ? section('引言与背景', r.introduction) : ''}
${r.methods ? section('研究方案与方法', r.methods) : ''}
${r.results ? section('结果', r.results) : ''}
${leftoverHtml ? '<section id="' + tocLink('图表') + '"><h2>图表</h2>' + leftoverHtml + '</section>' : ''}
${r.discussion ? section('讨论', r.discussion) : ''}
${r.references ? section('参考文献', r.references) : ''}
${r.appendix ? section('附录', r.appendix) : ''}
<footer>由 dsh-dcs-cloud 生成 · ${esc(new Date().toISOString())}</footer>
</div>
</body>
</html>`;

  writeFileSync(outPath, html, 'utf8');
  return { path: outPath, html, figures: figures.filter((f) => f.ok).length, totalFigures: figures.length };
}
