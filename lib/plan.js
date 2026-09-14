// dsh-dcs-cloud — Plan.md 生成（Genpilot 执行计划文档格式）。
// 对齐 DCS Genpilot 实际使用的「任务执行计划与过程文档」结构：
//   步骤执行进度表 + 产物路径汇总 + 方法学概述 + 执行总结。

import { mkdirSync } from 'node:fs';
import { atomicWrite } from './atomic-write.js';
import { join, dirname, isAbsolute } from 'node:path';
import { homedir } from 'node:os';

function esc(s) {
  return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * 生成 Plan.md。
 * @param {object} p { title, steps:[{status,desc,detail}], outputs:[{name,path,desc}], methodology, summary }
 * @param {object} opts { outPath, workspace }
 */
export function generatePlan(p, opts) {
  const workspace = (opts && opts.workspace) || process.cwd();
  const outDir = (opts && opts.outDir) || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dcs-plans');
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = (opts && opts.outPath) || join(outDir, 'plan-' + stamp + '.md');

  const steps = (p.steps || []).map((s) => {
    const statusIcon = /✅|✔|完成|done/i.test(s.status || '') ? '✅ 已完成'
      : /进行中|running|进行|doing/i.test(s.status || '') ? '🔄 进行中'
      : /待|pending|todo|计划/i.test(s.status || '') ? '⏳ 待执行'
      : (s.status || '—');
    return '| ' + statusIcon + ' | ' + esc(s.desc) + ' | ' + esc(s.detail || '') + ' |';
  });

  const outputs = (p.outputs || []).map((o) => '| ' + esc(o.name) + ' | ' + esc(o.path) + ' | ' + esc(o.desc || '') + ' |');

  const md = `# DCS Genpilot 任务执行计划与过程文档 (Plan.md)

${p.title ? '## 📌 ' + esc(p.title) + '\n' : ''}
## 📊 步骤执行进度 (Steps Progression)
| 状态 (Status) | 步骤描述 (Step Description) | 进度详情 (Detail Status) |
| :---: | :--- | :--- |
${steps.join('\n') || '| ⏳ 待执行 | （待补充步骤） | |'}

---

## 📂 主要产物与物理路径汇总 (Output Assets)
| 产物名称 (Name) | 路径 (Path) | 说明 (Description) |
| :--- | :--- | :--- |
${outputs.join('\n') || '| （待补充） | | |'}

---

## 🧬 计算科学方法学概述 (Methodology)

${p.methodology || '（待补充）'}

---

## 🎉 执行总结报告 (Completed Summary)

${p.summary || '（执行完成后补充总结）'}
`;

  // 原子写：避免中断留下半截 Markdown（用户可能直接打开并以为内容本就如此）
  atomicWrite(outPath, md, { mkdir: false });
  return { path: outPath, md };
}
