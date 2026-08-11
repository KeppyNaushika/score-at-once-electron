import type { IpcRenderer } from "electron"
import { contextBridge, ipcRenderer } from "electron"

import { createAnswerSheetApi } from "./preload-apis/answerSheetApi"
import { createAnswerSheetBuilderApi } from "./preload-apis/answerSheetBuilderApi"
import { createArchiveApi } from "./preload-apis/archiveApi"
import { createAuditLogApi } from "./preload-apis/auditLogApi"
import { createAuthApi } from "./preload-apis/authApi"
import { createCourseworkApi } from "./preload-apis/courseworkApi"
import { createCropRegionApi } from "./preload-apis/cropRegionApi"
import { createDrawingApi } from "./preload-apis/drawingApi"
import { createExamApi } from "./preload-apis/examApi"
import { createExamClassroomApi } from "./preload-apis/examClassroomApi"
import { createExportApi } from "./preload-apis/exportApi"
import { createGradeApi } from "./preload-apis/gradeApi"
import { createMiscApi } from "./preload-apis/miscApi"
import { createNavigationApi } from "./preload-apis/navigationApi"
import { createOmrApi } from "./preload-apis/omrApi"
import { createPdfToolsApi } from "./preload-apis/pdfToolsApi"
import { createScoringApi } from "./preload-apis/scoringApi"
import { createSettingsApi } from "./preload-apis/settingsApi"
import { createStudentApi } from "./preload-apis/studentApi"
import { createSubtotalApi } from "./preload-apis/subtotalApi"
import { createSyncApi } from "./preload-apis/syncApi"
import { createTagApi } from "./preload-apis/tagApi"
import { createUserExamApi } from "./preload-apis/userExamApi"

declare global {
  namespace NodeJS {
    interface Global {
      ipcRenderer: IpcRenderer
    }
  }
  var ipcRenderer: IpcRenderer
}

contextBridge.exposeInMainWorld("electronAPI", {
  ...createExamApi(),
  ...createAuthApi(),
  ...createStudentApi(),
  ...createAnswerSheetApi(),
  ...createCropRegionApi(),
  ...createScoringApi(),
  ...createSubtotalApi(),
  ...createExportApi(),
  ...createDrawingApi(),
  ...createArchiveApi(),
  ...createExamClassroomApi(),
  ...createUserExamApi(),
  ...createSettingsApi(),
  ...createPdfToolsApi(),
  ...createGradeApi(),
  ...createCourseworkApi(),
  ...createTagApi(),
  ...createOmrApi(),
  ...createAnswerSheetBuilderApi(),
  ...createMiscApi(),
  ...createNavigationApi(),
  ...createSyncApi(),
  ...createAuditLogApi(),
})

process.once("loaded", () => {
  global.ipcRenderer = ipcRenderer
})
