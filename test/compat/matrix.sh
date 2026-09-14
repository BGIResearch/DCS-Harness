#!/usr/bin/env bash
# 多版本兼容性矩阵：对多个已安装的 dsh 版本分别跑兼容性测试。
#
# 用途：dsh 处于 0.1.x-rc 快速迭代期。本脚本一次给出「插件在各 dsh 版本上的兼容性」，
# 用于升级前评估、回归定位、以及向用户声明支持范围。
#
# 用法：
#   bash test/compat/matrix.sh
#   DSH_ROOTS="/path/a/node_modules:/path/b/node_modules" bash test/compat/matrix.sh
#
# 说明：本脚本不自动安装 dsh（避免副作用）。用下面的方式准备多个版本：
#   mkdir -p /tmp/dsh-rc2 && cd /tmp/dsh-rc2 && npm init -y && npm i @deepseek-ai/dsh@0.1.5-rc.2
#   然后 DSH_ROOTS=/tmp/dsh-rc2/node_modules bash test/compat/matrix.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ="$(cd "$HERE/../.." && pwd)"

# 默认扫描：当前生效的 dsh + 常见临时安装目录
if [ -n "${DSH_ROOTS:-}" ]; then
  IFS=':' read -r -a ROOTS <<< "$DSH_ROOTS"
else
  ROOTS=()
  [ -d /tmp/dshrc2/node_modules ] && ROOTS+=("/tmp/dshrc2/node_modules")
  [ -d /tmp/dshold/node_modules ] && ROOTS+=("/tmp/dshold/node_modules")
  if DSH_BIN_NODE_MODULES="$(npm root -g 2>/dev/null)"; then ROOTS+=("$DSH_BIN_NODE_MODULES"); fi
fi

if [ "${#ROOTS[@]}" -eq 0 ]; then
  echo "未找到任何 dsh 安装。请设置 DSH_ROOTS=<node_modules 路径>[:...]" >&2
  exit 2
fi

printf "%-18s %-14s %s\n" "dsh 版本" "结果" "说明"
printf "%-18s %-14s %s\n" "------------------" "--------------" "------------------------------"

overall=0
for root in "${ROOTS[@]}"; do
  [ -d "$root" ] || continue
  ver="$(node -e "try{console.log(require('$root/@deepseek-ai/dsh/package.json').version)}catch(e){process.exit(1)}" 2>/dev/null)" || continue
  tools="$(node -e "try{console.log(require('$root/@deepseek-ai/dsh-tools/package.json').version)}catch(e){try{console.log(require('$root/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-tools/package.json').version)}catch(e2){console.log('-')}}" 2>/dev/null)"

  json="$(cd "$PROJ" && DSH_ROOT="$root" node test/compat/run.mjs --json 2>/dev/null)"
  code=$?
  if [ "$code" -eq 0 ]; then
    summary="$(printf '%s' "$json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.passed+'/'+j.total)}catch(e){console.log('?')}})")"
    printf "%-18s %-14s %s\n" "$ver" "✔ $summary" "dsh-tools $tools"
  else
    failed="$(printf '%s' "$json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.results.filter(r=>r.status==='fail').map(r=>r.id).slice(0,3).join(', '))}catch(e){console.log('(无报告)')}})")"
    printf "%-18s %-14s %s\n" "$ver" "✘ 不兼容" "失败: $failed"
    overall=1
  fi
done

echo
if [ "$overall" -eq 0 ]; then
  echo "✔ 全部被测 dsh 版本均兼容"
else
  echo "✘ 存在不兼容的 dsh 版本（详见上表与 node test/compat/run.mjs -l contract）"
fi
exit "$overall"
