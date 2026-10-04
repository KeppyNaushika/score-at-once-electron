/**
 * 成績算出エンジンの共有型
 * gradeCalculator / rawScoreCalculator / examScoreCalculator / absentEstimation で共有する。
 */

import type { Prisma } from "@prisma/client"

import type { AbsentMethod } from "../../../../src/types/grade.types"
import { subtotalWithQuestionAssignmentsInclude } from "../../prisma/cropSubtotal"
import type { QuestionScoreForSubtotal } from "./subtotalCalculator"

/**
 * 成績算出が読む対象者1行分の include。
 *
 * 上書き・確定値・除外設定は対象者の子なので、行と一緒に引けば「その対象者のセル」が
 * 経路上に必ず現れる。名簿に居ない生徒の設定を拾うことは構造的に起こらない（#962）。
 */
const gradeStudentForCalcInclude = {
  student: {
    include: {
      memberships: {
        include: { classroom: true },
      },
    },
  },
  overrides: true,
  frozenScores: true,
  itemExclusions: true,
} satisfies Prisma.GradeStudentInclude

/**
 * 成績算出が読む Grade 1件の include（評価項目・データソースと、その元データ）。
 *
 * 満点は元データからライブ算出する。その元データ（設問配点 / 評価項目満点）を
 * データソースの行に同梱し、算出のための追加クエリを立てない。
 */
const gradeForCalcInclude = {
  gradeClassrooms: {
    include: { classroom: true },
    orderBy: { order: "asc" },
  },
  gradeItems: {
    include: {
      dataSources: {
        include: {
          // 満点は元データからライブ算出する。その元データ（設問配点 / 評価項目満点）を
          // データソースの行に同梱し、算出のための追加クエリを立てない。
          exam: {
            include: {
              examPages: {
                include: {
                  cropRegions: { where: { type: "QUESTION_ANSWER" } },
                },
              },
            },
          },
          // 小計の設問割り当て。満点も素点もこの行から読む
          subtotal: { include: subtotalWithQuestionAssignmentsInclude },
          cropRegion: true,
          estimationSources: { orderBy: { order: "asc" } },
          // 点数は資料の対象者（CourseworkStudent）経由でのみ引ける。
          // 名簿から外された生徒の点数は存在しえないため算出に混ざらない（#962）。
          courseworkItem: {
            include: {
              scores: { include: { courseworkStudent: true } },
              letterScales: { orderBy: { order: "asc" } },
            },
          },
          coursework: {
            include: {
              items: {
                include: {
                  scores: { include: { courseworkStudent: true } },
                  letterScales: { orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
        orderBy: { order: "asc" },
      },
      boundaries: { orderBy: { order: "asc" } },
    },
    orderBy: { order: "asc" },
  },
} satisfies Prisma.GradeInclude

/**
 * **成績算出が DB から読むものの全部。** キーは Prisma の問い合わせ口（`prisma.<キー>`）、
 * 値はそこで使う include。
 *
 * 算出（`gradeCalculationContext.ts`）はここに無い問い合わせを立てない。成績算出のロック
 * （`electron-src/lib/prisma/gradeWriteLock.ts`）が、ここから「成績算出が読むテーブル」を
 * 型で導いて、ロック中の書き込みを止める。読むものを増やすときはここに足せば、ロックも
 * 追従する（足さずに `prisma.<別の口>` を呼ぶと規約テストが落ちる）。
 */
export const gradeCalculationReads = {
  grade: gradeForCalcInclude,
  gradeStudent: gradeStudentForCalcInclude,
  // 起点は ExamStudent（その試験の受験者）で、採点行はその子として引く
  examStudent: {
    questionScores: true,
    scoreDecisions: true,
  } satisfies Prisma.ExamStudentInclude,
  examPage: { cropRegions: true } satisfies Prisma.ExamPageInclude,
}

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
