window.__ModuleLoader__.load({ id: "dsh-dcs-cloud", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";

var React = require("react");
var h = React.createElement;

// ================= 工具函数 =================

function injectCss() {
  if (document.getElementById("dsh-dcs-cloud-v2-css")) return;
  var style = document.createElement("style");
  style.id = "dsh-dcs-cloud-v2-css";
  style.textContent =
    /* 通用 */
    ".dcs2{font-size:14px;line-height:1.6;color:inherit}" +
    ".dcs2 h2{margin:0 0 4px;font-size:15px;font-weight:600}" +
    ".dcs2 h3{margin:18px 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;opacity:.65}" +
    ".dcs2 .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
    ".dcs2 .muted{opacity:.6;font-size:12px}" +
    ".dcs2 .badge{font-size:11px;padding:1px 8px;border-radius:999px;color:#fff;white-space:nowrap}" +
    ".dcs2 .badge.pending{background:#8a8f98}.dcs2 .badge.running{background:#0f62fe}.dcs2 .badge.done{background:#22a06b}.dcs2 .badge.failed{background:#e5484d}.dcs2 .badge.blocked{background:#f5a524}" +
    ".dcs2 .bar{height:5px;border-radius:3px;background:rgba(128,128,128,.2);overflow:hidden;flex:1;min-width:60px}" +
    ".dcs2 .bar .fill{height:100%;background:#0f62fe;transition:width .4s}.dcs2 .bar .fill.done{background:#22a06b}.dcs2 .bar .fill.failed{background:#e5484d}" +
    ".dcs2 .card{border:1px solid rgba(128,128,128,.25);border-radius:10px;padding:12px 14px;margin-bottom:10px}" +
    ".dcs2 .empty{border:1px dashed rgba(128,128,128,.4);border-radius:10px;padding:36px 20px;text-align:center;opacity:.7}" +
    ".dcs2 .chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}" +
    ".dcs2 .chip{padding:5px 12px;border-radius:999px;border:1px solid rgba(128,128,128,.4);cursor:pointer;background:transparent;color:inherit;font-size:12px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".dcs2 .chip.on{background:#0f62fe;border-color:#0f62fe;color:#fff}" +
    ".dcs2 .btn{padding:6px 14px;border-radius:8px;border:1px solid rgba(128,128,128,.5);background:transparent;color:inherit;cursor:pointer;font-size:13px}" +
    ".dcs2 .btn.primary{background:#0f62fe;border-color:#0f62fe;color:#fff}" +
    ".dcs2 .btn:disabled{opacity:.5;cursor:default}" +
    ".dcs2 .refresh{padding:5px 12px;border-radius:6px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;cursor:pointer;font-size:12px}" +
    ".dcs2 select{max-width:280px;padding:5px 8px;border-radius:6px;border:1px solid rgba(128,128,128,.45);background:transparent;color:inherit;font-size:13px}" +
    /* 任务交互 */
    ".dcs2 .interact-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}" +
    ".dcs2 .interact-title{font-size:18px;font-weight:700}" +
    ".dcs2 .interact-obj{opacity:.8;margin:4px 0 0}" +
    ".dcs2 .interact-stats{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0 2px}" +
    ".dcs2 .interact-stat{font-size:12.5px;opacity:.8}" +
    ".dcs2 .interact-stat b{font-size:15px;margin-right:3px}" +
    ".dcs2 .modrow{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed rgba(128,128,128,.2)}" +
    ".dcs2 .modrow:last-child{border-bottom:none}" +
    ".dcs2 .modname{font-weight:600;min-width:150px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".dcs2 .moddesc{font-size:12px;opacity:.65;width:100%;margin-top:2px}" +
    ".dcs2 .modver{font-size:11.5px;opacity:.6;font-family:monospace}" +
    /* 项目管理 */
    ".dcs2 .proj-mod{border:1px solid rgba(128,128,128,.25);border-radius:12px;margin-bottom:12px;overflow:hidden}" +
    ".dcs2 .proj-mod-head{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none;flex-wrap:wrap}" +
    ".dcs2 .proj-mod-head:hover{background:rgba(128,128,128,.05)}" +
    ".dcs2 .chev{opacity:.5;font-size:11px;width:12px;display:inline-block;transition:transform .15s;flex:none}" +
    ".dcs2 .chev.open{transform:rotate(90deg)}" +
    ".dcs2 .proj-mod-name{font-weight:600;flex:1;min-width:140px}" +
    ".dcs2 .proj-mod-body{padding:0 14px 14px;border-top:1px dashed rgba(128,128,128,.2)}" +
    ".dcs2 .run{border-left:3px solid rgba(128,128,128,.4);margin:10px 0 0;padding:8px 12px;border-radius:0 8px 8px 0;background:rgba(128,128,128,.05)}" +
    ".dcs2 .run.done{border-color:#22a06b}.dcs2 .run.running{border-color:#0f62fe}.dcs2 .run.failed{border-color:#e5484d}.dcs2 .run.blocked{border-color:#f5a524}" +
    ".dcs2 .run-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer;user-select:none}" +
    ".dcs2 .run-ver{font-weight:700;font-size:12.5px;font-family:monospace}" +
    ".dcs2 .run-time{font-size:11.5px;opacity:.55}" +
    ".dcs2 .run-files{margin-top:8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}" +
    ".dcs2 .run-files .fcol h5{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;opacity:.6;margin:0 0 4px}" +
    ".dcs2 .run-file{font-family:monospace;font-size:11.5px;padding:2px 0;display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}" +
    ".dcs2 .run-file .n{font-weight:600;color:inherit}" +
    ".dcs2 .run-file .p{opacity:.6;word-break:break-all}" +
    ".dcs2 .run-file .d{opacity:.55;width:100%;font-family:inherit}" +
    ".dcs2 .run-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:12px;opacity:.8}" +
    ".dcs2 .run-notes{font-size:12.5px;opacity:.8;margin-top:6px;white-space:pre-wrap}" +
    ".dcs2 .cost-ok{color:#22a06b;font-weight:600}.dcs2 .cost-na{opacity:.5}" +
    ".dcs2 .modelbar{display:flex;align-items:center;gap:10px;margin:10px 0;flex-wrap:wrap}" +
    /* 结果交付 */
    ".dcs2 .paper{max-width:860px;margin:0 auto}" +
    ".dcs2 .paper-head{position:relative;border:1px solid rgba(128,128,128,.25);border-radius:14px;padding:24px 28px 20px;margin-bottom:12px;overflow:hidden}" +
    ".dcs2 .paper-head:before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#0f62fe,#22a06b,#f5a524,#e5484d)}" +
    ".dcs2 .paper-title{font-size:23px;font-weight:800;line-height:1.45;margin:2px 0 8px;letter-spacing:.2px}" +
    ".dcs2 .paper-sub{font-size:13px;opacity:.78;line-height:1.6}" +
    ".dcs2 .paper-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;font-size:12px;opacity:.75}" +
    ".dcs2 .paper-rev{background:#0f62fe;color:#fff;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600}" +
    /* 章节速览 */
    ".dcs2 .toc{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px;padding:8px 10px;border:1px dashed rgba(128,128,128,.3);border-radius:10px}" +
    ".dcs2 .toc .tchip{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:999px;border:1px solid rgba(128,128,128,.3);background:transparent;color:inherit;font-size:12px;cursor:pointer;transition:border-color .15s,color .15s}" +
    ".dcs2 .toc .tchip:hover{border-color:var(--tc,#0f62fe);color:var(--tc,#0f62fe)}" +
    /* 章节：左强调边 + accent 变量 */
    ".dcs2 .psec{--ac:#0f62fe;border:1px solid rgba(128,128,128,.22);border-left:3px solid var(--ac);border-radius:12px;padding:18px 22px 16px;margin-bottom:12px}" +
    ".dcs2 .psec.psec-hero{background:linear-gradient(180deg,rgba(245,165,36,.08),rgba(245,165,36,0) 75%)}" +
    ".dcs2 .psec h4{font-size:15px;margin:0 0 4px;display:flex;align-items:center;gap:8px}" +
    ".dcs2 .psec h4 .lb{font-weight:700}" +
    ".dcs2 .psec h4 .en{font-size:10.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--ac);opacity:.75}" +
    ".dcs2 .psec .ic{width:26px;height:26px;border-radius:8px;display:inline-grid;place-items:center;font-size:14px;flex:none}" +
    /* 正文排版 */
    ".dcs2 .psec .body{font-size:14px;line-height:1.75}" +
    ".dcs2 .psec .body p{margin:10px 0}" +
    ".dcs2 .psec .body li{margin:4px 0}" +
    ".dcs2 .psec .body ul,.dcs2 .psec .body ol{margin:10px 0;padding-left:24px}" +
    ".dcs2 .psec .body h3{font-size:16px;font-weight:700;color:var(--ac);margin:18px 0 8px;padding-bottom:4px;border-bottom:1px dashed rgba(128,128,128,.28)}" +
    ".dcs2 .psec .body h4{font-size:14.5px;font-weight:700;margin:14px 0 6px}" +
    ".dcs2 .psec .body h5{font-size:13.5px;font-weight:700;margin:12px 0 4px}" +
    ".dcs2 .psec .body strong{font-weight:700;background:linear-gradient(transparent 62%,rgba(245,165,36,.35) 62%);padding:0 1px}" +
    ".dcs2 .psec .body mark{background:rgba(245,165,36,.4);border-radius:3px;padding:0 3px}" +
    ".dcs2 .psec .body blockquote{margin:12px 0;padding:10px 14px;border-left:3px solid var(--ac);background:rgba(128,128,128,.07);border-radius:0 10px 10px 0}" +
    ".dcs2 .psec .body blockquote p{margin:4px 0}" +
    ".dcs2 .psec .body hr{border:0;border-top:1px dashed rgba(128,128,128,.3);margin:16px 0}" +
    ".dcs2 .psec .body code{background:rgba(128,128,128,.15);border-radius:4px;padding:1px 6px;font-family:monospace;font-size:.92em}" +
    ".dcs2 .psec .body pre{background:#0f1220;color:#e6e9f2;border-radius:8px;padding:12px 14px;overflow:auto;font-size:12.5px}" +
    ".dcs2 .psec .body pre code{background:none;color:inherit;padding:0}" +
    ".dcs2 .psec .body table{border-collapse:collapse;width:100%;margin:10px 0;font-size:12.5px;border-radius:8px;overflow:hidden}" +
    ".dcs2 .psec .body th,.dcs2 .psec .body td{border:1px solid rgba(128,128,128,.25);padding:6px 10px;text-align:left}" +
    ".dcs2 .psec .body th{background:rgba(128,128,128,.12);font-weight:600;white-space:nowrap}" +
    ".dcs2 .psec .body tbody tr:nth-child(even){background:rgba(128,128,128,.05)}" +
    /* 图表卡片：随文内嵌，悬浮微抬升 */
    ".dcs2 .chart{margin:14px 0;border:1px solid rgba(128,128,128,.18);border-radius:12px;padding:14px 16px;background:rgba(128,128,128,.03);box-shadow:0 1px 4px rgba(0,0,0,.06);transition:box-shadow .15s}" +
    ".dcs2 .chart:hover{box-shadow:0 3px 12px rgba(0,0,0,.11)}" +
    ".dcs2 .chart-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:10px}" +
    ".dcs2 .chart-title:before{content:'';width:4px;height:14px;border-radius:2px;background:var(--ac,#0f62fe);flex:none}" +
    ".dcs2 .chart-caption{font-size:11.5px;opacity:.62;margin-top:8px;line-height:1.55;font-style:italic}" +
    /* 发现卡片（科学发现与主要结论的结构化渲染） */
    ".dcs2 .findings .lead{font-size:13.5px;opacity:.88;line-height:1.7;margin:2px 0 12px}" +
    ".dcs2 .finding{display:flex;gap:12px;border:1px solid rgba(128,128,128,.2);border-left:4px solid var(--ac,#f5a524);border-radius:12px;padding:14px 16px;margin:12px 0;background:rgba(128,128,128,.03)}" +
    ".dcs2 .finding .no{flex:none;width:28px;height:28px;border-radius:999px;background:var(--ac,#f5a524);color:#fff;font-weight:800;font-size:14px;display:grid;place-items:center;margin-top:2px}" +
    ".dcs2 .finding .fbody{flex:1;min-width:0}" +
    ".dcs2 .finding .ftitle{font-size:14.5px;font-weight:700;margin:0 0 4px;line-height:1.5}" +
    ".dcs2 .finding .fbody .body{font-size:13.5px}" +
    ".dcs2 .bars{display:flex;align-items:flex-end;gap:12px;height:150px;padding:10px 6px 0;border-bottom:1px solid rgba(128,128,128,.3)}" +
    ".dcs2 .bars .bcol{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;height:100%}" +
    ".dcs2 .bars .bval{font-size:11px;opacity:.8;white-space:nowrap}" +
    ".dcs2 .bars .bcap{font-size:10.5px;opacity:.6;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".dcs2 .kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}" +
    ".dcs2 .kv .kv-item{background:rgba(128,128,128,.06);border-radius:8px;padding:8px 10px}" +
    ".dcs2 .kv .k{font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.4px}" +
    ".dcs2 .kv .v{font-size:14px;font-weight:600;margin-top:2px}" +
    ".dcs2 .legend{font-size:11px;color:inherit}" +
    ".dcs2 .media-html{margin:0;overflow-x:auto}" +
    ".dcs2 .body-wrap .body{margin:0}" +
    ".dcs2 .body-wrap > .body:first-child{margin-top:0}.dcs2 .body-wrap > .body:last-child{margin-bottom:0}" +
    /* v1 兼容样式（web 模式「DCS 任务」tab） */
    ".dcstask h2{font-size:15px;font-weight:600}.dcstask h3{font-size:12px;text-transform:uppercase;letter-spacing:.5px;opacity:.7;margin:18px 0 8px}" +
    ".dcstask .dcs-head{display:flex;align-items:center;justify-content:space-between;gap:10px}" +
    ".dcstask .dcs-title{font-size:16px;font-weight:700}" +
    ".dcstask .dcs-obj{opacity:.75;margin:4px 0}" +
    ".dcstask .dcs-tasks{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}" +
    ".dcstask .dcs-tchip{padding:5px 12px;border-radius:999px;border:1px solid rgba(128,128,128,.4);cursor:pointer;background:transparent;color:inherit;font-size:12px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".dcstask .dcs-tchip.on{background:#0f62fe;border-color:#0f62fe;color:#fff}" +
    ".dcstask .dcs-card{border:1px solid rgba(128,128,128,.25);border-radius:10px;padding:12px 14px;margin-bottom:10px}" +
    ".dcstask .dcs-step{border-left:3px solid rgba(128,128,128,.4);padding:8px 12px;margin:8px 0;border-radius:0 8px 8px 0;background:rgba(128,128,128,.05)}" +
    ".dcstask .dcs-step.done{border-color:#22a06b}.dcstask .dcs-step.running{border-color:#0f62fe}.dcstask .dcs-step.failed{border-color:#e5484d}" +
    ".dcstask .dcs-step .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
    ".dcstask .dcs-step .t{font-weight:600}" +
    ".dcstask .dcs-badge{font-size:11px;padding:1px 8px;border-radius:999px;color:#fff}" +
    ".dcstask .dcs-badge.pending{background:#8a8f98}.dcstask .dcs-badge.running{background:#0f62fe}.dcstask .dcs-badge.done{background:#22a06b}.dcstask .dcs-badge.failed{background:#e5484d}.dcstask .dcs-badge.blocked{background:#f5a524}" +
    ".dcstask .dcs-bar{height:5px;border-radius:3px;background:rgba(128,128,128,.2);margin-top:6px;overflow:hidden}" +
    ".dcstask .dcs-bar .fill{height:100%;background:#0f62fe;transition:width .4s}" +
    ".dcstask .dcs-empty{border:1px dashed rgba(128,128,128,.4);border-radius:10px;padding:30px 20px;text-align:center;opacity:.7}" +
    ".dcstask .dcs-refresh{padding:5px 12px;border-radius:6px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;cursor:pointer;font-size:12px}";
  document.head.appendChild(style);
}

function api(path) {
  return fetch("/api/dcs-cloud" + path).then(function (r) { return r.json(); });
}
function apiPost(path, body) {
  return fetch("/api/dcs-cloud" + path, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(function (r) { return r.json(); });
}

/** 是否运行在独立 DCS Harness profile（标记：该 profile 禁用了官方品牌行）。 */
function isHarnessMode() {
  try {
    var boot = window.__DSH_BOOT__;
    if (!boot || !boot.entries) return false;
    return !boot.entries.some(function (e) { return e.id === "@deepseek-ai/dsh-client-ui-brand-official"; });
  } catch (e) { return false; }
}

var STATUS_LABEL = { pending: "待执行", running: "进行中", done: "已完成", failed: "失败", blocked: "受阻" };
// Human-in-the-loop 审阅状态标签（节点级闸门）
var REVIEW_LABEL = { none: "", gate: "🔴 待审批", reviewing: "🔴 待审批", approved: "✅ 已批准", rejected: "⛔ 已否决" };
var REVIEW_COLORS = { none: "#8a8f98", gate: "#e5484d", reviewing: "#e5484d", approved: "#22a06b", rejected: "#f5a524" };

// 三窗口共享的「当前项目」选择（按会话，localStorage 持久化）
var selListeners = [];
function selKey(sessionId) { return "dcs2-sel-" + (sessionId || ""); }
function getSel(sessionId) { try { return window.localStorage.getItem(selKey(sessionId)) || ""; } catch { return ""; } }
function setSel(sessionId, projectId) {
  try { window.localStorage.setItem(selKey(sessionId), projectId || ""); } catch {}
  for (var i = 0; i < selListeners.length; i++) selListeners[i]();
}
function useSel(sessionId) {
  var s = React.useState(getSel(sessionId));
  var v = s[0], setV = s[1];
  React.useEffect(function () {
    function on() { setV(getSel(sessionId)); }
    selListeners.push(on);
    return function () { selListeners = selListeners.filter(function (x) { return x !== on; }); };
  }, [sessionId]);
  return [v, setV];
}

// 极简 Markdown → HTML（标题/粗体/行内码/代码块/列表/表格/链接）
function mdToHtml(md) {
  var src = String(md == null ? "" : md);
  var lines = src.split(/\r?\n/);
  var out = [], inCode = false, codeBuf = [], inTable = false, tableBuf = [], listStack = 0;
  function inline(s) {
    return String(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/==([^=]+)==/g, "<mark>$1</mark>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\">$1</a>");
  }
  function closeList() { while (listStack > 0) { out.push("</ul>"); listStack--; } }
  function splitRow(l) { return l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(function (c) { return c.trim(); }); }
  function isTableSep(l) { return /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.indexOf("-") !== -1; }
  function closeTable() {
    if (!inTable) return;
    var html = "<table><thead><tr>";
    var header = tableBuf[0] || [];
    for (var i = 0; i < header.length; i++) html += "<th>" + inline(header[i]) + "</th>";
    html += "</tr></thead><tbody>";
    for (var r = 2; r < tableBuf.length; r++) {
      var row = tableBuf[r] || [];
      html += "<tr>";
      for (var c = 0; c < row.length; c++) html += "<td>" + inline(row[c]) + "</td>";
      html += "</tr>";
    }
    html += "</tbody></table>";
    out.push(html);
    tableBuf = []; inTable = false;
  }
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.trim().indexOf("```") === 0) {
      if (inCode) { out.push("<pre><code>" + esc(codeBuf.join("\n")) + "</code></pre>"); codeBuf = []; inCode = false; }
      else { closeList(); closeTable(); inCode = true; codeBuf = []; }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    // 分隔线（--- 或 ***，独立成行且不含管道——避免与表格分隔行冲突）
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { closeList(); closeTable(); out.push("<hr/>"); continue; }
    // 引用块（> 开头，连续行合并为一个 callout）
    if (/^\s*>\s?/.test(line)) {
      closeList(); closeTable();
      var qbuf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { qbuf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      i--;
      out.push("<blockquote>" + qbuf.map(function (q) { return "<p>" + inline(q) + "</p>"; }).join("") + "</blockquote>");
      continue;
    }
    if (isTableSep(line)) { if (!inTable) { closeList(); inTable = true; tableBuf = []; tableBuf.push(splitRow(lines[i - 1] || "")); } tableBuf.push([]); continue; }
    if (/^\s*\|/.test(line)) { closeList(); if (!inTable) { inTable = true; tableBuf = []; } tableBuf.push(splitRow(line)); continue; }
    closeTable();
    var hm = line.match(/^(#{1,6})\s+(.*)$/);
    if (hm) { closeList(); var n = hm[1].length; out.push(n > 4 ? "<h5>" + inline(hm[2]) + "</h5>" : "<h" + n + ">" + inline(hm[2]) + "</h" + n + ">"); continue; }
    if (/^\s*[-*+]\s+/.test(line)) { if (listStack === 0) { out.push("<ul>"); listStack = 1; } out.push("<li>" + inline(line.replace(/^\s*[-*+]\s+/, "")) + "</li>"); continue; }
    if (/^\s*\d+\.\s+/.test(line)) { if (listStack === 0) { out.push("<ol>"); listStack = 1; } out.push("<li>" + inline(line.replace(/^\s*\d+\.\s+/, "")) + "</li>"); continue; }
    closeList();
    if (line.trim() === "") { out.push(""); continue; }
    out.push("<p>" + inline(line) + "</p>");
  }
  if (inCode) out.push("<pre><code>" + esc(codeBuf.join("\n")) + "</code></pre>");
  closeList(); closeTable();
  return out.join("\n");
}

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtTime(ts) {
  if (!ts) return "";
  var d = new Date(ts);
  function p(x) { return x < 10 ? "0" + x : String(x); }
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

// ================= 品牌（仅 harness 模式） =================

function HarnessBrandMark() {
  return h("span", { style: { display: "inline-grid", placeItems: "center", width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg,#0f62fe,#22a06b)", color: "#fff", fontSize: 15, fontWeight: 700 }, "aria-hidden": true }, "D");
}
function HarnessBrandName() {
  return h("span", { style: { fontWeight: 700, fontSize: 14, letterSpacing: ".3px" } }, "DCS Harness");
}

// ================= 项目管理窗口 =================

function ProjectChips(props) {
  var projects = props.projects || [];
  var sel = props.sel;
  return projects.length > 1 ? h("div", { className: "dcs2 chips" },
    projects.map(function (p) {
      return h("button", {
        key: p.id, className: "chip" + (p.id === sel ? " on" : ""),
        onClick: function () { props.onSelect(p.id); }, title: p.title,
      }, p.title);
    })
  ) : null;
}

function RunFiles(props) {
  var files = props && props.files;
  if (!files) return null;
  var kinds = [
    { k: "code", label: "代码文件" },
    { k: "input", label: "输入文件" },
    { k: "output", label: "输出文件" },
  ];
  var cols = kinds.map(function (kind) {
    var list = files[kind.k] || [];
    return h("div", { key: kind.k, className: "fcol" },
      h("h5", null, kind.label + " (" + list.length + ")"),
      list.length === 0 ? h("div", { className: "muted" }, "—") : null,
      list.map(function (f, idx) {
        return h("div", { key: idx, className: "run-file" },
          f.name ? h("span", { className: "n" }, f.name) : null,
          f.path ? h("span", { className: "p" }, f.path) : null,
          f.desc ? h("div", { className: "d" }, f.desc) : null
        );
      })
    );
  });
  return h("div", { className: "run-files" }, cols);
}

function RunItem(props) {
  var run = props.run; var costs = props.costs;
  var openState = React.useState(false); var open = openState[0]; var setOpen = openState[1];
  var costList = costs && costs[run.id];
  var totalCost = null;
  if (costList && costList.length) {
    totalCost = 0; var known = 0;
    for (var i = 0; i < costList.length; i++) if (costList[i].cost != null) { totalCost += costList[i].cost; known++; }
    if (known === 0) totalCost = null;
  }
  var hasFiles = run.files && ((run.files.code || []).length + (run.files.input || []).length + (run.files.output || []).length) > 0;
  var hasMore = hasFiles || (run.dcsTaskIds && run.dcsTaskIds.length) || run.notes;

  return h("div", { className: "run " + run.status },
    h("div", { className: "run-head", onClick: function () { if (hasMore) setOpen(!open); } },
      h("span", { className: "chev" + (open ? " open" : "") }, "▸"),
      h("span", { className: "run-ver" }, "v" + run.version),
      h("span", { className: "badge " + run.status }, STATUS_LABEL[run.status] || run.status),
      h("span", { className: "run-time" }, fmtTime(run.startedAt) + (run.finishedAt ? " → " + fmtTime(run.finishedAt) : "")),
      h("span", { className: "run-time" }, run.progress + "%"),
      totalCost != null ? h("span", { className: "cost-ok" }, "费用 ¥" + totalCost) : null,
      run.dshTokens != null ? h("span", { className: "muted" }, "tokens " + run.dshTokens) : null
    ),
    open ? h("div", null,
      hasFiles ? h(RunFiles, { files: run.files }) : null,
      run.dcsTaskIds && run.dcsTaskIds.length ? h("div", { className: "run-meta" },
        h("span", null, "DCS 离线任务: " + run.dcsTaskIds.join(", ")),
        costList ? h("span", null, costList.map(function (c) {
          return c.cost != null ? c.taskId + "=¥" + c.cost : c.taskId + "=—";
        }).join(" · ")) : null
      ) : null,
      run.notes ? h("div", { className: "run-notes" }, run.notes) : null
    ) : null
  );
}

// ================= Human-in-the-loop 节点审批面板 =================
// 管理项目窗口里，点击画布节点后出现在详情区的「设想/批准/纠正/否决」对话式交互。
// 人在这里对 AI 分解出的节点做人工把关（check 闸门），并把设想/纠正意见回写给 agent 执行。
function ModuleReviewPanel(props) {
  var sessionId = props.sessionId; var project = props.project; var module = props.module;
  var onUpdated = props.onUpdated;                       // 审批完成回调（用于刷新项目列表）
  var inputState = React.useState(""); var input = inputState[0]; var setInput = inputState[1];
  var busyState = React.useState(false); var busy = busyState[0]; var setBusy = busyState[1];
  var msgState = React.useState(""); var msg = msgState[0]; var setMsg = msgState[1];

  if (!module) return null;
  var review = module.review || 'none';
  var log = module.reviewLog || [];
  var FEEDBACK_ACTIONS = ['correct', 'propose', 'comment', 'veto'];
  var pendingCount = log.filter(function (e) {
    return e.actor === 'user' && FEEDBACK_ACTIONS.indexOf(e.action) >= 0 && !e.addressed;
  }).length;

  function act(action, text) {
    if (busy) return;
    setBusy(true); setMsg("");
    apiPost("/v2/module/review", {
      projectId: project.id, moduleId: module.id,
      action: action, text: text || "", sessionId: sessionId,
    }).then(function (d) {
      setBusy(false);
      if (d && d.ok) {
        setInput("");
        if (onUpdated) onUpdated(d.project);            // 回写后的完整项目（含新模块状态）
        var base = ({ approve: "✅ 已批准该模块", correct: "✏️ 纠正意见已记录", veto: "⛔ 已否决该模块", propose: "💡 设想已记录", comment: "💬 意见已记录" })[action] || "已提交";
        var fresh = d.project || project;
        var reviewedN = (fresh.modules || []).filter(function (m) { return m.review === 'approved'; }).length;
        var totalN = (fresh.modules || []).length;
        setMsg(base + "（已审核 " + reviewedN + "/" + totalN + " 模块）。审核完后点上方「🔄 根据意见重新修正计划」让 AI 自动修订，或直接「🚀 批准计划并自动执行」。");
      } else {
        setMsg("操作失败：" + ((d && d.error) || "未知错误"));
      }
    }).catch(function (e) { setBusy(false); setMsg("操作失败：" + e.message); });
  }

  return h("div", { className: "card", style: { marginTop: 10, borderLeft: "3px solid " + (review === 'approved' ? "#22a06b" : review === 'rejected' ? "#f5a524" : "#e5484d") } },
    h("div", { className: "row", style: { justifyContent: "space-between", alignItems: "center" } },
      h("span", { style: { fontSize: 12, fontWeight: 700, letterSpacing: ".3px" } }, "🧭 人工把关（Human-in-the-loop）"),
      h("span", { className: "badge", style: { background: REVIEW_COLORS[review] || "#8a8f98" } }, REVIEW_LABEL[review] || review)
    ),
    // 待 AI 处理的反馈提示
    pendingCount ? h("div", { style: { marginTop: 6, fontSize: 12, padding: "4px 8px", borderRadius: 6, background: "rgba(245,165,36,.12)", color: "#f5a524", fontWeight: 600 } },
      "⏳ " + pendingCount + " 条反馈待 AI 修订（AI 修订后会在这里回复并标记 ✅）") : null,
    // 审阅历史（人机动态对话留痕：用户反馈 → AI 修订回复）
    log.length ? h("div", { style: { marginTop: 8, maxHeight: 180, overflow: "auto", fontSize: 12 } },
      log.slice().reverse().map(function (e, i) {
        var isAI = e.actor === 'ai';
        var actLabel = { propose: "设想", approve: "批准", correct: "纠正", veto: "否决", comment: "意见", revise: "修订回复" }[e.action] || e.action;
        var pending = !isAI && FEEDBACK_ACTIONS.indexOf(e.action) >= 0 && !e.addressed;
        return h("div", {
          key: i,
          style: {
            padding: "4px 6px", margin: "2px 0", borderRadius: 6,
            borderLeft: "2px solid " + (isAI ? "#22a06b" : pending ? "#f5a524" : "rgba(128,128,128,.35)"),
            background: isAI ? "rgba(34,160,107,.08)" : "transparent",
            opacity: isAI ? 1 : (e.addressed && FEEDBACK_ACTIONS.indexOf(e.action) >= 0 ? .55 : .9),
          }
        },
          h("span", { style: { fontWeight: 600 } }, (isAI ? "🤖 AI " : "👤 ") + actLabel + (pending ? "（待处理）" : isAI && e.replyTo ? "" : e.action !== 'approve' && e.addressed ? " ✅" : "") + "："),
          " " + (e.text || "")
        );
      })
    ) : h("div", { className: "muted", style: { marginTop: 6, fontSize: 12 } }, "暂无审阅记录。首次由 AI 分解后，请在此审批或纠正。"),
    // 输入框：纠正意见 / 新设想
    h("textarea", {
      value: input,
      onChange: function (e) { setInput(e.target.value); },
      placeholder: "输入纠正意见或新设想（可选），例如：'差异基因阈值改成 p<0.01' 或 '补充一个对照数据组'",
      rows: 2,
      style: { width: "100%", marginTop: 8, boxSizing: "border-box", borderRadius: 8, border: "1px solid rgba(128,128,128,.3)", padding: 8, fontSize: 13, background: "transparent", color: "inherit" }
    }),
    // 操作按钮
    h("div", { style: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" } },
      h("button", { className: "refresh", style: { flex: 1 }, disabled: busy, onClick: function () { act('approve', input); } }, "✅ 批准"),
      h("button", { className: "refresh", style: { flex: 1 }, disabled: busy, onClick: function () { act('correct', input); } }, "✏️ 纠正"),
      h("button", { className: "refresh", style: { flex: 1 }, disabled: busy, onClick: function () { act('veto', input); } }, "⛔ 否决"),
      h("button", { className: "refresh", style: { flex: 1 }, disabled: busy, onClick: function () { act('propose', input); } }, "💡 提设想")
    ),
    msg ? h("div", { className: "muted", style: { marginTop: 6, fontSize: 12 } }, msg) : null
  );
}

// ================= 工作流画布（SVG DAG） =================

var WF_COLORS = { pending: "#8a8f98", running: "#0f62fe", done: "#22a06b", failed: "#e5484d", blocked: "#f5a524" };

function layoutWorkflow(modules, plan, svgW) {
  // ---- 分层 DAG 布局：按 dependsOn 最长路径深度分列（列=层级，列内纵向堆叠）----
  var byId = {}; for (var i = 0; i < modules.length; i++) byId[modules[i].id] = modules[i];
  var order = [];
  if (plan && plan.stepIds && plan.stepIds.length) {
    for (var j = 0; j < plan.stepIds.length; j++) { var m0 = byId[plan.stepIds[j]]; if (m0) order.push(m0); }
    for (var k in byId) if (order.indexOf(byId[k]) < 0) order.push(byId[k]);
  } else {
    order = modules.slice();
  }

  function depsOf(m) {
    var deps = (m.dependsOn || []).filter(function (d) { return byId[d]; });
    if (!deps.length && plan && plan.stepDeps && plan.stepDeps[m.id]) {
      deps = (plan.stepDeps[m.id] || []).filter(function (d) { return byId[d]; });
    }
    return deps;
  }

  // 最长路径分层：depth(n) = max(depth(dep)+1)；无依赖 = 0；成环/漏挂的归入最后一层
  var depth = {};
  function computeDepth(id, visiting) {
    if (depth[id] !== undefined) return depth[id];
    if (visiting[id]) return 0; // 环保护
    visiting[id] = true;
    var deps = depsOf(byId[id]);
    var d = 0;
    for (var x = 0; x < deps.length; x++) d = Math.max(d, computeDepth(deps[x], visiting) + 1);
    visiting[id] = false;
    depth[id] = d;
    return d;
  }
  for (var o = 0; o < order.length; o++) computeDepth(order[o].id, {});

  // 完全没有依赖信息时：退化为链式（顺序即层级），呈现一条清晰的流水线
  var hasAnyDep = order.some(function (m) { return depsOf(m).length > 0; });
  if (!hasAnyDep) {
    for (var q = 0; q < order.length; q++) depth[order[q].id] = q;
  }

  // 列内排序：父节点层级内位置靠前的排前面（减少交叉）；再按 order 兜底
  var depthPos = {}; // id -> 列内序号
  var cols = {};
  var ordIdx = {}; for (var oi = 0; oi < order.length; oi++) ordIdx[order[oi].id] = oi;
  for (var c0 = 0; c0 < order.length; c0++) {
    var id0 = order[c0].id;
    var d0 = depth[id0];
    (cols[d0] = cols[d0] || []).push(id0);
  }
  for (var key in cols) {
    cols[key].sort(function (a, b) {
      var da = depsOf(byId[a]), db = depsOf(byId[b]);
      var ma = da.length ? Math.min.apply(null, da.map(function (x) { return depthPos[x] !== undefined ? depthPos[x] : 1e9; })) : ordIdx[a];
      var mb = db.length ? Math.min.apply(null, db.map(function (x) { return depthPos[x] !== undefined ? depthPos[x] : 1e9; })) : ordIdx[b];
      return (ma - mb) || (ordIdx[a] - ordIdx[b]);
    });
    for (var ci = 0; ci < cols[key].length; ci++) depthPos[cols[key][ci]] = ci;
  }

  // 几何参数：纵向分层布局——层级自上而下、层内节点从左到右、超宽自动换行。
  // 形参 svgW 现在承载「容器可用宽度」：按可用宽度换行，纵向滚动，基本不出现横向拖动。
  var cellW = 232, cellH = 104, colGap = 64, rowGap = 34, pad = 30;
  var avail = Math.max(320, Number(svgW) || 960);
  var perRow = Math.max(1, Math.floor((avail - pad * 2 + colGap) / (cellW + colGap)));

  var nodes = [];
  var yCursor = pad;
  var contentW = 0;
  var layerKeys = Object.keys(cols).map(Number).sort(function (a, b) { return a - b; });
  for (var L = 0; L < layerKeys.length; L++) {
    var layerIds = cols[layerKeys[L]];
    for (var rStart = 0; rStart < layerIds.length; rStart += perRow) {
      var rowIds = layerIds.slice(rStart, rStart + perRow);
      var rowW = rowIds.length * cellW + (rowIds.length - 1) * colGap;
      var rowOffset = Math.max(0, (avail - pad * 2 - rowW) / 2); // 行内居中，视觉均衡
      if (pad * 2 + rowW > contentW) contentW = pad * 2 + rowW;
      for (var ri = 0; ri < rowIds.length; ri++) {
        var mm = byId[rowIds[ri]];
        nodes.push({
          id: mm.id,
          name: mm.name,
          status: mm.status,
          isGate: !!mm.isGate,
          review: mm.review || 'none',
          pendingFeedback: (mm.reviewLog || []).filter(function (e) {
            return e.actor === 'user' && ['correct', 'propose', 'comment', 'veto'].indexOf(e.action) >= 0 && !e.addressed;
          }).length,
          desc: mm.desc || "",
          runs: mm.runs.length,
          x: pad + rowOffset + ri * (cellW + colGap),
          y: yCursor,
          w: cellW,
          h: cellH,
        });
      }
      yCursor += cellH + rowGap;
    }
  }
  var contentH = Math.max(pad * 2 + cellH, yCursor - rowGap + pad);

  // 边：显式 dependsOn（含 plan.stepDeps 兜底）；无任何依赖时退化为顺序链
  var edges = [];
  var seenEdge = {};
  function addEdge(from, to) {
    if (from === to) return;
    var key = from + "|" + to;
    if (seenEdge[key]) return;
    seenEdge[key] = true;
    if (!byId[from] || !byId[to]) return;
    edges.push({ from: from, to: to });
  }
  if (hasAnyDep) {
    for (var d = 0; d < order.length; d++) {
      var deps = depsOf(order[d]);
      for (var dp = 0; dp < deps.length; dp++) addEdge(deps[dp], order[d].id);
    }
  } else {
    for (var e = 0; e < order.length - 1; e++) addEdge(order[e].id, order[e + 1].id);
  }

  return { nodes: nodes, edges: edges, contentW: contentW, contentH: contentH };
}

function WorkflowCanvas(props) {
  var modules = props.modules || [];
  var plan = props.plan;
  var selNode = props.selNode;
  var onSelect = props.onSelect;
  var viewState = React.useState({ x: 0, y: 0, scale: 1 }); var view = viewState[0]; var setView = viewState[1];
  var dragState = React.useState(null); var drag = dragState[0]; var setDrag = dragState[1];
  var svgRef = React.useRef(null);
  var wrapRef = React.useRef(null);
  var availState = React.useState(0); var availW = availState[0]; var setAvailW = availState[1];

  // 测量容器可用宽度：布局按可用宽度自动换行（纵向铺开，基本不需要横向滚动）
  React.useEffect(function () {
    var el = wrapRef.current;
    if (!el) return;
    function measure() { if (el.clientWidth > 0) setAvailW(el.clientWidth); }
    measure();
    var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    else window.addEventListener("resize", measure);
    return function () { if (ro) ro.disconnect(); else window.removeEventListener("resize", measure); };
  }, []);

  var layout = layoutWorkflow(modules, plan, availW || 960);
  var nodes = layout.nodes, edges = layout.edges;
  var hasNodes = nodes.length > 0;

  // 缩放：Ctrl/⌘ + 滚轮（普通滚轮保留给页面纵向滚动）；依赖 nodes.length：模块出现后重新挂监听。
  React.useEffect(function () {
    var el = svgRef.current;
    if (!el) return;
    function onWheel(e) {
      if (!(e.ctrlKey || e.metaKey)) return; // 普通滚轮不拦截——纵向滚动优先
      e.preventDefault();
      var delta = e.deltaY > 0 ? -0.1 : 0.1;
      setView(function (v) { return { x: v.x, y: v.y, scale: Math.max(0.3, Math.min(3, v.scale + delta)) }; });
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return function () { el.removeEventListener('wheel', onWheel); };
  }, [hasNodes]);

  if (!hasNodes) return h("div", { className: "empty" }, "（尚未分解模块，等待 agent 用 dcs_module_update 创建）");

  // 纵向布局：svg 宽 = 容器宽（无横向滚动条），高度随内容伸缩，超出 820 容器内纵向滚动
  var svgW = Math.max(availW || 960, 320);
  var contentW = Math.max(layout.contentW || 0, 320);
  var contentH = Math.max(layout.contentH || 0, 300);
  var svgH = Math.min(Math.max(contentH, 340), 820);

  function nodeById(id) { for (var i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i]; return null; }

  // 拖拽平移：记录起始 view 位置，delta 除以 scale 保证拖拽速度恒定
  function onMouseDown(e) {
    if (e.target.tagName === "rect" || e.target.tagName === "text" || e.target.tagName === "circle" || e.target.tagName === "path") return;
    setDrag({ startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y });
  }
  function onMouseMove(e) {
    if (!drag) return;
    var dx = (e.clientX - drag.startX) / view.scale;
    var dy = (e.clientY - drag.startY) / view.scale;
    setView(function (v) { return { x: drag.viewX + dx, y: drag.viewY + dy, scale: v.scale }; });
  }
  function onMouseUp() { setDrag(null); }

  return h("div", { style: { border: "1px solid rgba(128,128,128,.25)", borderRadius: 12, overflow: "hidden", background: "rgba(128,128,128,.03)", marginBottom: 12 } },
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px dashed rgba(128,128,128,.2)", fontSize: 12, opacity: .7, flexWrap: "wrap", gap: 6 } },
      h("span", null, "工作流画布 · " + nodes.length + " 节点 · " + edges.length + " 连线 · 层级自上而下 · Ctrl+滚轮缩放 · 拖拽平移"),
      h("span", { style: { display: "inline-flex", gap: 8, alignItems: "center" } },
        // 图例：执行状态
        ["pending", "running", "done", "failed"].map(function (s) {
          return h("span", { key: s, style: { display: "inline-flex", alignItems: "center", gap: 3 } },
            h("span", { style: { width: 8, height: 8, borderRadius: 4, background: WF_COLORS[s], display: "inline-block" } }),
            (STATUS_LABEL[s] || s));
        }),
        h("button", { className: "refresh", style: { marginLeft: 6 }, onClick: function () { setView({ x: 0, y: 0, scale: 1 }); } }, "重置视图"),
        Math.round(view.scale * 100) + "%"
      )
    ),
    h("div", { ref: wrapRef, style: { overflow: "auto", maxHeight: 820 } },
    h("svg", {
      ref: svgRef,
      width: svgW, height: svgH,
      viewBox: String(-view.x / view.scale) + " " + String(-view.y / view.scale) + " " + String(svgW / view.scale) + " " + String(svgH / view.scale),
      preserveAspectRatio: "xMinYMin meet",
      style: { width: svgW, maxWidth: "none", height: svgH, display: "block", cursor: drag ? "grabbing" : "grab", userSelect: "none" },
      onMouseDown: onMouseDown, onMouseMove: onMouseMove, onMouseUp: onMouseUp, onMouseLeave: onMouseUp,
    },
      // 网格背景 + 箭头
      h("defs", null,
        h("pattern", { id: "wf-grid", width: 40, height: 40, patternUnits: "userSpaceOnUse" },
          h("path", { d: "M 40 0 L 0 0 0 40", fill: "none", stroke: "rgba(128,128,128,.08)", strokeWidth: 1 })
        ),
        h("marker", { id: "wf-arrow", viewBox: "0 0 10 10", refX: 10, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" },
          h("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "rgba(128,128,128,.5)" })
        )
      ),
      h("rect", { x: 0, y: 0, width: Math.max(contentW, svgW), height: Math.max(contentH, svgH), fill: "url(#wf-grid)" }),
      // 边：纵向贝塞尔（上出下入），横向偏移自然形成 S 弧；回边绕右侧
      edges.map(function (edge, ei) {
        var from = nodeById(edge.from), to = nodeById(edge.to);
        if (!from || !to) return null;
        var d;
        if (to.y > from.y + 10) {
          // 前向边：从父节点底部中心 → 子节点顶部中心
          var x1 = from.x + from.w / 2, y1 = from.y + from.h;
          var x2 = to.x + to.w / 2, y2 = to.y;
          var dy = Math.min(90, Math.max(20, (y2 - y1) / 2));
          d = "M" + x1 + "," + y1 + " C" + x1 + "," + (y1 + dy) + " " + x2 + "," + (y2 - dy) + " " + x2 + "," + y2;
        } else {
          // 回边（指向更早层级）：绕右侧大弧
          var rx1 = from.x + from.w, ry1 = from.y + from.h / 2;
          var rx2 = to.x, ry2 = to.y + to.h / 2;
          var bx = Math.max(rx1, to.x + to.w) + 36;
          d = "M" + rx1 + "," + ry1 + " C" + bx + "," + ry1 + " " + bx + "," + ry2 + " " + rx2 + "," + ry2;
        }
        return h("path", { key: "e" + ei, d: d, fill: "none", stroke: "rgba(128,128,128,.45)", strokeWidth: 2, markerEnd: "url(#wf-arrow)" });
      }),
      // 节点
      nodes.map(function (node) {
        var isSel = selNode && selNode.id === node.id;
        var color = WF_COLORS[node.status] || WF_COLORS.pending;
        var revColor = REVIEW_COLORS[node.review] || REVIEW_COLORS.none;
        var isGate = !!node.isGate;
        var rx = node.x, ry = node.y, rw = node.w, rh = node.h;
        return h("g", { key: node.id, style: { cursor: "pointer" }, onClick: function () { onSelect && onSelect(node); } },
          // 主体（半透明中性底 + 文字用 currentColor，深浅主题均可读）
          h("rect", { x: rx, y: ry, width: rw, height: rh, rx: 10, fill: isSel ? "rgba(15,98,254,.14)" : "rgba(128,128,128,.10)", stroke: isSel ? color : (isGate ? revColor : "rgba(128,128,128,.35)"), strokeWidth: isSel ? 2.5 : (isGate ? 2 : 1.5) }),
          // 状态条
          h("rect", { x: rx, y: ry, width: rw, height: 4, rx: 2, fill: color }),
          // 闸门标记（右上角红/绿小圆 + 锁/勾符号）
          isGate ? h("g", null,
            h("circle", { cx: rx + rw - 16, cy: ry + 16, r: 8, fill: revColor, opacity: .9 }),
            h("text", { x: rx + rw - 16, y: ry + 20, fontSize: 10, fill: "#fff", textAnchor: "middle", fontWeight: 700 }, node.review === 'approved' ? "✓" : "✕")
          ) : null,
          // 待处理人工反馈角标（左上角橙色 💬N——AI 未修订完的反馈）
          node.pendingFeedback ? h("g", null,
            h("circle", { cx: rx + 16, cy: ry + 14, r: 9, fill: "#f5a524" }),
            h("text", { x: rx + 16, y: ry + 18, fontSize: 9, fill: "#fff", textAnchor: "middle", fontWeight: 700 }, "💬" + node.pendingFeedback)
          ) : null,
          // 状态圆点
          h("circle", { cx: rx + 16, cy: ry + 28, r: 5, fill: color }),
          // 名称
          h("text", { x: rx + 28, y: ry + 32, fontSize: 13, fontWeight: 600, fill: "currentColor", textAnchor: "start" }, node.name.length > 16 ? node.name.slice(0, 15) + "…" : node.name),
          // 运行次数 + 闸门状态
          h("text", { x: rx + 28, y: ry + 52, fontSize: 11, fill: "currentColor", opacity: .6, textAnchor: "start" },
            node.runs + " 次运行 · " + (STATUS_LABEL[node.status] || node.status) + (isGate ? " · " + (REVIEW_LABEL[node.review] || "") : "")),
          // 描述
          node.desc ? h("text", { x: rx + 14, y: ry + rh - 12, fontSize: 10, fill: "currentColor", opacity: .45, textAnchor: "start" }, node.desc.length > 30 ? node.desc.slice(0, 28) + "…" : node.desc) : null
        );
      })
    )
    )
  );
}

// ================= 项目管理窗口（v2.6.3 工作流画布） =================

// 计划级审核操作栏：批量审核制——审核完所有模块后一键「修正」或「批准执行」，无需去对话窗口
function PlanReviewBar(props) {
  var project = props.project; var sessionId = props.sessionId; var onUpdated = props.onUpdated;
  var busyState = React.useState(false); var busy = busyState[0]; var setBusy = busyState[1];
  var msgState = React.useState(""); var msg = msgState[0]; var setMsg = msgState[1];
  var modules = project.modules || [];
  var total = modules.length;
  var reviewed = modules.filter(function (m) { return m.review === 'approved'; }).length;
  var pendingFb = modules.reduce(function (n, m) {
    return n + (m.reviewLog || []).filter(function (e) {
      return e.actor === 'user' && ['correct', 'propose', 'comment', 'veto'].indexOf(e.action) >= 0 && !e.addressed;
    }).length;
  }, 0);
  var planStatus = (project.plan && project.plan.planStatus) || 'drafting';
  var approved = planStatus === 'approved';
  var statusLabel = { drafting: "草拟中", awaiting_review: "待人工审核", approved: "已批准 · 自动执行中" }[planStatus] || planStatus;

  function request(path, okMsg) {
    if (busy) return;
    setBusy(true); setMsg("");
    apiPost(path, { projectId: project.id, sessionId: sessionId }).then(function (d) {
      setBusy(false);
      if (d && d.ok) {
        if (d.project && onUpdated) onUpdated(d.project);
        setMsg(d.woken === false ? okMsg + " ⚠️ AI 未被自动唤醒——请在对话窗口直接说明该请求。" : okMsg + " AI 已收到通知，将在对话中给出修订/执行进展。");
      } else setMsg("操作失败：" + ((d && d.error) || "未知错误"));
    }).catch(function (e) { setBusy(false); setMsg("操作失败：" + e.message); });
  }

  return h("div", { style: { border: "1px solid rgba(128,128,128,.25)", borderLeft: "4px solid " + (approved ? "#22a06b" : pendingFb ? "#f5a524" : "#0f62fe"), borderRadius: 12, padding: "10px 14px", marginBottom: 10, background: "rgba(128,128,128,.04)" } },
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
        h("span", { style: { fontSize: 12, fontWeight: 700 } }, "📋 计划审核"),
        h("span", { className: "badge", style: { background: approved ? "#22a06b" : pendingFb ? "#f5a524" : "#0f62fe" } }, statusLabel),
        h("span", { style: { fontSize: 12, opacity: .75 } }, "已审核 " + reviewed + "/" + total + " 模块"),
        pendingFb ? h("span", { style: { fontSize: 12, color: "#f5a524", fontWeight: 600 } }, "· " + pendingFb + " 条意见待 AI 处理") : null
      ),
      h("div", { style: { display: "flex", gap: 8 } },
        h("button", { className: "refresh", disabled: busy || approved || !total, title: "AI 将读取全部模块意见并逐条修订，修订后再次等你审核", onClick: function () { request("/v2/project/revise-request", "已提交修正请求。"); } }, "🔄 根据意见重新修正计划"),
        h("button", { className: "refresh", disabled: busy || approved || !total, title: "批准计划后 AI 全自动执行所有模块，不再设审查节点、不需人工干预", style: approved ? { opacity: .6 } : null, onClick: function () { request("/v2/project/approve-plan", "✅ 计划已批准，进入全自动执行。"); } }, approved ? "🚀 已批准 · 自动执行中" : "🚀 批准计划并自动执行")
      )
    ),
    !approved && total ? h("div", { style: { fontSize: 11, opacity: .65, marginTop: 6 } }, "流程：逐个点击模块提出意见（可跳过）→ 审核完后点「重新修正计划」→ AI 修订后复审 → 满意后点「批准计划并自动执行」，之后全自动完成，无需人工干预。") : null,
    msg ? h("div", { style: { fontSize: 12, marginTop: 6, opacity: .85 } }, msg) : null
  );
}

function ProjectView(props) {
  var sessionId = props && props.sessionId ? props.sessionId : "";
  var projectsState = React.useState([]); var projects = projectsState[0]; var setProjects = projectsState[1];
  var modelsState = React.useState([{ id: "auto", label: "自动选择" }]); var models = modelsState[0]; var setModels = modelsState[1];
  var regionsState = React.useState({ list: [], current: "" }); var regions = regionsState[0]; var setRegions = regionsState[1];
  var costsState = React.useState({}); var costs = costsState[0]; var setCosts = costsState[1];
  var tokensState = React.useState(null); var tokens = tokensState[0]; var setTokens = tokensState[1];
  var billingState = React.useState(null); var billing = billingState[0]; var setBilling = billingState[1];
  var errState = React.useState(""); var err = errState[0]; var setErr = errState[1];
  var selPair = useSel(sessionId); var sel = selPair[0]; var setSelV = selPair[1];
  var selNodeState = React.useState(null); var selNode = selNodeState[0]; var setSelNode = selNodeState[1];

  React.useEffect(function () {
    var live = true;
    function load() {
      api("/v2/projects?sessionId=" + encodeURIComponent(sessionId)).then(function (d) {
        if (!live) return;
        if (d && d.ok) { setProjects(d.projects || []); setErr(""); }
        else setErr((d && d.error) || "读取失败");
      }).catch(function (e) { if (live) setErr(String(e && e.message || e)); });
      api("/v2/tokens?sessionId=" + encodeURIComponent(sessionId)).then(function (d) {
        if (live && d && d.ok) setTokens(d.tokens);
      }).catch(function () {});
      api("/v2/billing").then(function (d) {
        if (live && d && d.ok) setBilling(d);
      }).catch(function () {});
    }
    api("/models").then(function (d) { if (live && d && d.ok && d.models) setModels(d.models); }).catch(function () {});
    api("/v2/regions").then(function (d) {
      if (live && d && d.ok) setRegions({ list: d.regions || [], current: d.current || "", hint: d.hint || "" });
    }).catch(function () {});
    load();
    var timer = setInterval(load, 8000);
    return function () { live = false; clearInterval(timer); };
  }, [sessionId]);

  // 成本单独轮询
  React.useEffect(function () {
    if (!sel) return;
    var live = true;
    function loadCosts() {
      api("/v2/costs?projectId=" + encodeURIComponent(sel) + "&sessionId=" + encodeURIComponent(sessionId)).then(function (d) {
        if (live && d && d.ok) setCosts(d.costs || {});
      }).catch(function () {});
    }
    loadCosts();
    var timer = setInterval(loadCosts, 15000);
    return function () { live = false; clearInterval(timer); };
  }, [sel, sessionId]);

  var project = null;
  for (var i = 0; i < projects.length; i++) if (projects[i].id === sel) { project = projects[i]; break; }
  if (!project && projects.length) project = projects[0];

  function changeModel(model) {
    if (!project) return;
    apiPost("/v2/projects/" + encodeURIComponent(project.id), { model: model }).then(function (d) {
      if (d && d.ok && d.project) {
        setProjects(function (cur) { return cur.map(function (p) { return p.id === d.project.id ? d.project : p; }); });
      }
    }).catch(function () {});
  }
  function changeRegion(region) {
    if (!project) return;
    apiPost("/v2/region", { projectId: project.id, region: region, sessionId: sessionId }).then(function (d) {
      if (d && d.ok) {
        setRegions({ list: regions.list, current: d.region, hint: regions.hint });
        if (d.project) {
          setProjects(function (cur) { return cur.map(function (p) { return p.id === d.project.id ? d.project : p; }); });
        }
      }
    }).catch(function () {});
  }

  var currentRegion = (project && project.region) || regions.current || "";
  var doneCount = project ? (function () { var n = 0; for (var i = 0; i < project.modules.length; i++) if (project.modules[i].status === "done") n++; return n; })() : 0;
  var runCount = project ? (function () { var n = 0; for (var i = 0; i < project.modules.length; i++) n += project.modules[i].runs.length; return n; })() : 0;

  // 选中节点对应的模块
  var selModule = null;
  if (selNode && project) {
    for (var mi = 0; mi < project.modules.length; mi++) {
      if (project.modules[mi].id === selNode.id) { selModule = project.modules[mi]; break; }
    }
  }

  return h("div", { className: "dcs2", style: { padding: "16px 20px", maxWidth: 1040, margin: "0 auto" } },
    h("div", { className: "row", style: { justifyContent: "space-between" } },
      h("h2", null, "项目管理"),
      h("button", { className: "refresh", onClick: function () {
        api("/v2/projects?sessionId=" + encodeURIComponent(sessionId)).then(function (d) { if (d && d.ok) setProjects(d.projects || []); });
      } }, "刷新")
    ),
    err ? h("div", { style: { color: "#e5484d", fontSize: 12 } }, err) : null,

    projects.length === 0
      ? h("div", { className: "empty" }, "本会话暂无项目。agent 用 dcs_project_update 建立项目并分解模块后，这里展示工作流画布与实时状态。")
      : h("div", null,
          h(ProjectChips, { projects: projects, sel: project ? project.id : "", onSelect: function (id) { setSelV(id); setSel(sessionId, id); setSelNode(null); } }),
          // 项目概览
          h("div", { className: "card" },
            h("div", { className: "interact-head" },
              h("div", { className: "interact-title" }, project.title),
              h("span", { className: "badge " + project.status }, STATUS_LABEL[project.status] || project.status)
            ),
            project.objective ? h("div", { className: "interact-obj" }, "目标：" + project.objective) : null,
            h("div", { className: "interact-stats" },
              h("span", { className: "interact-stat" }, h("b", null, project.modules.length), "个模块"),
              h("span", { className: "interact-stat" }, h("b", null, doneCount), "个完成"),
              h("span", { className: "interact-stat" }, h("b", null, runCount), "次运行"),
              tokens ? h("span", { className: "interact-stat" }, "本会话 token 消耗 ", h("b", null, tokens.totalTokens != null ? tokens.totalTokens : "—")) : null,
              project.model && project.model !== "auto" ? h("span", { className: "interact-stat" }, "模型 ", h("b", null, project.model)) : null,
              project.region ? h("span", { className: "interact-stat" }, "节点 ", h("b", null, project.region)) : null
            ),
            billing ? h("div", { className: "interact-stats", style: { marginTop: 8, borderTop: "1px dashed rgba(128,128,128,.25)", paddingTop: 8 } },
              billing.balance != null ? h("span", { className: "interact-stat" }, "项目余额 ", h("b", null, "¥" + billing.balance), "（" + (billing.projectName || billing.projectCode || "当前项目") + "）") : null
            ) : null
          ),
          // 模型选择 + 节点选择 + 资源（保留）
          h("div", { className: "modelbar" },
            h("label", { style: { fontSize: 12, opacity: .75 } }, "Genpilot 模型"),
            h("select", {
              value: project.model || "auto",
              onChange: function (e) { changeModel(e.target.value); },
            }, models.map(function (m) { return h("option", { key: m.id, value: m.id }, m.label); })),
            h("label", { style: { fontSize: 12, opacity: .75 } }, "节点"),
            h("select", {
              value: currentRegion,
              onChange: function (e) { changeRegion(e.target.value); },
              title: "DCS 节点（片区）：切换后该项目的后续 DCS 操作（数据/流程/容器）在所选节点执行",
            },
              regions.list.map(function (r) { return h("option", { key: r.id, value: r.name }, r.name); })
            ),
            project.resources ? h("span", { className: "muted" }, "资源：" + project.resources) : null
          ),
          // 节点联动提示
          regions.hint ? h("div", { style: { padding: "6px 0", fontSize: 11, opacity: .7 } },
            h("span", { style: { fontWeight: 600 } }, "节点提示：" ), regions.hint
          ) : null,
          // ===== 计划级审核操作栏 + 工作流画布 =====
          h("div", { style: { margin: "10px 0" } },
            h(PlanReviewBar, { project: project, sessionId: sessionId, onUpdated: function (updatedProject) {
              setProjects(function (cur) { return cur.map(function (p) { return p.id === updatedProject.id ? updatedProject : p; }); });
            } }),
            h("h3", { style: { margin: "10px 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", opacity: .65 } }, "工作流画布 · 点击节点查看详情"),
            h(WorkflowCanvas, { modules: project.modules, plan: project.plan, selNode: selNode, onSelect: function (node) { setSelNode(node); } })
          ),
          // ===== 选中节点详情 =====
          selModule ? h("div", { className: "card", style: { borderColor: WF_COLORS[selModule.status] || "#8a8f98", borderWidth: 2 } },
            h("div", { className: "row", style: { justifyContent: "space-between" } },
              h("div", { style: { fontWeight: 700, fontSize: 15 } }, "🔍 " + selModule.name),
              h("span", { className: "badge " + selModule.status }, STATUS_LABEL[selModule.status] || selModule.status)
            ),
            selModule.desc ? h("div", { className: "muted", style: { marginTop: 4 } }, selModule.desc) : null,
            // 运行历史
            selModule.runs.length ? h("div", { style: { marginTop: 10 } },
              h("h4", { style: { fontSize: 12, fontWeight: 600, margin: "0 0 6px" } }, "运行历史（" + selModule.runs.length + " 次）"),
              selModule.runs.slice().reverse().map(function (r) { return h(RunItem, { key: r.id, run: r, costs: costs }); })
            ) : h("div", { className: "muted", style: { marginTop: 8 } }, "暂无运行记录"),
            // ===== Human-in-the-loop 节点审批面板（key 强制切节点时重挂载，清空输入与提示 state）=====
            h(ModuleReviewPanel, {
              key: selModule.id,
              sessionId: sessionId, project: project, module: selModule,
              onUpdated: function (updatedProject) {
                setProjects(function (cur) { return cur.map(function (p) { return p.id === updatedProject.id ? updatedProject : p; }); });
              }
            }),
            // 分析计划（如果节点选中）
            (project.plan && project.plan.content) ? h("div", { style: { marginTop: 10, borderTop: "1px dashed rgba(128,128,128,.2)", paddingTop: 10 } },
              h("div", { className: "row", style: { justifyContent: "space-between" } },
                h("span", { style: { fontSize: 11, fontWeight: 600, opacity: .7 } }, "分析计划"),
                h("span", { className: "badge " + ((project.plan.planStatus || "drafting") === "approved" ? "done" : "running") },
                  ({ drafting: "草拟中", awaiting_review: "待确认", approved: "已批准" })[project.plan.planStatus] || project.plan.planStatus)
              ),
              h("div", { className: "body", style: { maxHeight: 160, overflow: "auto", marginTop: 6 }, dangerouslySetInnerHTML: { __html: mdToHtml(project.plan.content) } })
            ) : null
          ) : (project.modules.length ? h("div", { className: "card", style: { textAlign: "center", opacity: .7, padding: "16px" } }, "👆 点击工作流画布中的节点查看模块详情与运行历史") : null)
        )
  );
}

// ================= 结果交付窗口 =================

var SECTION_META = [
  { key: "question", label: "科学问题", icon: "❓", en: "Question", color: "#8a8f98" },
  { key: "hypothesis", label: "科学假说", icon: "🧪", en: "Hypothesis", color: "#8172b2" },
  { key: "decomposition", label: "科学问题分解", icon: "🧩", en: "Decomposition", color: "#0f62fe" },
  { key: "data", label: "原始数据", icon: "🗂️", en: "Data", color: "#64b5cd" },
  { key: "methods", label: "分析方法", icon: "🔬", en: "Methods", color: "#22a06b" },
  { key: "findings", label: "科学发现与主要结论", icon: "💡", en: "Findings", color: "#f5a524", hero: true },
  { key: "novelty", label: "创新性与已有研究的关系", icon: "🌟", en: "Novelty", color: "#e5484d" },
  { key: "nextSteps", label: "下一步计划与建议", icon: "➡️", en: "Next Steps", color: "#ccb974" },
];

var CHART_COLORS = ["#0f62fe", "#22a06b", "#e5484d", "#f5a524", "#8172b2", "#ccb974", "#64b5cd", "#8a8f98"];

// 归一化媒体源的 src：支持字符串路径 / base64 data-URI / {path|src|url} 对象
function chartSrc(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object") return data.path || data.src || data.url || "";
  return String(data);
}

// 图片组件：src 为容器路径（/work/...）时经 /v2/chart-image 异步拉 base64；已内嵌 data: 直接用
function MediaImage(props) {
  var src = props.src || "";
  var resState = React.useState(null); var resolved = resState[0]; var setResolved = resState[1];
  var zoomState = React.useState(false); var zoomed = zoomState[0]; var setZoomed = zoomState[1];
  React.useEffect(function () {
    if (!src) { setResolved(""); return; }
    // base64 data-URI 或 http(s) 链接可直接作为 img src
    if (src.indexOf("data:") === 0 || /^https?:\/\//.test(src)) { setResolved(src); return; }
    // 容器路径(/work /data)或本机绝对路径(/home/.../.dsh/dcs-img-cache)都经 /v2/chart-image 读本机文件，
    // 容器路径仅在本地无缓存时触发下载一次，之后即本地化、离线可用。
    var live = true;
    api("/v2/chart-image?path=" + encodeURIComponent(src)).then(function (d) {
      if (live && d && d.ok && d.data) setResolved(d.data);
      else if (live) setResolved("__FAILED__");
    }).catch(function () { if (live) setResolved("__FAILED__"); });
    return function () { live = false; };
  }, [src]);

  // 全屏预览时支持 Esc 键快捷关闭
  React.useEffect(function () {
    if (!zoomed) return;
    function onKeyDown(e) { if (e.key === "Escape" || e.keyCode === 27) setZoomed(false); }
    window.addEventListener("keydown", onKeyDown);
    return function () { window.removeEventListener("keydown", onKeyDown); };
  }, [zoomed]);

  if (!resolved) return h("div", { className: "muted", style: { textAlign: "center", padding: "24px" } }, "图片加载中…");
  if (resolved === "__FAILED__" || resolved === "") return h("div", { className: "muted" }, "（图片缺失：" + (src || "") + "）");
  return h("div", { style: { textAlign: "center" } },
    h("img", {
      src: resolved, alt: props.caption || "图表",
      onClick: function () { setZoomed(true); },
      style: { maxWidth: "100%", borderRadius: 8, border: "1px solid rgba(128,128,128,.25)", cursor: "zoom-in", transition: "box-shadow .2s" }
    }),
    zoomed ? h("div", {
      onClick: function () { setZoomed(false); },
      style: { position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 9999, display: "grid", placeItems: "center", cursor: "zoom-out", padding: 24, boxSizing: "border-box" }
    },
      h("div", { style: { textAlign: "center", maxWidth: "94vw" } },
        h("img", { src: resolved, alt: props.caption || "图表", style: { maxWidth: "94vw", maxHeight: "88vh", borderRadius: 10, boxShadow: "0 8px 40px rgba(0,0,0,.4)", background: "#fff" } }),
        props.caption ? h("div", { style: { color: "#fff", fontSize: 13, marginTop: 10, padding: "0 12px" } }, String(props.caption)) : null
      )
    ) : null
  );
}

function BarChart(props) {
  // 兼容三种数据结构：
  //   chart.data = { labels:[...], values:[...] }                     单系列
  //   chart.data = { labels:[...], series:[{name, values:[...]}] }    分组多系列柱状图
  //   chart.data = { items:[{label,value}] } 或 裸数组 [{label,value}]
  var chart = props && props.data;
  var raw = chart && chart.data;
  var labels = (raw && raw.labels) || (chart && chart.labels) || [];
  var values = (raw && raw.values) || (chart && chart.values) || [];
  var series = (raw && raw.series) || (chart && chart.series) || [];
  var items = [];

  if (labels.length && series.length && series[0] && series[0].values) {
    // 分组柱状图：每个 label 一组，每组内多条 series 柱
    return groupedBars(labels, series);
  }
  if (labels.length && values.length) {
    for (var i = 0; i < labels.length; i++) items.push({ label: labels[i], value: values[i] });
  } else if (Array.isArray(raw) || (raw && Array.isArray(raw.items))) {
    var arr = Array.isArray(raw) ? raw : raw.items;
    for (var j = 0; j < arr.length; j++) items.push(arr[j]);
  } else if (Array.isArray(chart && chart.items)) {
    for (var k = 0; k < chart.items.length; k++) items.push(chart.items[k]);
  }
  if (!items.length) return null;
  var max = 1;
  for (var m = 0; m < items.length; m++) if (Number(items[m].value) > max) max = Number(items[m].value);
  return h("div", { className: "bars" },
    items.map(function (d, idx) {
      var val = Number(d.value) || 0;
      var lab = d.label != null ? String(d.label) : '';
      return h("div", { key: idx, className: "bcol" },
        h("span", { className: "bval" }, String(d.value != null ? d.value : "")),
        h("div", { style: { width: Math.max(6, Math.round(val / max * 110)) + "px", minHeight: 2, background: "linear-gradient(180deg,#0f62fe,#22a06b)", borderRadius: "4px 4px 0 0", flex: 1 } }),
        h("span", { className: "bcap", title: lab }, lab.length > 14 ? lab.slice(0, 12) + "…" : lab)
      );
    })
  );
}

function groupedBars(labels, series) {
  // 分组柱状图：横轴 labels，每组内按 series 并排多个柱子
  var max = 1;
  for (var s = 0; s < series.length; s++) {
    if (!series[s].values) continue;
    for (var v = 0; v < series[s].values.length; v++) if (Number(series[s].values[v]) > max) max = Number(series[s].values[v]);
  }
  var barW = Math.max(12, Math.round(110 / (series.length + 1)));
  return h("div", null,
    h("div", { className: "bars" },
      labels.map(function (lab, li) {
        return h("div", { key: li, className: "bcol grp", style: { flexDirection: "row", alignItems: "flex-end", gap: 3 } },
          series.map(function (sr, si) {
            var val = Number((sr.values && sr.values[li]) || 0);
            var color = CHART_COLORS[si % CHART_COLORS.length];
            return h("div", { key: si, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0 } },
              h("span", { className: "bval", style: { fontSize: 10 } }, String(sr.values && sr.values[li] != null ? sr.values[li] : "")),
              h("div", { style: { width: barW + "px", minHeight: 2, background: color, borderRadius: "3px 3px 0 0", flex: 1, opacity: .9 } }),
              h("span", { className: "bcap" }, lab.length > 8 ? lab.slice(0, 7) + "…" : lab)
            );
          })
        );
      })
    ),
    series.length ? h("div", { className: "legend", style: { display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8, fontSize: 11, opacity: .8 } },
      series.map(function (sr, si) {
        return h("span", { key: si, style: { display: "inline-flex", alignItems: "center", gap: 4 } },
          h("span", { style: { width: 10, height: 10, borderRadius: 2, background: CHART_COLORS[si % CHART_COLORS.length], display: "inline-block" } }),
          String(sr.name || "")
        );
      })
    ) : null
  );
}

// 数据表格组件：>PAGE 行自动分页（客户端轻量 paging）
var DT_PAGE = 10;
function DataTable(props) {
  var columns = props.columns || [];
  var rows = props.rows || [];
  var pageState = React.useState(0); var page = pageState[0]; var setPage = pageState[1];
  var total = rows.length;
  var pages = Math.max(1, Math.ceil(total / DT_PAGE));
  if (page >= pages) page = pages - 1;
  var start = page * DT_PAGE;
  var slice = rows.slice(start, start + DT_PAGE);
  return h("div", null,
    h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13 } },
      h("thead", null, h("tr", null, columns.map(function (c, i) { return h("th", { key: i, style: { border: "1px solid rgba(128,128,128,.25)", padding: "6px 8px", textAlign: "left", fontWeight: 600 } }, String(c)); }))),
      h("tbody", null, slice.map(function (row, ri) {
        return h("tr", { key: start + ri }, row.map(function (cell, ci) { return h("td", { key: ci, style: { border: "1px solid rgba(128,128,128,.25)", padding: "6px 8px" } }, String(cell == null ? "" : cell)); }));
      }))
    ),
    total > DT_PAGE ? h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, opacity: .75 } },
      h("button", { className: "refresh", disabled: page === 0, onClick: function () { setPage(0); } }, "«"),
      h("button", { className: "refresh", disabled: page === 0, onClick: function () { setPage(page - 1); } }, "‹ 上一页"),
      h("span", null, "第 " + (page + 1) + "/" + pages + " 页 · 共 " + total + " 行"),
      h("button", { className: "refresh", disabled: page >= pages - 1, onClick: function () { setPage(page + 1); } }, "下一页 ›"),
      h("button", { className: "refresh", disabled: page >= pages - 1, onClick: function () { setPage(pages - 1); } }, "»")
    ) : null
  );
}

function SummaryView(props) {
  // 兼容 {labels,values}（并排列表）与 {key:value} KV 两种形式
  var chart = props && props.data;
  var raw = chart && chart.data;
  if (raw && Array.isArray(raw.labels) && Array.isArray(raw.values)) {
    var pairs = [];
    for (var i = 0; i < raw.labels.length; i++) pairs.push([String(raw.labels[i]), raw.values[i]]);
    return h("div", { className: "kv" }, pairs.map(function (p, idx) {
      return h("div", { key: idx, className: "kv-item" }, h("div", { className: "k" }, p[0]), h("div", { className: "v" }, String(p[1])));
    }));
  }
  // 支持 {data:{columns:[...], rows:[[...]]}} 表格（>15 行自动分页）/ {data:{items:[...]}} KV
  if (raw && Array.isArray(raw.columns) && Array.isArray(raw.rows)) {
    return h(DataTable, { columns: raw.columns, rows: raw.rows });
  }
  var kv = (raw && typeof raw === "object") ? raw : (chart && typeof chart.data === "object" ? chart.data : {});
  return h("div", { className: "kv" }, Object.keys(kv).map(function (k) {
    return h("div", { key: k, className: "kv-item" }, h("div", { className: "k" }, k), h("div", { className: "v" }, String(kv[k])));
  }));
}

// ---- 数据归一化：把 labels/values, labels/series, items, 裸数组 统一为 [{label, value, series}] ----
function normChartData(chart, preferSeries) {
  var raw = chart && chart.data;
  var labels = (raw && raw.labels) || (chart && chart.labels) || [];
  var values = (raw && raw.values) || (chart && chart.values) || [];
  var series = (raw && raw.series) || (chart && chart.series) || [];
  if (labels.length && series.length && series[0] && series[0].values) {
    var out = [];
    for (var li = 0; li < labels.length; li++) {
      out.push(series.map(function (sr, si) {
        return { label: labels[li], value: sr.values ? sr.values[li] : undefined, name: sr.name, seriesIndex: si };
      }));
    }
    return out; // 二维分组
  }
  if (labels.length && values.length) {
    var items = [];
    for (var i = 0; i < labels.length; i++) items.push({ label: labels[i], value: values[i] });
    return items;
  }
  if (Array.isArray(raw) || (raw && Array.isArray(raw.items))) {
    var arr = Array.isArray(raw) ? raw : raw.items;
    return arr.map(function (d) { return { label: d.label, value: d.value, name: d.name }; });
  }
  if (Array.isArray(chart && chart.items)) return chart.items.map(function (d) { return { label: d.label, value: d.value, name: d.name }; });
  return null;
}

// ---- 折线图（SVG，支持单/多系列） ----
function LineChart(props) {
  var data = normChartData(props.data);
  if (!data) return null;
  var grouped = Array.isArray(data[0]);
  var W = 460, H = 170, pl = 34, pr = 10, pt = 12, pb = 26;
  var max = 1, min = 0;
  var flat = [];
  for (var i = 0; i < data.length; i++) {
    if (grouped) { for (var j = 0; j < data[i].length; j++) { var val = Number(data[i][j].value); if (val > max) max = val; if (val < min) min = val; flat.push(data[i][j]); } }
    else { var v = Number(data[i].value); if (v > max) max = v; if (v < min) min = v; flat.push(data[i]); }
  }
  var n = grouped ? data.length : data.length;
  var xStep = n > 1 ? (W - pl - pr) / (n - 1) : 0;
  var xPos = function (xi) { return n > 1 ? (pl + xi * xStep) : (pl + (W - pl - pr) / 2); };
  var yRange = max - min || 1;
  var y = function (val) { return pt + (H - pt - pb) * (1 - (val - min) / yRange); };
  // 系列/颜色分组
  var seriesNames = [];
  if (grouped) for (var s = 0; s < data[0].length; s++) seriesNames.push(data[0][s].name);
  var color = function (si) { return CHART_COLORS[si % CHART_COLORS.length]; };
  var seriesEls = [];
  if (grouped) {
    for (var si2 = 0; si2 < data[0].length; si2++) {
      var pts = [];
      for (var xi = 0; xi < data.length; xi++) pts.push([xPos(xi), y(Number(data[xi][si2].value))]);
      seriesEls.push(h("polyline", { key: si2, points: pts.map(function (p) { return p[0] + "," + p[1]; }).join(" "), fill: "none", stroke: color(si2), strokeWidth: 2 }));
      seriesEls.push(pts.map(function (p, pi) { return h("circle", { key: pi, cx: p[0], cy: p[1], r: 2.5, fill: color(si2) }); }));
    }
  } else {
    var pts2 = [];
    for (var xi2 = 0; xi2 < data.length; xi2++) pts2.push([xPos(xi2), y(Number(data[xi2].value))]);
    seriesEls.push(h("polyline", { points: pts2.map(function (p) { return p[0] + "," + p[1]; }).join(" "), fill: "none", stroke: CHART_COLORS[0], strokeWidth: 2 }));
    seriesEls.push(pts2.map(function (p, pi2) { return h("circle", { key: pi2, cx: p[0], cy: p[1], r: 2.5, fill: CHART_COLORS[0] }); }));
  }
  // 轴刻度
  var yTicks = [];
  for (var t = 0; t <= 4; t++) yTicks.push(min + yRange * t / 4);
  var xLabels = [];
  if (n === 1) {
    xLabels.push(h("text", { key: 0, x: xPos(0), y: H - 8, textAnchor: "middle", fontSize: 9, fill: "#888" }, String(grouped ? (data[0][0] && data[0][0].label) : data[0].label)));
  } else if (n <= 8) {
    for (var xl = 0; xl < n; xl++) xLabels.push(h("text", { key: xl, x: xPos(xl), y: H - 8, textAnchor: "middle", fontSize: 9, fill: "#888" }, String(grouped ? (data[xl][0] && data[xl][0].label) : data[xl].label)));
  } else {
    for (var xl2 = 0; xl2 < n; xl2 += Math.ceil(n / 7)) xLabels.push(h("text", { key: xl2, x: xPos(xl2), y: H - 8, textAnchor: "middle", fontSize: 9, fill: "#888" }, String(grouped ? (data[xl2][0] && data[xl2][0].label) : data[xl2].label)));
  }
  return h("div", null,
    h("svg", { width: "100%", viewBox: "0 0 " + W + " " + H, style: { maxHeight: 210 } },
      yTicks.map(function (tv, ti) { return h("g", { key: ti }, h("line", { x1: pl, x2: W - pr, y1: y(tv), y2: y(tv), stroke: "rgba(128,128,128,.15)" }), h("text", { x: pl - 6, y: y(tv) + 3, textAnchor: "end", fontSize: 9, fill: "#888" }, Number(tv).toFixed(1))); }),
      xLabels,
      seriesEls
    ),
    seriesNames.length ? h("div", { className: "legend", style: { display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 6, fontSize: 11, opacity: .8 } },
      seriesNames.map(function (nm, ni) { return h("span", { key: ni, style: { display: "inline-flex", alignItems: "center", gap: 4 } }, h("span", { style: { width: 10, height: 3, background: color(ni), display: "inline-block" } }), String(nm)); })
    ) : null
  );
}

// ---- 饼图（SVG，packed 扇区） ----
function PieChart(props) {
  var data = normChartData(props.data);
  if (!data || (!data.length && !data[0])) return null;
  var items = data[0] ? data : data; // 单系列
  var vals = items.map(function (d) { return Math.max(0, Number(d.value) || 0); });
  var total = vals.reduce(function (a, b) { return a + b; }, 0);
  if (!total) return null;
  var cx = 90, cy = 90, r = 78;
  var angle = -Math.PI / 2;
  var sectors = vals.map(function (v, i) {
    var frac = v / total;
    var a0 = angle, a1 = angle + frac * 2 * Math.PI;
    angle = a1;
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    // 扇区 path（含半径）
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    var path = "M" + cx + "," + cy + " L" + x0 + "," + y0 + " A" + r + "," + r + " 0 " + large + " 1 " + x1 + "," + y1 + " Z";
    return { path: path, color: CHART_COLORS[i % CHART_COLORS.length], label: items[i].label, pct: (frac * 100) };
  });
  return h("div", { style: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" } },
    h("svg", { width: 190, height: 190, viewBox: "0 0 180 180" },
      sectors.map(function (s, i) { return h("path", { key: i, d: s.path, fill: s.color, stroke: "#fff", strokeWidth: 1 }); })
    ),
    h("div", { style: { fontSize: 12, display: "flex", flexDirection: "column", gap: 4 } },
      sectors.map(function (s, i) {
        return h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 6 } },
          h("span", { style: { width: 12, height: 12, borderRadius: 3, background: s.color, display: "inline-block" } }),
          h("span", null, String(s.label) + "：" + s.pct.toFixed(1) + "%")
        );
      })
    )
  );
}

// ---- 散点图（SVG，支持 x/y 或 items 数组 {x,y 或 value}） ----
function ScatterChart(props) {
  var raw = props.data && props.data.data;
  var pts = [];
  if (Array.isArray(raw)) pts = raw;
  else if (raw && Array.isArray(raw.items)) pts = raw.items;
  else {
    var nd = normChartData(props.data);
    pts = nd || [];
  }
  if (!pts.length) return null;
  var W = 460, H = 170, pl = 34, pr = 10, pt = 12, pb = 26;
  var xs = pts.map(function (p) { return Number(p.x != null ? p.x : p.label); });
  var ys = pts.map(function (p) { return Number(p.y != null ? p.y : p.value); });
  var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs) || 1;
  var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys) || 1;
  var xr = xmax - xmin || 1, yr = ymax - ymin || 1;
  var px = function (v) { return pl + (W - pl - pr) * (v - xmin) / xr; };
  var py = function (v) { return pt + (H - pt - pb) * (1 - (v - ymin) / yr); };
  return h("svg", { width: "100%", viewBox: "0 0 " + W + " " + H, style: { maxHeight: 210 } },
    h("line", { x1: pl, x2: W - pr, y1: H - pb, y2: H - pb, stroke: "rgba(128,128,128,.3)" }),
    h("line", { x1: pl, x2: pl, y1: pt, y2: H - pb, stroke: "rgba(128,128,128,.3)" }),
    pts.map(function (p, i) {
      return h("circle", { key: i, cx: px(Number(p.x != null ? p.x : p.label)), cy: py(Number(p.y != null ? p.y : p.value)), r: 3.5, fill: CHART_COLORS[i % CHART_COLORS.length], opacity: .85 });
    })
  );
}

// ---- 热图（{data:{rows:[{label, values:[]}], columns:[...]}}） ----
function HeatmapChart(props) {
  var raw = props.data && props.data.data;
  if (!raw || !Array.isArray(raw.rows)) return null;
  var cols = raw.columns || [];
  var cells = [];
  var allv = [];
  for (var r = 0; r < raw.rows.length; r++) { var vals = raw.rows[r].values || []; for (var c = 0; c < vals.length; c++) allv.push(Number(vals[c])); }
  var vmin = Math.min.apply(null, allv) || 0, vmax = Math.max.apply(null, allv) || 1;
  function heat(v) { var t = (Number(v) - vmin) / (vmax - vmin || 1); return "rgba(15,98,254," + (0.12 + t * 0.75).toFixed(2) + ")"; }
  return h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
    h("thead", null, h("tr", null,
      h("th", { style: { padding: "6px 8px", textAlign: "left", fontWeight: 600 } }, ""),
      cols.map(function (cc, i) { return h("th", { key: i, style: { padding: "6px 8px", textAlign: "center", fontWeight: 600 } }, String(cc)); })
    )),
    h("tbody", null, raw.rows.map(function (row, ri) {
      return h("tr", { key: ri },
        h("td", { style: { padding: "6px 8px", fontWeight: 600 } }, String(row.label)),
        (row.values || []).map(function (val, ci) { return h("td", { key: ci, style: { padding: "6px 8px", textAlign: "center", background: heat(val), borderRadius: 4 } }, String(val)); })
      );
    }))
  );
}

