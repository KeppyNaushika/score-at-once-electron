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
import type { ClassStudentAPI } from "./electron/classStudentApi"
import type { CropRegionAPI } from "./electron/cropRegionApi"
import type { DataManagementAPI } from "./electron/dataManagementApi"
import type { DrawingAPI } from "./electron/drawingApi"
import type { ExamAPI } from "./electron/examApi"
import type { ExamClassAPI } from "./electron/examClassApi"
import type { ExportAPI } from "./electron/exportApi"
import type { GradeAPI } from "./electron/gradeApi"
import type { MasterImageAPI } from "./electron/masterImageApi"
import type { OmrAPI } from "./electron/omrApi"
import type { PdfToolsAPI } from "./electron/pdfToolsApi"
import type { ScoringAPI } from "./electron/scoringApi"
import type { SettingsAPI } from "./electron/settingsApi"
import type { StudentAnswerAPI } from "./electron/studentAnswerApi"
import type { SubjectAPI } from "./electron/subjectApi"
import type { SyncAPI } from "./electron/syncApi"
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
    ClassStudentAPI,
    MasterImageAPI,
    CropRegionAPI,
    ScoringAPI,
    ExportAPI,
    ArchiveAPI,
    DrawingAPI,
    ExamClassAPI,
    UserExamAPI,
    SettingsAPI,
    PdfToolsAPI,
    GradeAPI,
    SubjectAPI,
    AnswerSheetBuilderAPI,
    OmrAPI,
    DataManagementAPI,
    SyncAPI {}

// ---------------------------------------------------------------------------
// Global Window declarations
// ---------------------------------------------------------------------------

// パスワード保護PDF変換用のコールバック型
interface ConvertedImage {
  name: string
  type: string
  buffer: ArrayBuffer
}

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
    // パスワード保護PDF変換用のグローバルコールバック（01-upload/utils/password-utils.ts用）
    __masterImagePasswordResolve?: ((images: ConvertedImage[]) => void) | null
    __masterImagePasswordReject?: ((reason?: unknown) => void) | null
    __masterImagePasswordFile?: File | null
    // パスワード保護PDF変換用のグローバルコールバック（hooks/useMasterAnswers.ts用）
    __masterAnswerPasswordResolve?: ((images: ConvertedImage[]) => void) | null
    __masterAnswerPasswordReject?: ((error: Error) => void) | null
    __masterAnswerPasswordFile?: File | null
  }
}
