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
import type { ExamClassroomPlacement } from "@/lib/examClassroomPlacement"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface StudentRemovalConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  studentsToRemove: ExamStudentWithMemberships[]
  /** ExamClassroom 由来の表示学級情報（studentId キーの side data） */
  placementByStudent: Record<string, ExamClassroomPlacement>
  hasGradingData: boolean
  gradingDataCount?: number
}

export default function StudentRemovalConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  studentsToRemove,
  placementByStudent,
  hasGradingData,
  gradingDataCount = 0,
}: StudentRemovalConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            生徒の削除確認
          </DialogTitle>
          <DialogDescription>
            以下の生徒を試験から削除しようとしています。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 削除対象の生徒一覧 */}
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
            {studentsToRemove.map((examStudent) => (
              <div
                key={examStudent.studentId}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {examStudent.student.lastName} {examStudent.student.firstName}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {examStudent.student.studentNumber}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {placementByStudent[examStudent.studentId]?.classroom
                      ?.name ?? "未所属"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* 採点データの警告 */}
          {hasGradingData && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="space-y-2">
                  <h4 className="font-medium text-destructive">
                    採点データが存在します
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    削除する生徒には
                    <strong className="text-destructive">
                      {gradingDataCount}件の採点データ
                    </strong>
                    が関連付けられています。
                    生徒を削除すると、以下のデータも連動して削除されます：
                  </p>
                  <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
                    <li>• 答案シート情報</li>
                    <li>• 採点結果・コメント</li>
                    <li>• 設問別得点記録</li>
                    <li>• 最終成績情報</li>
                  </ul>
                  <p className="text-sm font-medium text-destructive">
                    ※ この操作は取り消すことができません
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 採点データがない場合の確認 */}
          {!hasGradingData && (
            <div className="rounded-md border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="space-y-1">
                  <h4 className="font-medium">試験から削除</h4>
                  <p className="text-sm text-muted-foreground">
                    選択した生徒は試験から削除されますが、採点データがないため安全に削除できます。
                    生徒の基本情報は保持され、他の試験には影響しません。
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
