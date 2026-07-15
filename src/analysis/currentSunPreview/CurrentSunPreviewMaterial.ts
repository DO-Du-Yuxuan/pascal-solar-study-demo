import * as THREE from 'three'

export interface CurrentSunPreviewMaterial extends THREE.ShaderMaterial {
  uniforms: {
    color: { value: THREE.Color }
    opacity: { value: number }
    [key: string]: THREE.IUniform
  }
}

export function createCurrentSunPreviewMaterial(): CurrentSunPreviewMaterial {
  const shadowShader = THREE.ShaderLib.shadow
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(shadowShader.uniforms),
    vertexShader: shadowShader.vertexShader,
    fragmentShader: shadowShader.fragmentShader.replace(
      'opacity * ( 1.0 - getShadowMask() )',
      'opacity * getShadowMask()',
    ),
    lights: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    side: THREE.DoubleSide,
    toneMapped: false,
  }) as CurrentSunPreviewMaterial
  material.uniforms.color.value.set('#ffb23e')
  material.uniforms.opacity.value = 0
  material.onBeforeRender = () => {
    material.uniforms.opacity.value = material.opacity
  }
  return material
}

export function currentSunPreviewOpacity(dniWm2: number | null | undefined, sunAboveHorizon: boolean): number {
  if (!sunAboveHorizon || !Number.isFinite(dniWm2) || (dniWm2 as number) < 20) return 0
  return THREE.MathUtils.lerp(0.28, 0.72, THREE.MathUtils.smoothstep(dniWm2 as number, 20, 850))
}
