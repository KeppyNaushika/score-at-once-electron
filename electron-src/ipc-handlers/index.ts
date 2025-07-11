import { setupProjectHandlers } from "./project-handlers"
import { setupStudentHandlers } from "./student-handlers"
import { setupLayoutHandlers } from "./layout-handlers"
import { setupScoringHandlers } from "./scoring-handlers"
import { setupExportHandlers } from "./export-handlers"
import { setupMiscHandlers } from "./misc-handlers"
import { setupQuestionGroupHandlers } from "./question-group-handlers"
import { setupQuestionHandlers } from "./question-handlers"

export function setupAllIPCHandlers(): void {
  setupProjectHandlers()
  setupStudentHandlers()
  setupLayoutHandlers()
  setupScoringHandlers()
  setupExportHandlers()
  setupMiscHandlers()
  setupQuestionGroupHandlers()
  setupQuestionHandlers()
}