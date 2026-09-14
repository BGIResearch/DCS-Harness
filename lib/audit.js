// dsh-dcs-cloud — 脚本/流程静态审计（Host 侧，纯 Node）。
// 在执行前对 shell / python / WDL 脚本做安全与质量静态检查，输出分级审计报告。

function guessType(text, hint) {
  if (hint && hint !== 'auto') return hint;
  const head = text.trim().split('\n').slice(0, 5).join('\n');
  if (/^#!.*\b(ba|z|k|c)?sh\b/.test(head)) return 'shell';
  if (/^#!.*\bpython/.test(head) || /\bimport\s+(os|sys|pandas|numpy|torch|scanpy|anndata|seaborn|matplotlib)\b/.test(text)) return 'python';
  if (/\b(task|workflow|call)\s+\S+\s*\{/.test(text) && /\bversion\s+1\.0\b/.test(text)) return 'wdl';
  if (/\bcommand\s*\{/.test(text)) return 'wdl';
  return 'shell';
}

const SHELL_RULES = [
  // 注意：不能用 /\b 作为目标后的边界——"/" 与 "~" 都是非单词字符，
  // "rm -rf /"（行尾）与 "rm -rf ~" 会因边界断言失败而漏检。改用「行尾/空白/分隔符」边界。
  // 必须含递归标志 -r/-R：只删单文件的 `rm -f /tmp/x` 不该报 critical（避免告警疲劳）。
  // 绝对路径删除按「是否触及系统/挂载根目录」分级：
  //   rm -rf /          → critical（根目录）
  //   rm -rf /data/work → high（容器工作区，常规清理但删错不可逆）
  //   rm -rf /tmp/x     → medium（临时目录，风险有限）
  // 这样既不放过真正的危险操作，也不因生信脚本里的常规清理造成告警疲劳。
  { re: /\brm\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*(?:\s+-[a-zA-Z]+)*\s*\/(?=\s|$|;|&|\|)/, sev: 'critical', msg: '危险删除命令（rm -rf / 删除根目录），可能造成不可逆数据丢失' },
  { re: /\brm\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*(?:\s+-[a-zA-Z]+)*\s*\/(?:data|work|Files|public|home|mnt|media)(?=\/|\s|$|;|&|\|)/, sev: 'high', msg: '递归删除绝对路径的挂载/工作区（rm -rf /data|/work|/Files|…），请确认路径正确且已备份' },
  { re: /\brm\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*(?:\s+-[a-zA-Z]+)*\s*\/(?!\/|data|work|Files|public|home|mnt|media)[^\s;|&]+(?=\s|$|;|&|\|)/, sev: 'medium', msg: '递归删除绝对路径，请确认路径正确' },
  { re: /\brm\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*(?:\s+-[a-zA-Z]+)*\s*(?:~|\$HOME)(?=\s|$|;|&|\|)/, sev: 'critical', msg: '危险删除命令（rm -rf ~ 删除家目录），可能造成不可逆数据丢失' },
  { re: /\brm\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*(?:\s+-[a-zA-Z]+)*\s*\*(?=\s|$|;|&|\|)/, sev: 'critical', msg: '危险删除命令（rm -rf * 通配删除当前目录全部内容）' },
  // 扩展变体：通配符叠加根路径、上级目录、变量间接、xargs 转发。
  // 变量间接无法静态求值，一律按危险处理（宁可误报，不可漏放不可逆删除）。
  { re: /\brm\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*(?:\s+-[a-zA-Z]+)*\s*\/\*(?=\s|$|;|&|\|)/, sev: 'critical', msg: '危险删除命令（rm -rf /* 通配删除根目录下全部内容），可能造成不可逆数据丢失' },
  { re: /\brm\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*(?:\s+-[a-zA-Z]+)*\s*\.\.(?=\s|$|\/|;|&|\|)/, sev: 'critical', msg: '危险删除命令（rm -rf .. 删除上级目录）' },
  // 仅当变量「单独构成删除目标」时告警：`rm -rf $VAR` 危险（无法静态求值）。
  // 而 `rm -rf $WORKDIR/tmp` 这类「变量+固定子路径」是生信脚本的常规清理写法，不应误报。
  { re: /\brm\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*(?:\s+-[a-zA-Z]+)*\s*["']?\$(?:\w+|\{[^}]+\})["']?(?=\s|$|;|&|\|)/, sev: 'high', msg: '删除目标是变量本身（rm -rf $VAR），无法静态确认路径安全，请显式写明或用白名单校验' },
  { re: /\bxargs\s+(?:-\S+\s+)*rm\b/, sev: 'high', msg: '通过 xargs 转发 rm，删除范围取决于上游输入，风险不可控' },
  // 其它破坏性操作
  { re: /\bfind\b[^|;]*\s-delete\b/, sev: 'high', msg: 'find -delete 会批量删除匹配文件，请先用 -print 确认匹配范围' },
  { re: /\bdd\b[^|;]*\bof=\/dev\//, sev: 'critical', msg: 'dd 写裸设备（of=/dev/…），极高风险' },
  { re: /(?:^|[\s;&|])>+\s*\/(?:etc|boot|bin|sbin|lib|usr|var|dev)\//, sev: 'critical', msg: '重定向覆盖系统目录文件，可能破坏系统' },
  // ---- 数据破坏（生信场景高价值：原始数据/中间结果不可逆丢失）----
  // 截断/擦除：truncate -s 0、shred 会不可逆地毁掉数据文件
  // 说明：truncate -s 0 常用于清空日志，属常规操作 → medium；
  // 但若目标是 *.bam/*.fastq/*.h5ad 等数据文件，则为 high。
  { re: /\btruncate\b[^|;&]*\s-s\s*0\b[^|;&]*\.(?:bam|cram|fastq?|fq|h5ad|h5|sam|vcf|bcf|bed|gtf|gff)\b/, sev: 'high', msg: 'truncate -s 0 作用于数据文件（不可逆清零），请确认不是原始/中间数据' },
  { re: /\btruncate\b[^|;&]*\s-s\s*0\b/, sev: 'medium', msg: 'truncate -s 0 会清零文件内容，请确认目标无误' },
  { re: /\bshred\b(?![^|;&]*(?:--help|--version|-h\b))/, sev: 'high', msg: 'shred 会不可逆擦除文件，请确认目标无误' },
  // 写满磁盘：/dev/zero、/dev/urandom 重定向到文件会耗尽存储，拖垮整台分析节点
  { re: /\/dev\/(?:zero|urandom)\s*>\s*[^\s|;&]+/, sev: 'high', msg: '写入 /dev/zero 或 /dev/urandom 到文件会耗尽磁盘，影响整台节点' },
  { re: /\bcp\s+\/dev\/(?:zero|urandom)\b/, sev: 'high', msg: 'cp /dev/zero 会耗尽磁盘空间' },
  { re: /\bdd\b[^|;&]*\bif=\/dev\/(?:zero|urandom)\b[^|;&]*\bof=\/(?!dev\/)/, sev: 'high', msg: 'dd 从 /dev/zero 写入普通文件会耗尽磁盘空间' },
  // ---- 权限 / 系统服务（容器内通常无权限，但脚本可能在宿主/特权容器执行）----
  { re: /\bchown\s+(?:-\S+\s+)*(?:root|0:0)\S*\s+\/(?=\s|$|;|&|\|)/, sev: 'high', msg: 'chown 递归作用于根目录，会破坏系统属主' },
  { re: /\bchmod\s+(?:-\S+\s+)*-?[0-7]*0[0-7]{2}\s+\/data\b/, sev: 'medium', msg: 'chmod 作用于 /data 可能使数据不可读，请确认' },
  { re: /\b(?:systemctl|service)\s+(?:stop|disable|mask)\b/, sev: 'medium', msg: '停用系统服务，请确认必要性' },
  { re: /\biptables\s+-F\b|\bufw\s+disable\b/, sev: 'high', msg: '清空/关闭防火墙，会暴露节点' },
  // ---- 凭据泄露 / 外传 ----
  { re: /\bcat\s+[^\s|;&]*(?:\.ssh\/id_\w+|\.aws\/credentials|\.netrc|\.git-credentials)\b/, sev: 'high', msg: '读取私钥/凭据文件，请确认不会进入日志或输出' },
  { re: /\bssh-keygen\b[^|;&]*-N\s*["']{2}/, sev: 'high', msg: '生成空密码 SSH 密钥，存在被滥用风险' },
  { re: /\b(?:curl|wget)\b[^|;&]*(?:-d\s*@|--data[^\s]*\s*@|--upload-file|-T\s)\s*\S*\/(?:etc\/|root\/|\.ssh)|\b(?:curl|wget)\b[^|;&]*@\/etc\//, sev: 'critical', msg: '疑似把系统文件/凭据外传到远端，存在数据外泄风险' },
  { re: /\bnc\s+(?:-l|-lp)\b[^|;&]*\|\s*(?:ba|z|k|c)?sh\b|\bncat\s+(?:-l|-lp)\b[^|;&]*\|\s*(?:ba|z|k|c)?sh\b/, sev: 'critical', msg: '疑似反弹 shell（nc -l | sh），存在入侵风险' },
  // ---- 无限循环 / 资源占用 ----
  { re: /\bwhile\s+true\b|\bwhile\s*:\s*;?\s*do\b|\bfor\s*\(\s*;\s*;\s*\)/, sev: 'medium', msg: '含无终止条件的循环，离线任务可能永不结束并持续计费' },
  { re: /\byes\b\s*>\s*\/dev\/null/, sev: 'info', msg: 'yes 循环用于占位，注意配合超时' },
  { re: /\bsudo\b/, sev: 'high', msg: '使用了 sudo 提权，请确认必要性' },
  { re: /\bmkfs\b|\bdd\s+if=.*of=\/dev\//, sev: 'critical', msg: '格式化/写裸设备操作，极高风险' },
  { re: /(curl|wget)\s+.*\|\s*(ba|z|k|c)?sh\b/, sev: 'critical', msg: '远程内容直接管道执行（curl|sh），存在供应链风险' },
  { re: /\beval\s+/, sev: 'high', msg: '使用 eval，可能执行任意注入代码' },
  { re: /chmod\s+-R\s+777/, sev: 'medium', msg: 'chmod -R 777 会开放过宽权限' },
  { re: /:\s*\(\s*\)\s*\{\s*:\s*\|:\s*&\s*\}/, sev: 'critical', msg: '疑似 fork bomb' },
  { re: /\b(shutdown|reboot|halt)\b/, sev: 'high', msg: '含关机/重启命令' },
  { re: /\bkill\s+-9\s+1\b/, sev: 'critical', msg: 'kill -9 1 会终止 init 进程' },
  { re: /(api[_-]?key|token|password|passwd|secret|credentials?)\s*[=:]\s*["']?[A-Za-z0-9_\-\.]{12,}["']?/i, sev: 'critical', msg: '疑似硬编码密钥/口令，请改用环境变量或密钥管理' },
  { re: /(dcs_pat_|ghp_|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{20,}|sk-[A-Za-z0-9]{20,})/i, sev: 'critical', msg: '检测到疑似明文访问令牌（PAT/云密钥）' },
  { re: /\bcurl\b|\bwget\b/, sev: 'info', msg: '含网络下载，请确认来源可信（外部数据下载应优先核对原始出处）' },
  { re: /\bunzip|tar\s+-x|gunzip/, sev: 'info', msg: '含解压操作，注意压缩包来源与大小' },
];

const PYTHON_RULES = [
  { re: /\bos\.system\(|\bsubprocess\.(call|run|Popen)\([^)]*shell\s*=\s*True/, sev: 'high', msg: 'Python 使用 shell=True 或 os.system，存在命令注入风险' },
  { re: /\beval\(|\bexec\s*\(/, sev: 'high', msg: 'Python 使用 eval/exec，输入不可信时危险' },
  { re: /(api[_-]?key|token|password|passwd|secret|credentials?)\s*[=:]\s*["']?[A-Za-z0-9_\-\.]{12,}["']?/i, sev: 'critical', msg: '疑似硬编码密钥/口令' },
  { re: /(dcs_pat_|ghp_|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{20,}|sk-[A-Za-z0-9]{20,})/i, sev: 'critical', msg: '检测到疑似明文访问令牌' },
  { re: /\bpickle\.load\(/, sev: 'medium', msg: 'pickle.load 不安全反序列化，不可信输入可能执行任意代码' },
  { re: /\byaml\.(?<!safe_)load\(/, sev: 'medium', msg: 'yaml.load 不安全反序列化，建议改用 yaml.safe_load' },
  { re: /\binput\s*\(/, sev: 'info', msg: '含交互式 input，离线任务环境可能阻塞' },
];

const WDL_RULES = [
  // 镜像引用：registry/name 的 registry 段可能含连字符与点
  // （如插件文档推荐的 `public-library/<镜像名>:latest`、`registry.example.com/img`），
  // 原用 [a-z]+/ 只吃得下纯小写字母，会把带连字符/点的 registry **静默漏掉**。
  // 改为 [\w.-]+/ 覆盖这些形态。
  { re: /\bdocker:\s*["']?[\w.-]+\/\S+/i, sev: 'info', msg: 'WDL 引用了容器镜像，请确认镜像在 DCS 镜像库可用' },
  { re: /\bcpu\s*:\s*\d+|\bmemory\s*:\s*["']?\d+\s*[GT]B/i, sev: 'info', msg: 'WDL 指定了资源，投递前请核对与 dcs task run -l 资源是否匹配' },
];

const RULES_BY_TYPE = { shell: SHELL_RULES, python: PYTHON_RULES, wdl: WDL_RULES };

export function auditScript(text, type) {
  const t = String(text == null ? '' : text);
  const lang = guessType(t, type);
  const rules = RULES_BY_TYPE[lang] || SHELL_RULES;
  const findings = [];
  for (const rule of rules) {
    if (rule.re.test(t)) {
      findings.push({ severity: rule.sev, message: rule.msg });
    }
  }
  // 通用质量提示
  if (lang === 'shell') {
    if (!/^#!/.test(t.trim())) findings.push({ severity: 'medium', message: '缺少 shebang 行（#!），dcs 离线任务可能无法正确执行' });
    if (!/\bset\s+-[a-z]*e[a-z]*\b/.test(t)) findings.push({ severity: 'info', message: '建议使用 set -euo pipefail 尽早暴露错误' });
  }
  if (lang === 'python') {
    if (!/\bif\s+__name__\s*==\s*['"]__main__['"]/.test(t) && t.trim()) findings.push({ severity: 'info', message: '未发现 __main__ 入口守卫，被 import 时会立即执行' });
  }
  const sevRank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  findings.sort((a, b) => (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0));
  const hasBlocker = findings.some((f) => f.severity === 'critical' || f.severity === 'high');
  const summary = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };
  return {
    language: lang,
    verdict: hasBlocker ? 'blocked' : 'pass',
    verdictLabel: hasBlocker ? '存在高风险项，建议先修复再执行' : '未发现高风险项，可进入执行',
    summary,
    findings,
  };
}
