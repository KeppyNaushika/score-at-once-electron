/**
 * アーカイブの ExamClassroom 出力フラグ（teacherStatistics/studentReport）を解決する。
 *
 * v1.16.0+ は teacherStatistics を持つ。旧アーカイブには無いので旧フラグから補完する：
 * v1.15.0 は teacherStat、〜v1.14.0 は 教員集計=旧 statistics、生徒表示=再採番(administered)。
 *
 * import の2経路（exam-archive/dataCreator・merge/idIntegrationImporter）で共有し、
 * 補完規則の重複・ドリフトを防ぐ。
 */
export function resolveExamClassroomOutputFlags(examClassroom: {
  teacherStatistics?: boolean | null
  teacherStat?: boolean | null
  studentReport?: boolean | null
  statistics?: boolean | null
  administered?: boolean | null
}): { teacherStatistics: boolean; studentReport: boolean } {
  return {
    teacherStatistics:
      examClassroom.teacherStatistics ??
      examClassroom.teacherStat ??
      examClassroom.statistics ??
      false,
    studentReport:
      examClassroom.studentReport ?? examClassroom.administered ?? false,
  }
}
