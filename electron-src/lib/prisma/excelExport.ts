// この機能は新しい構造に移行されました
// 新しい場所: /electron-src/lib/export/excel/excel-export-main.ts

export { exportGradingDataExcel } from "../export/excel/excel-export-main"

// 互換性のため、旧インターface を維持
export interface ExportGradingDataOptions {
  projectId: string
  selectedStudentIds: string[]
  outputPath?: string
}
