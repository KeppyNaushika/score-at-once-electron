/**
 * 中間テーブルの決定論的id生成。
 *
 * `@default(uuid())` に任せると、2端末が同じ組み合わせを作ったときに id 違い・`@@unique`
 * 同値の行ができてNAS同期で衝突する。同一idなら行レベルLWWで1行へ収束する
 * （CropRegionAssignment と同じ理由）。
 *
 * CropRegionAssignment は uuidv5 を使うが、ここでは単純な連結にしている。既存データを
 * 移すマイグレーションが同じidを組み立てられる必要があり、SQLite に sha1 が無いため
 * SQL 側で uuidv5 を再現できないため。親idはuuid（固定長36文字）なので、区切り文字が
 * 子キー側に含まれていても解釈は一意に定まる。
 */

function joinIds(parentId: string, childKey: string): string {
  return `${parentId}:${childKey}`
}

/** 試験と小計点グループの紐付け（ExamSubtotalGroup）のid */
export function buildExamSubtotalGroupId(
  examId: string,
  subtotalGroupId: string
): string {
  return joinIds(examId, subtotalGroupId)
}

/** consistency ルールの集計対象観点（GradeConstraintViewpoint）のid */
export function buildConstraintViewpointId(
  constraintId: string,
  gradeItemId: string
): string {
  return joinIds(constraintId, gradeItemId)
}

/** consistency ルールのラベル→数値対応（GradeConstraintLabelValue）のid */
export function buildConstraintLabelValueId(
  constraintId: string,
  label: string
): string {
  return joinIds(constraintId, label)
}

/** mutual_exclusion ルールの混在禁止ラベル（GradeConstraintExclusionLabel）のid */
export function buildConstraintExclusionLabelId(
  constraintId: string,
  label: string
): string {
  return joinIds(constraintId, label)
}

/** 欠損推定に使う他データソース（GradeDataSourceEstimationSource）のid */
export function buildEstimationSourceId(
  dataSourceId: string,
  sourceDataSourceId: string
): string {
  return joinIds(dataSourceId, sourceDataSourceId)
}
