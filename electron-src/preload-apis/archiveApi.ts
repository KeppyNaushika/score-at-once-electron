import { ipcRenderer } from "electron"

/** 試験・生徒アーカイブのIPC API（エクスポート・インポート・競合検出・ID統合） */
export function createArchiveApi() {
  return {
    // Exam Archive (Export/Import) related
    archive: {
      exportExam: (options: {
        examId: string
        userId: string
        outputPath?: string
        exportMode?: import("../../src/types/examArchive.types").ExportMode
      }) => ipcRenderer.invoke("archive:exportExam", options),
      analyzeArchive: (options: { archivePath: string }) =>
        ipcRenderer.invoke("archive:analyzeArchive", options),
      preMatch: (options: { archivePath: string }) =>
        ipcRenderer.invoke("archive:preMatch", options),
      detectConflicts: (options: {
        archivePath: string
        matchingConfig: import("../../src/types/examArchive.types").MatchingConfig
      }) => ipcRenderer.invoke("archive:detectConflicts", options),
      idIntegrationImport: (options: {
        archivePath: string
        preMatchResult: import("../../src/types/examArchive.types").FileOverviewData
        integrationConfig: import("../../src/types/examArchive.types").IdIntegrationConfig
        currentUserId: string
        scoringConflictConfig?: import("../../src/types/examArchive.types").ScoringConflictConfig
        updateDecisions?: import("../../src/types/examArchive.types").UpdateDecisions
      }) => ipcRenderer.invoke("archive:idIntegrationImport", options),
      detectScoringConflicts: (options: {
        archivePath: string
        preMatchResult: import("../../src/types/examArchive.types").FileOverviewData
        integrationConfig: import("../../src/types/examArchive.types").IdIntegrationConfig
      }) => ipcRenderer.invoke("archive:detectScoringConflicts", options),
      bulkExportExams: (options: {
        examIds: string[]
        userId: string
        exportMode?: import("../../src/types/examArchive.types").ExportMode
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
        preMatchResult: import("../../src/types/studentArchive.types").StudentArchiveFileOverviewData
        integrationConfig: import("../../src/types/studentArchive.types").StudentArchiveIdIntegrationConfig
        updateDecisions?: import("../../src/types/examArchive.types").UpdateDecisions
      }) => ipcRenderer.invoke("studentArchive:import", options),
    },
  }
}
