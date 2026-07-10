import { describe, expect, it } from 'vitest'
import { validatePascalJson } from './validatePascalJson'

describe('validatePascalJson', () => {
  it('counts nodes by type without interpreting geometry', () => {
    const result = validatePascalJson({
      nodes: {
        a: { type: 'Wall' },
        b: { type: 'Wall' },
        c: { type: 'Slab' },
      },
    })
    expect(result.valid).toBe(true)
    expect(result.summary).toEqual({
      totalNodes: 3,
      countsByType: { Wall: 2, Slab: 1 },
    })
  })

  it('rejects JSON without a nodes object', () => {
    expect(validatePascalJson({ nodes: [] }).valid).toBe(false)
  })
})
