/**
 * 統合アーカイブ（.sao）の試し取り込みで書いた行のうち、成績算出の値を変えうる行だけを残す
 *
 * main は成績算出が読む表へ書いた行の「前」と「後」を生のまま返す（差分は取らない）。
 * ここで列ごとに比べ、値に効く列が1つでも違う行だけを「変わった」とする
 * （docs/unified-archive-design.md §7.5）。作る行（前が無い）は常に「変わった」。
 *
 * 粒度は「値が実際に変わりそうなものだけ」。関与しているだけで出すと、統合のたびに警告が
 * 出て慣れてしまう。そのため時刻に加えて、成績算出が値に使わない列（表示の名前・並び順・
 * 用紙上の位置・コメント・誰がいつ確定したか）の違いも「変わらない」とする。
 */

/** どの表でも値に効かない列（統合では元の時刻、上書きでは取り込み時刻が入るだけ） */
const TIMESTAMP_COLUMNS: readonly string[] = ["createdAt", "updatedAt"]

/**
 * 表ごとの、成績算出が値に使わない列。**名指しの一覧で持つ**（判断基準で書かない）。
 * 載っていない列は値に効くものとして扱う（列が増えたときに黙って見落とさない側に倒す）。
 *
 * 生徒・学級の名前は載せない。成績算出の結果に名簿として出るため（名簿の変化として示す）。
 */
const VALUE_NEUTRAL_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  Exam: ["examName", "description", "referenceDate", "markerCorrectionEnabled"],
  ExamPage: ["pageNumber", "imagePath", "pageSize"],
  CropRegion: ["label", "x", "y", "width", "height", "orderIndex"],
  Subtotal: ["name", "order"],
  ExamStudent: ["customOrder"],
  QuestionScore: ["comment"],
  ScoreDecision: ["comment", "decidedByUserId", "decidedAt"],
  Coursework: ["name", "description", "referenceDate"],
  CourseworkItem: ["name", "order"],
  CourseworkStudent: ["customOrder"],
  CourseworkScore: ["comment", "adjustmentReason"],
  Grade: ["name", "description"],
  GradeItem: ["name", "order"],
  GradeDataSource: ["name", "order"],
  GradeClassroom: ["order"],
  GradeStudent: ["customOrder"],
  GradeFrozenScore: ["frozenByUserId", "frozenAt"],
  StudentClassroomMembership: ["notes"],
  Classroom: ["description", "isVisible"],
}

const sameValue = (beforeValue: unknown, afterValue: unknown): boolean => {
  if (beforeValue instanceof Date && afterValue instanceof Date) {
    return beforeValue.getTime() === afterValue.getTime()
  }
  if (
    typeof beforeValue === "object" &&
    beforeValue !== null &&
    typeof afterValue === "object" &&
    afterValue !== null
  ) {
    return JSON.stringify(beforeValue) === JSON.stringify(afterValue)
  }
  return beforeValue === afterValue
}

/** 値に効く列のどれかが、前と後で違うか。前が無ければ（作る行）違う */
export function changesGradeInput(change: {
  table: string
  before: Readonly<Record<string, unknown>> | null
  after: Readonly<Record<string, unknown>>
}): boolean {
  const { before, after } = change
  if (before === null) return true
  const neutralColumns = new Set([
    ...TIMESTAMP_COLUMNS,
    ...(VALUE_NEUTRAL_COLUMNS[change.table] ?? []),
  ])
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].some(
    (column) =>
      !neutralColumns.has(column) && !sameValue(before[column], after[column])
  )
}
