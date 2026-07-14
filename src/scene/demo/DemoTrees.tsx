import { Tree } from '@dgreenheck/ez-tree'
import { useMemo } from 'react'
import * as THREE from 'three'

interface DemoTreeSpec {
  id: string
  preset: string
  seed: number
  height: number
  position: [number, number, number]
  rotationY: number
  leafColor: number
}

const treeSpecs: DemoTreeSpec[] = [
  // Keep the trunks outside the 9.2 m × 8.2 m house footprint. The extra
  // clearance also keeps the generated crowns from intersecting the walls.
  { id: 'west-oak', preset: 'Oak Medium', seed: 17, height: 6.4, position: [-7.5, 0, -1.8], rotationY: 0.3, leafColor: 0x66864a },
  { id: 'north-aspen', preset: 'Aspen Medium', seed: 31, height: 5.2, position: [0, 0, 7.3], rotationY: 1.1, leafColor: 0x789657 },
  { id: 'east-pine', preset: 'Pine Medium', seed: 46, height: 7.2, position: [7.4, 0, 1.8], rotationY: -0.5, leafColor: 0x496f50 },
]

function generateDemoTree(spec: DemoTreeSpec): Tree {
  const tree = new Tree()
  tree.loadPreset(spec.preset)
  tree.options.seed = spec.seed
  tree.options.leaves.tint = spec.leafColor
  tree.options.leaves.alphaTest = 0.5
  tree.generate()
  tree.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  const bounds = new THREE.Box3().setFromObject(tree)
  const generatedHeight = Math.max(0.001, bounds.max.y - bounds.min.y)
  const scale = spec.height / generatedHeight
  tree.scale.setScalar(scale)
  tree.position.set(...spec.position)
  tree.rotation.y = spec.rotationY
  tree.name = `Demo tree ${spec.id}`
  return tree
}

export function DemoTrees() {
  const trees = useMemo(() => treeSpecs.map((spec) => ({ id: spec.id, object: generateDemoTree(spec) })), [])
  return trees.map(({ id, object }) => <primitive key={id} object={object} />)
}
