import { useRef, useState } from 'react'
import type { ParsedPascalScene, PascalValidationResult } from '../scene/pascal/types'
import { DEMO_SCENE_SOURCE, IMPORTED_PASCAL_SCENE_SOURCE, type SceneSourceKind } from '../scene/SceneSource'
import { validatePascalJson } from '../scene/pascal/validatePascalJson'

interface PascalImportProps {
  importedScene: ParsedPascalScene | null
  sceneSource: SceneSourceKind
  onImported: (scene: ParsedPascalScene) => void
  onSceneSourceChange: (source: SceneSourceKind) => void
}

export function PascalImport({ importedScene, sceneSource, onImported, onSceneSourceChange }: PascalImportProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<PascalValidationResult | null>(null)

  const inspectFile = async (file: File) => {
    setFileName(file.name)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const nextResult = validatePascalJson(parsed)
      setResult(nextResult)
      if (nextResult.scene) onImported(nextResult.scene)
    } catch {
      setResult({ valid: false, scene: null, message: '所选文件不是有效的 JSON。' })
    }
  }

  const report = result?.scene?.report ?? importedScene?.report

  return (
    <div
      className="import-dropzone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const file = event.dataTransfer.files[0]
        if (file) void inspectFile(file)
      }}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void inspectFile(file)
          event.currentTarget.value = ''
        }}
      />
      <div className="scene-source-row">
        <button type="button" className={sceneSource === 'demo' ? 'source-active' : ''} onClick={() => onSceneSourceChange('demo')}>
          {DEMO_SCENE_SOURCE.label}
        </button>
        <button type="button" className={sceneSource === 'pascal' ? 'source-active' : ''} disabled={!importedScene} onClick={() => onSceneSourceChange('pascal')}>
          {IMPORTED_PASCAL_SCENE_SOURCE.label}
        </button>
      </div>
      <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>
        选择本地 Pascal JSON
      </button>
      <span>或将本地文件拖放到此处；文件不会上传</span>
      {fileName && <strong>{fileName}</strong>}
      {result && <p className={result.valid ? 'import-message valid' : 'import-message invalid'}>{result.message}</p>}
      {report && (
        <div className="import-result valid">
          <b>共 {report.totalNodes} 个节点</b>
          <dl className="import-summary">
            <div><dt>rendered</dt><dd>{report.rendered}</dd></div>
            <div><dt>approximate</dt><dd>{report.approximate}</dd></div>
            <div><dt>ignored</dt><dd>{report.ignored}</dd></div>
            <div><dt>unsupported</dt><dd>{report.unsupported}</dd></div>
            <div><dt>failed</dt><dd>{report.failed}</dd></div>
            <div><dt>warnings</dt><dd>{report.warnings.length}</dd></div>
          </dl>
          <details>
            <summary>查看节点类型明细</summary>
            <ul className="type-counts">
              {Object.entries(report.countsByType)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([type, count]) => <li key={type}>{type}: {count}</li>)}
            </ul>
          </details>
          {report.warnings.length > 0 && (
            <details>
              <summary>查看 warnings</summary>
              <ul>{report.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      <small>JSON 仅保存在当前浏览器内存中；刷新后请重新选择。</small>
    </div>
  )
}
