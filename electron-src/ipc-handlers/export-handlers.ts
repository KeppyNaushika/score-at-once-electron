import { ipcMain } from "electron"
import { exportScoredAnswersPDF } from "../lib/prisma/pdfExport"
import { exportGradingDataExcel } from "../lib/prisma/excelExport"

export function setupExportHandlers(): void {
  // PDF Export handlers
  ipcMain.handle(
    "export-scored-answers-pdf",
    async (event, options: {
      projectId: string
      selectedStudentIds: string[]
      outputPath?: string
      scoringMarkConfig?: any
      pdfOrientation?: 'portrait' | 'landscape'
    }) => {
      try {
        // プログレスコールバックを設定
        const progressCallback = (progress: {
          current: number
          total: number
          step: string
          percentage: number
          currentStepIndex: number
          totalSteps: number
        }) => {
          event.sender.send('export-progress', progress)
        }

        return await exportScoredAnswersPDF({
          ...options,
          progressCallback
        })
      } catch (err) {
        console.error("Error exporting scored answers PDF:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error occurred'
        }
      }
    },
  )

  // Excel Export handlers
  ipcMain.handle(
    "export-grading-data-excel",
    async (_event, options: {
      projectId: string
      selectedStudentIds: string[]
      outputPath?: string
    }) => {
      try {
        return await exportGradingDataExcel(options)
      } catch (err) {
        console.error("Error exporting grading data Excel:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error occurred'
        }
      }
    },
  )
}