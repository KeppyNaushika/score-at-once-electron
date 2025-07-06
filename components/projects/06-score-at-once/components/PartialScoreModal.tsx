"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface PartialScoreModalProps {
  isOpen: boolean
  value: string
  maxPoints: number
  questionNumber: string
  onClose: () => void
}

export default function PartialScoreModal({
  isOpen,
  value,
  maxPoints,
  questionNumber,
  onClose,
}: PartialScoreModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            部分点入力
            <Badge variant="outline">
              {questionNumber} ({maxPoints}点満点)
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 入力表示エリア */}
          <div className="relative">
            <Input
              value={value}
              readOnly
              className="text-2xl text-center font-mono h-16 text-blue-700 bg-blue-50 border-blue-300"
              placeholder="0"
            />
            {value.endsWith(".") && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-500 text-2xl animate-pulse">
                ●
              </div>
            )}
          </div>

          {/* キーボードガイド */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="text-sm font-medium text-gray-700">キーボード操作:</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <kbd className="bg-white px-2 py-1 rounded border">0-9, .</kbd> 入力
              </div>
              <div>
                <kbd className="bg-white px-2 py-1 rounded border">Backspace</kbd> 削除
              </div>
              <div>
                <kbd className="bg-white px-2 py-1 rounded border">F</kbd> 部分点で確定
              </div>
              <div>
                <kbd className="bg-white px-2 py-1 rounded border">J</kbd> 保留で確定
              </div>
              <div>
                <kbd className="bg-white px-2 py-1 rounded border">Escape</kbd> キャンセル
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
                const event = new KeyboardEvent('keydown', {
                  key: 'f',
                  code: 'KeyF',
                  bubbles: true
                });
                document.dispatchEvent(event);
              }}
            >
              部分点で確定 (F)
            </Button>
            <Button 
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                // J キーのエミュレート
                const event = new KeyboardEvent('keydown', {
                  key: 'j',
                  code: 'KeyJ',
                  bubbles: true
                });
                document.dispatchEvent(event);
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