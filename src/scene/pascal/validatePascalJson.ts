import type { PascalValidationResult } from './types'
import { parsePascalScene } from './parsePascalScene'

export function validatePascalJson(value: unknown): PascalValidationResult {
  try {
    const scene = parsePascalScene(value)
    return {
      valid: true,
      scene,
      message: 'Pascal JSON 已在浏览器本地解析。',
    }
  } catch (error) {
    return {
      valid: false,
      scene: null,
      message: error instanceof Error ? error.message : 'Pascal JSON 解析失败。',
    }
  }
}
