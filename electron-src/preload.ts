import { contextBridge, IpcRenderer, ipcRenderer } from "electron"

import { createAnswerSheetApi } from "./preload-apis/answerSheetApi"
import { createAnswerSheetBuilderApi } from "./preload-apis/answerSheetBuilderApi"
import { createArchiveApi } from "./preload-apis/archiveApi"
import { createAuthApi } from "./preload-apis/authApi"
import { createCropRegionApi } from "./preload-apis/cropRegionApi"
import { createDrawingApi } from "./preload-apis/drawingApi"
import { createExamApi } from "./preload-apis/examApi"
import { createExamClassApi } from "./preload-apis/examClassApi"
import { createExportApi } from "./preload-apis/exportApi"
import { createGradeApi } from "./preload-apis/gradeApi"
import { createLegacyCompatApi } from "./preload-apis/legacyCompatApi"
import { createMiscApi } from "./preload-apis/miscApi"
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
  ...createLegacyCompatApi(),
  ...createExportApi(),
  ...createDrawingApi(),
  ...createArchiveApi(),
  ...createExamClassApi(),
  ...createUserExamApi(),
  ...createSettingsApi(),
  ...createPdfToolsApi(),
  ...createGradeApi(),
  ...createTagApi(),
  ...createOmrApi(),
  ...createAnswerSheetBuilderApi(),
  ...createMiscApi(),
  ...createSyncApi(),
})

process.once("loaded", () => {
  global.ipcRenderer = ipcRenderer
})
