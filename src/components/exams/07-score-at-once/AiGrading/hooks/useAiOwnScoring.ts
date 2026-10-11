import { useMemo } from "react"

import { useGradeLock } from "@/components/common/grade-lock/GradeLockProvider"
import { useBatchScoring } from "@/components/exams/07-score-at-once/ScoringData/hooks/useBatchScoring"
import { KEYBOARD_ONLY_CONDITION } from "@/components/exams/07-score-at-once/ScoringMain/hooks/shortcuts/scoringShortcutConditions"
import { usePartialScoreShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/shortcuts/usePartialScoreShortcuts"
import { usePartialScore } from "@/components/exams/07-score-at-once/ScoringMain/hooks/usePartialScore"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { AiGridItem } from "../types"
import { toStudentAnswerImageIds } from "../utils/aiGridItems"
import { AI_GRADING_MODE_CONDITION } from "./useAiGradingShortcuts"
import { useStatusScoringCommands } from "./useAiScoringKeyCommands"

interface UseAiOwnScoringOptions {
  examId: string
  currentUserId: string
  cropRegion: QuestionAnswerRegionRow
  /** 試験の答案すべて（一覧表示の一括採点が答案の id から受験者を引くのに使う） */
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  /** この設問の採点行（誰の分も。自分の行を探すのは一括採点） */
  questionScores: QuestionScoreRow[]
  selectedItems: readonly AiGridItem[]
  /**
   * 採点のキーを効かせるか（左パネルで採点反映のタブを開いているときだけ。問いかけの中の採点キーは
   * 「1件ずつ自分で採点する」の下書きで、`useQuestioningManualKeys` が受ける）
   */
  isShortcutEnabled: boolean
  /**
   * 採点した答案（一覧の id ＝ examStudentId）。絞り込みからすぐ消さないことと、
   * 選択を次の答案へ移すことに使う（キー・ボタン・部分点の確定のどれでも呼ぶ。
   * 部分点の入力欄を Esc で閉じたときは呼ばない）
   */
  onScored: (examStudentIds: string[]) => void
}

/**
 * AI採点モードで、選んだ答案に**自分の採点**を直接書く（一覧表示と同じ書き込み）。
 *
 * 書き込みは一覧表示の一括採点（`useBatchScoring`）をそのまま使う。一括採点は答案画像の
 * id を受け取るので、一覧のマスの id（examStudentId）から答案画像の id へ読み替えて渡す。
 * F・J は一覧表示のキーと同じく、今の部分点を引き継ぐ。点を入れるのは一覧表示と同じ
 * 部分点の入力欄（`usePartialScore`）で、数字キーで開き、選んだ答案すべてに同じ点を書く。
 *
 * キーは一覧表示と同じ割り当て（q e f j o p u と数字・小数点）。一覧表示の登録は
 * `hasSelectedAnswers` を条件にしていて、AI採点モードでは偽なので重ならない。
 * 入力欄の中のキー（数字・F・J・Esc・Backspace）は一覧表示の登録もいつも載っているので、
 * AI採点モードの条件を足した、より具体的な登録として先に効かせる
 */
export function useAiOwnScoring({
  examId,
  currentUserId,
  cropRegion,
  studentAnswerImages,
  questionScores,
  selectedItems,
  isShortcutEnabled,
  onScored,
}: UseAiOwnScoringOptions) {
  const { guard } = useGradeLock()
  const cropRegions = useMemo(() => [cropRegion], [cropRegion])
  const questionScoresByCropRegionId = useMemo(
    () => new Map([[cropRegion.id, questionScores]]),
    [cropRegion.id, questionScores]
  )
  const { handleBatchScore } = useBatchScoring({
    examId,
    studentAnswerImages,
    cropRegions,
    questionScoresByCropRegionId,
    currentCropRegionId: cropRegion.id,
    currentUserId,
  })

  const selectedStudentAnswerImageIds = useMemo(
    () => new Set(toStudentAnswerImageIds(selectedItems)),
    [selectedItems]
  )

  const scoreSelected = guard((status: ScoringStatus) => {
    if (selectedItems.length === 0) return
    handleBatchScore(status, null, null, selectedStudentAnswerImageIds)
    onScored(selectedItems.map((gridItem) => gridItem.id))
  })

  // 部分点の入力欄（一覧表示と同じ）。確定すると、入れた点を選んだ答案すべてに書く
  const {
    openPartialScoreModal,
    handlePartialScoreInput,
    ...partialScoreModal
  } = usePartialScore({
    selectedAnswers: selectedStudentAnswerImageIds,
    currentCropRegion: cropRegion,
    onBatchScore: guard((status, score, partialScore, answerImageIds) => {
      handleBatchScore(status, score, partialScore, answerImageIds)
      onScored(selectedItems.map((gridItem) => gridItem.id))
    }),
  })
  // 一覧表示と同じく、ロック中は入力欄を開くところから止める（開いても確定できないため）
  const partialScore = {
    ...partialScoreModal,
    openPartialScoreModal: guard(() => openPartialScoreModal()),
    handlePartialScoreInput: guard(handlePartialScoreInput),
  }

  // 採点反映のタブを開いていないときは、条件を偽にして効かせない
  const condition = isShortcutEnabled
    ? `${AI_GRADING_MODE_CONDITION} && ${KEYBOARD_ONLY_CONDITION}`
    : "false"
  const options = (title: string) => ({
    condition,
    metadata: { title, category: "AI採点" },
  })
  useStatusScoringCommands(scoreSelected, "scoring", options)
  usePartialScoreShortcuts(
    {
      handlePartialScoreInput: partialScore.handlePartialScoreInput,
      handlePartialScoreConfirmPartial: () =>
        partialScore.handlePartialScoreConfirm("partial"),
      handlePartialScoreConfirmPending: () =>
        partialScore.handlePartialScoreConfirm("pending"),
      handlePartialScoreCancel: partialScore.handlePartialScoreCancel,
      handlePartialScoreBackspace: partialScore.handlePartialScoreBackspace,
    },
    { openCondition: condition, inputCondition: AI_GRADING_MODE_CONDITION }
  )

  return { scoreSelected, partialScore }
}
