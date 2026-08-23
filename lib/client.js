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

// ================= 工作流画布（SVG DAG） =================

var WF_COLORS = { pending: "#8a8f98", running: "#0f62fe", done: "#22a06b", failed: "#e5484d", blocked: "#f5a524" };

function layoutWorkflow(modules, plan, svgW) {
  // 拓扑排序：按 plan.stepIds 顺序，否则按创建顺序
  var order = [];
  var byId = {}; for (var i = 0; i < modules.length; i++) byId[modules[i].id] = modules[i];
  if (plan && plan.stepIds && plan.stepIds.length) {
    for (var j = 0; j < plan.stepIds.length; j++) {
      var m = byId[plan.stepIds[j]];
      if (m) { order.push(m); delete byId[plan.stepIds[j]]; }
    }
    for (var k in byId) order.push(byId[k]);
  } else {
    order = modules.slice();
  }

  // 自适应网格：节点宽 200px，间距 24px，每格 224px
  var cellW = 200, cellH = 88, padX = 24, padY = 24;
  var gutter = 16;
  var usableW = Math.max(400, svgW - 2 * gutter);
  var cols = Math.max(2, Math.floor((usableW + padX) / (cellW + padX)));
  var rows = Math.ceil(order.length / cols);

  var nodes = [];
  for (var n = 0; n < order.length; n++) {
    var col = n % cols, row = Math.floor(n / cols);
    // 每行居中
    var rowCount = (row < rows - 1 || order.length % cols === 0) ? cols : (order.length % cols);
    var rowOffset = (cols - rowCount) * (cellW + padX) / 2;
    nodes.push({
      id: order[n].id,
      name: order[n].name,
      status: order[n].status,
      desc: order[n].desc || "",
      runs: order[n].runs.length,
      x: gutter + padX + rowOffset + col * (cellW + padX),
      y: padY + row * (cellH + padY),
      w: cellW,
      h: cellH,
    });
  }

  // 边：优先用 plan.stepIds 顺序（相邻节点连线），再补充 dependsOn 显式依赖
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
  // 顺序边（步骤链路）
  for (var e = 0; e < order.length - 1; e++) addEdge(order[e].id, order[e + 1].id);
  // 显式依赖边（从 tasks 或 plan 的 dependsOn）
  for (var d = 0; d < order.length; d++) {
    var deps = order[d].dependsOn || [];
    if (!deps.length && plan && plan.stepDeps && plan.stepDeps[order[d].id]) deps = plan.stepDeps[order[d].id];
    for (var dp = 0; dp < deps.length; dp++) addEdge(deps[dp], order[d].id);
  }

  return { nodes: nodes, edges: edges };
}

