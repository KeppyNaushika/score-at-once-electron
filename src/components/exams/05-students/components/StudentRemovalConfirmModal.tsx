"use client"

import { useQuery } from "@tanstack/react-query"

import { CautionNotice } from "@/components/common/CautionNotice"
import { ConfirmationTitleRow } from "@/components/common/ConfirmationTitleRow"
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
import {
  buildRosterRemovalWarning,
  examUsingDataSources,
} from "@/lib/shared/gradeReferenceMessages"
import { examDetailQuery } from "@/queries/exam"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface StudentRemovalConfirmModalProps {
  /** 成績算出で使われていれば、外した生徒の点数が欠測になることを見せる */
  examId: string
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  studentsToRemove: ExamStudentWithMemberships[]
  /** ExamClassroom 由来の表示学級情報（studentId キーの side data） */
  placementByStudent: Record<string, ExamClassroomPlacement>
  /**
   * 巻き添えになるものの件数。数え終わるまでと、数えられなかったときは null。
   * この配列がそのまま削除の要求へ添えられる（見せたものと送るものが同じ）
   */
  deletionCounts: ConfirmedDeletionCount[] | null
  /** 押せるか（数え終わっていて削除中でない） */
  canConfirm: boolean
  /** 数え直しで増えていて中止されたときの文言 */
  refusalMessage: string | null
}

export default function StudentRemovalConfirmModal({
  examId,
  isOpen,
  onClose,
  onConfirm,
  studentsToRemove,
  placementByStudent,
  deletionCounts,
  canConfirm,
  refusalMessage,
}: StudentRemovalConfirmModalProps) {
  // この試験を使っている成績算出。外した生徒の点数はそこで欠測になる
  // （使っているデータソースは試験の詳細に同梱してある）
  const examDetail = useQuery({
    ...examDetailQuery(examId),
    enabled: isOpen,
  })
  const gradeWarning = examDetail.data
    ? buildRosterRemovalWarning("exam", examUsingDataSources(examDetail.data))
    : null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <ConfirmationTitleRow variant="destructive">
            <DialogTitle>受験生徒の登録を外しますか？</DialogTitle>
          </ConfirmationTitleRow>
          <DialogDescription>
            以下の生徒の、この試験への登録を外します。
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
                      ?.name ?? "未在籍"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* 採点データの警告 */}
          {deletionCounts !== null && deletionCounts.length > 0 && (
            <div className="space-y-2 text-sm">
              <p>
                {`登録を外す生徒には${deletionCounts
                  .map(
                    (deletionCount) =>
                      `${deletionCount.countedName}${deletionCount.shownCount}件`
                  )
                  .join("、")}があります。登録を外すと、以下も削除されます：`}
              </p>
              <ul className="pl-4 text-muted-foreground">
                <li>・答案シート情報</li>
                <li>・採点結果・コメント</li>
                <li>・設問別得点記録</li>
                <li>・最終成績情報</li>
              </ul>
              <p className="font-medium">
                この操作は元に戻すことができません。
              </p>
            </div>
          )}

          {/* 採点データがない場合の確認 */}
          {deletionCounts !== null && deletionCounts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              採点データがないため、安全に外せます。生徒の基本情報は保持され、他の試験には影響しません。
            </p>
          )}
        </div>

        {gradeWarning && <CautionNotice>{gradeWarning}</CautionNotice>}

        {/* 数えている途中・数えられなかったとき。件数不明のまま押させない */}
        {deletionCounts === null && (
          <p className="text-sm text-muted-foreground">
            消えるものを数えています…（数え終わるまで登録を外せません）
          </p>
        )}

        {/* 数えた後に他の教員が書き足していれば main が中止する。閉じずに
            数え直した結果を見せ、利用者にもう一度決めてもらう */}
        {refusalMessage && (
          <p className="rounded bg-amber-50 p-3 text-sm font-medium text-amber-900">
            {refusalMessage}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            // 試験の詳細が読めるまでは押させない（影響を見せる前に消さない）
            disabled={!canConfirm || examDetail.isPending}
          >
            登録を外す
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
