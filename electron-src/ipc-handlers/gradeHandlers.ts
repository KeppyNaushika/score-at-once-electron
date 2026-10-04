/**
 * Grade（成績算出）IPC ハンドラー
 *
 * 成績算出本体（CRUD・タグ・個人成績表の設定）・算出・Excel 出力・アーカイブ。
 * 名簿は `gradeRosterHandlers.ts`、評価項目とその中身（データソース・境界・比較）は
 * `gradeStructureHandlers.ts`、セルの調整（上書き・制約・除外・確定）は
 * `gradeAdjustmentHandlers.ts`。チャンネル名はすべて `grade:` のまま。
 */

import { dialog } from "electron"

import type { GradeReportSettings } from "../../src/types/gradeReport.types"
import { createGradeArchive } from "../lib/export/grade-archive/gradeArchiveCreator"
import { exportGradeExcel } from "../lib/export/gradeExcel/gradeExcelExportMain"
import { extractGradeArchive } from "../lib/import/grade-archive/gradeArchiveExtractor"
import {
  importGradeArchive,
  previewGradeArchiveImport,
} from "../lib/import/grade-archive/gradeArchiveImporter"
import {
  addGradeTag,
  createGrade,
  deleteGrade,
  duplicateGrade,
  getAllGrades,
  getGradeById,
  setGradeTags,
  updateGrade,
} from "../lib/prisma/grade"
import {
  getGradeIndividualReportSettings,
  updateGradeIndividualReportSettings,
} from "../lib/prisma/gradeIndividualReportSettings"
import {
  calculateGrades,
  computeSourceFits,
} from "../lib/shared/calculations/gradeCalculator"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 成績算出（Grade）本体の CRUD・タグ・個人成績表の設定・算出・Excel出力・アーカイブの IPC チャンネル */
export const gradeHandlers = {
  // =====================================================================
  // Grade CRUD
  // =====================================================================

  "grade:getAll": async () => {
    return getAllGrades()
  },

  "grade:getById": async (id: string) => {
    return getGradeById(id)
  },

  "grade:create": async (gradeInput: {
    /** renderer が振った uuid（規約: id は呼び出し側で決める） */
    id?: string
    name: string
    description?: string
    referenceDate?: string | null
  }) => {
    return createGrade(gradeInput)
  },

  "grade:update": async (
    id: string,
    gradeChanges: {
      name?: string
      description?: string | null
      referenceDate?: string | null
    }
  ) => {
    return updateGrade(id, gradeChanges)
  },

  "grade:delete": async (id: string) => {
    return deleteGrade(id)
  },

  "grade:duplicate": async (id: string) => {
    return duplicateGrade(id)
  },

  // タグ（GradeTag）
  "grade:setTags": async (gradeId: string, tagIds: string[]) => {
    return setGradeTags(gradeId, tagIds)
  },

  "grade:addTag": async (gradeId: string, tagId: string) => {
    return addGradeTag(gradeId, tagId)
  },

  "grade:getReportSettings": async (gradeId: string) => {
    return getGradeIndividualReportSettings(gradeId)
  },

  // 触った列だけを載せる。まるごと送ると、続けて2つ変えたときに先の1つが消える
  "grade:updateReportSettings": async (
    gradeId: string,
    values: Partial<GradeReportSettings>
  ) => {
    await updateGradeIndividualReportSettings(gradeId, values)
  },

  // =====================================================================
  // 成績算出
  // =====================================================================

  "grade:calculateGrades": async (gradeId: string) => {
    return calculateGrades(gradeId)
  },

  "grade:computeSourceFits": async (gradeId: string) => {
    return computeSourceFits(gradeId)
  },

  // =====================================================================
  // Excel出力
  // =====================================================================

  "grade:exportExcel": async (
    gradeId: string,
    options?: { studentIds?: string[] }
  ) => {
    return exportGradeExcel(gradeId, {
      studentIds: options?.studentIds,
    })
  },

  // =====================================================================
  // アーカイブ Export/Import
  // =====================================================================

  "grade:exportArchive": async (gradeId: string) => {
    const result = await dialog.showSaveDialog({
      title: "成績アーカイブの保存先",
      defaultPath: `grade-exam.grade`,
      filters: [{ name: "成績アーカイブ", extensions: ["grade"] }],
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }
    await createGradeArchive(gradeId, result.filePath)
    return { canceled: false as const, outputPath: result.filePath }
  },

  "grade:importArchive": async () => {
    const result = await dialog.showOpenDialog({
      title: "成績アーカイブを選択",
      filters: [{ name: "成績アーカイブ", extensions: ["grade"] }],
      properties: ["openFile"],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true as const }
    }

    const archivePath = result.filePaths[0]
    const archiveData = await extractGradeArchive(archivePath)
    const preview = await previewGradeArchiveImport(archiveData)
    return { canceled: false as const, preview, archivePath }
  },

  // 中身は renderer を往復させず、実行時に main がファイルから読み直す
  // （.coursework と同じ。renderer から届いた値をそのまま DB へ書かない）
  "grade:executeImport": async (
    archivePath: string,
    options?: Parameters<typeof importGradeArchive>[1]
  ) => {
    const archiveData = await extractGradeArchive(archivePath)
    return importGradeArchive(archiveData, options)
  },
} satisfies HandlerMap
