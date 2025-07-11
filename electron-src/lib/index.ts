// Score at Once - Electron Backend Library Index
// 新しい階層構造による統合エクスポート

// === 共通機能 ===
export type {
  ExportGradingDataOptions,
  ExportResult,
  ScoreDetail,
  ScoringData,
  SubtotalScore,
} from "./shared/types/export-types"

export {
  buildSubtotalTargetMap,
  calculateSubtotalScore,
  checkIfQuestionIsInSubtotal,
  getTargetQuestionIndicesForSubtotal,
} from "./shared/calculations/subtotal-calculator"

export {
  applyCellStyle,
  autoFitColumns,
  getExcelColumnLetter,
  getStatusSymbol,
} from "./shared/utilities/excel-utilities"

// === 出力機能 ===
export { exportGradingDataExcel } from "./export/excel/excel-export-main"
export { exportScoredAnswersPDF } from "./prisma/pdfExport"

// === Prisma関連（互換性のため、個別import推奨） ===
export { getAbsolutePathFromData } from "./dataManager"
export { getPrismaClient } from "./prisma/client"
