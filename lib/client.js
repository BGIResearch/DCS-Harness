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
    ".dcs2 .paper-head{border:1px solid rgba(128,128,128,.25);border-radius:12px;padding:22px 26px;margin-bottom:14px}" +
    ".dcs2 .paper-title{font-size:22px;font-weight:700;line-height:1.4;margin:0 0 8px}" +
    ".dcs2 .paper-sub{font-size:13px;opacity:.75}" +
    ".dcs2 .paper-meta{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:12px;opacity:.65}" +
    ".dcs2 .paper-rev{background:#0f62fe;color:#fff;border-radius:999px;padding:2px 10px;font-size:11px}" +
    ".dcs2 .psec{border:1px solid rgba(128,128,128,.25);border-radius:12px;padding:18px 22px;margin-bottom:12px}" +
    ".dcs2 .psec h4{font-size:15px;margin:0 0 10px;display:flex;align-items:center;gap:8px}" +
    ".dcs2 .psec .ic{width:24px;height:24px;border-radius:7px;display:inline-grid;place-items:center;font-size:13px;background:rgba(15,98,254,.12);flex:none}" +
    ".dcs2 .psec .body{font-size:13.5px}" +
    ".dcs2 .psec .body p{margin:8px 0}.dcs2 .psec .body ul,.dcs2 .psec .body ol{margin:8px 0;padding-left:22px}" +
    ".dcs2 .psec .body code{background:rgba(128,128,128,.15);border-radius:4px;padding:1px 6px;font-family:monospace;font-size:.92em}" +
    ".dcs2 .psec .body pre{background:#0f1220;color:#e6e9f2;border-radius:8px;padding:12px 14px;overflow:auto;font-size:12.5px}" +
    ".dcs2 .psec .body pre code{background:none;color:inherit;padding:0}" +
    ".dcs2 .psec .body table{border-collapse:collapse;width:100%;margin:8px 0;font-size:12.5px}" +
    ".dcs2 .psec .body th,.dcs2 .psec .body td{border:1px solid rgba(128,128,128,.3);padding:5px 9px;text-align:left}" +
    ".dcs2 .psec .body th{background:rgba(128,128,128,.1)}" +
    ".dcs2 .psec .body h5{font-size:13.5px;margin:12px 0 4px}" +
    ".dcs2 .psec .body strong{font-weight:600}" +
    ".dcs2 .chart{margin:12px 0;border:1px solid rgba(128,128,128,.2);border-radius:10px;padding:14px}" +
    ".dcs2 .chart-title{font-size:13px;font-weight:600;margin-bottom:8px}" +
    ".dcs2 .chart-caption{font-size:11.5px;opacity:.6;margin-top:6px}" +
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
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
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

