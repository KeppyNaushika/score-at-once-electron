/**
 * 成績算出（Grade）のデータソースから「使われている」ことの型。
 *
 * 試験・試験外成績資料とその中の項目を消す前に、どの成績算出がどう使っているかを
 * 調べて見せる（試験・資料は使われていれば消させない、項目は警告して消させる）。
 * 調べるのは main（`electron-src/lib/prisma/gradeReference.ts`）、文言を組み立てるのは
 * `src/lib/shared/gradeReferenceMessages.ts`。
 */

/** 何が使われているかを調べる対象 */
export type GradeReferenceTarget =
  | { kind: "exam"; id: string }
  | { kind: "cropRegion"; id: string }
  | { kind: "subtotal"; id: string }
  | { kind: "coursework"; id: string }
  | { kind: "courseworkItem"; id: string }

/**
 * 使われ方。
 *
 * - `direct`: データソースが対象そのものを参照している（試験の合計点・小計・設問・
 *   評価項目・資料合計のデータソースが、その試験・小計・設問・評価項目・資料を指す）
 * - `total`: 対象がデータソースの合計に含まれている（設問が「試験の合計点」や
 *   小計に含まれる、評価項目が「資料合計」に含まれる）。消すと合計が変わる
 */
export type GradeReferenceUsage = "direct" | "total"

/** データソースの種類（`GradeDataSource.type`） */
export type GradeReferenceDataSourceType =
  | "exam_total"
  | "subtotal"
  | "crop_region"
  | "coursework"
  | "coursework_total"
  | "other"

/** 対象を使っているデータソース1件 */
export interface GradeReference {
  gradeId: string
  /** 成績算出の名前 */
  gradeName: string
  /** 成績算出の評価項目の名前 */
  gradeItemName: string
  dataSourceId: string
  /** データソースの名前 */
  dataSourceName: string
  dataSourceType: GradeReferenceDataSourceType
  usage: GradeReferenceUsage
}
