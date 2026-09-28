/**
 * 成績算出（Grade）で使われている試験・試験外成績資料のロックの型。
 *
 * 配点・受験状態・点数・評価項目の満点などは、変えるとそれを使う成績算出の点数が
 * 黙って変わる。どの欄が効くかを欄ごとに見分けると漏れる（設問の追加・種類の変更・
 * 答案の割り当て替えなども点数を変える）ので、使われている試験・資料は**まるごと**
 * ロックし、確認してから解除させる。
 *
 * 取るのは main（`electron-src/lib/prisma/gradeLockSource.ts`）で、試験・資料1件を
 * 使っているデータソースの一覧を返す。確認の文言は `src/lib/gradeLock.ts` が組み立てる。
 */

import type { GradeReferenceDataSourceType } from "./gradeReference.types"

/** 試験・資料を使っているデータソース1件（確認の表の1行の材料） */
export interface GradeLockSource {
  gradeId: string
  /** 成績算出の名前 */
  gradeName: string
  /** 成績算出の評価項目の名前 */
  gradeItemName: string
  dataSourceId: string
  /** データソースの名前 */
  dataSourceName: string
  dataSourceType: GradeReferenceDataSourceType
  /**
   * その評価項目で成績算出が確定済みの生徒の数（`GradeFrozenScore`）。0 なら未確定。
   * 確定済みなら値は残るが元データとずれる、と確認で言うのは、ここが 1 以上のときだけ
   */
  frozenScoreCount: number
}

/** ロックする単位（試験1件か、試験外成績資料1件） */
export type GradeLockTarget =
  | { kind: "exam"; examId: string }
  | { kind: "coursework"; courseworkId: string }