function ProjectView(props) {
  var sessionId = props && props.sessionId ? props.sessionId : "";
  var projectsState = React.useState([]); var projects = projectsState[0]; var setProjects = projectsState[1];
  var modelsState = React.useState([{ id: "auto", label: "自动选择" }]); var models = modelsState[0]; var setModels = modelsState[1];
  var regionsState = React.useState({ list: [], current: "" }); var regions = regionsState[0]; var setRegions = regionsState[1];
  var costsState = React.useState({}); var costs = costsState[0]; var setCosts = costsState[1];
  var tokensState = React.useState(null); var tokens = tokensState[0]; var setTokens = tokensState[1];
  var billingState = React.useState(null); var billing = billingState[0]; var setBilling = billingState[1];
  var overviewState = React.useState(null); var overview = overviewState[0]; var setOverview = overviewState[1];
  var errState = React.useState(""); var err = errState[0]; var setErr = errState[1];
  var selPair = useSel(sessionId); var sel = selPair[0]; var setSelV = selPair[1];
  var openModsState = React.useState({}); var openMods = openModsState[0]; var setOpenMods = openModsState[1];

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

  // 项目总览聚合：里程碑 + 分片任务进度
  React.useEffect(function () {
    if (!sel) { setOverview(null); return; }
    var live = true;
    function loadOverview() {
      api("/v2/project-overview?projectId=" + encodeURIComponent(sel) + "&sessionId=" + encodeURIComponent(sessionId)).then(function (d) {
        if (live && d && d.ok) setOverview(d);
      }).catch(function () {});
    }
    loadOverview();
    var timer = setInterval(loadOverview, 12000);
    return function () { live = false; clearInterval(timer); };
  }, [sel, sessionId]);

  // 成本单独轮询（host 侧有 60s 缓存，不会打爆 DCS API）
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
  function toggleMod(id) {
    setOpenMods(function (cur) { var n = {}; for (var k in cur) n[k] = cur[k]; n[id] = !cur[id]; return n; });
  }

  var currentRegion = (project && project.region) || regions.current || "";
  var doneCount = project ? (function () { var n = 0; for (var i = 0; i < project.modules.length; i++) if (project.modules[i].status === "done") n++; return n; })() : 0;
  var runCount = project ? (function () { var n = 0; for (var i = 0; i < project.modules.length; i++) n += project.modules[i].runs.length; return n; })() : 0;

  return h("div", { className: "dcs2", style: { padding: "16px 20px", maxWidth: 1040, margin: "0 auto" } },
    h("div", { className: "row", style: { justifyContent: "space-between" } },
      h("h2", null, "项目管理"),
      h("button", { className: "refresh", onClick: function () {
        api("/v2/projects?sessionId=" + encodeURIComponent(sessionId)).then(function (d) { if (d && d.ok) setProjects(d.projects || []); });
      } }, "刷新")
    ),
    err ? h("div", { style: { color: "#e5484d", fontSize: 12 } }, err) : null,

    projects.length === 0
      ? h("div", { className: "empty" }, "本会话暂无项目。agent 用 dcs_project_update 建立项目并分解模块后，这里展示项目概览、模块状态、资源消耗、费用与历史运行版本。")
      : h("div", null,
          h(ProjectChips, { projects: projects, sel: project ? project.id : "", onSelect: function (id) { setSelV(id); setSel(sessionId, id); } }),
          // 项目概览（原「任务交互」内容，合并进项目管理）
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
            // 费用与资源总览
            billing ? h("div", { className: "interact-stats", style: { marginTop: 8, borderTop: "1px dashed rgba(128,128,128,.25)", paddingTop: 8 } },
              billing.balance != null ? h("span", { className: "interact-stat" }, "项目余额 ", h("b", null, "¥" + billing.balance), "（" + (billing.projectName || billing.projectCode || "当前项目") + "）") : null
            ) : null
          ),
          // 节点联动提示
          regions.hint ? h("div", { className: "card", style: { marginBottom: 10, padding: "10px 12px", fontSize: 12, opacity: .9 } },
            h("span", { style: { fontWeight: 600, marginRight: 4 } }, "节点提示：" ), regions.hint
          ) : null,
          // 分析计划 + 互动状态
          (project.plan && project.plan.content) ? h("div", { className: "card", style: { marginBottom: 10 } },
            h("div", { className: "row", style: { justifyContent: "space-between" } },
              h("h3", { style: { margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", opacity: .65 } }, "分析计划"),
              h("span", { className: "badge " + ((project.plan.planStatus || "drafting") === "approved" ? "done" : (project.plan.planStatus === "awaiting_review" ? "running" : "pending")) },
                ({ drafting: "草拟中", awaiting_review: "待确认", approved: "已批准" })[project.plan.planStatus] || project.plan.planStatus)
            ),
            h("div", { className: "body", style: { maxHeight: 220, overflow: "auto", marginTop: 8 }, dangerouslySetInnerHTML: { __html: mdToHtml(project.plan.content) } })
          ) : null,
          // 已登记的自有数据（在对话中由 agent 通过 dcs_project_update 记录，只读展示）
          (project.customData && project.customData.items && project.customData.items.length) ? h("div", { className: "card", style: { marginBottom: 10 } },
            h("h3", { style: { margin: "0 0 6px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", opacity: .65 } }, "自有数据来源"),
            project.customData.items.map(function (it, i) {
              return h("div", { key: i, className: "modrow" },
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { className: "modname", style: { fontFamily: "monospace" } }, it.path),
                  it.desc ? h("div", { className: "moddesc" }, it.desc) : null
                )
              );
            }),
            project.customData.note ? h("div", { className: "muted", style: { marginTop: 6 } }, project.customData.note) : null
          ) : null,
          // 里程碑质检
          (overview && overview.milestones && overview.milestones.length) ? h("div", { className: "card", style: { marginBottom: 10 } },
            h("h3", { style: { margin: "0 0 6px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", opacity: .65 } }, "里程碑质检"),
            overview.milestones.map(function (ms, i) {
              return h("div", { key: i, className: "modrow" },
                h("span", { className: "badge " + ms.status }, STATUS_LABEL[ms.status] || ms.status),
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { className: "modname" }, ms.name),
                  ms.check ? h("div", { className: "moddesc" }, ms.check) : null
                )
              );
            })
          ) : null,
          // 分片任务进度聚合
          (overview && overview.sharded && Object.keys(overview.sharded).length) ? h("div", { className: "card", style: { marginBottom: 10 } },
            h("h3", { style: { margin: "0 0 6px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", opacity: .65 } }, "分片任务进度"),
            Object.keys(overview.sharded).map(function (rid) {
              var sh = overview.sharded[rid];
              var pct = sh.total ? Math.round(sh.done / sh.total * 100) : 0;
              return h("div", { key: rid, style: { marginBottom: 8 } },
                h("div", { className: "modrow" },
                  h("span", { className: "badge " + sh.status }, STATUS_LABEL[sh.status] || sh.status),
                  h("div", { style: { flex: 1, minWidth: 0 } },
                    h("div", { className: "modname" }, sh.name, " · ", h("span", { className: "muted" }, "分片 " + sh.done + "/" + sh.total)),
                    h("div", { className: "bar" }, h("div", { className: "fill " + sh.status, style: { width: pct + "%" } }))
                  ),
                  h("span", { className: "muted" }, pct + "%")
                )
              );
            })
          ) : null,
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
          project.modules.length === 0
            ? h("div", { className: "empty" }, "（尚未分解模块）")
            : project.modules.map(function (m) {
                var open = !!openMods[m.id];
                var runs = m.runs.slice().reverse();
                return h("div", { key: m.id, className: "proj-mod" },
                  h("div", { className: "proj-mod-head", onClick: function () { toggleMod(m.id); } },
                    h("span", { className: "chev" + (open ? " open" : "") }, "▸"),
                    h("span", { className: "badge " + m.status }, STATUS_LABEL[m.status] || m.status),
                    h("span", { className: "proj-mod-name" }, m.name),
                    h("span", { className: "muted" }, m.runs.length + " 次运行 · 最新 v" + (m.runs.length ? m.runs[m.runs.length - 1].version : "—"))
                  ),
                  open ? h("div", { className: "proj-mod-body" },
                    m.desc ? h("div", { className: "muted", style: { margin: "10px 0 4px" } }, m.desc) : null,
                    runs.map(function (r) { return h(RunItem, { key: r.id, run: r, costs: costs }); })
                  ) : null
                );
              })
        )
  );
}