// ---- KPI/指标卡（{data:{items:[{label,value,unit?}]} 或 KV}） ----
function StatView(props) {
  var raw = props.data && props.data.data;
  var items = [];
  if (raw && Array.isArray(raw.items)) items = raw.items;
  else if (raw && Array.isArray(raw.labels) && Array.isArray(raw.values)) for (var i = 0; i < raw.labels.length; i++) items.push({ label: raw.labels[i], value: raw.values[i] });
  else if (raw && typeof raw === "object") for (var k in raw) items.push({ label: k, value: raw[k] });
  else {
    var nd = normChartData(props.data); if (nd) items = nd;
  }
  return h("div", { className: "stats", style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 } },
    items.map(function (it, i) {
      return h("div", { key: i, style: { background: "rgba(128,128,128,.06)", borderRadius: 10, padding: "12px 14px", textAlign: "center" } },
        h("div", { style: { fontSize: 11, opacity: .65, marginBottom: 4 } }, String(it.label || "")),
        h("div", { style: { fontSize: 20, fontWeight: 700, color: "#0f62fe" } }, String(it.value != null ? it.value : ""), it.unit ? h("span", { style: { fontSize: 12, fontWeight: 400, opacity: .7 } }, String(it.unit)) : null)
      );
    })
  );
}

