import type {} from "../../src/types/examArchive.types"
import type {} from "../../src/types/studentArchive.types"
import { bind } from "./invoke"

/** 試験・生徒アーカイブ（旧形式）の取り込みの IPC API（競合検出・ID統合） */
export function createArchiveApi() {
  return {
    // 試験アーカイブ（.score）の取り込み
    archive: {
      analyzeArchive: bind("archive:analyzeArchive"),
      preMatch: bind("archive:preMatch"),
      idIntegrationImport: bind("archive:idIntegrationImport"),
      detectScoringConflicts: bind("archive:detectScoringConflicts"),
      selectImportFile: bind("archive:selectImportFile"),
      convertHszToScore: bind("archive:convertHszToScore"),
      convertDatToScore: bind("archive:convertDatToScore"),
    },

    // 生徒アーカイブ（.students）の取り込み
    studentArchive: {
      selectImportFile: bind("studentArchive:selectImportFile"),
      analyzeArchive: bind("studentArchive:analyzeArchive"),
      preMatch: bind("studentArchive:preMatch"),
      import: bind("studentArchive:import"),
    },
  }
}
