export interface SceneSourceDescriptor {
  id: string
  label: string
  kind: 'demo' | 'pascal'
  renderStatus: 'ready'
}

export type SceneSourceKind = SceneSourceDescriptor['kind']

export interface SceneBounds {
  min: [number, number, number]
  max: [number, number, number]
}

export const DEMO_SCENE_SOURCE: SceneSourceDescriptor = {
  id: 'simplified-two-storey-house',
  label: '示例建筑',
  kind: 'demo',
  renderStatus: 'ready',
}

export const IMPORTED_PASCAL_SCENE_SOURCE: SceneSourceDescriptor = {
  id: 'imported-pascal-json',
  label: '已导入 Pascal JSON',
  kind: 'pascal',
  renderStatus: 'ready',
}
