import { ipcRenderer } from "electron"

import type {
  ArchiveExportMode,
  FileOverviewData,
  IdIntegrationConfig,
  MatchingConfig,
  ScoringConflictConfig,
  UpdateDecisions,
} from "../../src/types/examArchive.types"
import type {
  StudentArchiveFileOverviewData,
  StudentArchiveIdIntegrationConfig,
} from "../../src/types/studentArchive.types"

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
      }) => ipcRenderer.invoke("archive:exportExam", options),
      analyzeArchive: (options: { archivePath: string }) =>
        ipcRenderer.invoke("archive:analyzeArchive", options),
      preMatch: (options: { archivePath: string }) =>
        ipcRenderer.invoke("archive:preMatch", options),
      detectConflicts: (options: {
        archivePath: string
        matchingConfig: MatchingConfig
      }) => ipcRenderer.invoke("archive:detectConflicts", options),
      idIntegrationImport: (options: {
        archivePath: string
        preMatchResult: FileOverviewData
        integrationConfig: IdIntegrationConfig
        currentUserId: string
        scoringConflictConfig?: ScoringConflictConfig
        updateDecisions?: UpdateDecisions
      }) => ipcRenderer.invoke("archive:idIntegrationImport", options),
      detectScoringConflicts: (options: {
        archivePath: string
        preMatchResult: FileOverviewData
        integrationConfig: IdIntegrationConfig
      }) => ipcRenderer.invoke("archive:detectScoringConflicts", options),
      bulkExportExams: (options: {
        examIds: string[]
        userId: string
        exportMode?: ArchiveExportMode
      }) => ipcRenderer.invoke("archive:bulkExportExams", options),
      selectImportFile: () => ipcRenderer.invoke("archive:selectImportFile"),
      convertHszToScore: (options: { hszPath: string }) =>
        ipcRenderer.invoke("archive:convertHszToScore", options),
      convertDatToScore: (options: { datPath: string }) =>
        ipcRenderer.invoke("archive:convertDatToScore", options),
    },

    // Student Archive (Export/Import) related
    studentArchive: {
      exportStudents: (options: {
        studentIds: string[]
        classroomIds?: string[]
      }) => ipcRenderer.invoke("studentArchive:exportStudents", options),
      selectImportFile: () =>
        ipcRenderer.invoke("studentArchive:selectImportFile"),
      analyzeArchive: (options: { archivePath: string }) =>
        ipcRenderer.invoke("studentArchive:analyzeArchive", options),
      preMatch: (options: { archivePath: string }) =>
        ipcRenderer.invoke("studentArchive:preMatch", options),
      import: (options: {
        archivePath: string
        preMatchResult: StudentArchiveFileOverviewData
        integrationConfig: StudentArchiveIdIntegrationConfig
        updateDecisions?: UpdateDecisions
      }) => ipcRenderer.invoke("studentArchive:import", options),
    },
  }
}
