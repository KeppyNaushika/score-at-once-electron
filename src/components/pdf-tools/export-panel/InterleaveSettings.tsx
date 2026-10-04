"use client"

import { Settings2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import type {
  FileTransform,
  ImportedFile,
  InterleaveConfig,
} from "@/types/pdfTools.types"

import FileLayoutSettings from "../FileLayoutSettings"

interface InterleaveSettingsProps {
  files: ImportedFile[]
  config: InterleaveConfig
  onConfigChange: (config: InterleaveConfig) => void
  /** N-up・回転の変更。ファイルの設定を直接書き換える（左のファイル欄と共通） */
  onFileUpdated: (file: ImportedFile) => void
  disabled: boolean
}

/**
 * 交互挿入設定コンポーネント
 *
 * 複数ファイルの交互挿入設定を管理する。1回に入れるページ数は交互挿入に固有の設定、
 * N-up・回転はファイルの設定（左のファイル欄と同じ値）を表示・変更する。
 * ファイルの増減に伴う設定の増減は、取り込み・削除のときに親が行う（`PdfToolsMainView`）。
 */
export default function InterleaveSettings({
  files,
  config,
  onConfigChange,
  onFileUpdated,
  disabled,
}: InterleaveSettingsProps) {
  const handleTransformChange = (
    fileId: string,
    updates: Partial<FileTransform>
  ) => {
    onConfigChange({
      ...config,
      transforms: config.transforms.map((transform) =>
        transform.fileId === fileId ? { ...transform, ...updates } : transform
      ),
    })
  }

  if (files.length < 2) {
    return (
      <div className="text-sm text-muted-foreground">
        交互挿入には2つ以上のファイルが必要です
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        N-up・回転は左のファイルの設定と共通です。頁/組をN-upの枚数に合わせると、面ごとに交互になります
      </p>
      {config.transforms.map((transform) => {
        const file = files.find(
          (candidateFile) => candidateFile.id === transform.fileId
        )
        if (!file) return null

        return (
          // ファイル名と設定を1行に並べる。ファイル名は残りの幅に縮めて切り詰め、設定が
          // 入りきらないときだけ設定を折り返す（なるべく1ファイル1段で済ませる）
          <div
            key={transform.fileId}
            className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2"
          >
            <div
              className="flex min-w-20 flex-1 basis-20 items-center gap-2"
              title={file.name}
            >
              <Settings2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{file.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FileLayoutSettings
                file={file}
                onFileUpdated={onFileUpdated}
                disabled={disabled}
              />

              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={transform.pagesPerGroup}
                  onChange={(e) => {
                    const pagesPerGroup = parseInt(e.target.value)
                    if (pagesPerGroup >= 1) {
                      handleTransformChange(transform.fileId, {
                        pagesPerGroup,
                      })
                    }
                  }}
                  className="h-8 w-12 text-center"
                  disabled={disabled}
                />
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                  頁/組
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
