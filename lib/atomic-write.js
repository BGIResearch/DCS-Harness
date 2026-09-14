// dsh-dcs-cloud — 原子写工具（Host 侧，纯 Node）。
//
// 为什么单独成模块：项目里有 5 处需要「要么旧内容、要么新内容」的落盘
// （项目库 / 任务库 / 配置（含 PAT） / dcs 二进制 / 生成的文档）。
// 直接 writeFileSync 会**先截断再写** —— 中途崩溃、被 kill、磁盘满
// 都会留下半截文件；而各处的读取路径大多对损坏内容**静默降级**
// （返回空列表 / 默认配置），表现为「数据凭空消失」且无任何提示。
// 原子写用「临时文件 + rename」消除该类问题（rename 在同一文件系统内是原子操作）。
//
// 各处曾各自复制这段逻辑（含各自的注释与边界处理），现统一到此处，
// 避免新增存储时再次漏掉、或某处被改坏而其它处看起来正常。

import { writeFileSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * 原子写文件：先写同目录下的临时文件，再 rename 覆盖目标。
 *
 * @param {string} target 目标绝对路径
 * @param {string|Buffer} content 内容
 * @param {object} [opts]
 *   - mode: number  目标文件权限（如 0o600 表示仅本用户可读写）。
 *                   会在**写入前**应用到临时文件，避免内容以默认 umask
 *                   短暂暴露（对含密钥的文件尤其重要）。
 *   - mkdir: boolean 是否自动创建父目录（默认 true）
 * @returns {string} 目标路径
 */
export function atomicWrite(target, content, opts = {}) {
  const { mode, mkdir = true } = opts;
  if (mkdir) mkdirSync(dirname(target), { recursive: true });

  const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    writeFileSync(tmp, content, mode === undefined ? undefined : { mode });
    renameSync(tmp, target);
  } catch (e) {
    // 失败路径必须清理临时文件，否则会在目录里越积越多
    try { unlinkSync(tmp); } catch { /* 清理失败不掩盖原始错误 */ }
    throw e;
  }
  return target;
}
