import { useRef, useState } from 'react'
import type { PascalValidationResult } from '../scene/pascal/types'
import { validatePascalJson } from '../scene/pascal/validatePascalJson'

export function PascalImport() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<PascalValidationResult | null>(null)

  const inspectFile = async (file: File) => {
    setFileName(file.name)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      setResult(validatePascalJson(parsed))
    } catch {
      setResult({ valid: false, summary: null, message: '所选文件不是有效的 JSON。' })
    }
  }

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
        }}
      />
      <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>
        导入 Pascal JSON
      </button>
      <span>或将本地文件拖放到此处</span>
      {fileName && <strong>{fileName}</strong>}
      {result && (
        <div className={result.valid ? 'import-result valid' : 'import-result invalid'}>
          <p>{result.message}</p>
          {result.summary && (
            <>
              <b>共 {result.summary.totalNodes} 个节点</b>
              <ul>
                {Object.entries(result.summary.countsByType)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([type, count]) => <li key={type}>{type}: {count}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
      <small>Pascal 几何渲染将在下一个里程碑中实现。</small>
    </div>
  )
}
