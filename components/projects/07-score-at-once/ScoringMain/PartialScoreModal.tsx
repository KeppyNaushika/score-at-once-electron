"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useCallback } from "react"

/** キーバインディングの型 */
interface KeyBindings {
  partialKey?: string
  pendingKey?: string
  cancelKey?: string
}

/** キー表示を整形する */
function formatKeyDisplay(key: string | undefined): string {
  if (!key) return ""
  // 小文字キーは大文字に変換して表示
  if (key.length === 1) {
    return key.toUpperCase()
  }
  return key
}

interface PartialScoreModalProps {
  isOpen: boolean
  value: string
  maxPoints: number
  questionLabel: string
  onClose: () => void
  onChange?: (value: string) => void
  onConfirmPartial?: () => void
  onConfirmPending?: () => void
  keyBindings?: KeyBindings
}

export default function PartialScoreModal({
  isOpen,
  value,
  maxPoints,
  questionLabel,
  onClose,
  onChange,
  onConfirmPartial,
  onConfirmPending,
  keyBindings,
}: PartialScoreModalProps) {
  // デフォルト値を設定
  const partialKey = keyBindings?.partialKey || "f"
  const pendingKey = keyBindings?.pendingKey || "j"
  const cancelKey = keyBindings?.cancelKey || "Escape"

  const partialKeyDisplay = formatKeyDisplay(partialKey)
  const pendingKeyDisplay = formatKeyDisplay(pendingKey)
  const cancelKeyDisplay = formatKeyDisplay(cancelKey)

  /** Input内でのキーボードハンドラー */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const key = e.key.toLowerCase()

      // 部分点確定キー
      if (key === partialKey.toLowerCase()) {
        e.preventDefault()
        e.stopPropagation()
        onConfirmPartial?.()
        return
      }

      // 保留確定キー
      if (key === pendingKey.toLowerCase()) {
        e.preventDefault()
        e.stopPropagation()
        onConfirmPending?.()
        return
      }

      // キャンセルキー
      if (e.key === cancelKey) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
    },
    [
      partialKey,
      pendingKey,
      cancelKey,
      onConfirmPartial,
      onConfirmPending,
      onClose,
    ]
  )
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            部分点入力
            <Badge variant="outline">
              問{questionLabel} ({maxPoints}点満点)
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 入力表示エリア */}
          <div className="relative">
            <Input
              value={value}
              className="h-16 border-blue-300 bg-blue-50 text-center font-mono text-2xl text-blue-700"
              placeholder="0"
              onChange={(e) => {
                if (onChange) {
                  onChange(e.target.value)
                }
              }}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {value.endsWith(".") && (
              <div className="absolute top-1/2 right-4 -translate-y-1/2 transform animate-pulse text-2xl text-blue-500">
                ●
              </div>
            )}
          </div>

          {/* キーボードガイド */}
          <div className="space-y-2 rounded-lg bg-gray-50 p-4">
            <div className="text-sm font-medium text-gray-700">
              キーボード操作:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <kbd className="rounded border bg-white px-2 py-1">0-9, .</kbd>{" "}
                入力
              </div>
              <div>
                <kbd className="rounded border bg-white px-2 py-1">
                  Backspace
                </kbd>{" "}
                削除
              </div>
              <div>
                <kbd className="rounded border bg-white px-2 py-1">
                  {partialKeyDisplay}
                </kbd>{" "}
                部分点で確定
              </div>
              <div>
                <kbd className="rounded border bg-white px-2 py-1">
                  {pendingKeyDisplay}
                </kbd>{" "}
                保留で確定
              </div>
              <div>
                <kbd className="rounded border bg-white px-2 py-1">
                  {cancelKeyDisplay}
                </kbd>{" "}
                キャンセル
              </div>
            </div>
          </div>

          {/* 確認ボタン（マウス操作用） */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              variant="default"
              className="bg-yellow-600 hover:bg-yellow-700"
              onClick={() => {
                if (onConfirmPartial) {
                  onConfirmPartial()
                }
              }}
            >
              部分点で確定 ({partialKeyDisplay})
            </Button>
            <Button
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                if (onConfirmPending) {
                  onConfirmPending()
                }
              }}
            >
              保留で確定 ({pendingKeyDisplay})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
