export interface SceneSourceDescriptor {
  id: string
  label: string
  kind: 'demo' | 'pascal'
  renderStatus: 'ready' | 'diagnostic-only'
}

export const DEMO_SCENE_SOURCE: SceneSourceDescriptor = {
  id: 'simplified-two-storey-house',
  label: 'Simplified two-storey residence',
  kind: 'demo',
  renderStatus: 'ready',
}
