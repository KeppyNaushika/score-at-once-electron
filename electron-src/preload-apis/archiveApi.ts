import type {} from "../../src/types/examArchive.types"
import type {} from "../../src/types/studentArchive.types"
import { bind } from "./invoke"

/** 試験・生徒アーカイブのIPC API（エクスポート・インポート・競合検出・ID統合） */
export function createArchiveApi() {
  return {
    // Exam Archive (Export/Import) related
    archive: {
      exportExam: bind("archive:exportExam"),
      analyzeArchive: bind("archive:analyzeArchive"),
      preMatch: bind("archive:preMatch"),
      idIntegrationImport: bind("archive:idIntegrationImport"),
      detectScoringConflicts: bind("archive:detectScoringConflicts"),
      bulkExportExams: bind("archive:bulkExportExams"),
      selectImportFile: bind("archive:selectImportFile"),
      convertHszToScore: bind("archive:convertHszToScore"),
      convertDatToScore: bind("archive:convertDatToScore"),
    },

    // Student Archive (Export/Import) related
    studentArchive: {
      exportStudents: bind("studentArchive:exportStudents"),
      selectImportFile: bind("studentArchive:selectImportFile"),
      analyzeArchive: bind("studentArchive:analyzeArchive"),
      preMatch: bind("studentArchive:preMatch"),
      import: bind("studentArchive:import"),
    },
  }
}
