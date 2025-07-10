"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { PendingChange, ScoringDataOption } from "@/types/answer-sheet.types"
import { AlertTriangle, ArrowLeftRight, FileEdit, Loader2 } from "lucide-react"
import { useState } from "react"

interface ConfirmChangesModalProps {
  isOpen: boolean
  onClose: () => void
  pendingChanges: PendingChange[]
  onConfirm: (option: ScoringDataOption) => Promise<void>
}

export function ConfirmChangesModal({
  isOpen,
  onClose,
  pendingChanges,
  onConfirm,
}: ConfirmChangesModalProps) {
  const [selectedOption, setSelectedOption] = useState<ScoringDataOption>("with-scoring")
  const [isApplying, setIsApplying] = useState(false)

  const handleConfirm = async () => {
    setIsApplying(true)
    try {
      await onConfirm(selectedOption)
      onClose()
    } catch (error) {
      console.error("変更の適用に失敗しました:", error)
    } finally {
      setIsApplying(false)
    }
  }

  const handleCancel = () => {
    onConfirm("cancel")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5" />
            {pendingChanges.length}件の変更を適用
          </DialogTitle>
          <DialogDescription>
            以下の答案配置変更をデータベースに反映します。処理方法を選択してください。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 変更リスト */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-700">変更内容:</h4>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {pendingChanges.map((change, index) => (
                <div
                  key={change.id}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border"
                >
                  <span className="font-mono text-sm text-gray-500 min-w-[30px]">
                    #{index + 1}
                  </span>
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {change.position1.studentName || "未割当"} 
                        <span className="text-gray-500 ml-1">P{change.position1.pageNumber}</span>
                      </span>
                      <ArrowLeftRight className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="font-medium">
                        {change.position2.studentName || "未割当"}
                        <span className="text-gray-500 ml-1">P{change.position2.pageNumber}</span>
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {change.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 処理オプション選択 */}
          <div className="border-t pt-4">
            <Label className="text-base font-semibold mb-4 block">
              採点データの処理方法
            </Label>
            <RadioGroup
              value={selectedOption}
              onValueChange={(value) => setSelectedOption(value as ScoringDataOption)}
              className="space-y-4"
            >
              {/* 推奨オプション: 採点情報も一緒に入れ替え */}
              <div className="p-4 border-2 border-blue-200 bg-blue-50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="with-scoring" id="with-scoring" className="mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="with-scoring" className="cursor-pointer block">
                      <div className="font-medium text-blue-800 flex items-center gap-2 flex-wrap">
                        採点情報も一緒に入れ替え
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full flex-shrink-0">
                          推奨
                        </span>
                      </div>
                      <div className="text-sm text-blue-700 mt-2">
                        答案画像と採点結果を正しく対応させます。論理的に一貫した処理です。
                      </div>
                    </Label>
                  </div>
                </div>
              </div>

              {/* 答案画像のみ入れ替え（警告付き） */}
              <div className="p-4 border-2 border-orange-200 bg-orange-50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="image-only" id="image-only" className="mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="image-only" className="cursor-pointer block">
                      <div className="font-medium text-orange-800 flex items-center gap-2 flex-wrap">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        答案画像のみ入れ替え
                      </div>
                      <div className="text-sm text-orange-700 mt-2">
                        採点情報は元の位置に残します。
                      </div>
                      <div className="text-sm font-medium text-red-600 mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        注意: 答案と評価結果の不整合が発生します
                      </div>
                    </Label>
                  </div>
                </div>
              </div>
            </RadioGroup>

            {/* 警告メッセージ（答案のみ選択時） */}
            {selectedOption === "image-only" && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-red-800 mb-3">
                      ⚠️ データ整合性への影響
                    </div>
                    <ul className="text-red-700 space-y-2 text-sm">
                      <li>• 生徒Aの答案に生徒Bの採点結果が紐づきます</li>
                      <li>• 採点結果と実際の答案内容が一致しなくなります</li>
                      <li>• 成績データの信頼性に問題が生じる可能性があります</li>
                    </ul>
                    <div className="mt-4 p-3 bg-red-100 rounded border border-red-300">
                      <div className="text-red-800 font-medium text-sm">
                        推奨: 「採点情報も一緒に入れ替え」を選択してください
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isApplying}>
            キャンセル
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isApplying}
            className={
              selectedOption === "with-scoring"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-orange-600 hover:bg-orange-700"
            }
          >
            {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selectedOption === "with-scoring" ? "採点情報込みで" : "答案画像のみ"}
            {pendingChanges.length}件を適用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}