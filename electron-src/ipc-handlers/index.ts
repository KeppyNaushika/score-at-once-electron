import { registerArchiveHandlers } from "./archiveHandlers"
import { setupAuthHandlers } from "./authHandlers"
import { setupCropRegionHandlers } from "./cropRegionHandlers"
import { setupDrawingHandlers } from "./drawingHandlers"
import { setupExportHandlers } from "./exportHandlers"
import { setupMiscHandlers } from "./miscHandlers"
import { setupPdfToolsHandlers } from "./pdfToolsHandlers"
import { setupProjectClassHandlers } from "./projectClassHandlers"
import { setupProjectHandlers } from "./projectHandlers"
import { setupQuestionGroupHandlers } from "./questionGroupHandlers"
import { setupScoringHandlers } from "./scoringHandlers"
import { registerSettingsHandlers } from "./settingsHandlers"
import { setupStudentHandlers } from "./studentHandlers"
import { setupSubtotalGroupHandlers } from "./subtotalGroupHandlers"
import { setupUserProjectHandlers } from "./userProjectHandlers"

export function setupAllIPCHandlers(): void {
  setupProjectHandlers()
  setupStudentHandlers()
  setupCropRegionHandlers()
  setupScoringHandlers()
  setupExportHandlers()
  setupMiscHandlers()
  setupQuestionGroupHandlers()
  setupAuthHandlers()
  setupSubtotalGroupHandlers()
  setupDrawingHandlers()
  registerArchiveHandlers()
  setupProjectClassHandlers()
  setupUserProjectHandlers()
  registerSettingsHandlers()
  setupPdfToolsHandlers()
}
