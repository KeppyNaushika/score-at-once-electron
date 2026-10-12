import { useCallback, useMemo } from "react"
import { toast } from "sonner"

import {
  findQuestionScore,
  type StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import type { QuestionScoreRow } from "@/queries/scoring"
import { isStatusCompatibleWithScoringMethod } from "@/types/rubric.types"

import {
  POINT_VERDICT_ON_SCALE_NOTICE,
  SCALE_NOT_SELECTED_NOTICE,
} from "../scaleLevelMessages"
import {
  type ScaleLevelChoice,
  scaleLevelOfDigit,
} from "../utils/scaleLevelAppearance"
import { useScaleLevelWriter } from "./useScaleLevelWriter"

/** 今の設問の類型評価（`useScaleQuestion` が返すもののうち、採点の口が読むもの） */
export interface ScaleQuestionState {
  isScaleQuestion: boolean
  scaleLevels: readonly ScaleLevelChoice[]
  isScaleLevelsLoading: boolean
}

interface UseScaleScoringGateOptions {
  examId: string
  currentUserId: string
  currentCropRegionId: string | null
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  /** 設問ごとの採点行（採点者を問わない。類型を読むのは自分の行だけ） */
  questionScoresByCropRegionId: Map<string, QuestionScoreRow[]>
  scaleQuestion: ScaleQuestionState
  /** 選んでいる答案へ書き込み、次の答案・設問へ進む（`useBatchScoringWithProgress`） */
  applyWithProgress: (write: (answerIds: Set<string>) => void) => void
  /** 成績算出のロックで包む（`useGradeLock().guard`） */
  guardScoring: <Args extends unknown[]>(
    write: (...args: Args) => void
  ) => (...args: Args) => void
}

/**
 * 類型評価の設問での採点の口（docs/vlm-grading-design.md §4-8-5・§4-8-6）。
 *
 * - 類型を付ける（ボタン・数字キー）。書いたあとは採点キーと同じく次の答案へ進む
 * - 類型を付ける（マウスモードの類型のブラシ）。クリックした答案へ書き、選択も進みもしない
 * - 正答・誤答・部分点は付けない（キー・ボタン・クリック・ブラシのどこから来ても書かずに知らせる）。
 *   保留・無答・Wマーク・未採点は点の採点と同じ口で書く（main が類型を外す）
 */
export function useScaleScoringGate({
  examId,
  currentUserId,
  currentCropRegionId,
  studentAnswerImages,
  questionScoresByCropRegionId,
  scaleQuestion: { isScaleQuestion, scaleLevels, isScaleLevelsLoading },
  applyWithProgress,
  guardScoring,
}: UseScaleScoringGateOptions) {
  const writeScaleLevel = useScaleLevelWriter({
    examId,
    currentCropRegionId,
    studentAnswerImages,
  })

  /** 類型評価の設問に、その状態を付けてはいけないか（いけなければ知らせる） */
  const blocksStatusOnScale = useCallback(
    (status: string | null): boolean => {
      if (!isScaleQuestion || status === null) return false
      if (isStatusCompatibleWithScoringMethod("scale", status)) return false
      toast.info(POINT_VERDICT_ON_SCALE_NOTICE, { id: "scale-point-verdict" })
      return true
    },
    [isScaleQuestion]
  )

  /** 選んでいる答案にその類型を付けて、次の答案へ進む */
  const applyScaleLevel = useMemo(
    () =>
      guardScoring((scaleLevelId: string) => {
        applyWithProgress((answerIds) =>
          writeScaleLevel(scaleLevelId, answerIds)
        )
      }),
    [guardScoring, applyWithProgress, writeScaleLevel]
  )

  /**
   * 名指しした答案にその類型を付ける（選択によらず、次の答案へも進まない。マウスモードの類型のブラシ）。
   * ロックの包みと「いま採点した」印は呼び出し側が1つにして付ける（`useGuardedScoring`）
   */
  const writeScaleLevelTo = useCallback(
    (scaleLevelId: string, answerIds: readonly string[]) => {
      writeScaleLevel(scaleLevelId, new Set(answerIds))
    },
    [writeScaleLevel]
  )

  /** 受験者の、今の設問の自分の採点行の類型。採点行が無い・類型が付いていなければ null */
  const ownScaleLevelIdOf = useCallback(
    (examStudentId: string): string | null => {
      if (!currentCropRegionId) return null
      const ownScore = findQuestionScore(
        questionScoresByCropRegionId.get(currentCropRegionId) ?? [],
        examStudentId,
        currentUserId
      )
      return ownScore?.scaleLevelId ?? null
    },
    [currentCropRegionId, questionScoresByCropRegionId, currentUserId]
  )

  /**
   * 数字キーで類型を選ぶ（1 が先頭）。組が無ければ知らせ、0・小数点・類型の数を超える数字は
   * 何もしない（部分点の入力は始めない）
   */
  const applyScaleLevelOfDigit = useCallback(
    (key: string) => {
      if (scaleLevels.length === 0) {
        if (!isScaleLevelsLoading) {
          toast.warning(SCALE_NOT_SELECTED_NOTICE, { id: "scale-not-selected" })
        }
        return
      }
      const scaleLevel = scaleLevelOfDigit(scaleLevels, key)
      if (scaleLevel) applyScaleLevel(scaleLevel.id)
    },
    [scaleLevels, isScaleLevelsLoading, applyScaleLevel]
  )

  return {
    isScaleQuestion,
    blocksStatusOnScale,
    applyScaleLevel,
    applyScaleLevelOfDigit,
    writeScaleLevelTo,
    ownScaleLevelIdOf,
  }
}
