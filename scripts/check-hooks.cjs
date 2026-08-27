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
  lines.forEach((ln, i) => {
    // 模式：var setXxx = <xxx>S[n] 或 var setXxx = <xxx>S[0][1] —— setter 从「值变量」取下标（应为 stateArr[1]）
    // 正确写法是 var setXxx = xxx[1]（xxx 为 useState 返回的数组，不结尾 S）
    const m = ln.match(/var\s+(set\w+)\s*=\s*([a-zA-Z_$][\w$]*S)\s*(\[\d\])/);
    if (m) {
      const stateVar = m[2].replace(/S$/, '');
      errors.push(`lib/client.js:${i + 1}: useState setter 解构错误：${m[0].trim()} —— setter 应取 ${stateVar}[1]（useState 数组），而非值变量 ${m[2]}[${m[3].slice(1, -1)}]`);
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
    // 图表对象原地赋值：c.data = ...（非 nextCharts.push 的新对象写法）。
    // (?!=) 排除 .data === / == 的比较运算（typeof c.data === 'string' 属合法读取）
    if (/\b(?:c|c0|chart|ch)\d*\.data\s*=(?!=)/.test(ln) && !/nextCharts/.test(ln)) {
      errors.push(`lib/index.js:${i + 1}: 图表对象原地赋值（冻结对象会抛 readonly 错误）：${t}`);
    }
  });
}

function checkSyntax() {
  for (const f of ['lib/client.js', 'lib/index.js']) {
    try {
      execSync(`node --check ${f}`, { cwd: root, stdio: 'pipe' });
    } catch (e) {
      errors.push(`${f}: 语法错误`);
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
