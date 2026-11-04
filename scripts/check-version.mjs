#!/usr/bin/env node
// 版本号规则自检：未发布期间只允许小版本（patch）升级，不允许跳 minor/major。
// 规则与用法见 docs/release.md。
//
//   node scripts/check-version.mjs
//
// 判定：
//   - package.json 版本 == 最近 tag            → 干净（已发布）✅
//   - 同 major.minor 且 patch 递增            → 未发布窗口内的小版本升级 ✅
//   - 未发布却提升 minor/major，或版本回退    → ❌
// 发布动作（改号 + npm publish + git tag）完成后版本与 tag 相等，自然放行。

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = String(pkg.version || '');

function lastTag() {
  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function parse(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const tag = lastTag();
const cur = parse(version);
if (!cur) {
  console.error(`✗ package.json 的 version 不是合法语义化版本号: ${JSON.stringify(version)}`);
  process.exit(1);
}
if (!tag) {
  console.log('ℹ 仓库没有 tag，跳过检查（首次发布前）');
  process.exit(0);
}
const base = parse(tag);
if (!base) {
  console.error(`✗ 最近 tag 不是合法语义化版本号: ${tag}`);
  process.exit(1);
}

const [tm, tn, tp] = base;
const [cm, cn, cp] = cur;

if (cm === tm && cn === tn && cp === tp) {
  console.log(`✓ ${tag} 已发布，工作区版本与 tag 一致`);
  process.exit(0);
}
if (cm === tm && cn === tn && cp > tp) {
  console.log(`✓ 未发布窗口内的小版本升级：${tag} → ${version}（同 minor，patch +${cp - tp}）`);
  process.exit(0);
}

console.error(`✗ 版本号违规：最近发布 ${tag}，当前 ${version}`);
if (cp < tp) {
  console.error('  原因：版本回退（当前版本低于最近发布的 patch）。');
} else {
  console.error(`  原因：未发布就跳了 minor/major（${tm}.${tn}.x → ${cm}.${cn}.x）。`);
  console.error(`  规则：未发布只允许小版本升级，当前应为 ${tm}.${tn}.${tp + 1}；`);
  console.error('        想升 minor，请在发布时一次性完成「改号 + npm publish + git tag」。');
}
console.error('  详见 docs/release.md');
process.exit(1);