// ================= 3D 分子结构查看器（structure3d，本地打包 3Dmol.js，免外网） =================

// 路径形态判断：非 data:/http(s)/blob: 且像文件路径（/开头 或 带扩展名）→ 需经 /v2/chart-file 解析
function isPathLike(s) {
  if (typeof s !== "string" || !s) return false;
  if (/^(data:|https?:|blob:)/.test(s)) return false;
  if (s.indexOf("<") >= 0) return false;
  return s.startsWith("/") || s.startsWith("./") || s.startsWith("../") || /^[A-Za-z]:[\\/]/.test(s) || /\.[A-Za-z0-9]{1,6}$/.test(s);
}

// 解析路径 → 可访问 URL（容器/本机/相对路径都经 /v2/chart-file 本地化）
function resolveFileUrl(p) {
  return api("/v2/chart-file?path=" + encodeURIComponent(String(p || ""))).then(function (d) {
    if (d && d.ok && d.url) return d.url;
    throw new Error((d && d.error) || "chart-file 解析失败");
  });
}

// 懒加载 3Dmol（一次性注入 script，Promise 缓存）
var molScriptPromise = null;
function webglSupported() {
  try {
    var c = document.createElement("canvas");
    if (!c || typeof c.getContext !== "function") return false;
    // 覆盖 WebGL2 / WebGL / 实验性 WebGL 三种上下文（远程桌面/无 GPU/浏览器关闭硬件加速时均会失败）
    var gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
    return !!gl;
  } catch (e) { return false; }
}
function load3Dmol() {
  if (molScriptPromise) return molScriptPromise;
  molScriptPromise = new Promise(function (resolve, reject) {
    if (typeof window !== "undefined" && window.$3Dmol) { resolve(window.$3Dmol); return; }
    var s = document.createElement("script");
    s.src = "/api/dcs-cloud/v2/vendor/3dmol.js";
    s.onload = function () {
      if (window.$3Dmol) resolve(window.$3Dmol);
      else { molScriptPromise = null; reject(new Error("3Dmol 加载失败（$3Dmol 未定义）")); }
    };
    s.onerror = function () { molScriptPromise = null; reject(new Error("3Dmol 脚本加载失败")); };
    document.head.appendChild(s);
  });
  return molScriptPromise;
}

