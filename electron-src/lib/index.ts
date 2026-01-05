// Score at Once - Electron Backend Library Index
// 新しい階層構造による統合エクスポート

// === 共通機能 ===
export type {
  ExportGradingDataOptions,
  ExportResult,
  ScoreDetail,
  ScoringData,
  SubtotalScore,
} from "./shared/types/exportTypes"

export {
  buildSubtotalTargetMap,
  calculateSubtotalScoreForStudent,
} from "./shared/calculations/subtotalCalculator"

export {
  applyCellStyle,
  autoFitColumns,
  getExcelColumnLetter,
  getStatusSymbol,
} from "./shared/utilities/excelUtilities"

// === 出力機能 ===
export { exportGradingDataExcel } from "./export/excel/excelExportMain"

// === Prisma関連（互換性のため、個別import推奨） ===
export { getAbsolutePathFromData } from "./dataManager"
export { getPrismaClient } from "./prisma/client"
