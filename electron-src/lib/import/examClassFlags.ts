/**
 * アーカイブの ExamClass 出力フラグ（teacherStat/studentReport）を解決する。
 *
 * v1.15.0+ は明示フィールドを持つ。旧アーカイブには無いので旧フラグから補完する：
 * 教員集計 = 旧 statistics、生徒表示 = 再採番(administered)。
 *
 * import の2経路（exam-archive/dataCreator・merge/idIntegrationImporter）で共有し、
 * 補完規則の重複・ドリフトを防ぐ。
 */
export function resolveExamClassOutputFlags(examClass: {
  teacherStat?: boolean | null
  studentReport?: boolean | null
  statistics?: boolean | null
  administered?: boolean | null
}): { teacherStat: boolean; studentReport: boolean } {
  return {
    teacherStat: examClass.teacherStat ?? examClass.statistics ?? false,
    studentReport: examClass.studentReport ?? examClass.administered ?? false,
  }
}