// AlphaFold pLDDT 配色（B-factor 列承载置信度 0-100）
function plddtColor(b) {
  if (b >= 90) return "#0053d6";
  if (b >= 70) return "#65cbf3";
  if (b >= 60) return "#ffdb13";
  return "#ff7d45";
}
var CHAIN_PALETTE = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f39c12", "#1abc9c", "#e67e22", "#34495e"];

// 组装 3Dmol 样式对象：style=cartoon|stick|sphere|surface × colorBy=spectrum|chain|plddt|custom
function buildMolStyle(style, colorBy, customColor) {
  var styleObj = {};
  function wrap(o) { return style === "surface" ? { surface: { opacity: 0.5, colorscheme: o.colorscheme, color: o.color, colorfunc: o.colorfunc } } : styleObj; }
  if (colorBy === "spectrum") {
    styleObj = style === "cartoon" ? { cartoon: { color: "spectrum" } }
      : style === "stick" ? { stick: { color: "spectrum", radius: 0.18 } }
      : style === "sphere" ? { sphere: { color: "spectrum" } }
      : { surface: { opacity: 0.5, colorscheme: "spectrum" } };
  } else if (colorBy === "chain") {
    var cf = function (atom) { return CHAIN_PALETTE[Math.abs(String(atom.chain || "A").split("").reduce(function (a, c) { return a + c.charCodeAt(0); }, 0)) % CHAIN_PALETTE.length]; };
    styleObj = style === "cartoon" ? { cartoon: { colorfunc: cf } }
      : style === "stick" ? { stick: { colorfunc: cf, radius: 0.18 } }
      : style === "sphere" ? { sphere: { colorfunc: cf } }
      : { surface: { opacity: 0.5, colorfunc: cf } };
  } else if (colorBy === "plddt") {
    var pf = function (atom) { return plddtColor(atom.b || 0); };
    styleObj = style === "cartoon" ? { cartoon: { colorfunc: pf } }
      : style === "stick" ? { stick: { colorfunc: pf, radius: 0.18 } }
      : style === "sphere" ? { sphere: { colorfunc: pf } }
      : { surface: { opacity: 0.5, colorfunc: pf } };
  } else {
    var col = customColor || "#5b8def";
    styleObj = style === "cartoon" ? { cartoon: { color: col } }
      : style === "stick" ? { stick: { color: col, radius: 0.18 } }
      : style === "sphere" ? { sphere: { color: col } }
      : { surface: { opacity: 0.5, color: col } };
  }
  return styleObj;
}

