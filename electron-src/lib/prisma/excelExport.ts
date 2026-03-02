// この機能は新しい構造に移行されました
// 新しい場所: /electron-src/lib/export/excel/excelExportMain.ts

export { exportGradingDataExcel } from "../export/excel/excelExportMain"

// 互換性のため、旧インターface を維持
export interface ExportGradingDataOptions {
  examId: string
  selectedStudentIds: string[]
  outputPath?: string
}
