import { setupAnswerSheetBuilderHandlers } from "./answerSheetBuilderHandlers"
import { registerArchiveHandlers } from "./archiveHandlers"
import { setupAuthHandlers } from "./authHandlers"
import { setupCropRegionHandlers } from "./cropRegionHandlers"
import { setupDrawingHandlers } from "./drawingHandlers"
import { setupExamClassHandlers } from "./examClassHandlers"
import { setupExamHandlers } from "./examHandlers"
import { setupExportHandlers } from "./exportHandlers"
import { setupGradeHandlers } from "./gradeHandlers"
import { setupMiscHandlers } from "./miscHandlers"
import { setupOmrConfigHandlers } from "./omrConfigHandlers"
import { setupOMRHandlers } from "./omrHandlers"
import { setupPdfToolsHandlers } from "./pdfToolsHandlers"
import { setupQuestionGroupHandlers } from "./questionGroupHandlers"
import { setupScoringHandlers } from "./scoringHandlers"
import { registerSettingsHandlers } from "./settingsHandlers"
import { registerStudentArchiveHandlers } from "./studentArchiveHandlers"
import { setupStudentHandlers } from "./studentHandlers"
import { setupSubjectHandlers } from "./subjectHandlers"
import { setupSubtotalGroupHandlers } from "./subtotalGroupHandlers"
import { setupSyncHandlers } from "./syncHandlers"
import { setupUserExamHandlers } from "./userExamHandlers"

/** 全IPCハンドラーを一括登録する */
export function setupAllIPCHandlers(): void {
  setupExamHandlers()
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
  setupExamClassHandlers()
  setupUserExamHandlers()
  registerSettingsHandlers()
  setupPdfToolsHandlers()
  setupSubjectHandlers()
  setupGradeHandlers()
  setupAnswerSheetBuilderHandlers()
  setupOMRHandlers()
  setupOmrConfigHandlers()
  registerStudentArchiveHandlers()
  setupSyncHandlers()
}