// ---- PDB 文本处理：CA 提取 / Kabsch 叠合（Jacobi 3x3 特征分解）/ 坐标变换 ----
function parseCA(text) {
  var out = [];
  var lines = String(text || "").split("\n");
  for (var i = 0; i < lines.length; i++) {
    var L = lines[i];
    if (L.substr(0, 6) !== "ATOM  " && L.substr(0, 6) !== "HETATM") continue;
    if (L.substr(12, 4) !== " CA ") continue;           // 只取 Cα
    var alt = L.substr(16, 1);
    if (alt !== " " && alt !== "A") continue;
    out.push({
      chain: L.substr(21, 1).trim() || "A",
      resi: parseInt(L.substr(22, 4), 10),
      x: parseFloat(L.substr(30, 8)), y: parseFloat(L.substr(38, 8)), z: parseFloat(L.substr(46, 8)),
    });
  }
  return out.filter(function (a) { return isFinite(a.x) && isFinite(a.y) && isFinite(a.z); });
}

// 3x3 矩阵小工具
function mat3Mul(A, B) {
  var C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) for (var k = 0; k < 3; k++) C[i][j] += A[i][k] * B[k][j];
  return C;
}
function mat3Vec(A, v) { return [A[0][0]*v[0]+A[0][1]*v[1]+A[0][2]*v[2], A[1][0]*v[0]+A[1][1]*v[1]+A[1][2]*v[2], A[2][0]*v[0]+A[2][1]*v[1]+A[2][2]*v[2]]; }
function mat3Transpose(A) { return [[A[0][0],A[1][0],A[2][0]],[A[0][1],A[1][1],A[2][1]],[A[0][2],A[1][2],A[2][2]]]; }
function mat3Det(A) { return A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1]) - A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0]) + A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]); }

// Jacobi 特征分解（对称 3x3）：返回 {values:[...], vectors:[[...],[...],[...]]（列向量）}
function jacobiEigen3(M) {
  var A = M.map(function (r) { return r.slice(); });
  var V = [[1,0,0],[0,1,0],[0,0,1]];
  for (var sweep = 0; sweep < 50; sweep++) {
    var off = Math.abs(A[0][1]) + Math.abs(A[0][2]) + Math.abs(A[1][2]);
    if (off < 1e-12) break;
    for (var p = 0; p < 2; p++) {
      for (var q = p + 1; q < 3; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        var theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        var t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        var c = 1 / Math.sqrt(t * t + 1), s = t * c;
        var R = [[1,0,0],[0,1,0],[0,0,1]];
        R[p][p] = c; R[q][q] = c; R[p][q] = s; R[q][p] = -s;
        A = mat3Mul(mat3Transpose(R), mat3Mul(A, R));
        V = mat3Mul(V, R);
      }
    }
  }
  var vals = [A[0][0], A[1][1], A[2][2]];
  // 按特征值降序排列
  var order = [0, 1, 2].sort(function (a, b) { return vals[b] - vals[a]; });
  return {
    values: order.map(function (i) { return vals[i]; }),
    vectors: [0, 1, 2].map(function (r) { return order.map(function (i) { return V[r][i]; }); }),
  };
}

