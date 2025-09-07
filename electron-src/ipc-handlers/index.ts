import { setupProjectHandlers } from "./project-handlers"
import { setupStudentHandlers } from "./student-handlers"
import { setupCropRegionHandlers } from "./crop-region-handlers"
import { setupScoringHandlers } from "./scoring-handlers"
import { setupExportHandlers } from "./export-handlers"
import { setupMiscHandlers } from "./misc-handlers"
import { setupQuestionGroupHandlers } from "./question-group-handlers"
import { setupAuthHandlers } from "./auth-handlers"
import { setupSubtotalGroupHandlers } from "./subtotal-group-handlers"

export function setupAllIPCHandlers(): void {
  setupProjectHandlers()
  setupStudentHandlers()
  setupCropRegionHandlers() // CropRegion handlers
  setupScoringHandlers()
  setupExportHandlers()
  setupMiscHandlers()
  setupQuestionGroupHandlers() // 互換性のため一時的に残す
  setupAuthHandlers()
  setupSubtotalGroupHandlers()
  
  console.log("✅ All IPC handlers setup completed")
}