function WorkflowCanvas(props) {
  var modules = props.modules || [];
  var plan = props.plan;
  var svgW = 920;
  var layout = layoutWorkflow(modules, plan, svgW);
  var nodes = layout.nodes, edges = layout.edges;
  var selNode = props.selNode;
  var onSelect = props.onSelect;
  var viewState = React.useState({ x: 0, y: 0, scale: 1 }); var view = viewState[0]; var setView = viewState[1];
  var dragState = React.useState(null); var drag = dragState[0]; var setDrag = dragState[1];
  var svgRef = React.useRef(null);

  // 滚轮缩放：用原生事件监听器（passive:false），否则 preventDefault 被忽略。
  // 依赖 nodes.length：首渲染无模块时 SVG 未挂载，模块出现后需重新挂监听。
  var hasNodes = nodes.length > 0;
  React.useEffect(function () {
    var el = svgRef.current;
    if (!el) return;
    function onWheel(e) {
      e.preventDefault();
      var delta = e.deltaY > 0 ? -0.1 : 0.1;
      setView(function (v) { return { x: v.x, y: v.y, scale: Math.max(0.3, Math.min(3, v.scale + delta)) }; });
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return function () { el.removeEventListener('wheel', onWheel); };
  }, [hasNodes]);

  if (!hasNodes) return h("div", { className: "empty" }, "（尚未分解模块，等待 agent 用 dcs_module_update 创建）");

  // SVG 高度自适应：根据节点布局计算内容高度，最小 280px，最大 600px
  var maxX = 0, maxY = 0;
  for (var i = 0; i < nodes.length; i++) { if (nodes[i].x + nodes[i].w > maxX) maxX = nodes[i].x + nodes[i].w; if (nodes[i].y + nodes[i].h > maxY) maxY = nodes[i].y + nodes[i].h; }
  var contentW = maxX + 40, contentH = maxY + 40;
  var svgH = Math.max(280, Math.min(600, contentH + 20));

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
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px dashed rgba(128,128,128,.2)", fontSize: 12, opacity: .7 } },
      h("span", null, "工作流画布 · " + nodes.length + " 节点 · " + edges.length + " 连线 · 滚轮缩放 · 拖拽平移"),
      h("span", null,
        h("button", { className: "refresh", style: { marginRight: 4 }, onClick: function () { setView({ x: 0, y: 0, scale: 1 }); } }, "重置视图"),
        Math.round(view.scale * 100) + "%"
      )
    ),
    h("svg", {
      ref: svgRef,
      width: svgW, height: svgH,
      viewBox: String(-view.x / view.scale) + " " + String(-view.y / view.scale) + " " + String(svgW / view.scale) + " " + String(svgH / view.scale),
      style: { width: "100%", height: svgH, cursor: drag ? "grabbing" : "grab", userSelect: "none" },
      onMouseDown: onMouseDown, onMouseMove: onMouseMove, onMouseUp: onMouseUp, onMouseLeave: onMouseUp,
    },
      // 网格背景
      h("defs", null,
        h("pattern", { id: "wf-grid", width: 40, height: 40, patternUnits: "userSpaceOnUse" },
          h("path", { d: "M 40 0 L 0 0 0 40", fill: "none", stroke: "rgba(128,128,128,.08)", strokeWidth: 1 })
        ),
        // 箭头标记
        h("marker", { id: "wf-arrow", viewBox: "0 0 10 10", refX: 10, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" },
          h("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "rgba(128,128,128,.5)" })
        )
      ),
      h("rect", { x: 0, y: 0, width: contentW, height: contentH, fill: "url(#wf-grid)" }),
      // 边：同行用水平直线，跨行用正交路径（出→下→横→下→入）
      edges.map(function (edge, ei) {
        var from = nodeById(edge.from), to = nodeById(edge.to);
        if (!from || !to) return null;
        var x1 = from.x + from.w, y1 = from.y + from.h / 2;
        var x2 = to.x, y2 = to.y + to.h / 2;
        var fromRow = Math.round((from.y - 24) / (from.h + 24));
        var toRow = Math.round((to.y - 24) / (to.h + 24));
        var d;
        if (fromRow === toRow && x1 < x2) {
          // 同行水平
          var mx = (x1 + x2) / 2;
          d = "M" + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2;
        } else {
          // 跨行正交：出 → 右拐 → 下行 → 左拐 → 入
          var midX = Math.max(x1, x2) + 20;
          d = "M" + x1 + "," + y1 + " L" + midX + "," + y1 + " L" + midX + "," + y2 + " L" + x2 + "," + y2;
        }
        return h("path", { key: "e" + ei, d: d, fill: "none", stroke: "rgba(128,128,128,.4)", strokeWidth: 2, markerEnd: "url(#wf-arrow)" });
      }),
      // 节点
      nodes.map(function (node) {
        var isSel = selNode && selNode.id === node.id;
        var color = WF_COLORS[node.status] || WF_COLORS.pending;
        var rx = node.x, ry = node.y, rw = node.w, rh = node.h;
        return h("g", { key: node.id, style: { cursor: "pointer" }, onClick: function () { onSelect && onSelect(node); } },
          // 主体（半透明中性底 + 文字用 currentColor，深浅主题均可读）
          h("rect", { x: rx, y: ry, width: rw, height: rh, rx: 10, fill: isSel ? "rgba(15,98,254,.14)" : "rgba(128,128,128,.10)", stroke: isSel ? color : "rgba(128,128,128,.35)", strokeWidth: isSel ? 2.5 : 1.5 }),
          // 状态条
          h("rect", { x: rx, y: ry, width: rw, height: 4, rx: 2, fill: color }),
          // 状态圆点
          h("circle", { cx: rx + 16, cy: ry + 28, r: 5, fill: color }),
          // 名称
          h("text", { x: rx + 28, y: ry + 32, fontSize: 13, fontWeight: 600, fill: "currentColor", textAnchor: "start" }, node.name.length > 16 ? node.name.slice(0, 15) + "…" : node.name),
          // 运行次数
          h("text", { x: rx + 28, y: ry + 52, fontSize: 11, fill: "currentColor", opacity: .6, textAnchor: "start" }, node.runs + " 次运行 · " + (STATUS_LABEL[node.status] || node.status)),
          // 描述
          node.desc ? h("text", { x: rx + 14, y: ry + rh - 12, fontSize: 10, fill: "currentColor", opacity: .45, textAnchor: "start" }, node.desc.length > 30 ? node.desc.slice(0, 28) + "…" : node.desc) : null
        );
      })
    )
  );
}

// ================= 项目管理窗口（v2.6.3 工作流画布） =================

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
          // ===== 工作流画布 =====
          h("div", { style: { margin: "10px 0" } },
            h("h3", { style: { margin: "0 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", opacity: .65 } }, "工作流画布 · 点击节点查看详情"),
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

// ================= 会话地图（Synapse） =================

function SynapseView(props) {
  var sessionId = props && props.sessionId ? props.sessionId : "";
  var eventsState = React.useState([]); var events = eventsState[0]; var setEvents = eventsState[1];
  var titleState = React.useState(""); var title = titleState[0]; var setTitle = titleState[1];
  var forksState = React.useState([]); var forks = forksState[0]; var setForks = forksState[1];
  var errState = React.useState(""); var err = errState[0]; var setErr = errState[1];
  var expandState = React.useState({}); var expand = expandState[0]; var setExpand = expandState[1];
  var loadingState = React.useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];
  var nextSeqRef = React.useRef(0);

  React.useEffect(function () {
    var live = true;
    nextSeqRef.current = 0;
    setEvents([]);
    function load(full) {
      var from = full ? 0 : nextSeqRef.current;
      api("/v2/session-events?sessionId=" + encodeURIComponent(sessionId) + "&fromSeq=" + from).then(function (d) {
        if (!live) return;
        if (d && d.ok) {
          if (d.title) setTitle(d.title);
          if (typeof d.nextSeq === "number" && d.nextSeq > 0) nextSeqRef.current = d.nextSeq;
          var incoming = d.events || [];
          if (from === 0) setEvents(incoming);
          else if (incoming.length) setEvents(function (cur) {
            // 增量合并：tool 事件可能是对已存在 call 的补全（服务端已折叠，同 seq 不会重复；按 seq 去重）
            var seen = {}; for (var i = 0; i < cur.length; i++) seen[cur[i].seq] = i;
            var merged = cur.slice();
            for (var j = 0; j < incoming.length; j++) {
              var e = incoming[j];
              if (seen[e.seq] !== undefined) merged[seen[e.seq]] = e; else merged.push(e);
            }
            return merged;
          });
          setErr("");
        } else setErr((d && d.error) || "读取失败");
        setLoading(false);
      }).catch(function (e) { if (live) { setErr(String(e && e.message || e)); setLoading(false); } });
      api("/v2/session-forks?sessionId=" + encodeURIComponent(sessionId)).then(function (d) {
        if (live && d && d.ok) setForks(d.forks || []);
      }).catch(function () {});
    }
    load(true);
    var timer = setInterval(function () { load(false); }, 10000);
    return function () { live = false; clearInterval(timer); };
  }, [sessionId]);

  // 将事件分组为 turns：真人 user 消息开新轮次；plugin 注入的 user 消息计为上下文；
  // assistant/tool 归入当前轮次。服务端已把 tool call+result 按 callId 折叠为单条。
  var turns = [];
  var currentTurn = null;
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (ev.kind === "user" && (ev.source === "user" || ev.source === undefined)) {
      if (currentTurn) turns.push(currentTurn);
      currentTurn = { userText: ev.text || "", assistantTexts: [], toolCalls: [], contextCount: 0, at: ev.at, seq: ev.seq };
    } else if (ev.kind === "user") {
      if (currentTurn) currentTurn.contextCount++;
    } else if (ev.kind === "assistant" && currentTurn) {
      if (ev.text) currentTurn.assistantTexts.push({ text: ev.text, interrupted: !!ev.interrupted });
    } else if (ev.kind === "tool" && currentTurn) {
      currentTurn.toolCalls.push(ev);
    }
  }
  if (currentTurn) turns.push(currentTurn);
  var failCount = 0, toolTotal = 0;
  for (var fi2 = 0; fi2 < turns.length; fi2++) {
    toolTotal += turns[fi2].toolCalls.length;
    for (var tj = 0; tj < turns[fi2].toolCalls.length; tj++) if (turns[fi2].toolCalls[tj].isError) failCount++;
  }

  function toggleTurn(idx) {
    setExpand(function (cur) { var n = {}; for (var k in cur) n[k] = cur[k]; n[idx] = !cur[idx]; return n; });
  }
  function shortTool(name) {
    if (!name) return "工具";
    var m = name.match(/^dcs_(.+)/);
    return m ? m[1] : (name.length > 28 ? name.slice(0, 26) + "…" : name);
  }
  function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  return h("div", { className: "dcs2", style: { padding: "16px 20px", maxWidth: 900, margin: "0 auto" } },
    h("div", { className: "row", style: { justifyContent: "space-between" } },
      h("h2", null, "会话地图" + (title ? " · " + clip(title, 24) : "")),
      h("button", { className: "refresh", onClick: function () {
        nextSeqRef.current = 0; setLoading(true);
        api("/v2/session-events?sessionId=" + encodeURIComponent(sessionId) + "&fromSeq=0").then(function (d) {
          if (d && d.ok) { setEvents(d.events || []); if (typeof d.nextSeq === "number") nextSeqRef.current = d.nextSeq; if (d.title) setTitle(d.title); }
          setLoading(false);
        }).catch(function () { setLoading(false); });
        api("/v2/session-forks?sessionId=" + encodeURIComponent(sessionId)).then(function (d) { if (d && d.ok) setForks(d.forks || []); });
      } }, "刷新")
    ),
    err ? h("div", { style: { color: "#e5484d", fontSize: 12, marginBottom: 8 } }, err) : null,

    // Fork 分支树（当前会话 + 父会话 + 兄弟/子分支）
    forks.length ? h("div", { className: "card", style: { marginBottom: 12, padding: "10px 14px" } },
      h("div", { style: { fontSize: 12, fontWeight: 600, opacity: .7, marginBottom: 6 } }, "🌿 分支关系（" + forks.length + " 个相关分支）"),
      forks.map(function (f, fi) {
        var isCurrent = f.id === sessionId;
        var isChild = f.parentId === sessionId;
        return h("div", {
          key: fi,
          style: {
            fontSize: 12, padding: "6px 8px", borderRadius: 6, marginBottom: 4,
            border: "1px solid " + (isCurrent ? "#0f62fe" : "rgba(128,128,128,.2)"),
            background: isCurrent ? "rgba(15,98,254,.08)" : (isChild ? "rgba(34,160,107,.06)" : "transparent"),
          },
        },
          h("div", { className: "row", style: { justifyContent: "space-between" } },
            h("div", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
              isCurrent ? h("span", { style: { color: "#0f62fe", fontWeight: 700, marginRight: 4 } }, "● 当前") : null,
              isChild ? h("span", { style: { color: "#22a06b", fontWeight: 600, marginRight: 4 } }, "↳ 子分支") : null,
              (!isCurrent && !isChild) ? h("span", { style: { opacity: .55, marginRight: 4 } }, "◇ 同源分支") : null,
              h("span", { style: { fontWeight: 600 } }, f.title || (f.id.slice(0, 16) + "…")),
              h("span", { style: { fontSize: 10, opacity: .5, marginLeft: 6 } }, f.live ? "活跃" : "已归档")
            ),
            h("button", { className: "refresh", style: { fontSize: 10, padding: "2px 6px", flexShrink: 0 }, title: "复制会话 ID，可在会话列表中打开", onClick: function () { try { navigator.clipboard.writeText(f.id); } catch (e2) {} } }, "复制ID")
          ),
          f.cwd ? h("div", { style: { fontSize: 10, opacity: .5, marginTop: 2, fontFamily: "monospace" } }, f.cwd) : null
        );
      }),
      h("div", { style: { fontSize: 10.5, opacity: .55, marginTop: 4 } }, "提示：在侧栏会话列表 fork 当前会话即可创建新分析分支；分支会自动出现在这里。")
    ) : null,

    // 统计
    h("div", { className: "card", style: { marginBottom: 12, padding: "10px 14px" } },
      h("div", { className: "interact-stats" },
        h("span", { className: "interact-stat" }, h("b", null, turns.length), "个对话轮次"),
        h("span", { className: "interact-stat" }, h("b", null, toolTotal), "次工具调用"),
        failCount ? h("span", { className: "interact-stat", style: { color: "#e5484d" } }, h("b", null, failCount), "次失败") : null,
        loading ? h("span", { className: "interact-stat", style: { opacity: .5 } }, "加载中…") : null
      )
    ),

    // 对话卡片（倒序：最新在上）
    turns.length === 0
      ? h("div", { className: "empty" }, loading ? "正在加载会话事件…" : "本会话暂无已提交的对话记录（当前进行中的轮次结束后才会出现在这里）。")
      : h("div", null,
          turns.slice().reverse().map(function (turn, ti) {
            var idx = turns.length - 1 - ti;
            var open = !!expand[idx];
            var hasTools = turn.toolCalls.length > 0;
            var turnFails = 0;
            for (var q = 0; q < turn.toolCalls.length; q++) if (turn.toolCalls[q].isError) turnFails++;
            return h("div", { key: turn.seq, className: "card", style: { borderLeft: "3px solid " + (turnFails ? "#e5484d" : (hasTools ? "#0f62fe" : "#22a06b")), marginBottom: 10 } },
              // 用户消息（点击展开/收起整轮）
              h("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 4, cursor: "pointer" }, onClick: function () { toggleTurn(idx); } },
                h("span", { className: "chev" + (open ? " open" : ""), style: { marginRight: 6 } }, "▸"),
                h("span", { style: { opacity: .7 } }, "🧑 "),
                clip(turn.userText, 120) || "（用户消息）"
              ),
              // 折叠摘要行
              h("div", { style: { fontSize: 11, opacity: .6, marginLeft: 20 } },
                hasTools ? ("🔧 " + turn.toolCalls.length + " 次工具调用" + (turnFails ? "（" + turnFails + " 失败）" : "")) : null,
                hasTools && turn.assistantTexts.length ? " · " : null,
                turn.assistantTexts.length ? ("🤖 " + turn.assistantTexts.length + " 段回复") : null,
                turn.contextCount ? (" · 📎 " + turn.contextCount + " 条注入上下文") : null
              ),
              // 展开：工具调用（含结果预览）
              open && hasTools ? turn.toolCalls.map(function (tc, tci) {
                return h("div", { key: tci, className: "run", style: { borderColor: tc.isError ? "#e5484d" : "#0f62fe", padding: "6px 10px", margin: "4px 0 4px 20px" } },
                  h("div", { style: { fontSize: 11.5, fontWeight: 600 } },
                    (tc.isError ? "❌ " : (tc.pending ? "⏳ " : "✅ ")) + shortTool(tc.name)
                  ),
                  tc.args ? h("div", { style: { fontSize: 10.5, opacity: .65, marginTop: 2, fontFamily: "monospace", wordBreak: "break-all" } }, clip(tc.args, 160)) : null,
                  tc.result ? h("div", { style: { fontSize: 10.5, opacity: .75, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 96, overflow: "auto", background: "rgba(128,128,128,.05)", borderRadius: 4, padding: "4px 6px" } }, clip(tc.result, 400)) : null
                );
              }) : null,
              // 展开：助手回复
              open ? turn.assistantTexts.map(function (am, ami) {
                return h("div", { key: ami, style: { marginTop: 6, marginLeft: 20, padding: "8px 10px", background: "rgba(128,128,128,.04)", borderRadius: 8, fontSize: 12.5 } },
                  h("span", { style: { opacity: .6, fontWeight: 600 } }, "🤖 "),
                  h("span", null, clip(am.text, 250)),
                  am.interrupted ? h("span", { style: { color: "#f5a524", marginLeft: 6, fontSize: 10.5 } }, "（被中断）") : null
                );
              }) : null,
              h("div", { style: { fontSize: 10, opacity: .45, marginTop: 6 } }, fmtTime(turn.at))
            );
          })
        ),

    // 分析角度建议（基于会话结构的具体提示）
    turns.length > 3 ? h("div", { className: "card", style: { marginTop: 14, padding: "14px 16px", background: "rgba(15,98,254,.06)", borderColor: "rgba(15,98,254,.25)" } },
      h("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, "💡 从会话地图推动新的分析角度"),
      h("div", { style: { fontSize: 12, opacity: .8, lineHeight: 1.7 } },
        h("ul", { style: { margin: "6px 0", paddingLeft: 18 } },
          failCount ? h("li", null, "有 " + failCount + " 次失败的工具调用——展开红色卡片定位失败参数，在对话中要求 agent 换一种方法重试") : null,
          forks.length ? h("li", null, "已有 " + forks.length + " 个相关分支——对比不同分支的分析路径，把有效的策略合并回主线") : h("li", null, "在侧栏 fork 本会话可以从当前状态分出一条新分析路径（如换一种统计方法/参数），互不干扰"),
          h("li", null, "回顾工具调用链路——每轮卡片展开后能看到参数与结果预览，可据此让 agent 调整下一步方案"),
          h("li", null, "长会话可让 agent 用 dcs_delivery_update 把已确认的发现固化到「结果交付」，避免结论散落在对话里")
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

function apply(ctx) {
  injectCss();
  var harness = isHarnessMode();

  // 两个核心窗口（项目管理 / 结果交付）+ 会话地图（Synapse）：
  // 默认 dsh 自动注册（无需独立 profile / 启动器），独立 profile 也保留。
  ctx.slots.inject("conversation.view", function () {
    return ctx.slots.register({ name: "conversation.view", id: "dcs-project", order: 50, label: "项目管理" }, ProjectView);
  });
  ctx.slots.inject("conversation.view", function () {
    return ctx.slots.register({ name: "conversation.view", id: "dcs-synapse", order: 55, label: "会话地图" }, SynapseView);
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