// Kabsch：把 mobile 的 CA 叠到 ref 上，返回 {R: 3x3, t: [3]}，使 R·p + t ≈ q
function kabschTransform(mobileCA, refCA) {
  // 按 chain:resi 配对
  var refMap = {};
  refCA.forEach(function (a) { refMap[a.chain + ":" + a.resi] = a; });
  var pairs = [];
  mobileCA.forEach(function (a) { var q = refMap[a.chain + ":" + a.resi]; if (q) pairs.push([a, q]); });
  if (pairs.length < 3) return null;
  var n = pairs.length;
  var pc = [0, 0, 0], qc = [0, 0, 0];
  pairs.forEach(function (pr) { pc[0]+=pr[0].x; pc[1]+=pr[0].y; pc[2]+=pr[0].z; qc[0]+=pr[1].x; qc[1]+=pr[1].y; qc[2]+=pr[1].z; });
  pc = pc.map(function (v) { return v / n; }); qc = qc.map(function (v) { return v / n; });
  // 协方差 H = Σ (p-pc)(q-qc)^T
  var H = [[0,0,0],[0,0,0],[0,0,0]];
  pairs.forEach(function (pr) {
    var p = [pr[0].x - pc[0], pr[0].y - pc[1], pr[0].z - pc[2]];
    var q = [pr[1].x - qc[0], pr[1].y - qc[1], pr[1].z - qc[2]];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) H[i][j] += p[i] * q[j];
  });
  // SVD via 特征分解：H^T H = V S² V^T；U_i = H v_i / s_i
  var eig = jacobiEigen3(mat3Mul(mat3Transpose(H), H)); // H^T H（对称阵）
  var V = eig.vectors;                                     // 列向量为特征向量
  var U = [[0,0,0],[0,0,0],[0,0,0]];
  var sv = [];
  for (var c = 0; c < 3; c++) {
    var v = [V[0][c], V[1][c], V[2][c]];
    var Hv = mat3Vec(H, v);
    var s = Math.sqrt(Math.max(eig.values[c], 0));
    sv.push(s);
    if (s > 1e-9) for (var r = 0; r < 3; r++) U[r][c] = Hv[r] / s;
    else { var fallback = [0,0,0]; fallback[(c+1)%3] = 1; for (var r2 = 0; r2 < 3; r2++) U[r2][c] = fallback[r2]; }
  }
  // 修正反射：D = diag(1,1,det(V·U^T))
  var VUT = mat3Mul(V, mat3Transpose(U));
  var D = [[1,0,0],[0,1,0],[0,0,mat3Det(VUT) >= 0 ? 1 : -1]];
  var R = mat3Mul(V, mat3Mul(D, mat3Transpose(U)));
  // t = qc - R·pc
  var t = [qc[0] - mat3Vec(R, pc)[0], qc[1] - mat3Vec(R, pc)[1], qc[2] - mat3Vec(R, pc)[2]];
  return { R: R, t: t, pairs: n };
}

// 对 PDB 文本应用刚体变换（只改 ATOM/HETATM 的坐标列，列宽严格保持）
function applyRigidToPdb(text, R, t) {
  var lines = String(text || "").split("\n");
  for (var i = 0; i < lines.length; i++) {
    var L = lines[i];
    if (L.substr(0, 6) !== "ATOM  " && L.substr(0, 6) !== "HETATM") continue;
    var x = parseFloat(L.substr(30, 8)), y = parseFloat(L.substr(38, 8)), z = parseFloat(L.substr(46, 8));
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
    var v = mat3Vec(R, [x, y, z]);
    var nx = v[0] + t[0], ny = v[1] + t[1], nz = v[2] + t[2];
    function fmt(num) {
      var s = num.toFixed(3);
      if (s.indexOf(".") < 0) s += ".000";
      while (s.length < 8) s = " " + s;   // 右对齐到 8 列（PDB 列 31-38）
      if (s.length > 8) s = s.slice(0, 8);
      return s;
    }
    lines[i] = L.substr(0, 30) + fmt(nx) + fmt(ny) + fmt(nz) + L.substr(54);
  }
  return lines.join("\n");
}

// 文件路径友好标签
function pdbLabel(struct, idx) { return struct.label || (struct.pdb ? String(struct.pdb).split("/").pop() : "结构 " + (idx + 1)); }

// 3D 查看器主体
function MoleculeViewer(props) {
  var raw = props.data;
  // 兼容简写：data 直接是 PDB 路径字符串
  var spec = raw;
  if (typeof raw === "string") spec = { structures: [{ pdb: raw }] };
  var structures = (spec && Array.isArray(spec.structures) ? spec.structures : []).filter(function (s) { return s && (s.pdb || s.url); });
  var defStyle = (spec && spec.style) || "cartoon";
  var defColorBy = (spec && spec.colorBy) || "spectrum";
  var defLayout = (spec && spec.layout) || "sideBySide";
  var height = Math.max(240, Math.min(900, Number((spec && spec.height) || props.height) || 480));

  var boxRef = React.useRef(null);
  var viewersRef = React.useRef([]);
  var textsRef = React.useRef([]);        // 每个结构的 PDB 文本（叠合后替换）
  var st = React.useState(defStyle); var style = st[0]; var setStyle = st[1];
  var cb = React.useState(defColorBy); var colorBy = cb[0]; var setColorBy = cb[1];
  var lo = React.useState(defLayout); var layout = lo[0]; var setLayout = lo[1];
  var msg = React.useState(""); var msgS = msg[0]; var setMsg = msg[1];
  var busy = React.useState(false); var busyS = busy[0]; var setBusy = busy[1];
  var overlaid = React.useState(false); var overlaidS = overlaid[0]; var setOverlaid = overlaid[1];
  var superposeInfo = React.useState(""); var superInfo = superposeInfo[0]; var setSuperInfo = superposeInfo[1];

  // 应用样式/着色到全部 viewer（不重建——快速切换）
  function applyStyle() {
    viewersRef.current.forEach(function (v, i) {
      if (!v) return;
      var col = colorBy === "custom" ? (structures[i] && structures[i].color) : null;
      var so = buildMolStyle(style, colorBy, col);
      if (layout === "overlay") v.setStyle({ model: i }, so);
      else v.setStyle({}, so);
      v.render();
    });
  }
  React.useEffect(function () { applyStyle(); }, [style, colorBy]);

  // 构建/重建 viewer（layout 或叠合状态变化时）
  function buildAll() {
    var box = boxRef.current;
    if (!box || !structures.length) return;
    // WebGL 预检：远程桌面/无 GPU/浏览器禁用 WebGL 时 3Dmol 必然失败——提前给出友好降级，绝不拖垮整个窗口
    if (!webglSupported()) {
      setMsg("当前浏览器/环境不支持 WebGL，无法渲染 3D 结构（其余图表不受影响）。建议：① 换用本地 Chrome/Edge 打开本页面；② 若经远程桌面访问，请在本地浏览器登录；③ 浏览器开启硬件加速（设置 → 系统 → 使用硬件加速）后重试。");
      return;
    }
    setBusy(true); setMsg("加载 PDB…");
    var texts = textsRef.current;
    load3Dmol().then(function ($3Dmol) {
      // 1) 解析全部 PDB → 本地 URL → 文本
      return Promise.all(structures.map(function (s, i) {
        var cached = texts[i] && texts[i].src === s.pdb ? texts[i] : null;
        if (cached) return Promise.resolve(cached.text);
        var urlPromise = s.url && /^https?:|^data:|^\//.test(s.url) ? Promise.resolve(s.url) : resolveFileUrl(s.pdb);
        return urlPromise.then(function (u) { return fetch(u).then(function (r) { return r.text(); }); }).then(function (t) {
          if (!t || /^\s*<(!doctype|html)/i.test(t)) throw new Error("PDB 文件读取失败（路径不存在或服务异常）：" + (s.pdb || s.url || ""));
          texts[i] = { src: s.pdb, text: t };
          return t;
        });
      })).then(function (allTexts) {
        // 2) 清空容器重建
        box.innerHTML = "";
        viewersRef.current = [];
        var overlay = layout === "overlay" && structures.length > 1;
        function newViewer(el) {
          try { var v0 = $3Dmol.createViewer(el, { backgroundColor: "#f7f8fa" }); if (v0) return v0; } catch (e0) { /* 落到下方统一报错 */ }
          throw new Error("WebGL 上下文创建失败（createViewer 返回空）——当前环境无法渲染 3D，其余图表不受影响");
        }
        if (overlay) {
          var one = document.createElement("div");
          one.style.width = "100%"; one.style.height = height + "px";
          box.appendChild(one);
          var v = newViewer(one);
          allTexts.forEach(function (t, i) {
            v.addModel(t, "pdb");
            var col = colorBy === "custom" ? (structures[i] && structures[i].color) : null;
            v.setStyle({ model: i }, buildMolStyle(style, colorBy, col));
          });
          v.zoomTo(); v.render();
          viewersRef.current = [v];
        } else {
          var row = document.createElement("div");
          row.style.display = "flex"; row.style.flexWrap = "wrap"; row.style.gap = "10px";
          box.appendChild(row);
          structures.forEach(function (s, i) {
            var cell = document.createElement("div");
            cell.style.flex = "1 1 320px"; cell.style.minWidth = "280px";
            var cap = document.createElement("div");
            cap.style.cssText = "font-size:12px;font-weight:600;opacity:.75;padding:2px 2px 4px;";
            cap.textContent = pdbLabel(s, i) + (s.color ? " ●" : "");
            if (s.color) cap.style.color = s.color;
            var holder = document.createElement("div");
            holder.style.width = "100%"; holder.style.height = height + "px";
            holder.style.border = "1px solid rgba(128,128,128,.25)"; holder.style.borderRadius = "8px"; holder.style.overflow = "hidden";
            cell.appendChild(cap); cell.appendChild(holder); row.appendChild(cell);
            var vv = newViewer(holder);
            vv.addModel(allTexts[i], "pdb");
            var col2 = colorBy === "custom" ? (s && s.color) : null;
            vv.setStyle({}, buildMolStyle(style, colorBy, col2));
            vv.zoomTo(); vv.render();
            viewersRef.current.push(vv);
          });
        }
        setBusy(false); setMsg("");
      });
    }).catch(function (e) {
      setBusy(false); setMsg("❌ " + (e && e.message || e));
    });
  }
  React.useEffect(buildAll, [JSON.stringify(structures), layout]);

  // 工具栏动作
  function doSuperpose() {
    if (overlaidS) { setOverlaid(false); setSuperInfo(""); textsRef.current = textsRef.current.map(function (t) { if (t && t.original) { var r = { src: t.src, text: t.original }; return r; } return t; }); setTimeout(buildAll, 0); return; }
    if (structures.length < 2 || layout !== "overlay") return;
    setBusy(true); setMsg("叠合计算中…");
    setTimeout(function () {
      try {
        var texts = textsRef.current;
        var refCA = parseCA(texts[0].text);
        var report = [];
        for (var i = 1; i < texts.length; i++) {
          var mobCA = parseCA(texts[i].text);
          var tf = kabschTransform(mobCA, refCA);
          if (!tf) { report.push(pdbLabel(structures[i], i) + ": Cα 配对不足"); continue; }
          texts[i] = { src: texts[i].src, text: applyRigidToPdb(texts[i].text, tf.R, tf.t), original: texts[i].original || texts[i].text };
          report.push(pdbLabel(structures[i], i) + ": " + tf.pairs + " Cα");
        }
        setOverlaid(true); setSuperInfo("已叠合到 " + pdbLabel(structures[0], 0) + "（" + report.join("；") + "）");
        setBusy(false); setMsg("");
        setTimeout(buildAll, 0);
      } catch (e) { setBusy(false); setMsg("❌ 叠合失败：" + (e && e.message || e)); }
    }, 30);
  }
  function doFullscreen() {
    var box = boxRef.current;
    if (!box) return;
    var target = box.parentElement || box;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (target.requestFullscreen) target.requestFullscreen();
  }
  function doScreenshot() {
    var viewers = viewersRef.current.filter(Boolean);
    if (!viewers.length) return;
    var uris = viewers.map(function (v) { try { return v.pngURI(); } catch (e) { return null; } }).filter(Boolean);
    if (!uris.length) { setMsg("❌ 截图失败"); return; }
    var imgs = uris.map(function (u) { var im = new Image(); im.src = u; return im; });
    setTimeout(function () {
      var cw = imgs.reduce(function (a, im) { return a + im.width; }, 0);
      var ch = Math.max.apply(null, imgs.map(function (im) { return im.height; }));
      if (!cw || !ch) { setMsg("❌ 截图失败"); return; }
      var canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext("2d");
      var x = 0;
      imgs.forEach(function (im) { ctx.drawImage(im, x, 0); x += im.width; });
      var a = document.createElement("a");
      a.download = "structures-" + Date.now() + ".png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      setMsg("📸 截图已下载");
    }, 120);
  }

  if (!structures.length) return h("div", { className: "muted" }, "（structure3d：data.structures 为空——需提供 [{pdb: 路径, label, color}]）");
  var btn = function (label, active, onClick, title) {
    return h("button", { className: "refresh", onClick: onClick, title: title || "", style: active ? { background: "rgba(15,98,254,.14)", borderColor: "#0f62fe", fontWeight: 700 } : null }, label);
  };
  return h("div", { style: { border: "1px solid rgba(128,128,128,.25)", borderRadius: 10, overflow: "hidden", background: "rgba(128,128,128,.03)" } },
    // 工具栏
    h("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "6px 10px", borderBottom: "1px dashed rgba(128,128,128,.2)", fontSize: 12 } },
      h("span", { style: { opacity: .6, marginRight: 2 } }, "视图"),
      btn("卡通", style === "cartoon", function () { setStyle("cartoon"); }),
      btn("球棍", style === "stick", function () { setStyle("stick"); }),
      btn("表面", style === "surface", function () { setStyle("surface"); }),
      btn("空间填充", style === "sphere", function () { setStyle("sphere"); }),
      h("span", { style: { opacity: .4 } }, "|"),
      h("span", { style: { opacity: .6 } }, "着色"),
      btn("彩虹", colorBy === "spectrum", function () { setColorBy("spectrum"); }, "按残基位置光谱着色"),
      btn("链", colorBy === "chain", function () { setColorBy("chain"); }, "按链着色"),
      btn("pLDDT", colorBy === "plddt", function () { setColorBy("plddt"); }, "AlphaFold 置信度（蓝高红低，需 B-factor 列）"),
      btn("自定义", colorBy === "custom", function () { setColorBy("custom"); }, "按各结构 color 字段着色"),
      h("span", { style: { opacity: .4 } }, "|"),
      structures.length > 1 ? btn(layout === "overlay" ? "叠合模式" : "并列模式", true, function () { setLayout(layout === "overlay" ? "sideBySide" : "overlay"); setOverlaid(false); setSuperInfo(""); }) : null,
      structures.length > 1 && layout === "overlay" ? btn(overlaidS ? "取消叠合" : "🔄 结构叠合", overlaidS, doSuperpose, "按 Cα 最小二乘叠合到第一个结构") : null,
      h("span", { style: { flex: 1 } }),
      btn("⛶ 全屏", false, doFullscreen, "全屏查看"),
      btn("📸 截图", false, doScreenshot, "截图下载 PNG")
    ),
    superInfo ? h("div", { style: { fontSize: 11, padding: "3px 10px", color: "#22a06b", fontWeight: 600 } }, superInfo) : null,
    // 3D 画布容器（命令式管理）
    h("div", { style: { position: "relative" } },
      h("div", { ref: boxRef, style: { width: "100%" } }),
      busyS || msgS ? h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(247,248,250,.75)", fontSize: 13, pointerEvents: "none" } },
        msgS || "渲染中…") : null
    ),
    h("div", { style: { fontSize: 11, opacity: .55, padding: "3px 10px 6px" } }, "拖拽旋转 · 右键平移 · 滚轮缩放" + (structures.length > 1 ? " · " + structures.length + " 个结构" : ""))
  );
}

// iframe：data 为路径时经 /v2/chart-file 本地化后再加载（P0）
function FileIframe(props) {
  var data = props.data;
  var srcState = React.useState(null); var src = srcState[0]; var setSrc = srcState[1];
  var errState = React.useState(""); var err = errState[0]; var setErr = errState[1];
  var raw = chartSrc(data);
  React.useEffect(function () {
    if (!raw) return;
    if (!isPathLike(raw)) { setSrc(raw); return; }
    var live = true;
    resolveFileUrl(raw).then(function (u) { if (live) setSrc(u); }).catch(function (e) { if (live) setErr(e.message); });
    return function () { live = false; };
  }, [raw]);
  if (!raw) return h("div", { className: "muted" }, "（iframe 未提供地址）");
  if (err) return h("div", { className: "muted" }, "（iframe 加载失败：" + err + "）");
  if (!src) return h("div", { className: "muted", style: { textAlign: "center", padding: 24 } }, "解析文件中…");
  return h("div", { style: { position: "relative", width: "100%", paddingTop: props.ratio || "62.5%", border: "1px solid rgba(128,128,128,.25)", borderRadius: 8, overflow: "hidden" } },
    h("iframe", { src: src, style: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }, allowFullScreen: true, loading: "lazy" })
  );
}

// html 块：data 为路径时取回内容再渲染（P2，消除「路径 vs 字符串」歧义）
function HtmlBlock(props) {
  var raw = String(props.data || "");
  var html = React.useState(isPathLike(raw) ? "" : raw); var content = html[0]; var setContent = html[1];
  var err = React.useState(""); var errS = err[0]; var setErr = err[1];
  React.useEffect(function () {
    if (!isPathLike(raw)) return;
    var live = true;
    resolveFileUrl(raw).then(function (u) { return fetch(u).then(function (r) { return r.text(); }); })
      .then(function (t) { if (live) setContent(t); })
      .catch(function (e) { if (live) setErr(e.message); });
    return function () { live = false; };
  }, [raw]);
  if (errS) return h("div", { className: "muted" }, "（html 加载失败：" + errS + "）");
  if (!content) return h("div", { className: "muted", style: { textAlign: "center", padding: 24 } }, "加载内容中…");
  return h("div", { className: "media-html", dangerouslySetInnerHTML: { __html: content } });
}

