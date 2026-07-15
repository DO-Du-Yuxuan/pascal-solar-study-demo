import * as THREE from 'three'

const stops = [
  [0.05, new THREE.Color('#174a9e')],
  [0.2, new THREE.Color('#1769c2')],
  [0.4, new THREE.Color('#00b8c8')],
  [0.6, new THREE.Color('#f5dc45')],
  [0.8, new THREE.Color('#f28a2e')],
  [1, new THREE.Color('#df3028')],
] as const

export interface CumulativeColor {
  color: THREE.Color
  alpha: number
}

export function cumulativeColor(valueKWhM2: number, lockedScaleMaxKWhM2: number): CumulativeColor {
  if (!Number.isFinite(valueKWhM2) || valueKWhM2 <= 0 || !Number.isFinite(lockedScaleMaxKWhM2) || lockedScaleMaxKWhM2 <= 0) {
    return { color: stops[0][1].clone(), alpha: 0 }
  }
  const normalized = THREE.MathUtils.clamp(valueKWhM2 / lockedScaleMaxKWhM2, 0, 1)
  const alpha = THREE.MathUtils.smoothstep(normalized, 0, 0.12) * 0.82
  if (normalized <= stops[0][0]) return { color: stops[0][1].clone(), alpha }
  for (let index = 0; index < stops.length - 1; index += 1) {
    const current = stops[index]
    const next = stops[index + 1]
    if (!current || !next || normalized > next[0]) continue
    const ratio = (normalized - current[0]) / (next[0] - current[0])
    return { color: current[1].clone().lerp(next[1], ratio), alpha }
  }
  return { color: stops.at(-1)?.[1].clone() ?? new THREE.Color('#df3028'), alpha }
}
