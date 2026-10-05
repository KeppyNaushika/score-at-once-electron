import { useMemo } from "react"

import { useGradeLock } from "@/components/common/grade-lock/GradeLockProvider"
import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import { useBatchScoring } from "@/components/exams/07-score-at-once/ScoringData/hooks/useBatchScoring"
import { KEYBOARD_ONLY_CONDITION } from "@/components/exams/07-score-at-once/ScoringMain/hooks/shortcuts/scoringShortcutConditions"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { AiGridItem } from "../types"
import { toStudentAnswerImageIds } from "../utils/aiGridItems"
import { AI_GRADING_MODE_CONDITION } from "./useAiGradingShortcuts"

interface UseAiOwnScoringOptions {
  examId: string
  currentUserId: string
  cropRegion: QuestionAnswerRegionRow
  /** 試験の答案すべて（一覧表示の一括採点が答案の id から受験者を引くのに使う） */
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  /** この設問の採点行（誰の分も。自分の行を探すのは一括採点） */
  questionScores: QuestionScoreRow[]
  selectedItems: readonly AiGridItem[]
  /** 採点のキーを効かせるか（左パネルで採点反映のタブを開いているときだけ） */
  isShortcutEnabled: boolean
  /** 採点した答案（一覧の id ＝ examStudentId）。絞り込みからすぐ消さないために使う */
  onScored: (examStudentIds: string[]) => void
}

/**
 * AI採点モードで、選んだ答案に**自分の採点**を直接書く（一覧表示と同じ書き込み）。
 *
 * 書き込みは一覧表示の一括採点（`useBatchScoring`）をそのまま使う。一括採点は答案画像の
 * id を受け取るので、一覧のマスの id（examStudentId）から答案画像の id へ読み替えて渡す。
 * 部分点・保留は一覧表示のキーと同じく、今の部分点を引き継ぐ（数字キーの部分点の入力欄は
 * 一覧表示の画面のもので、AI採点モードには無い）。
 *
 * キーは一覧表示と同じ割り当て（q e f j o p u）。一覧表示の登録は `hasSelectedAnswers`
 * を条件にしていて、AI採点モードでは偽なので重ならない
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

  const scoreSelected = guard((status: ScoringStatus) => {
    if (selectedItems.length === 0) return
    handleBatchScore(
      status,
      null,
      null,
      new Set(toStudentAnswerImageIds(selectedItems))
    )
    onScored(selectedItems.map((gridItem) => gridItem.id))
  })

  // 採点反映のタブを開いていないときは、条件を偽にして効かせない
  const condition = isShortcutEnabled
    ? `${AI_GRADING_MODE_CONDITION} && ${KEYBOARD_ONLY_CONDITION}`
    : "false"
  const options = (title: string) => ({
    condition,
    metadata: { title, category: "AI採点" },
  })
  useSceneCommand(
    "scoring.unscored",
    () => scoreSelected("unscored"),
    options("選んだ答案を自分の採点で未採点に")
  )
  useSceneCommand(
    "scoring.correct",
    () => scoreSelected("correct"),
    options("選んだ答案を自分の採点で正答に")
  )
  useSceneCommand("scoring.partial", () => scoreSelected("partial"), {
    scene: "scoring",
    ...options("選んだ答案を自分の採点で部分点に"),
  })
  useSceneCommand("scoring.pending", () => scoreSelected("pending"), {
    scene: "scoring",
    ...options("選んだ答案を自分の採点で保留に"),
  })
  useSceneCommand(
    "scoring.incorrect",
    () => scoreSelected("incorrect"),
    options("選んだ答案を自分の採点で誤答に")
  )
  useSceneCommand(
    "scoring.noAnswer",
    () => scoreSelected("no_answer"),
    options("選んだ答案を自分の採点で無答に")
  )
  useSceneCommand(
    "scoring.doubleMark",
    () => scoreSelected("double_mark"),
    options("選んだ答案を自分の採点で Wマークに")
  )

  return { scoreSelected }
}
