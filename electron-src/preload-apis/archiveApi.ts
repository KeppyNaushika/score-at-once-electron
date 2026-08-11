import type {
  ArchiveExportMode,
  FileOverviewData,
  IdIntegrationConfig,
  ScoringConflictConfig,
  UpdateDecisions,
} from "../../src/types/examArchive.types"
import type {
  StudentArchiveFileOverviewData,
  StudentArchiveIdIntegrationConfig,
} from "../../src/types/studentArchive.types"
import { invoke } from "./invoke"

/** 試験・生徒アーカイブのIPC API（エクスポート・インポート・競合検出・ID統合） */
export function createArchiveApi() {
  return {
    // Exam Archive (Export/Import) related
    archive: {
      exportExam: (options: {
        examId: string
        userId: string
        outputPath?: string
        exportMode?: ArchiveExportMode
      }) => invoke("archive:exportExam", options),
      analyzeArchive: (options: { archivePath: string }) =>
        invoke("archive:analyzeArchive", options),
      preMatch: (options: { archivePath: string }) =>
        invoke("archive:preMatch", options),
      idIntegrationImport: (options: {
        archivePath: string
        preMatchResult: FileOverviewData
        integrationConfig: IdIntegrationConfig
        currentUserId: string
        scoringConflictConfig?: ScoringConflictConfig
        updateDecisions?: UpdateDecisions
      }) => invoke("archive:idIntegrationImport", options),
      detectScoringConflicts: (options: {
        archivePath: string
        preMatchResult: FileOverviewData
        integrationConfig: IdIntegrationConfig
      }) => invoke("archive:detectScoringConflicts", options),
      bulkExportExams: (options: {
        examIds: string[]
        userId: string
        exportMode?: ArchiveExportMode
      }) => invoke("archive:bulkExportExams", options),
      selectImportFile: () => invoke("archive:selectImportFile"),
      convertHszToScore: (options: { hszPath: string }) =>
        invoke("archive:convertHszToScore", options),
      convertDatToScore: (options: { datPath: string }) =>
        invoke("archive:convertDatToScore", options),
    },

    // Student Archive (Export/Import) related
    studentArchive: {
      exportStudents: (options: {
        studentIds: string[]
        classroomIds?: string[]
      }) => invoke("studentArchive:exportStudents", options),
      selectImportFile: () => invoke("studentArchive:selectImportFile"),
      analyzeArchive: (options: { archivePath: string }) =>
        invoke("studentArchive:analyzeArchive", options),
      preMatch: (options: { archivePath: string }) =>
        invoke("studentArchive:preMatch", options),
      import: (options: {
        archivePath: string
        preMatchResult: StudentArchiveFileOverviewData
        integrationConfig: StudentArchiveIdIntegrationConfig
        updateDecisions?: UpdateDecisions
      }) => invoke("studentArchive:import", options),
    },
  }
}
