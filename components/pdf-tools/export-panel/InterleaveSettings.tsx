"use client"

import { RotateCw, Settings2 } from "lucide-react"
import { useEffect, useRef } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type {
  FileTransform,
  ImportedFile,
  InterleaveConfig,
  NUpLayout,
  RotationDegree,
} from "@/types/pdfTools.types"

interface InterleaveSettingsProps {
  files: ImportedFile[]
  config: InterleaveConfig
  onConfigChange: (config: InterleaveConfig) => void
  disabled: boolean
}

/**
 * 交互挿入設定コンポーネント
 *
 * 複数ファイルの交互挿入設定（N-up、回転など）を管理する
 */
export default function InterleaveSettings({
  files,
  config,
  onConfigChange,
  disabled,
}: InterleaveSettingsProps) {
  // useRefで最新の値を保持（依存配列に入れずに最新値を参照するため）
  const configRef = useRef(config)
  configRef.current = config

  const onConfigChangeRef = useRef(onConfigChange)
  onConfigChangeRef.current = onConfigChange

  // ファイルが変更されたらtransformsを同期
  useEffect(() => {
    const currentConfig = configRef.current
    const currentFileIds = new Set(files.map((f) => f.id))
    const existingTransforms = currentConfig.transforms.filter((t) =>
      currentFileIds.has(t.fileId)
    )

    // 新しいファイルのデフォルト設定を追加
    const newTransforms: FileTransform[] = files
      .filter((f) => !existingTransforms.some((t) => t.fileId === f.id))
      .map((f) => ({
        fileId: f.id,
        nUp: { ...f.nUp },
        rotation: f.rotation,
        pagesPerGroup: 1,
      }))

    if (
      existingTransforms.length !== currentConfig.transforms.length ||
      newTransforms.length > 0
    ) {
      onConfigChangeRef.current({
        ...currentConfig,
        transforms: [...existingTransforms, ...newTransforms],
      })
    }
  }, [files])

  const handleEnabledChange = (enabled: boolean) => {
    onConfigChange({ ...config, enabled })
  }

  const handleTransformChange = (
    fileId: string,
    updates: Partial<FileTransform>
  ) => {
    onConfigChange({
      ...config,
      transforms: config.transforms.map((t) =>
        t.fileId === fileId ? { ...t, ...updates } : t
      ),
    })
  }

  if (files.length < 2) {
    return (
      <div className="text-muted-foreground text-sm">
        交互挿入には2つ以上のファイルが必要です
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">交互挿入を有効化</Label>
        <Switch
          checked={config.enabled}
          onCheckedChange={handleEnabledChange}
          disabled={disabled}
        />
      </div>

      {config.enabled && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            各ファイルの変換設定を個別に指定できます
          </p>
          {config.transforms.map((transform) => {
            const file = files.find((f) => f.id === transform.fileId)
            if (!file) return null

            return (
              <div
                key={transform.fileId}
                className="bg-card rounded-lg border p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Settings2 className="text-muted-foreground h-4 w-4" />
                  <span className="truncate text-sm font-medium">
                    {file.name}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={
                      transform.nUp.enabled ? transform.nUp.layout : "1in1"
                    }
                    onValueChange={(value) => {
                      const enabled = value !== "1in1"
                      const layout =
                        value === "1in1" ? "2x1" : (value as NUpLayout)
                      handleTransformChange(transform.fileId, {
                        nUp: { ...transform.nUp, enabled, layout },
                      })
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1in1">1in1</SelectItem>
                      <SelectItem value="2x1">2in1(横)</SelectItem>
                      <SelectItem value="1x2">2in1(縦)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={transform.rotation.toString()}
                    onValueChange={(value) => {
                      handleTransformChange(transform.fileId, {
                        rotation: parseInt(value) as RotationDegree,
                      })
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 w-20">
                      <RotateCw className="mr-1 h-3 w-3" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0°</SelectItem>
                      <SelectItem value="90">90°</SelectItem>
                      <SelectItem value="180">180°</SelectItem>
                      <SelectItem value="270">270°</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={transform.pagesPerGroup}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        if (val >= 1) {
                          handleTransformChange(transform.fileId, {
                            pagesPerGroup: val,
                          })
                        }
                      }}
                      className="h-8 w-14 text-center"
                      disabled={disabled}
                    />
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      頁/組
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