// 渲染错误边界：单个图表/章节渲染抛异常时降级为内联错误卡，绝不让整窗空白。
// 错误信息直接显示在界面上（同时起到自诊断作用：真实环境崩溃原因一眼可见）。
function safeWrap(node, hint) {
  if (!(React && typeof React.Component === "function")) return node; // 极端环境下无 Component 则退回直接渲染
  return h(ErrorBoundary, { hint: hint }, node);
}
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  componentDidCatch() { /* 已由 getDerivedStateFromError 呈现，无需额外上报 */ }
  render() {
    var e = this.state.err;
    if (!e) return this.props.children;
    var msg = String((e && e.message) || e || "未知错误").slice(0, 300);
    return h("div", { style: { border: "1px dashed rgba(229,72,77,.55)", borderRadius: 10, padding: "12px 14px", margin: "10px 0", background: "rgba(229,72,77,.06)" } },
      h("div", { style: { fontWeight: 700, fontSize: 12.5, marginBottom: 4, color: "#b3261e" } }, "⚠️ 这一部分渲染失败（其余内容不受影响）"),
      h("div", { style: { fontFamily: "monospace", fontSize: 11.5, wordBreak: "break-all", opacity: .8 } }, msg),
      this.props.hint ? h("div", { style: { fontSize: 12, opacity: .65, marginTop: 4 } }, this.props.hint) : null
    );
  }
}

function ChartView(props) {
  var chart = props.data;
  if (!chart || !chart.type) return null;
  var body = null;
  if (chart.type === "bar") body = h(BarChart, { data: chart });
  else if (chart.type === "summary") body = h(SummaryView, { data: chart });
  else if (chart.type === "line") body = h(LineChart, { data: chart });
  else if (chart.type === "pie") body = h(PieChart, { data: chart });
  else if (chart.type === "scatter") body = h(ScatterChart, { data: chart });
  else if (chart.type === "heatmap") body = h(HeatmapChart, { data: chart });
  else if (chart.type === "stat" || chart.type === "kpi") body = h(StatView, { data: chart });
  else if (chart.type === "table") body = h(SummaryView, { data: { type: "summary", data: chart.data } });
  else if (chart.type === "html") body = h(HtmlBlock, { data: chart.data });
  else if (chart.type === "structure3d") body = safeWrap(h(MoleculeViewer, { data: chart.data, height: 480 }), "3D 渲染依赖 WebGL，远程桌面/无 GPU 或浏览器关闭硬件加速时不可用；其余图表不受影响。");
  else if (chart.type === "image") {
    body = h(MediaImage, { src: chartSrc(chart.data), caption: chart.caption });
  } else if (chart.type === "video") {
    var vsrc = chartSrc(chart.data);
    body = h("div", { style: { textAlign: "center" } },
      h("video", { src: vsrc, controls: true, style: { maxWidth: "100%", borderRadius: 8, maxHeight: 360 } })
    );
  } else if (chart.type === "audio") {
    body = h("div", null, h("audio", { src: chartSrc(chart.data), controls: true, style: { width: "100%" } }));
  } else if (chart.type === "iframe") {
    body = h(FileIframe, { data: chart.data });
  } else if (chart.type === "link") {
    body = h("div", null, h("a", { href: String(chart.data || ""), target: "_blank", rel: "noopener noreferrer", style: { color: "#0f62fe" } }, String(chart.title || chart.caption || "打开链接")));
  } else {
    body = h("div", { className: "muted" }, "（不支持的图表类型：" + esc(chart.type) + "）");
  }
  return h("div", { className: "chart" },
    chart.title ? h("div", { className: "chart-title" }, chart.title) : null,
    safeWrap(body, "该图表数据或渲染环境（如 WebGL）可能导致此问题；可重启后重试或联系查看控制台报错。"),
    chart.caption ? h("div", { className: "chart-caption" }, chart.caption) : null
  );
}

function DeliveryView(props) {
  var sessionId = props && props.sessionId ? props.sessionId : "";
  var projectsState = React.useState([]); var projects = projectsState[0]; var setProjects = projectsState[1];
  var errState = React.useState(""); var err = errState[0]; var setErr = errState[1];
  var imagesState = React.useState([]); var images = imagesState[0]; var setImages = imagesState[1];
  var selPair = useSel(sessionId); var sel = selPair[0]; var setSelV = selPair[1];

  React.useEffect(function () {
    var live = true;
    function load() {
      // 结果交付按会话隔离：每个对话只显示该会话的项目成果
      api("/v2/projects?sessionId=" + encodeURIComponent(sessionId)).then(function (d) {
        if (!live) return;
        if (d && d.ok) { setProjects(d.projects || []); setErr(""); }
        else setErr((d && d.error) || "读取失败");
      }).catch(function (e) { if (live) setErr(String(e && e.message || e)); });
    }
    load();
    var timer = setInterval(load, 10000);
    return function () { live = false; clearInterval(timer); };
  }, [sessionId]);

  // 收集该项目运行产物中的分析图（base64，host 侧缓存）
  React.useEffect(function () {
    if (!sel) { setImages([]); return; }
    var live = true;
    api("/v2/delivery-images?projectId=" + encodeURIComponent(sel) + "&sessionId=" + encodeURIComponent(sessionId)).then(function (d) {
      if (live && d && d.ok) setImages(d.images || []);
    }).catch(function () { setImages([]); });
    return function () { live = false; };
  }, [sel, sessionId]);

  var project = null;
  for (var i = 0; i < projects.length; i++) if (projects[i].id === sel) { project = projects[i]; break; }
  if (!project && projects.length) project = projects[0];

  var delivery = project ? project.delivery : null;
  var allCharts = (delivery && delivery.charts && delivery.charts.length) ? delivery.charts : [];
  var hasImages = images.length > 0;

  // 最外层兜底：即便某个未知环节抛错，也只显示错误卡而不是整窗空白
  return safeWrap(h("div", { className: "dcs2 paper", style: { padding: "16px 20px" } },
    projects.length === 0
      ? h("div", { className: "empty" }, "本会话暂无交付文档。项目推进到关键节点时，agent 会用 dcs_delivery_update 按论文逻辑整体梳理：科学问题 → 假说 → 分解 → 数据 → 方法 → 发现 → 创新性 → 下一步。")
      : h("div", null,
          h(ProjectChips, { projects: projects, sel: project ? project.id : "", onSelect: function (id) { setSelV(id); setSel(sessionId, id); } }),
          !delivery || !delivery.revision
            ? h("div", { className: "empty" }, "交付文档尚未开始。建议在项目早期就用 dcs_delivery_update 写下科学问题与假说，随后在关键节点整体梳理更新。")
            : h("div", null,
                h("div", { className: "paper-head" },
                  h("div", { className: "paper-title" }, project.title),
                  project.objective ? h("div", { className: "paper-sub" }, "研究目标：" + project.objective) : null,
                  h("div", { className: "paper-meta" },
                    h("span", { className: "paper-rev" }, "修订 v" + delivery.revision),
                    h("span", null, "最近整体梳理：" + fmtTime(delivery.updatedAt)),
                    h("span", null, "模型：" + (project.model || "auto")),
                    h("span", null, "状态：" + (STATUS_LABEL[project.status] || project.status))
                  )
                ),
                // 章节速览：点击平滑滚动到对应章节
                (function () {
                  var present = SECTION_META.filter(function (sec) {
                    var c = delivery.sections && delivery.sections[sec.key];
                    return c && String(c).trim();
                  });
                  if (present.length < 3) return null;
                  return h("div", { className: "toc" }, present.map(function (sec) {
                    return h("button", { key: sec.key, className: "tchip", style: { "--tc": sec.color || "#0f62fe" }, onClick: function () {
                      var el = document.getElementById("dcs-sec-" + sec.key);
                      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    } }, sec.icon + " " + sec.label);
                  }));
                })(),
                SECTION_META.map(function (sec) {
                  var content = delivery.sections && delivery.sections[sec.key];
                  if (!content || !String(content).trim()) return null;
                  var opts = { images: images, sectionKey: sec.key };
                  var bodyNodes = sec.key === "findings"
                    ? renderFindings(content, allCharts, opts)
                    : renderBodyWithEmbeds(content, allCharts, opts);
                  return h("div", {
                    key: sec.key,
                    id: "dcs-sec-" + sec.key,
                    className: "psec" + (sec.hero ? " psec-hero" : ""),
                    style: sec.color ? { "--ac": sec.color } : null,
                  },
                    h("h4", null,
                      h("span", { className: "ic", style: sec.color ? { background: sec.color + "1f" } : null }, sec.icon),
                      h("span", { className: "lb" }, sec.label),
                      sec.en ? h("span", { className: "en" }, sec.en) : null
                    ),
                    safeWrap(bodyNodes, "本节内容渲染异常；其余章节不受影响。")
                  );
                }),
                (function () {
                  // 末尾「数据图表」区：只放未被正文引用的图表 + 自动收集的分析图
                  var usedIds = collectInlineChartIds(delivery, allCharts);
                  var leftover = allCharts.filter(function (c) { return !c.id || usedIds.indexOf(String(c.id)) === -1; });
                  if (!leftover.length && !hasImages) return null;
                  return h("div", { className: "psec" }, h("h4", null, h("span", { className: "ic" }, "📊"), "数据图表"),
                    leftover.map(function (c, idx) { return safeWrap(h(ChartView, { key: 'c' + idx, data: c }), "该图表渲染异常，其余图表不受影响。"); }),
                    images.map(function (im, idx) {
                      return safeWrap(h(ChartView, { key: 'i' + idx, data: { type: "image", title: im.name, caption: im.name, data: im.base64 } }), "该分析图渲染异常，其余图表不受影响。");
                    })
                  );
                })()
              )
        )
  ), "交付窗口整体渲染异常——请把此错误信息反馈给开发。");
}

// 把 markdown 内容里的 %%chart:<id>%% / %%media:<id>%% 占位符替换为内嵌的 ChartView 组件，
// 其余文本经 mdToHtml。用于让图表/多媒体随正文插入（非末尾堆积）。
function renderBodyWithEmbeds(content, charts, opts) {
  var src = String(content || "");
  var byId = {};
  for (var i = 0; i < charts.length; i++) if (charts[i].id) byId[String(charts[i].id)] = charts[i];
  // 用 %CHART:id% 作为分隔 token，再按 token 拆成文本段 + 组件段
  var marker = "__CHART_TOKEN__";
  var replaced = src.replace(/%{2}(chart|media):([A-Za-z0-9_\-]+)%{2}/g, function (m, kind, id) {
    var chart = byId[id];
    if (chart) return marker + id + marker;
    return m; // 保留未匹配的
  });
  // 智能兜底：正文未用占位符时，把"（图N：...）"这类文字注记替换为真正内嵌的图
  if (replaced.indexOf(marker) === -1) {
    var inlineIds = findChartsMentioned(textToPlain(src), charts);
    if (inlineIds.length) {
      var replaced2 = replaced;
      for (var cIdx = 0; cIdx < inlineIds.length; cIdx++) {
        // 匹配 "（图N：...）" 或 "（图N ...）" 注记（N 对应序号），删除注记并注入内嵌 token
        var noteRe = new RegExp('[（(]\\s*图' + (cIdx + 1) + '[^（（）()图]{0,90}?[）)]\\s*', 'g');
        replaced2 = replaced2.replace(noteRe, function () { return marker + inlineIds[cIdx] + marker; });
      }
      if (replaced2 !== replaced) replaced = replaced2;
    }
  }
  var segs = replaced.split(marker);
  // 奇数位是 chart id，偶数位是文本
  var out = 0; // count text segments for keys
  var nodes = segs.map(function (seg, idx) {
    if (idx % 2 === 1) {
      var c = byId[seg];
      return c ? h(ChartView, { key: 'emb' + seg, data: c }) : null;
    }
    if (!seg) return null;
    return h("div", { key: 'txt' + (out++), className: "body", dangerouslySetInnerHTML: { __html: mdToHtml(seg) } });
  }).filter(Boolean);
  if (nodes.length === 1 && nodes[0].type === "div") return nodes[0];
  return h("div", { className: "body-wrap" }, nodes);
}

