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
import type {
  PendingChange,
  ScoringDataOption,
} from "@/components/projects/06-student-answers/types"
import { AlertTriangle, FileEdit, Loader2 } from "lucide-react"
import { useState } from "react"

interface ConfirmChangesModalProps {
  isOpen: boolean
  onClose: () => void
  pendingChanges: PendingChange[]
  onConfirm: (option: ScoringDataOption) => Promise<void>
  onReset?: () => Promise<void>
}

export function ConfirmChangesModal({
  isOpen,
  onClose,
  pendingChanges,
  onConfirm,
  onReset,
}: ConfirmChangesModalProps) {
  const [selectedOption, setSelectedOption] =
    useState<ScoringDataOption>("with-scoring")
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
    onClose()
  }

  const handleReset = async () => {
    if (onReset) {
      await onReset()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
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
            <h4 className="text-sm font-medium text-gray-700">変更内容:</h4>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {pendingChanges.map((change, index) => (
                <div
                  key={change.id}
                  className="flex items-center gap-4 rounded-lg border bg-gray-50 p-3"
                >
                  <span className="min-w-7.5 font-mono text-sm text-gray-500">
                    #{index + 1}
                  </span>
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {change.fromPosition.studentName || "未割当"}
                        <span className="ml-1 text-gray-500">
                          P{change.fromPosition.pageNumber}
                        </span>
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="font-medium">
                        {change.toPosition.studentName || "未割当"}
                        <span className="ml-1 text-gray-500">
                          P{change.toPosition.pageNumber}
                        </span>
                      </span>
                      {change.targetFileId && (
                        <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
                          入れ替え
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 処理オプション選択 */}
          <div className="border-t pt-4">
            <Label className="mb-4 block text-base font-semibold">
              採点データの処理方法
            </Label>
            <RadioGroup
              value={selectedOption}
              onValueChange={(value) =>
                setSelectedOption(value as ScoringDataOption)
              }
              className="space-y-4"
            >
              {/* 推奨オプション: 採点情報も一緒に入れ替え */}
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem
                    value="with-scoring"
                    id="with-scoring"
                    className="mt-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor="with-scoring"
                      className="block cursor-pointer"
                    >
                      <div className="flex flex-wrap items-center gap-2 font-medium text-blue-800">
                        採点情報も一緒に入れ替え
                        <span className="shrink-0 rounded-full bg-blue-600 px-2 py-1 text-xs text-white">
                          推奨
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-blue-700">
                        答案画像と採点結果を正しく対応させます。論理的に一貫した処理です。
                      </div>
                    </Label>
                  </div>
                </div>
              </div>

              {/* 答案画像のみ入れ替え（警告付き） */}
              <div className="rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem
                    value="image-only"
                    id="image-only"
                    className="mt-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor="image-only"
                      className="block cursor-pointer"
                    >
                      <div className="flex flex-wrap items-center gap-2 font-medium text-orange-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        答案画像のみ入れ替え
                      </div>
                      <div className="mt-2 text-sm text-orange-700">
                        採点情報は元の位置に残します。
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-sm font-medium text-red-600">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        注意: 答案と評価結果の不整合が発生します
                      </div>
                    </Label>
                  </div>
                </div>
              </div>
            </RadioGroup>

            {/* 警告メッセージ（答案のみ選択時） */}
            {selectedOption === "image-only" && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 font-medium text-red-800">
                      ⚠️ データ整合性への影響
                    </div>
                    <ul className="space-y-2 text-sm text-red-700">
                      <li>• 生徒Aの答案に生徒Bの採点結果が紐づきます</li>
                      <li>• 採点結果と実際の答案内容が一致しなくなります</li>
                      <li>
                        • 成績データの信頼性に問題が生じる可能性があります
                      </li>
                    </ul>
                    <div className="mt-4 rounded border border-red-300 bg-red-100 p-3">
                      <div className="text-sm font-medium text-red-800">
                        推奨: 「採点情報も一緒に入れ替え」を選択してください
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isApplying}
          >
            キャンセル
          </Button>
          {onReset && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isApplying}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              リセット
            </Button>
          )}
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
            {selectedOption === "with-scoring"
              ? "採点情報込みで"
              : "答案画像のみ"}
            {pendingChanges.length}件を適用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
