/**
 * Grade（成績算出）IPC ハンドラー
 *
 * 成績算出本体（CRUD・タグ・個人成績表の設定）・算出・Excel 出力・アーカイブの取り込み。
 * 名簿は `gradeRosterHandlers.ts`、評価項目とその中身（データソース・境界・比較）は
 * `gradeStructureHandlers.ts`、セルの調整（上書き・制約・除外・確定）は
 * `gradeAdjustmentHandlers.ts`。チャンネル名はすべて `grade:` のまま。
 */

import type { GradeExcelComparisonColumn } from "../../src/types/gradeExport.types"
import type { GradeReportSettings } from "../../src/types/gradeReport.types"
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
  getAllGrades,
  getGradeById,
  setGradeTags,
  updateGrade,
} from "../lib/prisma/grade"
import { duplicateGrade } from "../lib/prisma/gradeDuplicate"
import {
  getGradeExportComparisons,
  setGradeExportComparison,
} from "../lib/prisma/gradeExportComparison"
import {
  getGradeIndividualReportSettings,
  updateGradeIndividualReportSettings,
} from "../lib/prisma/gradeIndividualReportSettings"
import { calculateGrades } from "../lib/shared/calculations/gradeCalculator"
import { computeSourceFits } from "../lib/shared/calculations/gradeSourceFit"
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

  // 出力（Excel・個人成績通知書）に載せる比較の選択。行が無い比較は出す
  "grade:getExportComparisons": async (gradeId: string) => {
    return getGradeExportComparisons(gradeId)
  },

  "grade:setExportComparison": async (selectionInput: {
    gradeId: string
    gradeComparisonId: string
    enabled: boolean
  }) => {
    return setGradeExportComparison(selectionInput)
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

  // 比較の列（比較先の評定・変化の記号）は renderer が算出して渡す。main は書くだけ
  "grade:exportExcel": async (
    gradeId: string,
    options?: {
      studentIds?: string[]
      comparisonColumns?: GradeExcelComparisonColumn[]
    }
  ) => {
    return exportGradeExcel(gradeId, {
      studentIds: options?.studentIds,
      comparisonColumns: options?.comparisonColumns,
    })
  },

  // =====================================================================
  // アーカイブ（.grade の取り込み。旧形式は読み込みだけ残して凍結）
  // =====================================================================

  // ファイルは一覧の「読み込み」で選ぶ。中身を読んで照合の結果を返すだけ（DB は書かない）
  "grade:analyzeArchive": async (archivePath: string) => {
    const archiveData = await extractGradeArchive(archivePath)
    return previewGradeArchiveImport(archiveData)
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