// ================= 结果交付窗口 =================

var SECTION_META = [
  { key: "question", label: "科学问题", icon: "❓" },
  { key: "hypothesis", label: "科学假说", icon: "🧪" },
  { key: "decomposition", label: "科学问题分解", icon: "🧩" },
  { key: "data", label: "原始数据", icon: "🗂️" },
  { key: "methods", label: "分析方法", icon: "🔬" },
  { key: "findings", label: "科学发现与主要结论", icon: "💡" },
  { key: "novelty", label: "创新性与已有研究的关系", icon: "🌟" },
  { key: "nextSteps", label: "下一步计划与建议", icon: "➡️" },
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
  else if (chart.type === "html") body = h("div", { className: "media-html", dangerouslySetInnerHTML: { __html: String(chart.data || "") } });
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
    body = h("div", { style: { position: "relative", width: "100%", paddingTop: "62.5%", border: "1px solid rgba(128,128,128,.25)", borderRadius: 8, overflow: "hidden" } },
      h("iframe", { src: chartSrc(chart.data), style: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }, allowFullScreen: true, loading: "lazy" })
    );
  } else if (chart.type === "link") {
    body = h("div", null, h("a", { href: String(chart.data || ""), target: "_blank", rel: "noopener noreferrer", style: { color: "#0f62fe" } }, String(chart.title || chart.caption || "打开链接")));
  } else {
    body = h("div", { className: "muted" }, "（不支持的图表类型：" + esc(chart.type) + "）");
  }
  return h("div", { className: "chart" },
    chart.title ? h("div", { className: "chart-title" }, chart.title) : null,
    body,
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

  return h("div", { className: "dcs2 paper", style: { padding: "16px 20px" } },
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
                SECTION_META.map(function (sec) {
                  var content = delivery.sections && delivery.sections[sec.key];
                  if (!content || !String(content).trim()) return null;
                  return h("div", { key: sec.key, className: "psec" },
                    h("h4", null, h("span", { className: "ic" }, sec.icon), sec.label),
                    renderBodyWithEmbeds(content, allCharts, { images: images, sectionKey: sec.key })
                  );
                }),
                (function () {
                  // 末尾「数据图表」区：只放未被正文引用的图表 + 自动收集的分析图
                  var usedIds = collectInlineChartIds(delivery, allCharts);
                  var leftover = allCharts.filter(function (c) { return !c.id || usedIds.indexOf(String(c.id)) === -1; });
                  if (!leftover.length && !hasImages) return null;
                  return h("div", { className: "psec" }, h("h4", null, h("span", { className: "ic" }, "📊"), "数据图表"),
                    leftover.map(function (c, idx) { return h(ChartView, { key: 'c' + idx, data: c }); }),
                    images.map(function (im, idx) {
                      return h(ChartView, { key: 'i' + idx, data: { type: "image", title: im.name, caption: im.name, data: im.base64 } });
                    })
                  );
                })()
              )
        )
  );
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

function apply(ctx) {
  injectCss();
  var harness = isHarnessMode();

  // 两个核心窗口（项目管理 / 结果交付）：
  // 默认 dsh 自动注册（无需独立 profile / 启动器），独立 profile 也保留。
  // 注：v2.2 起「任务交互」已并入「项目管理」（概览 + 模块 + 费用 + 节点/模型），
  // 并移除旧版「DCS 任务」tab。
  ctx.slots.inject("conversation.view", function () {
    return ctx.slots.register({ name: "conversation.view", id: "dcs-project", order: 50, label: "项目管理" }, ProjectView);
  });
  ctx.slots.inject("conversation.view", function () {
    return ctx.slots.register({ name: "conversation.view", id: "dcs-delivery", order: 60, label: "结果交付" }, DeliveryView);
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
