import type { PascalValidationResult } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validatePascalJson(value: unknown): PascalValidationResult {
  if (!isRecord(value) || !isRecord(value.nodes)) {
    return {
      valid: false,
      summary: null,
      message: 'JSON 顶层必须包含 nodes 对象。',
    }
  }

  const countsByType: Record<string, number> = {}
  const nodes = Object.values(value.nodes)
  for (const node of nodes) {
    const type = isRecord(node) && typeof node.type === 'string' ? node.type : '未知类型'
    countsByType[type] = (countsByType[type] ?? 0) + 1
  }

  return {
    valid: true,
    summary: { totalNodes: nodes.length, countsByType },
    message: 'JSON 结构有效，已完成第一阶段诊断。',
  }
}
