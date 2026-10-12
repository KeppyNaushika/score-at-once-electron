import { useMutation } from "@tanstack/react-query"
import { useCallback } from "react"

import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import { setScaleLevelsMutation } from "@/queries/scoring"

interface UseScaleLevelWriterOptions {
  examId: string
  currentCropRegionId: string | null
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
}

/**
 * 選んだ答案に類型を付ける書き込み（docs/vlm-grading-design.md §4-8-8）。
 *
 * 答案 id から受験者を引いて、今の設問へ1回でまとめて書く。書くのは今の利用者の採点行だけで、
 * 楽観更新は持たない（採点キーの書き込みと同じく、取り直しで画面が追いつく）
 */
export function useScaleLevelWriter({
  examId,
  currentCropRegionId,
  studentAnswerImages,
}: UseScaleLevelWriterOptions) {
  // 設問が決まっていないときは採点そのものが起きないので、鍵は使われない
  const cropRegionId = currentCropRegionId ?? ""
  const { mutateAsync: setScaleLevels } = useMutation(
    setScaleLevelsMutation(examId, cropRegionId)
  )

  return useCallback(
    (scaleLevelId: string, answerIds: ReadonlySet<string>) => {
      if (!currentCropRegionId) return
      const examStudentIds = [
        ...new Set(
          studentAnswerImages
            .filter((answerImage) => answerIds.has(answerImage.id))
            .map((answerImage) => answerImage.examStudentId)
        ),
      ]
      if (examStudentIds.length === 0) return
      setScaleLevels({
        cropRegionId: currentCropRegionId,
        examStudentIds,
        scaleLevelId,
      }).catch(() => {
        // 失敗の通知と取り直しは MutationCache の後始末が担う
      })
    },
    [currentCropRegionId, studentAnswerImages, setScaleLevels]
  )
}
