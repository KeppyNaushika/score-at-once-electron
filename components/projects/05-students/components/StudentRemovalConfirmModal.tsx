"use client"

import { AlertTriangle, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface StudentRemovalConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  studentsToRemove: Array<{
    id: string
    studentNumber: string
    lastName: string
    firstName: string
    className: string
  }>
  hasGradingData: boolean
  gradingDataCount?: number
}

export default function StudentRemovalConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  studentsToRemove,
  hasGradingData,
  gradingDataCount = 0,
}: StudentRemovalConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-destructive h-5 w-5" />
            生徒の削除確認
          </DialogTitle>
          <DialogDescription>
            以下の生徒をプロジェクトから削除しようとしています。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 削除対象の生徒一覧 */}
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
            {studentsToRemove.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {student.lastName} {student.firstName}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {student.studentNumber}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {student.className}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* 採点データの警告 */}
          {hasGradingData && (
            <div className="bg-destructive/10 border-destructive/20 rounded-md border p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-2">
                  <h4 className="text-destructive font-medium">
                    採点データが存在します
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    削除する生徒には
                    <strong className="text-destructive">
                      {gradingDataCount}件の採点データ
                    </strong>
                    が関連付けられています。
                    生徒を削除すると、以下のデータも連動して削除されます：
                  </p>
                  <ul className="text-muted-foreground ml-4 space-y-1 text-sm">
                    <li>• 答案シート情報</li>
                    <li>• 採点結果・コメント</li>
                    <li>• 設問別得点記録</li>
                    <li>• 最終成績情報</li>
                  </ul>
                  <p className="text-destructive text-sm font-medium">
                    ※ この操作は取り消すことができません
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 採点データがない場合の確認 */}
          {!hasGradingData && (
            <div className="bg-muted/50 rounded-md border p-4">
              <div className="flex items-start gap-3">
                <Trash2 className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-medium">プロジェクトから削除</h4>
                  <p className="text-muted-foreground text-sm">
                    選択した生徒はプロジェクトから削除されますが、採点データがないため安全に削除できます。
                    生徒の基本情報は保持され、他のプロジェクトには影響しません。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="gap-2">
            <Trash2 className="h-4 w-4" />
            削除する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
