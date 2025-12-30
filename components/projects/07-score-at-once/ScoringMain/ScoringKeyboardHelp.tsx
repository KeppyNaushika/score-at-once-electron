"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Keyboard } from "lucide-react"

interface ScoringKeyboardHelpProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  modifierKeyLabel: string
}

export default function ScoringKeyboardHelp({
  isOpen,
  onOpenChange,
  modifierKeyLabel,
}: ScoringKeyboardHelpProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Keyboard className="mr-2 h-4 w-4" />
          キーボード
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>キーボードショートカット</DialogTitle>
          <DialogDescription>
            効率的な採点のためのキーボードショートカット一覧
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="mb-3 font-medium">採点操作</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>未採点</span>
                <code className="rounded bg-gray-100 px-2 py-1">Q</code>
              </div>
              <div className="flex justify-between">
                <span>正答</span>
                <code className="rounded bg-gray-100 px-2 py-1">E</code>
              </div>
              <div className="flex justify-between">
                <span>部分点</span>
                <code className="rounded bg-gray-100 px-2 py-1">F</code>
              </div>
              <div className="flex justify-between">
                <span>保留</span>
                <code className="rounded bg-gray-100 px-2 py-1">J</code>
              </div>
              <div className="flex justify-between">
                <span>誤答</span>
                <code className="rounded bg-gray-100 px-2 py-1">O</code>
              </div>
              <div className="flex justify-between">
                <span>無答</span>
                <code className="rounded bg-gray-100 px-2 py-1">P</code>
              </div>
            </div>
          </div>
          <div>
            <h4 className="mb-3 font-medium">ナビゲーション</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>前の設問</span>
                <code className="rounded bg-gray-100 px-2 py-1">Shift+A</code>
              </div>
              <div className="flex justify-between">
                <span>次の設問</span>
                <code className="rounded bg-gray-100 px-2 py-1">Shift+D</code>
              </div>
              <div className="flex justify-between">
                <span>WASD移動</span>
                <code className="rounded bg-gray-100 px-2 py-1">WASD</code>
              </div>
              <div className="flex justify-between">
                <span>フィルタ更新</span>
                <code className="rounded bg-gray-100 px-2 py-1">R</code>
              </div>
              <div className="flex justify-between">
                <span>フィルタ切替</span>
                <code className="rounded bg-gray-100 px-2 py-1">
                  {modifierKeyLabel}+採点キー
                </code>
              </div>
              <div className="flex justify-between">
                <span>部分点入力</span>
                <code className="rounded bg-gray-100 px-2 py-1">0-9,.</code>
              </div>
              <div className="flex justify-between">
                <span>部分点リセット</span>
                <code className="rounded bg-gray-100 px-2 py-1">Backspace</code>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
