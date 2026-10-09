import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import type {
  MasterGridItem,
  ScoringData,
} from "@/components/exams/07-score-at-once/types"
import { useExamDecisionSummary } from "@/hooks/useExamDecisionSummary"
import { toAppImageUrl } from "@/lib/appImageUrl"
import { questionAnswerRegionsQuery } from "@/queries/cropRegion"
import { examWithPagesQuery, studentAnswerImagesQuery } from "@/queries/exam"
import type {
  ScoreDecisionCell,
  ScoreDecisionQuestion,
} from "@/types/scoreDecision.types"

/**
 * 一覧の1マス。07 の答案（`ScoringData`）に、裁定の材料（セル）を同梱する。
 *
 * **id は受験者の id。** 一覧は設問1つぶんなので受験者で一意に決まり、選択・移動・
 * 確定の書き込み先がすべてこの id から引ける（答案画像の id を経由しない）。
 */
export interface DecisionGridItem extends ScoringData {
  cell: ScoreDecisionCell
}

/**
 * 「8. 採点確定」の画面が読むデータ。裁定サマリに、07 と同じキャッシュの
 * 答案画像・採点領域・模範解答を画面側で突き合わせる（main では結合しない）。
 *
 * @param selectedCropRegionId 利用者が選んだ設問（未選択なら null）。一覧から
 *   消えた設問を指していれば、要裁定が残る先頭の設問へ寄せる
 */
export function useFinalizeData(
  examId: string,
  userId: string,
  selectedCropRegionId: string | null
) {
  // この画面は裁定のために開いた画面なので、常に取る。07 が「メンバー1人なら
  // 引かない」と絞っているのは、採点のたびに全採点行を走査させないためであって、
  // ここでは引かないと画面に出すものが無くなる
  const { summary, loading, error, refresh } = useExamDecisionSummary(
    examId,
    userId,
    true
  )
  const { data: exam } = useQuery({
    ...examWithPagesQuery(examId),
    enabled: Boolean(examId),
  })
  const { data: studentAnswerImages = [] } = useQuery({
    ...studentAnswerImagesQuery(examId),
    enabled: Boolean(examId),
  })
  const { data: cropRegions = [] } = useQuery({
    ...questionAnswerRegionsQuery(examId),
    enabled: Boolean(examId),
  })

  /** 一覧に載るセルがある設問（設問の並び順のまま） */
  const decisionQuestions = useMemo(
    () =>
      (summary?.questions ?? []).filter(
        (question) => question.cells.length > 0
      ),
    [summary]
  )

  /** 設問の切り替え・移動が読む採点領域（一覧に載るセルがある設問だけ） */
  const decisionCropRegions = useMemo(
    () =>
      decisionQuestions.flatMap((question) => {
        const cropRegion = cropRegions.find(
          (candidate) => candidate.id === question.cropRegionId
        )
        return cropRegion ? [cropRegion] : []
      }),
    [decisionQuestions, cropRegions]
  )

  // 選択は「利用者が選んだ設問」だけを持ち、開く設問はそこから引き直す
  // （消えた設問を状態へ書き戻すと、裁定のたびに再描画が二重に走る）
  const currentCropRegionId =
    (
      decisionQuestions.find(
        (question) => question.cropRegionId === selectedCropRegionId
      ) ??
      decisionQuestions.find((question) =>
        question.cells.some((cell) => cell.reason !== "decided")
      ) ??
      decisionQuestions[0]
    )?.cropRegionId ?? null

  const currentQuestion: ScoreDecisionQuestion | null =
    decisionQuestions.find(
      (question) => question.cropRegionId === currentCropRegionId
    ) ?? null
  const currentCropRegion =
    decisionCropRegions.find(
      (cropRegion) => cropRegion.id === currentCropRegionId
    ) ?? null

  /** いまの設問の一覧（受験生徒順。並びはサマリが決めている） */
  const gridItems = useMemo((): DecisionGridItem[] => {
    if (!currentQuestion || !currentCropRegion) return []
    return currentQuestion.cells.map((cell) => {
      const answerImage = studentAnswerImages.find(
        (image) =>
          image.examStudentId === cell.examStudentId &&
          image.examPageId === currentCropRegion.examPageId
      )
      return {
        id: cell.examStudentId,
        examStudentId: cell.examStudentId,
        studentName: cell.studentName,
        imageUrl: answerImage?.imagePath
          ? toAppImageUrl(answerImage.imagePath)
          : "",
        // 枠の色は「いま出力される結果」。未解決の食い違いは出力でも未採点になる
        status: cell.decision?.verdict ?? "unscored",
        currentScore: cell.decision?.score ?? undefined,
        maxScore: currentQuestion.maxScore,
        questionRegion: currentCropRegion,
        customOrder: answerImage?.examStudent.customOrder ?? 999999,
        cell,
      }
    })
  }, [currentQuestion, currentCropRegion, studentAnswerImages])

  /** 先頭に置く模範解答（07 の一覧と同じ） */
  const masterAnswerData = useMemo((): MasterGridItem | null => {
    if (!currentCropRegion || !exam?.examPages) return null
    const examPage = exam.examPages.find(
      (page) => page.id === currentCropRegion.examPageId
    )
    if (!examPage) return null
    return {
      id: `master-${currentCropRegion.id}`,
      examStudentId: "MASTER",
      studentName: "模範解答",
      imageUrl: examPage.imagePath ? toAppImageUrl(examPage.imagePath) : "",
      maxScore: currentCropRegion.points || 0,
      status: "master",
      questionRegion: currentCropRegion,
      customOrder: -1,
      isMaster: true,
    }
  }, [currentCropRegion, exam])

  return {
    exam,
    summary,
    loading,
    error,
    refresh,
    decisionQuestions,
    decisionCropRegions,
    currentCropRegionId,
    currentQuestion,
    currentCropRegion,
    gridItems,
    masterAnswerData,
  }
}
