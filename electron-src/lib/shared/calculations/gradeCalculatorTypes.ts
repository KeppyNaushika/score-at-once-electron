/**
 * 成績算出エンジンの共有型
 * gradeCalculator / rawScoreCalculator / examScoreCalculator / absentEstimation で共有する。
 */

import type { Prisma } from "@prisma/client"

import type { AbsentMethod } from "../../../../src/types/grade.types"
import type { QuestionScoreForSubtotal } from "./subtotalCalculator"

/**
 * 成績算出が読む対象者1行分の include。
 *
 * 上書き・確定値・除外設定は対象者の子なので、行と一緒に引けば「その対象者のセル」が
 * 経路上に必ず現れる。名簿に居ない生徒の設定を拾うことは構造的に起こらない（#962）。
 */
export const gradeStudentForCalcInclude = {
  student: {
    include: {
      memberships: {
        include: { classroom: { select: { id: true, name: true } } },
      },
    },
  },
  overrides: true,
  frozenScores: true,
  itemExclusions: true,
} satisfies Prisma.GradeStudentInclude

/** 成績算出のループ軸となる対象者1行（人・所属・セル設定つき） */
export type GradeStudentForCalc = Prisma.GradeStudentGetPayload<{
  include: typeof gradeStudentForCalcInclude
}>

/**
 * 試験の受験者1人分の解決済みスコア。
 *
 * 成績算出のループ軸は Student（試験横断で同一人物を追う）なので、この行が
 * 「その人がその試験を受験しているか」の解決結果そのものになる。
 * ここに現れない生徒はその試験を受験していない＝データなしであり、
 * 採点データだけが残っている孤児を拾うことは構造的に起こらない。
 */
export interface ExamStudentScores {
  examStudentId: string
  studentId: string
  /** 受験状態（participating | expected | absent）。見込→欠測の判定に使う */
  status: string
  questionScores: QuestionScoreForSubtotal[]
}

/**
 * 試験ごとに事前取得したスコア・領域データ（生徒ループ外で1回だけ構築）
 */
export interface ExamDataCache {
  examStudents: ExamStudentScores[]
  cropRegions: { id: string; type: string; points: number | null }[]
}

/**
 * 欠測推定で参照するDataSource情報（満点はライブ算出済みの値）
 */
export interface DataSourceInfo {
  id: string
  name: string
  maxScore: number
  absentMethod: AbsentMethod
  absentRatio: number
  absentOffset: number
  estimationMode: string
  estimationSourceIds: string[]
}
