import { useMemo } from "react"

import { useGradeLock } from "@/components/common/grade-lock/GradeLockProvider"
import {
  type ScaleQuestionState,
  useScaleScoringGate,
} from "@/components/exams/07-score-at-once/ScaleLevel/hooks/useScaleScoringGate"
import { scoringStatusOfCall } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"

import { useBatchScoringWithProgress } from "./useBatchScoringWithProgress"
import { useClickAndMouseScoring } from "./useClickAndMouseScoring"
import { usePartialScore } from "./usePartialScore"
import { useScoringData } from "./useScoringData"

interface UseGuardedScoringOptions {
  scoringData: Parameters<typeof useScoringData>[0]
  progress: Omit<
    Parameters<typeof useBatchScoringWithProgress>[0],
    "handleBatchScore"
  >
  clickScoring: Omit<
    Parameters<typeof useClickAndMouseScoring>[0],
    "openPartialScoreModal" | "scoreAnswers"
  >
  currentCropRegion: Parameters<typeof usePartialScore>[0]["currentCropRegion"]
  /** 今の設問の類型評価（類型評価の設問では、正答・誤答・部分点を付けず数字キーで類型を選ぶ） */
  scaleQuestion: ScaleQuestionState
}

/**
 * 採点の口（キー操作・クリック・ブラシ・部分点）を、成績算出のロックで包んで揃える。
 *
 * 成績算出が使う試験は、試験ごとロックされる（layout の `GradeLockProvider`）。
 * 書き込みそのものは main が止めるが、採点の口はここでも包み、採点の後の自動進行や
 * モーダルまで止めて通知だけ出す。
 */
export function useGuardedScoring({
  scoringData,
  progress,
  clickScoring,
  currentCropRegion,
  scaleQuestion,
}: UseGuardedScoringOptions) {
  const { guard: guardScoring } = useGradeLock()

  const {
    handleBatchScore: handleBatchScoreUnguarded,
    calculateQuestionProgress,
  } = useScoringData(scoringData)
  const handleBatchScore = useMemo(
    () => guardScoring(handleBatchScoreUnguarded),
    [guardScoring, handleBatchScoreUnguarded]
  )

  const {
    applyWithProgress,
    handleBatchScoreWithProgress: handleBatchScoreWithProgressUnguarded,
  } = useBatchScoringWithProgress({ ...progress, handleBatchScore })

  /** 類型評価の設問での口（類型を付ける・正答などを止める） */
  const {
    isScaleQuestion,
    blocksStatusOnScale,
    applyScaleLevel,
    applyScaleLevelOfDigit,
  } = useScaleScoringGate({
    examId: scoringData.examId,
    currentCropRegionId: scoringData.currentCropRegionId,
    studentAnswerImages: scoringData.studentAnswerImages,
    scaleQuestion,
    applyWithProgress,
    guardScoring,
  })

  // ロック中は採点しないだけでなく、採点の後の自動進行もさせない。
  // 類型評価の設問の正答・誤答・部分点は、書かず進みもしない
  const handleBatchScoreWithProgress = useMemo(
    () =>
      guardScoring(
        (...args: Parameters<typeof handleBatchScoreWithProgressUnguarded>) => {
          if (blocksStatusOnScale(scoringStatusOfCall(args[0], args[1]))) {
            return
          }
          handleBatchScoreWithProgressUnguarded(...args)
        }
      ),
    [guardScoring, handleBatchScoreWithProgressUnguarded, blocksStatusOnScale]
  )

  const {
    partialScoreInput,
    showPartialScoreModal,
    openPartialScoreModal: openPartialScoreModalUnguarded,
    handlePartialScoreInput: handlePartialScoreInputUnguarded,
    handlePartialScoreConfirm,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
    handlePartialScoreChange,
  } = usePartialScore({
    selectedAnswers: progress.selectedAnswers,
    currentCropRegion,
    onBatchScore: handleBatchScoreWithProgress,
  })
  // 部分点の入力はモーダルを開くところから止める（開いても確定できないため）。
  // 類型評価の設問は部分点を持たないので開かない
  const openPartialScoreModal = useMemo(
    () =>
      guardScoring((targetAnswers?: Set<string>) => {
        if (blocksStatusOnScale("partial")) return
        openPartialScoreModalUnguarded(targetAnswers)
      }),
    [guardScoring, openPartialScoreModalUnguarded, blocksStatusOnScale]
  )
  // 数字キーは、類型評価の設問では類型を選び（1 が先頭）、ほかの設問では部分点の入力を始める
  const handlePartialScoreInput = useMemo(
    () =>
      guardScoring((key: string) => {
        if (isScaleQuestion) {
          applyScaleLevelOfDigit(key)
          return
        }
        handlePartialScoreInputUnguarded(key)
      }),
    [
      guardScoring,
      isScaleQuestion,
      applyScaleLevelOfDigit,
      handlePartialScoreInputUnguarded,
    ]
  )

  /**
   * 答案を採点し、「いま採点した」印も付ける（クリック・ブラシ・表示中の一括）。
   *
   * 印付けまでを1つにして包む。採点だけを包むと、ロック中に断った採点にも
   * 印が付き、採点していない答案が採点済みの並びへ寄せられる
   */
  const { setRecentlyScoredAnswers } = progress
  const scoreAnswers = useMemo(
    () =>
      guardScoring(
        (
          status: Parameters<typeof handleBatchScoreUnguarded>[0],
          answerIds: string[]
        ) => {
          if (blocksStatusOnScale(scoringStatusOfCall(status))) return
          handleBatchScoreUnguarded(status, null, null, new Set(answerIds))
          setRecentlyScoredAnswers((prev) => {
            const newSet = new Set(prev)
            answerIds.forEach((answerId) => newSet.add(answerId))
            return newSet
          })
        }
      ),
    [
      guardScoring,
      handleBatchScoreUnguarded,
      setRecentlyScoredAnswers,
      blocksStatusOnScale,
    ]
  )

  const {
    handleClickScoring,
    handleMouseScoring,
    handleBatchScoreVisibleUnscored,
    visibleUnscoredCount,
    hiddenUnscoredCount,
  } = useClickAndMouseScoring({
    ...clickScoring,
    openPartialScoreModal,
    scoreAnswers,
  })

  return {
    guardScoring,
    calculateQuestionProgress,
    handleBatchScoreWithProgress,
    applyScaleLevel,
    partialScoreInput,
    showPartialScoreModal,
    openPartialScoreModal,
    handlePartialScoreInput,
    handlePartialScoreConfirm,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
    handlePartialScoreChange,
    handleClickScoring,
    handleMouseScoring,
    handleBatchScoreVisibleUnscored,
    visibleUnscoredCount,
    hiddenUnscoredCount,
  }
}
