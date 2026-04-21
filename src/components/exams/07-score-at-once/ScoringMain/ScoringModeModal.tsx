"use client"

import { Keyboard, Mouse } from "lucide-react"
import { useState } from "react"

import type { ScoringOperationMode } from "@/components/exams/07-score-at-once/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ScoringModeModalProps {
  open: boolean
  onSelect: (mode: ScoringOperationMode, remember: boolean) => void
  onClose: () => void
}

export function ScoringModeModal({
  open,
  onSelect,
  onClose,
}: ScoringModeModalProps) {
  const [remember, setRemember] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>採点操作モードを選択</DialogTitle>
          <DialogDescription>
            採点時の操作方法を選んでください。後からサイドパネルで切り替えられます。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* キーボードモード */}
          <Button
            variant="outline"
            className="flex h-32 flex-col items-center justify-center gap-3 border-2 hover:border-blue-500 hover:bg-blue-50"
            onClick={() => onSelect("keyboard", remember)}
          >
            <Keyboard className="h-10 w-10 text-blue-600" />
            <div className="text-center">
              <div className="font-medium">キーボード</div>
              <div className="mt-1 text-[10px] text-gray-500">
                選択してキーで採点
              </div>
            </div>
          </Button>

          {/* マウスモード */}
          <Button
            variant="outline"
            className="flex h-32 flex-col items-center justify-center gap-3 border-2 hover:border-green-500 hover:bg-green-50"
            onClick={() => onSelect("mouse", remember)}
          >
            <Mouse className="h-10 w-10 text-green-600" />
            <div className="text-center">
              <div className="font-medium">マウス</div>
              <div className="mt-1 text-[10px] text-gray-500">
                クリックで直接採点
              </div>
            </div>
          </Button>
        </div>

        <div className="flex items-center gap-2 border-t pt-3">
          <Checkbox
            id="remember-mode"
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
          />
          <label
            htmlFor="remember-mode"
            className="cursor-pointer text-sm text-gray-600"
          >
            この選択を記憶する
          </label>
        </div>
      </DialogContent>
    </Dialog>
  )
}
