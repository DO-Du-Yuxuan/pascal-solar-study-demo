import type { PascalValidationResult } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validatePascalJson(value: unknown): PascalValidationResult {
  if (!isRecord(value) || !isRecord(value.nodes)) {
    return {
      valid: false,
      summary: null,
      message: 'Expected a top-level nodes object.',
    }
  }

  const countsByType: Record<string, number> = {}
  const nodes = Object.values(value.nodes)
  for (const node of nodes) {
    const type = isRecord(node) && typeof node.type === 'string' ? node.type : 'Unknown'
    countsByType[type] = (countsByType[type] ?? 0) + 1
  }

  return {
    valid: true,
    summary: { totalNodes: nodes.length, countsByType },
    message: 'JSON structure is valid for milestone-one diagnostics.',
  }
}
