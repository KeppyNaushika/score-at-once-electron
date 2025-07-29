import { setupProjectHandlers } from "./project-handlers"
import { setupStudentHandlers } from "./student-handlers"
import { setupLayoutHandlers } from "./layout-handlers"
import { setupCropRegionHandlers } from "./crop-region-handlers"
import { setupScoringHandlers } from "./scoring-handlers"
import { setupExportHandlers } from "./export-handlers"
import { setupMiscHandlers } from "./misc-handlers"
import { setupQuestionGroupHandlers } from "./question-group-handlers"
import { setupAuthHandlers } from "./auth-handlers"

export function setupAllIPCHandlers(): void {
  setupProjectHandlers()
  setupStudentHandlers()
  setupLayoutHandlers() // 互換性のため一時的に残す
  setupCropRegionHandlers() // 新しいハンドラー
  setupScoringHandlers()
  setupExportHandlers()
  setupMiscHandlers()
  setupQuestionGroupHandlers() // 互換性のため一時的に残す
  setupAuthHandlers()
}