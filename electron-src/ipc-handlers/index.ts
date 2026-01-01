import { registerArchiveHandlers } from "./archiveHandlers"
import { setupAuthHandlers } from "./authHandlers"
import { setupCropRegionHandlers } from "./cropRegionHandlers"
import { setupDrawingHandlers } from "./drawingHandlers"
import { setupExportHandlers } from "./exportHandlers"
import { setupMiscHandlers } from "./miscHandlers"
import { setupProjectClassHandlers } from "./projectClassHandlers"
import { setupProjectHandlers } from "./projectHandlers"
import { setupQuestionGroupHandlers } from "./questionGroupHandlers"
import { setupScoringHandlers } from "./scoringHandlers"
import { setupStudentHandlers } from "./studentHandlers"
import { setupSubtotalGroupHandlers } from "./subtotalGroupHandlers"
import { setupUserProjectHandlers } from "./userProjectHandlers"

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
  setupProjectClassHandlers() // v0.3.0: ProjectClass handlers
  setupUserProjectHandlers() // v0.3.0: UserProject 権限管理 handlers

  console.log("✅ All IPC handlers setup completed")
}
