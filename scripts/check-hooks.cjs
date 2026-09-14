#!/usr/bin/env node
/**
 * 静态回归检查（防再犯两类已修复的 Bug）：
 *   Bug 1: React.useState 解构 setter 取错下标（setMsg = msgS[1]，应为 setMsg = msg[1]）
 *          → setter 为 undefined → "setBusy is not a function" → 整窗白屏
 *   Bug 2: dcs_delivery_update 对 image 图表原地赋值（c.data = ...）
 *          → 冻结对象抛 "Cannot assign to read only property 'data'" → 提交失败
 * 外加 node --check 语法校验。接入 npm run check / precommit 即可。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.env.CHECK_ROOT || path.join(__dirname, '..');
const errors = [];

function checkClient() {
  const file = path.join(root, 'lib', 'client.js');
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  // 先收集全部 useState 的接收变量名（如 projectsState），
  // 供下面的 setter 解构校验使用。必须在遍历前完成，避免顺序依赖。
  const stateVars = new Set();
  for (const ln of lines) {
    const s1 = ln.match(/var\s+([a-zA-Z_$][\w$]*)\s*=\s*React\.useState\s*\(/);
    if (s1) stateVars.add(s1[1]);
    // 也支持 `var [a, b] = React.useState(...)` 形式
    const s2 = ln.match(/var\s*\[\s*[\w$]+\s*,\s*([a-zA-Z_$][\w$]*)\s*\]\s*=\s*React\.useState\s*\(/);
    if (s2) stateVars.add(s2[1]);
  }

  lines.forEach((ln, i) => {
    // 模式：var setXxx = <stateVar>[n]，其中 n 必须是 1（useState 返回 [值, setter]）。
    //
    // ⚠ 历史缺陷：原正则要求状态变量名**以 S 结尾**（[a-zA-Z_$][\w$]*S），
    // 但本文件实际命名风格是 `xxxState`（37 处 useState 全部如此，无一以 S 结尾），
    // 因此该规则**从未匹配到任何一行** —— 名为防此 bug，实则完全失效。
    // 现改为：把 `React.useState(...)` 左侧的变量名收集为已知状态数组，
    // 再校验 `var setX = <该变量>[n]` 的 n 是否为 1。
    if (stateVars.size > 0) {
      const m = ln.match(/var\s+(set\w+)\s*=\s*([a-zA-Z_$][\w$]*)\s*\[\s*(\d+)\s*\]/);
      if (m && stateVars.has(m[2]) && m[3] !== '1') {
        errors.push(`lib/client.js:${i + 1}: useState setter 解构错误：${m[0].trim()} —— setter 应取 ${m[2]}[1]，实际取了 [${m[3]}]`);
      }
    }
    // 兜底：任何出现 [0][1] 连写的地方也拦截（双下标基本是笔误）
    if (/\bvar\s+set\w+\s*=.*\[0\]\[1\]/.test(ln)) {
      errors.push(`lib/client.js:${i + 1}: 疑似 useState setter 双下标笔误：${ln.trim()}`);
    }
  });
}

function checkIndex() {
  const file = path.join(root, 'lib', 'index.js');
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    // 图表对象原地赋值：c.data = ...
    //
    // ⚠ 历史缺陷：原规则用 `!/nextCharts/.test(ln)` 排除「新对象写法」，
    // 但**真实的历史 bug 形态恰恰同行含 nextCharts**：
    //     if (local) { c.data = local; nextCharts.push(c); }
    // 于是这条豁免把要拦的目标本身放过了 —— 规则形同虚设。
    //
    // 正确判据不是「行内是否出现 nextCharts」，而是**赋值后 push 的是不是同一个对象**：
    //   ✔ 合法：nextCharts.push({ ...c, data: local })   —— push 的是新对象
    //   ✘ 违规：c.data = local; nextCharts.push(c)        —— 原地改后 push 原对象
    // 因此改为：只要出现 `<短名>.data =`（非比较运算）就报错；
    // 唯一豁免是「本行的 push 明显在构造新对象」（含 `{ ...` 展开）。
    const assign = /\b(?:c|c0|chart|ch)\d*\.data\s*=(?!=)/;
    if (assign.test(ln)) {
      const pushesNewObject = /push\(\s*\{[^}]*\.\.\./.test(ln);
      if (!pushesNewObject) {
        errors.push(`lib/index.js:${i + 1}: 图表对象原地赋值（冻结对象会抛 readonly 错误）：${t}`);
      }
    }
  });
}

function checkSyntax() {
  // ⚠ 历史缺陷：原来只硬编码检查 lib/client.js 与 lib/index.js 两个文件，
  // 而 lib/ 下共有 9 个模块 —— atlas/audit/plan/projects/report/tasks
  // 等 6 个**从未被语法检查覆盖**，其中的语法错误会直接随包发布。
  // 现改为扫描 lib/ 下全部 .js 文件。
  const libDir = path.join(root, 'lib');
  if (!fs.existsSync(libDir)) return;
  const files = fs.readdirSync(libDir).filter((f) => f.endsWith('.js'));
  if (files.length === 0) {
    errors.push('lib/ 下未找到任何 .js 文件（路径或结构异常）');
    return;
  }
  for (const f of files) {
    const rel = path.join('lib', f);
    try {
      execSync(`node --check ${JSON.stringify(rel)}`, { cwd: root, stdio: 'pipe' });
    } catch (e) {
      const detail = String((e && e.stderr) || '').split('\n').filter(Boolean).slice(-1)[0] || '';
      errors.push(`${rel}: 语法错误${detail ? ' —— ' + detail.slice(0, 160) : ''}`);
    }
  }
}

checkClient();
checkIndex();
checkSyntax();

if (errors.length) {
  console.error('❌ 静态检查发现回归风险（' + errors.length + ' 处）：\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('✅ 静态检查通过：useState 解构 / charts 不可变更新 / 语法 均无回归');
