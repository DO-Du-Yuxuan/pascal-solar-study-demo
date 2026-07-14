import { describe, expect, it } from 'vitest'
import { validatePascalJson } from './validatePascalJson'
import { orientAnalyticalOpening } from './parsePascalScene'

describe('validatePascalJson', () => {
  it('counts every node type while preparing the render scene', () => {
    const result = validatePascalJson({
      nodes: {
        a: { type: 'Wall' },
        b: { type: 'Wall' },
        c: { type: 'Slab' },
      },
    })
    expect(result.valid).toBe(true)
    expect(result.scene?.report.totalNodes).toBe(3)
    expect(result.scene?.report.countsByType).toEqual({ wall: 2, slab: 1 })
    expect(result.scene?.report.failed).toBe(3)
  })

  it('rejects JSON without a nodes object', () => {
    expect(validatePascalJson({ nodes: [] }).valid).toBe(false)
  })

  it('builds analytical openings and excludes hidden roof history', () => {
    const result = validatePascalJson({
      nodes: {
        level: { id: 'level', type: 'level', level: 0, children: ['wall', 'roof', 'old-roof'] },
        wall: { id: 'wall', type: 'wall', parentId: 'level', start: [0, 0], end: [4, 0], height: 2.5, thickness: 0.2 },
        window: { id: 'window', type: 'window', wallId: 'wall', position: [2, 1.25, 0], width: 1.5, height: 1, side: 'front' },
        roof: { id: 'roof', type: 'roof', parentId: 'level', position: [0, 2.5, 0], children: ['segment'] },
        segment: { id: 'segment', type: 'roof-segment', parentId: 'roof', roofType: 'gable', width: 4, depth: 3 },
        'old-roof': { id: 'old-roof', type: 'roof', parentId: 'level', visible: false, children: ['old-segment'] },
        'old-segment': { id: 'old-segment', type: 'roof-segment', parentId: 'old-roof', roofType: 'hip', width: 40, depth: 40 },
      },
    })
    expect(result.scene?.roofs).toHaveLength(1)
    expect(result.scene?.roofs[0]?.segments[0]?.roofType).toBe('gable')
    expect(result.scene?.report.ignored).toBe(2)
    const opening = result.scene?.analyticalOpenings[0]
    expect(opening?.centerWorld).toEqual([2, 1.25, 0])
    expect(opening?.outwardNormalWorld).toEqual([0, 0, 1])
    expect(opening && orientAnalyticalOpening(opening, 90).orientationDeg).toBe(270)
  })
})
