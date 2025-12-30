import { setupProjectHandlers } from "./projectHandlers"
import { setupStudentHandlers } from "./studentHandlers"
import { setupCropRegionHandlers } from "./cropRegionHandlers"
import { setupScoringHandlers } from "./scoringHandlers"
import { setupExportHandlers } from "./exportHandlers"
import { setupMiscHandlers } from "./miscHandlers"
import { setupQuestionGroupHandlers } from "./questionGroupHandlers"
import { setupAuthHandlers } from "./authHandlers"
import { setupSubtotalGroupHandlers } from "./subtotalGroupHandlers"
import { setupDrawingHandlers } from "./drawingHandlers"
import { registerArchiveHandlers } from "./archiveHandlers"

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
  setupDrawingHandlers() // 描画アノテーション handlers
  registerArchiveHandlers() // プロジェクトアーカイブ handlers

  console.log("✅ All IPC handlers setup completed")
}
