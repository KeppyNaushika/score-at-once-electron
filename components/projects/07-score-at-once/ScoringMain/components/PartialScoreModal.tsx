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

interface PartialScoreModalProps {
  isOpen: boolean
  value: string
  maxPoints: number
  questionLabel: string
  onClose: () => void
  onChange?: (value: string) => void
}

export default function PartialScoreModal({
  isOpen,
  value,
  maxPoints,
  questionLabel,
  onClose,
  onChange,
}: PartialScoreModalProps) {
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
                <kbd className="rounded border bg-white px-2 py-1">F</kbd>{" "}
                部分点で確定
              </div>
              <div>
                <kbd className="rounded border bg-white px-2 py-1">J</kbd>{" "}
                保留で確定
              </div>
              <div>
                <kbd className="rounded border bg-white px-2 py-1">Escape</kbd>{" "}
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
                // F キーのエミュレート - 実際の処理はキーボードハンドラーで
                const event = new KeyboardEvent("keydown", {
                  key: "f",
                  code: "KeyF",
                  bubbles: true,
                })
                document.dispatchEvent(event)
              }}
            >
              部分点で確定 (F)
            </Button>
            <Button
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                // J キーのエミュレート
                const event = new KeyboardEvent("keydown", {
                  key: "j",
                  code: "KeyJ",
                  bubbles: true,
                })
                document.dispatchEvent(event)
              }}
            >
              保留で確定 (J)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
