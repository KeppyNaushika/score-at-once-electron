import type { UnifiedArchiveExportPhase } from "@/electron-src/lib/export/unified-archive/unifiedArchiveCreator"
import type { UnifiedArchiveMissingFile } from "@/types/unifiedArchive.types"

/** 書き出しの段の日本語 */
export const EXPORT_PHASE_LABELS: Record<UnifiedArchiveExportPhase, string> = {
  resolvingScope: "書き出す範囲を決めています",
  writingDatabase: "データを書き込んでいます",
  packing: "ファイルをまとめています",
}

const MISSING_FILE_REASON_LABELS: Record<
  UnifiedArchiveMissingFile["reason"],
  string
> = {
  notFound: "見つからない",
  outsideDataDirectory: "データフォルダの外",
}

/** 同梱できなかったファイルを、理由つきの1行にする（例: `見つからない: answers/1.png`） */
export const missingFileDescription = (
  missingFile: UnifiedArchiveMissingFile
): string =>
  `${MISSING_FILE_REASON_LABELS[missingFile.reason]}: ${missingFile.path}`

/** 「書き出すもの」の右に1行で数を出す表（残りは「全ての表」の折りたたみ） */
export const MAJOR_TABLES: readonly string[] = [
  "Exam",
  "ExamStudent",
  "QuestionScore",
  "StudentAnswerImage",
  "Coursework",
  "CourseworkScore",
  "Grade",
  "GradeItem",
  "AsbDefinition",
  "Student",
  "Classroom",
  "StudentClassroomMembership",
  "User",
]
