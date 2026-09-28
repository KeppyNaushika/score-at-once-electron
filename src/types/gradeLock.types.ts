/**
 * 成績算出（Grade）で使われている値の編集欄に付けるロックの型。
 *
 * 配点・評価項目の満点・受験状態・点数などは、変えるとそれを使う成績算出の点数が
 * 黙って変わる。使われている欄だけにロックを出し、確認してから解除させる。
 *
 * 取るのは main（`electron-src/lib/prisma/gradeLockSource.ts`）で、試験・資料1件ぶんを
 * まとめて返す（一覧の行ごとに IPC を打たないため）。どの行・列がロックされるかの判定は
 * `src/lib/gradeLock.ts`、確認の文言は同じファイルが組み立てる。
 */

import type { GradeReferenceDataSourceType } from "./gradeReference.types"

/** 試験・資料を使っているデータソース1件と、ロックの判定に要る参照先 */
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
  examId: string | null
  cropRegionId: string | null
  subtotalId: string | null
  courseworkItemId: string | null
  /** 受験状態「見込」を欠測とする */
  treatExpectedAsMissing: boolean
  /**
   * 小計のデータソースのとき、その小計へ割り当てた（`QUESTION_ASSIGNMENT`）この試験の
   * 設問。小計の点数はこれらの設問の点数の和なので、配点を変えると小計が変わる
   */
  subtotalCropRegionIds: string[]
}