// 「科学发现与主要结论」结构化渲染：识别 "### 发现/结论 …" 块 → 编号发现卡片（重点明确）。
// 块内正文仍走 renderBodyWithEmbeds，图表占位符照常内嵌；无结构化标题时回退普通渲染。
function renderFindings(content, charts, opts) {
  var src = String(content || "");
  var re = /^[ \t]*(#{2,4})[ \t]*((?:发现|结论|核心结论|主要结论|发现\s*\d+|结论\s*\d+)[^\n]*)$/gm;
  var marks = [];
  var m;
  while ((m = re.exec(src)) !== null) {
    marks.push({
      start: m.index,
      end: (function () { var nl = src.indexOf("\n", m.index); return nl === -1 ? src.length : nl + 1; })(),
      title: m[2].replace(/[：:]\s*$/, ""),
    });
  }
  if (!marks.length) return renderBodyWithEmbeds(src, charts, opts);
  var lead = marks[0].start > 0 ? src.slice(0, marks[0].start).trim() : "";
  var nodes = [];
  if (lead) nodes.push(h("div", { key: "flead", className: "lead", dangerouslySetInnerHTML: { __html: mdToHtml(lead) } }));
  marks.forEach(function (mk, idx) {
    var bodyEnd = idx + 1 < marks.length ? marks[idx + 1].start : src.length;
    var body = src.slice(mk.end, bodyEnd).trim();
    // agent 常把 %%chart:id%% 附在标题行（如 `### 发现 1：…[%%chart:fig1%%]（解读）`）。
    // 从标题剥离这些占位符，作为该发现的附图内嵌到正文前——保证图文混排（不然 token 锁死在标题文字里）。
    var titleTokens = [];
    var cleanTitle = mk.title
      .replace(/%{2}(?:chart|media):([A-Za-z0-9_\-]+)%{2}/g, function (m0, id0) { titleTokens.push(id0); return ""; })
      .replace(/\[[ \t]*\]/g, "").replace(/\s+/g, " ").trim();
    if (titleTokens.length) body = titleTokens.map(function (id2) { return "%%chart:" + id2 + "%%"; }).join("\n\n") + (body ? "\n\n" + body : "");
    nodes.push(h("div", { key: "fnd" + idx, className: "finding" },
      h("div", { className: "no" }, String(idx + 1)),
      h("div", { className: "fbody" },
        h("div", { className: "ftitle" }, cleanTitle),
        body ? h("div", { className: "fembed" }, renderBodyWithEmbeds(body, charts, opts)) : null
      )
    ));
  });
  return h("div", { className: "findings" }, nodes);
}

// 从纯文本中探测章节引用的图表：匹配"图N"序号，N 对应 charts 数组第 N 项（含 id）
function findChartsMentioned(text, charts) {
  var ids = [];
  var nums = [];
  var m;
  var re = /图\s*([0-9]+)/g;
  while ((m = re.exec(text)) !== null) nums.push(parseInt(m[1], 10));
  for (var i = 0; i < nums.length; i++) {
    var n = nums[i];
    var c = charts[n - 1];
    if (c && c.id && ids.indexOf(String(c.id)) === -1) ids.push(String(c.id));
  }
  return ids;
}

function textToPlain(md) {
  return String(md || "").replace(/[#*\-`|]/g, " ");
}

// 收集正文中已引用的图表 id：%%chart:<id>%% 显式占位符 + "（图N...）见图表区"兜底注记
function collectInlineChartIds(delivery, charts) {
  var ids = [];
  var sections = (delivery && delivery.sections) || {};
  var re = /%{2}chart:([A-Za-z0-9_\-]+)%{2}/g;
  var all = charts || [];
  for (var k in sections) {
    var s = String(sections[k] || "");
    var m;
    while ((m = re.exec(s)) !== null) ids.push(m[1]);
    // 兜底注记："图N" 且 N 对应 all 数组第 N 项
    var nums = [];
    var nr = /图\s*([0-9]+)/g;
    while ((m = nr.exec(textToPlain(s))) !== null) nums.push(parseInt(m[1], 10));
    for (var i = 0; i < nums.length; i++) {
      var c = all[nums[i] - 1];
      if (c && c.id && ids.indexOf(String(c.id)) === -1) ids.push(String(c.id));
    }
  }
  return ids;
}

// ================= 会话地图（Synapse 式实时画布） =================

function SynapseView(props) {
  var sessionId = props && props.sessionId ? props.sessionId : "";
  var eventsState = React.useState([]); var events = eventsState[0]; var setEvents = eventsState[1];
  var titleState = React.useState(""); var title = titleState[0]; var setTitle = titleState[1];
  var forksState = React.useState([]); var forks = forksState[0]; var setForks = forksState[1];
  var errState = React.useState(""); var err = errState[0]; var setErr = errState[1];
  var expandState = React.useState({}); var expand = expandState[0]; var setExpand = expandState[1];
  var connectedState = React.useState(false); var connected = connectedState[0]; var setConnected = connectedState[1];
  var esRef = React.useRef(null);

  // SSE 实时连接：替代轮询，事件驱动推送
  React.useEffect(function () {
    var live = true;
    setEvents([]);
    setConnected(false);
    var url = '/api/dcs-cloud/v2/session-events/stream?sessionId=' + encodeURIComponent(sessionId);
    var es = new EventSource(url);
    esRef.current = es;
    es.onopen = function () { if (live) setConnected(true); };
    es.onerror = function () { if (live) setConnected(false); };
    es.addEventListener('message', function (e) {
      if (!live) return;
      try {
        var ev = JSON.parse(e.data);
        if (ev.kind === 'title') { setTitle(ev.title); return; }
        setEvents(function (cur) {
          var seen = {}; for (var i = 0; i < cur.length; i++) seen[cur[i].seq] = i;
          if (seen[ev.seq] !== undefined) {
            var merged = cur.slice();
            merged[seen[ev.seq]] = ev;
            return merged;
          }
          return cur.concat([ev]);
        });
      } catch {}
    });
    es.addEventListener('forks', function (e) {
      if (!live) return;
      try { setForks(JSON.parse(e.data)); } catch {}
    });
    return function () { live = false; es.close(); };
  }, [sessionId]);

  // 将事件分组为 turns（与之前逻辑一致，但事件来源改为 SSE）
  var turns = [];
  var currentTurn = null;
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (ev.kind === 'user' && (ev.source === 'user' || ev.source === undefined)) {
      if (currentTurn) turns.push(currentTurn);
      currentTurn = { userText: ev.text || '', assistantTexts: [], toolCalls: [], contextCount: 0, at: ev.at, seq: ev.seq };
    } else if (ev.kind === 'user') {
      if (currentTurn) currentTurn.contextCount++;
    } else if (ev.kind === 'assistant' && currentTurn) {
      if (ev.text) currentTurn.assistantTexts.push({ text: ev.text, interrupted: !!ev.interrupted });
    } else if (ev.kind === 'tool' && currentTurn) {
      // SSE 推送的单个 tool 事件已经是折叠后的（call+result 合并）
      if (ev.resultOnly && currentTurn.toolCalls.length) {
        // 查找匹配的 callId 补全
        for (var tj = currentTurn.toolCalls.length - 1; tj >= 0; tj--) {
          if (currentTurn.toolCalls[tj].callId === ev.callId && currentTurn.toolCalls[tj].pending) {
            currentTurn.toolCalls[tj].result = ev.result;
            currentTurn.toolCalls[tj].isError = ev.isError;
            currentTurn.toolCalls[tj].pending = false;
            break;
          }
        }
      } else {
        currentTurn.toolCalls.push(ev);
      }
    }
  }
  if (currentTurn) turns.push(currentTurn);

  var failCount = 0, toolTotal = 0;
  for (var fi = 0; fi < turns.length; fi++) {
    toolTotal += turns[fi].toolCalls.length;
    for (var tj = 0; tj < turns[fi].toolCalls.length; tj++) if (turns[fi].toolCalls[tj].isError) failCount++;
  }

  function toggleTurn(idx) {
    setExpand(function (cur) { var n = {}; for (var k in cur) n[k] = cur[k]; n[idx] = !cur[idx]; return n; });
  }
  function shortTool(name) {
    if (!name) return '工具';
    var m = name.match(/^dcs_(.+)/);
    return m ? m[1] : (name.length > 28 ? name.slice(0, 26) + '…' : name);
  }
  function clipText(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  return h('div', { className: 'dcs2', style: { padding: '16px 20px', maxWidth: 900, margin: '0 auto' } },
    h('div', { className: 'row', style: { justifyContent: 'space-between' } },
      h('h2', null, '会话地图' + (title ? ' · ' + clipText(title, 24) : '')),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        h('span', { style: { fontSize: 11, opacity: .7 } },
          connected ? '🟢 实时' : '🔴 断线'
        ),
        h('button', { className: 'refresh', onClick: function () {
          setEvents([]); esRef.current && esRef.current.close();
          setConnected(false);
          var es2 = new EventSource('/api/dcs-cloud/v2/session-events/stream?sessionId=' + encodeURIComponent(sessionId));
          esRef.current = es2;
          es2.onopen = function () { setConnected(true); };
          es2.onerror = function () { setConnected(false); };
          es2.addEventListener('message', function (e) {
            try {
              var ev = JSON.parse(e.data);
              if (ev.kind === 'title') { setTitle(ev.title); return; }
              setEvents(function (cur) {
                var seen = {}; for (var i = 0; i < cur.length; i++) seen[cur[i].seq] = i;
                if (seen[ev.seq] !== undefined) { var m = cur.slice(); m[seen[ev.seq]] = ev; return m; }
                return cur.concat([ev]);
              });
            } catch {}
          });
          es2.addEventListener('forks', function (e) { try { setForks(JSON.parse(e.data)); } catch {} });
        } }, '重连')
      )
    ),
    err ? h('div', { style: { color: '#e5484d', fontSize: 12, marginBottom: 8 } }, err) : null,

    // Fork 分支关系
    forks.length ? h('div', { className: 'card', style: { marginBottom: 12, padding: '10px 14px' } },
      h('div', { style: { fontSize: 12, fontWeight: 600, opacity: .7, marginBottom: 6 } }, '🌿 分支关系（' + forks.length + ' 个相关分支）'),
      forks.map(function (f, fi) {
        var isCurrent = f.id === sessionId;
        var isChild = f.parentId === sessionId;
        return h('div', {
          key: fi,
          style: {
            fontSize: 12, padding: '6px 8px', borderRadius: 6, marginBottom: 4,
            border: '1px solid ' + (isCurrent ? '#0f62fe' : 'rgba(128,128,128,.2)'),
            background: isCurrent ? 'rgba(15,98,254,.08)' : (isChild ? 'rgba(34,160,107,.06)' : 'transparent'),
          },
        },
          h('div', { className: 'row', style: { justifyContent: 'space-between' } },
            h('div', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              isCurrent ? h('span', { style: { color: '#0f62fe', fontWeight: 700, marginRight: 4 } }, '● 当前') : null,
              isChild ? h('span', { style: { color: '#22a06b', fontWeight: 600, marginRight: 4 } }, '↳ 子分支') : null,
              (!isCurrent && !isChild) ? h('span', { style: { opacity: .55, marginRight: 4 } }, '◇ 同源分支') : null,
              h('span', { style: { fontWeight: 600 } }, clipText(f.id, 16)),
              h('span', { style: { fontSize: 10, opacity: .5, marginLeft: 6 } }, f.cwd || '')
            ),
            h('button', { className: 'refresh', style: { fontSize: 10, padding: '2px 6px', flexShrink: 0 }, title: '复制会话 ID', onClick: function () { try { navigator.clipboard.writeText(f.id); } catch {} } }, '复制ID')
          )
        );
      }),
      h('div', { style: { fontSize: 10.5, opacity: .55, marginTop: 4 } }, '提示：在侧栏会话列表 fork 当前会话即可创建新分析分支，分支会自动出现在这里。')
    ) : null,

    // 统计
    h('div', { className: 'card', style: { marginBottom: 12, padding: '10px 14px' } },
      h('div', { className: 'interact-stats' },
        h('span', { className: 'interact-stat' }, h('b', null, turns.length), '个对话轮次'),
        h('span', { className: 'interact-stat' }, h('b', null, toolTotal), '次工具调用'),
        failCount ? h('span', { className: 'interact-stat', style: { color: '#e5484d' } }, h('b', null, failCount), '次失败') : null,
        connected ? h('span', { className: 'interact-stat', style: { color: '#22a06b' } }, '实时连接中') : null
      )
    ),

    // 对话卡片（倒序：最新在上）
    turns.length === 0
      ? h('div', { className: 'empty' }, connected ? '等待对话事件…' : '正在连接实时推送…')
      : h('div', null,
          turns.slice().reverse().map(function (turn, ti) {
            var idx = turns.length - 1 - ti;
            var open = !!expand[idx];
            var hasTools = turn.toolCalls.length > 0;
            var turnFails = 0;
            for (var q = 0; q < turn.toolCalls.length; q++) if (turn.toolCalls[q].isError) turnFails++;
            return h('div', { key: turn.seq, className: 'card', style: { borderLeft: '3px solid ' + (turnFails ? '#e5484d' : (hasTools ? '#0f62fe' : '#22a06b')), marginBottom: 10 } },
              h('div', { style: { fontWeight: 600, fontSize: 13, marginBottom: 4, cursor: 'pointer' }, onClick: function () { toggleTurn(idx); } },
                h('span', { className: 'chev' + (open ? ' open' : ''), style: { marginRight: 6 } }, '▸'),
                h('span', { style: { opacity: .7 } }, '🧑 '),
                clipText(turn.userText, 120) || '（用户消息）'
              ),
              h('div', { style: { fontSize: 11, opacity: .6, marginLeft: 20 } },
                hasTools ? ('🔧 ' + turn.toolCalls.length + ' 次工具调用' + (turnFails ? '（' + turnFails + ' 失败）' : '')) : null,
                hasTools && turn.assistantTexts.length ? ' · ' : null,
                turn.assistantTexts.length ? ('🤖 ' + turn.assistantTexts.length + ' 段回复') : null,
                turn.contextCount ? (' · 📎 ' + turn.contextCount + ' 条注入上下文') : null
              ),
              open && hasTools ? turn.toolCalls.map(function (tc, tci) {
                return h('div', { key: tci, className: 'run', style: { borderColor: tc.isError ? '#e5484d' : '#0f62fe', padding: '6px 10px', margin: '4px 0 4px 20px' } },
                  h('div', { style: { fontSize: 11.5, fontWeight: 600 } },
                    (tc.isError ? '❌ ' : (tc.pending ? '⏳ ' : '✅ ')) + shortTool(tc.name)
                  ),
                  tc.args ? h('div', { style: { fontSize: 10.5, opacity: .65, marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all' } }, clipText(tc.args, 160)) : null,
                  tc.result ? h('div', { style: { fontSize: 10.5, opacity: .75, marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 96, overflow: 'auto', background: 'rgba(128,128,128,.05)', borderRadius: 4, padding: '4px 6px' } }, clipText(tc.result, 400)) : null
                );
              }) : null,
              open ? turn.assistantTexts.map(function (am, ami) {
                return h('div', { key: ami, style: { marginTop: 6, marginLeft: 20, padding: '8px 10px', background: 'rgba(128,128,128,.04)', borderRadius: 8, fontSize: 12.5 } },
                  h('span', { style: { opacity: .6, fontWeight: 600 } }, '🤖 '),
                  h('span', null, clipText(am.text, 250)),
                  am.interrupted ? h('span', { style: { color: '#f5a524', marginLeft: 6, fontSize: 10.5 } }, '（被中断）') : null
                );
              }) : null,
              h('div', { style: { fontSize: 10, opacity: .45, marginTop: 6 } }, fmtTime(turn.at))
            );
          })
        ),

    // 分析角度建议
    turns.length > 3 ? h('div', { className: 'card', style: { marginTop: 14, padding: '14px 16px', background: 'rgba(15,98,254,.06)', borderColor: 'rgba(15,98,254,.25)' } },
      h('div', { style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, '💡 从会话地图推动新的分析角度'),
      h('div', { style: { fontSize: 12, opacity: .8, lineHeight: 1.7 } },
        h('ul', { style: { margin: '6px 0', paddingLeft: 18 } },
          failCount ? h('li', null, '有 ' + failCount + ' 次失败的工具调用——展开红色卡片定位失败参数，在对话中要求 agent 换一种方法重试') : null,
          forks.length ? h('li', null, '已有 ' + forks.length + ' 个相关分支——对比不同分支的分析路径，把有效的策略合并回主线') : h('li', null, '在侧栏 fork 本会话可以从当前状态分出一条新分析路径（如换一种统计方法/参数），互不干扰'),
          h('li', null, '回顾工具调用链路——每轮卡片展开后能看到参数与结果预览，可据此让 agent 调整下一步方案'),
          h('li', null, '长会话可让 agent 用 dcs_delivery_update 把已确认的发现固化到「结果交付」，避免结论散落在对话里')
        )
      )
    ) : null
  );
}

// ================= 设置页 + 启动器 =================

function DcsCloudSettingsPage() {
  var patState = React.useState(""); var pat = patState[0]; var setPat = patState[1];
  var cliState = React.useState(""); var cliPath = cliState[0]; var setCliPath = cliState[1];
  var autoState = React.useState("auto"); var autoInstall = autoState[0]; var setAutoInstall = autoState[1];
  var genosState = React.useState(""); var genosKey = genosState[0]; var setGenosKey = genosState[1];
  var statusState = React.useState("加载中…"); var status = statusState[0]; var setStatus = statusState[1];
  var busyState = React.useState(false); var busy = busyState[0]; var setBusy = busyState[1];

  React.useEffect(function () {
    api("/config").then(function (c) {
      if (!c || !c.ok) { setStatus("读取配置失败: " + ((c && c.error) || "")); return; }
      if (c.cliPath) setCliPath(c.cliPath === "dcs" ? "" : c.cliPath);
      if (c.autoInstall) setAutoInstall(c.autoInstall);
      if (c.genosKeySet) setGenosKey("••••••••"); // 不显示完整 key，仅提示已配置
      var s = c.status || {};
      setStatus(c.patSet
        ? ("已配置 PAT（…" + c.patHint.slice(-4) + "）" + (s.loggedIn ? "｜已登录 " + (s.username || "") + "｜" + (s.region || "") + "｜项目 " + (s.project || "") : "｜未登录"))
        : "尚未配置 PAT。填入 DCS Cloud 个人访问令牌（dcs_pat_...）后点「保存并登录」。");
    }).catch(function (e) { setStatus("读取配置失败: " + String(e)); });
  }, []);

  function save() {
    setBusy(true);
    var payload = { pat: pat, cliPath: cliPath, autoInstall: autoInstall };
    // Genos key：只有用户主动输入时才发送（占位符 "••••••••" 不发送）
    if (genosKey && genosKey !== "••••••••") payload.genosKey = genosKey;
    apiPost("/config", payload).then(function (r) {
      if (r && r.ok) {
        if (r.genosKeySet) setGenosKey("••••••••");
        var s = r.status || {};
        setStatus((s.loggedIn ? "✅ 已登录 " + (s.username || "") + "｜" + (s.region || "") + "｜项目 " + (s.project || "") : "⚠️ PAT 已保存，但登录未成功（请检查 PAT 是否有效）"));
      } else {
        setStatus("❌ 保存失败: " + ((r && r.error) || ""));
      }
    }).catch(function (e) { setStatus("❌ 保存失败: " + String(e)); }).finally(function () { setBusy(false); });
  }

  function test() {
    setBusy(true);
    apiPost("/test").then(function (r) {
      var s = (r && r.status) || {};
      setStatus(s.loggedIn ? ("✅ 连接正常：" + (s.username || "") + "｜" + (s.region || "") + "｜项目 " + (s.project || "")) : "❌ 未登录 / 连接失败");
    }).catch(function (e) { setStatus("❌ 测试失败: " + String(e)); }).finally(function () { setBusy(false); });
  }

  return h("div", { className: "dcs2" },
    h("div", { style: { fontSize: 12, opacity: .75, lineHeight: 1.6, borderLeft: "3px solid rgba(128,128,128,.4)", paddingLeft: 8, marginBottom: 10 } },
      "配置 DCS Cloud 访问令牌（PAT），用于登录 dcs CLI 与检索公共库。获取方式：登录 DCS Cloud →「个人中心 → API Key / PAT 管理」创建。Genpilot 对话 LLM 系统自动鉴权；Genos 预测模型（VCF→RNA 信号）需填写下方 API key。"
    ),
    h("label", { style: { display: "block", fontSize: 12, opacity: .78, margin: "10px 0 2px" } }, "个人访问令牌 (PAT)"),
    h("input", { type: "password", value: pat, placeholder: "dcs_pat_...（留空保存 = 保留已保存的 PAT）", onChange: function (e) { setPat(e.target.value); }, style: { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(128,128,128,.45)", background: "transparent", color: "inherit", boxSizing: "border-box" } }),
    h("label", { style: { display: "block", fontSize: 12, opacity: .78, margin: "10px 0 2px" } }, "Genos API key（Genos‑VEP / Genos‑Mutation 预测模型）"),
    h("input", { type: "password", value: genosKey, placeholder: "sk-...（从 DCS Cloud「个人资料→API_key 管理」申请，仅限 Genos 预测）", onChange: function (e) { setGenosKey(e.target.value); }, style: { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(128,128,128,.45)", background: "transparent", color: "inherit", boxSizing: "border-box" } }),
    h("div", { style: { fontSize: 11, opacity: .55, margin: "2px 0 4px" } },
      genosKey === "••••••••" ? "✅ 已配置（重新输入可覆盖）" : "Genos 是基因组预测模型（1.2B，VCF→RNA 表达信号），非对话 LLM。仅用于 Genos‑VEP 与 Genos‑Mutation 技能。"
    ),
    h("label", { style: { display: "block", fontSize: 12, opacity: .78, margin: "10px 0 2px" } }, "dcs CLI 路径（可选）"),
    h("input", { type: "text", value: cliPath, placeholder: "留空 = 自动在 PATH 中查找 / 自动下载", onChange: function (e) { setCliPath(e.target.value); }, style: { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(128,128,128,.45)", background: "transparent", color: "inherit", boxSizing: "border-box" } }),
    h("label", { style: { display: "block", fontSize: 12, opacity: .78, margin: "10px 0 2px" } }, "二进制自动安装"),
    h("select", { value: autoInstall, onChange: function (e) { setAutoInstall(e.target.value); }, style: { padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(128,128,128,.45)", background: "transparent", color: "inherit" } },
      h("option", { value: "auto" }, "auto — 找不到时自动下载（含 SHA256 校验）"),
      h("option", { value: "never" }, "never — 只用已有二进制")
    ),
    h("div", { className: "row", style: { margin: "12px 0 4px" } },
      h("button", { className: "btn primary", disabled: busy, onClick: save }, busy ? "处理中…" : "保存并登录"),
      h("button", { className: "btn", disabled: busy, onClick: test }, "测试连接")
    ),
    h("div", { style: { fontSize: 12, opacity: .85, marginTop: 10, whiteSpace: "pre-wrap" } }, status)
  );
}

// ================= 应用入口 =================

// 顶层防御：把视图组件包在最外层错误边界里——即使视图自身渲染/挂载抛错，
// 也只显示错误卡，绝不会让整个对话页空白（ErrorBoundary 只兜子组件，包外面才能兜视图自身）。
function guarded(view) {
  if (!(React && typeof React.Component === "function")) return view;
  function Guarded(props) {
    return h(ErrorBoundary, { hint: "该视图渲染异常，可刷新页面重试；若持续出现请反馈上面的错误信息。" }, h(view, props));
  }
  return Guarded;
}

function apply(ctx) {
  injectCss();
  var harness = isHarnessMode();

  // 两个核心窗口（项目管理 / 结果交付）+ 会话地图（Synapse）：
  // 默认 dsh 自动注册（无需独立 profile / 启动器），独立 profile 也保留。
  ctx.slots.inject("conversation.view", function () {
    return ctx.slots.register({ name: "conversation.view", id: "dcs-project", order: 50, label: "项目管理" }, guarded(ProjectView));
  });
  ctx.slots.inject("conversation.view", function () {
    return ctx.slots.register({ name: "conversation.view", id: "dcs-synapse", order: 55, label: "会话地图" }, guarded(SynapseView));
  });
  ctx.slots.inject("conversation.view", function () {
    return ctx.slots.register({ name: "conversation.view", id: "dcs-delivery", order: 60, label: "结果交付" }, guarded(DeliveryView));
  });

  // 品牌接管仅在独立 DCS Harness profile（默认 dsh 保留官方品牌）
  if (harness) {
    ctx.slots.inject("sidebar.brand.mark", function () {
      return ctx.slots.register({ name: "sidebar.brand.mark", id: "dcs-harness-mark", order: 0 }, HarnessBrandMark);
    });
    ctx.slots.inject("sidebar.brand.name", function () {
      return ctx.slots.register({ name: "sidebar.brand.name", id: "dcs-harness-name", order: 0 }, HarnessBrandName);
    });
  }

  // 设置页（两个模式都有）
  ctx.slots.inject("settings.section", function () {
    return ctx.slots.register({ name: "settings.section", id: "dcs-cloud", order: 31, label: "DCS Cloud" }, DcsCloudSettingsPage);
  });
}

module.exports = {
  apply: apply,
  inject: ["slots"]
};
return module.exports; } });
