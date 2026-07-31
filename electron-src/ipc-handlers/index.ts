import { setupAnswerSheetBuilderHandlers } from "./answerSheetBuilderHandlers"
import { registerArchiveHandlers } from "./archiveHandlers"
import { setupAuditLogHandlers } from "./auditLogHandlers"
import { setupAuthHandlers } from "./authHandlers"
import { setupCourseworkHandlers } from "./courseworkHandlers"
import { setupCropRegionHandlers } from "./cropRegionHandlers"
import { setupDrawingHandlers } from "./drawingHandlers"
import { setupExamClassroomHandlers } from "./examClassroomHandlers"
import { setupExamHandlers } from "./examHandlers"
import { setupExportHandlers } from "./exportHandlers"
import { setupGradeHandlers } from "./gradeHandlers"
import { setupMiscHandlers } from "./miscHandlers"
import { setupNavigationHandlers } from "./navigationHandlers"
import { setupOmrConfigHandlers } from "./omrConfigHandlers"
import { setupOMRHandlers } from "./omrHandlers"
import { setupPdfToolsHandlers } from "./pdfToolsHandlers"
import { setupScoringHandlers } from "./scoringHandlers"
import { registerSettingsHandlers } from "./settingsHandlers"
import { registerStudentArchiveHandlers } from "./studentArchiveHandlers"
import { setupStudentHandlers } from "./studentHandlers"
import { setupSubtotalGroupHandlers } from "./subtotalGroupHandlers"
import { setupSyncHandlers } from "./syncHandlers"
import { setupTagHandlers } from "./tagHandlers"
import { setupUserExamHandlers } from "./userExamHandlers"

/** 全IPCハンドラーを一括登録する */
export function setupAllIPCHandlers(): void {
  setupExamHandlers()
  setupStudentHandlers()
  setupCropRegionHandlers()
  setupScoringHandlers()
  setupExportHandlers()
  setupMiscHandlers()
  setupAuthHandlers()
  setupSubtotalGroupHandlers()
  setupDrawingHandlers()
  registerArchiveHandlers()
  setupExamClassroomHandlers()
  setupUserExamHandlers()
  registerSettingsHandlers()
  setupPdfToolsHandlers()
  setupTagHandlers()
  setupGradeHandlers()
  setupCourseworkHandlers()
  setupAnswerSheetBuilderHandlers()
  setupOMRHandlers()
  setupOmrConfigHandlers()
  registerStudentArchiveHandlers()
  setupSyncHandlers()
  setupAuditLogHandlers()
  setupNavigationHandlers()
}
