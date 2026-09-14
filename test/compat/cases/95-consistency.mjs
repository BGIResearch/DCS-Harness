// 内部一致性层：插件各处的常量与引用必须自洽。
//
// 为什么需要：插件把「专家 / 技能 / 模型 / 区域」等枚举值**同时**写在
// 常量表（lib/atlas.js）与文案/提示词（lib/index.js 的 systemPrompt 各 section）
// 里。这类「同一事实写两处」的地方最容易在迭代中漂移 ——
// 提示词里提到的专家若不存在，agent 会去调用一个不存在的实体；
// 模型名写错则选择菜单与实际能力不符。两者都不会报错，只会静默失效。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, assert, assertEqual, ROOT } from '../lib/harness.mjs';

const ATLAS = () => import(join(ROOT, 'lib', 'atlas.js'));
const IDX_SRC = () => readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8');

// ---------------------------------------------------------------- 专家

test('consistency', 'consistency/expert-references-resolve', '提示词中提到的专家都已注册', async () => {
  const atlas = await ATLAS();
  const idx = IDX_SRC();
  const registered = new Set(atlas.EXPERTS.map((e) => (typeof e === 'string' ? e : e.name)));

  // 专家名形如 xxx-expert，且必须是**独立词**：
  // 不能把 `dcs-expert-skill` 这类技能名误判为专家（早期版本的误报来源）。
  const mentioned = new Set();
  for (const m of idx.matchAll(/(?<![\w-])([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-expert(?![\w-])/g)) {
    mentioned.add(m[1] + '-expert');
  }

  const dangling = [...mentioned].filter((x) => !registered.has(x));
  assertEqual(dangling.length, 0,
    `提示词提到但未注册的专家（agent 会调用不存在的实体）: ${dangling.join(', ')}`);

  // 注册的专家应在某处被引用（否则属于死数据）
  const unused = [...registered].filter((x) => !idx.includes(x));
  assertEqual(unused.length, 0, `已注册但从未被引用的专家: ${unused.join(', ')}`);
});

test('consistency', 'consistency/expert-kind-covers-experts', '每个专家都有类别标注', async () => {
  const atlas = await ATLAS();
  const missing = [];
  for (const e of atlas.EXPERTS) {
    const name = typeof e === 'string' ? e : e.name;
    if (atlas.EXPERT_KIND[name] === undefined) missing.push(name);
  }
  assertEqual(missing.length, 0, `缺少类别标注的专家: ${missing.join(', ')}`);

  // 反向：类别表里不应有未注册的专家
  const registered = new Set(atlas.EXPERTS.map((e) => (typeof e === 'string' ? e : e.name)));
  const orphan = Object.keys(atlas.EXPERT_KIND).filter((k) => !registered.has(k));
  assertEqual(orphan.length, 0, `EXPERT_KIND 中有未注册的专家: ${orphan.join(', ')}`);
});

// ---------------------------------------------------------------- 模型

test('consistency', 'consistency/model-ids-unique-and-valid', '模型 id 唯一且格式合法', async () => {
  const atlas = await ATLAS();
  const ids = atlas.GENPILOT_MODELS.map((m) => m.id);
  assert(ids.length > 0, 'GENPILOT_MODELS 不应为空');
  assertEqual(new Set(ids).size, ids.length, `模型 id 有重复: ${ids.join(', ')}`);

  const bad = ids.filter((id) => !/^[a-z0-9][a-z0-9.\-]*$/.test(String(id)));
  assertEqual(bad.length, 0, `模型 id 格式异常: ${bad.join(', ')}`);

  // 默认模型必须存在（文档与提示词都指向 flash 为默认）
  assert(ids.includes('auto'), '应有 auto（自动选择）选项');
});

test('consistency', 'consistency/mentioned-models-are-registered', '代码中提到的模型都在注册表内', async () => {
  const atlas = await ATLAS();
  const idx = IDX_SRC();
  const ids = new Set(atlas.GENPILOT_MODELS.map((m) => m.id));

  const mentioned = new Set();
  for (const m of idx.matchAll(/\b(deepseek-v4-[a-z]+|qwen[0-9.]+-[a-z]+|glm-[0-9.]+|kimi-k[0-9.]+)\b/g)) {
    mentioned.add(m[1]);
  }
  const dangling = [...mentioned].filter((x) => !ids.has(x));
  assertEqual(dangling.length, 0,
    `代码提到但未注册的模型（选择菜单与实际不符）: ${dangling.join(', ')}`);
});

test('consistency', 'consistency/model-labels-nonempty', '每个模型都有非空中文标签', async () => {
  const atlas = await ATLAS();
  const problems = atlas.GENPILOT_MODELS
    .filter((m) => !m.label || String(m.label).trim().length < 2)
    .map((m) => m.id);
  assertEqual(problems.length, 0, `缺少标签的模型: ${problems.join(', ')}`);
});

// ---------------------------------------------------------------- API key 技能

test('consistency', 'consistency/api-key-skills-consistent', 'API key 技能表结构自洽', async () => {
  const atlas = await ATLAS();
  const skills = atlas.API_KEY_SKILLS;
  assert(Array.isArray(skills) && skills.length > 0, 'API_KEY_SKILLS 不应为空');

  const problems = [];
  const names = new Set();
  for (const s of skills) {
    if (!s.name) problems.push('条目缺少 name');
    else if (names.has(s.name)) problems.push(`name 重复: ${s.name}`);
    else names.add(s.name);

    if (!s.envVar) problems.push(`${s.name}: 缺少 envVar`);
    else if (!/^[A-Z][A-Z0-9_]*$/.test(s.envVar)) problems.push(`${s.name}: envVar 格式异常 ${s.envVar}`);

    if (!s.skills || !Array.isArray(s.skills) || s.skills.length === 0) {
      problems.push(`${s.name}: 缺少 skills 列表`);
    }
    if (s.apiUrl && !/^https:\/\//.test(s.apiUrl)) {
      problems.push(`${s.name}: apiUrl 非 https（密钥传输不安全）: ${s.apiUrl}`);
    }
  }
  assertEqual(problems.length, 0, problems.join('; '));

  // genos 全系应与 genos_vep / genos_mutation 共用同一 envVar
  const byName = Object.fromEntries(skills.map((s) => [s.name, s]));
  if (byName.genos && byName.genos_vep) {
    assertEqual(byName.genos.envVar, byName.genos_vep.envVar,
      'genos 全系应与 genos_vep 共用同一 envVar');
  }
});

// ---------------------------------------------------------------- 技能目录

test('consistency', 'consistency/skill-top-dirs-unique', '技能库一级目录清单无重复', async () => {
  const atlas = await ATLAS();
  const dirs = atlas.SKILL_TOP_DIRS;
  assert(Array.isArray(dirs) && dirs.length > 0, 'SKILL_TOP_DIRS 不应为空');
  assertEqual(new Set(dirs).size, dirs.length, `SKILL_TOP_DIRS 有重复: ${dirs.join(', ')}`);
  const bad = dirs.filter((d) => !/^[A-Za-z][\w-]*$/.test(d));
  assertEqual(bad.length, 0, `目录名格式异常: ${bad.join(', ')}`);
});

// ---------------------------------------------------------------- 区域

test('consistency', 'consistency/regions-unique-and-shaped', '区域表无重复且结构完整', async () => {
  const atlas = await ATLAS();
  const regions = atlas.REGIONS;
  assert(Array.isArray(regions) && regions.length > 0, 'REGIONS 不应为空');

  const names = regions.map((r) => r.name);
  assertEqual(new Set(names).size, names.length, `区域名重复: ${names.join(', ')}`);

  const problems = [];
  for (const r of regions) {
    if (!r.name) problems.push('条目缺少 name');
    if (r.type && !['bgi-center', 'dcs-public', 'public'].includes(r.type)) {
      problems.push(`${r.name}: 未知 type ${r.type}`);
    }
  }
  assertEqual(problems.length, 0, problems.join('; '));
});

test('consistency', 'consistency/regions-referenced-in-hints', '区域提示中的节点名都能在区域表中找到', async () => {
  const atlas = await ATLAS();
  const idx = IDX_SRC();
  const known = new Set(atlas.REGIONS.map((r) => r.name));
  // 插件文档/提示里出现的「BGI-时空」「DCS-华南1」这类节点名
  const mentioned = new Set();
  for (const m of idx.matchAll(/\b((?:BGI|DCS)-[\u4e00-\u9fa5\w]+)/g)) mentioned.add(m[1]);

  const dangling = [...mentioned].filter((x) => !known.has(x));
  // 允许少量示例性提及（如说明文字里的历史节点），但应当是极少数
  assert(dangling.length <= 2,
    `提示词提到的区域节点多数不在区域表中: ${dangling.join(', ')}`);
});
