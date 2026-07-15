export function quantile(values: Iterable<number>, percentile: number): number | null {
  const sorted = [...values]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right)
  if (sorted.length === 0) return null
  if (sorted.length < 4) return sorted.at(-1) ?? null
  const clamped = Math.max(0, Math.min(1, percentile))
  const index = (sorted.length - 1) * clamped
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const lowerValue = sorted[lower] ?? sorted.at(-1) ?? 0
  const upperValue = sorted[upper] ?? lowerValue
  return lowerValue + (upperValue - lowerValue) * (index - lower)
}

export function positiveResultP95(grids: ArrayLike<{ energyKWhM2: Float32Array }>): number | null {
  const values: number[] = []
  for (let gridIndex = 0; gridIndex < grids.length; gridIndex += 1) {
    const grid = grids[gridIndex]
    if (!grid) continue
    for (const value of grid.energyKWhM2) {
      if (Number.isFinite(value) && value > 0) values.push(value)
    }
  }
  return quantile(values, 0.95)
}
