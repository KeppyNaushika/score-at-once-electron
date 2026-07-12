// =============================================================================
// Electron IPC API 型定義 - メインオーケストレーター
// =============================================================================
//
// MyAPI は各ドメイン別サブインターフェースから合成されます。
// 各ドメインの詳細は ./electron/ ディレクトリを参照してください。
// =============================================================================

// ---------------------------------------------------------------------------
// ドメイン別サブインターフェースのインポート
// ---------------------------------------------------------------------------

import type { AnswerSheetBuilderAPI } from "./electron/answerSheetBuilderApi"
import type { ArchiveAPI } from "./electron/archiveApi"
import type { AuditLogAPI } from "./electron/auditLogApi"
import type { ClassroomStudentAPI } from "./electron/classroomStudentApi"
import type { CourseworkAPI } from "./electron/courseworkApi"
import type { CropRegionAPI } from "./electron/cropRegionApi"
import type { DataManagementAPI } from "./electron/dataManagementApi"
import type { DrawingAPI } from "./electron/drawingApi"
import type { ExamAPI } from "./electron/examApi"
import type { ExamClassroomAPI } from "./electron/examClassroomApi"
import type { ExportAPI } from "./electron/exportApi"
import type { GradeAPI } from "./electron/gradeApi"
import type { MasterImageAPI } from "./electron/masterImageApi"
import type { NavigationAPI } from "./electron/navigationApi"
import type { OmrAPI } from "./electron/omrApi"
import type { PdfToolsAPI } from "./electron/pdfToolsApi"
import type { ScoringAPI } from "./electron/scoringApi"
import type { SettingsAPI } from "./electron/settingsApi"
import type { StudentAnswerAPI } from "./electron/studentAnswerApi"
import type { SyncAPI } from "./electron/syncApi"
import type { TagAPI } from "./electron/tagApi"
import type { UserAuthAPI } from "./electron/userAuthApi"
import type { UserExamAPI } from "./electron/userExamApi"

// ---------------------------------------------------------------------------
// PDF.js module declarations
// ---------------------------------------------------------------------------

declare module "pdfjs-dist/legacy/build/pdf.min.mjs" {
  export * from "pdfjs-dist"
  export { default } from "pdfjs-dist"
}

declare module "pdfjs-dist" {
  export const GlobalWorkerOptions: {
    workerSrc: string
  }

  export function getDocument(params: {
    data: ArrayBuffer
    password?: string
  }): {
    promise: Promise<{
      numPages: number
      getPage(pageNum: number): Promise<{
        getViewport(options: { scale: number }): {
          width: number
          height: number
        }
        render(options: {
          canvasContext: CanvasRenderingContext2D
          viewport: { width: number; height: number }
        }): { promise: Promise<void> }
      }>
    }>
  }
}

// ---------------------------------------------------------------------------
// MyAPI - 合成インターフェース
// ---------------------------------------------------------------------------

export interface MyAPI
  extends
    ExamAPI,
    UserAuthAPI,
    StudentAnswerAPI,
    ClassroomStudentAPI,
    MasterImageAPI,
    CropRegionAPI,
    ScoringAPI,
    ExportAPI,
    ArchiveAPI,
    DrawingAPI,
    ExamClassroomAPI,
    UserExamAPI,
    SettingsAPI,
    PdfToolsAPI,
    GradeAPI,
    CourseworkAPI,
    TagAPI,
    AnswerSheetBuilderAPI,
    OmrAPI,
    DataManagementAPI,
    SyncAPI,
    NavigationAPI,
    AuditLogAPI {}

// ---------------------------------------------------------------------------
// Global Window declarations
// ---------------------------------------------------------------------------

// MathJax 3 ブラウザ版の型定義
interface MathJaxObject {
  startup?: {
    document?: unknown
    defaultReady?: () => void | Promise<void>
  }
  typesetPromise?: (elements?: (Element | null)[]) => Promise<void>
  typeset?: (elements?: (Element | null)[]) => void
  tex2svg?: (tex: string, options?: Record<string, unknown>) => Element
}

declare global {
  interface Window {
    electronAPI: MyAPI
    mathJaxReady?: boolean
    MathJax?: MathJaxObject
  }
}
