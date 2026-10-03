import { useMemo } from "react"

import { useGradeLock } from "@/components/common/grade-lock/GradeLockProvider"

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
    handleBatchScoreWithProgress: handleBatchScoreWithProgressUnguarded,
  } = useBatchScoringWithProgress({ ...progress, handleBatchScore })
  // ロック中は採点しないだけでなく、採点の後の自動進行もさせない
  const handleBatchScoreWithProgress = useMemo(
    () => guardScoring(handleBatchScoreWithProgressUnguarded),
    [guardScoring, handleBatchScoreWithProgressUnguarded]
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
  // 部分点の入力はモーダルを開くところから止める（開いても確定できないため）
  const openPartialScoreModal = useMemo(
    () => guardScoring(openPartialScoreModalUnguarded),
    [guardScoring, openPartialScoreModalUnguarded]
  )
  const handlePartialScoreInput = useMemo(
    () => guardScoring(handlePartialScoreInputUnguarded),
    [guardScoring, handlePartialScoreInputUnguarded]
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
          handleBatchScoreUnguarded(status, null, null, new Set(answerIds))
          setRecentlyScoredAnswers((prev) => {
            const newSet = new Set(prev)
            answerIds.forEach((answerId) => newSet.add(answerId))
            return newSet
          })
        }
      ),
    [guardScoring, handleBatchScoreUnguarded, setRecentlyScoredAnswers]
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
