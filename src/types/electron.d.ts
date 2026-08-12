// =============================================================================
// Electron IPC API 型定義
// =============================================================================
//
// MyAPI は **preload が組み立てる実体から導出する**。renderer 側で契約を宣言し直さ
// ないので、ハンドラや preload の署名を変えると呼び出し側がコンパイルエラーになる。
//
// 引数・戻り値は preload の `invoke` を経由して main の登録簿（`Handlers`）まで
// 遡って決まる（electron-src/ipc-handlers/index.ts）。
//
// 値ではなく型としてのみ import すること（renderer は main を実行できない）。
// =============================================================================

import type { createAnswerSheetApi } from "@/electron-src/preload-apis/answerSheetApi"
import type { createAnswerSheetBuilderApi } from "@/electron-src/preload-apis/answerSheetBuilderApi"
import type { createArchiveApi } from "@/electron-src/preload-apis/archiveApi"
import type { createAuditLogApi } from "@/electron-src/preload-apis/auditLogApi"
import type { createAuthApi } from "@/electron-src/preload-apis/authApi"
import type { createCourseworkApi } from "@/electron-src/preload-apis/courseworkApi"
import type { createCropRegionApi } from "@/electron-src/preload-apis/cropRegionApi"
import type { createDrawingApi } from "@/electron-src/preload-apis/drawingApi"
import type { createExamApi } from "@/electron-src/preload-apis/examApi"
import type { createExamClassroomApi } from "@/electron-src/preload-apis/examClassroomApi"
import type { createExportApi } from "@/electron-src/preload-apis/exportApi"
import type { createGradeApi } from "@/electron-src/preload-apis/gradeApi"
import type { createMiscApi } from "@/electron-src/preload-apis/miscApi"
import type { createNavigationApi } from "@/electron-src/preload-apis/navigationApi"
import type { createOmrApi } from "@/electron-src/preload-apis/omrApi"
import type { createPdfToolsApi } from "@/electron-src/preload-apis/pdfToolsApi"
import type { createScoringApi } from "@/electron-src/preload-apis/scoringApi"
import type { createSettingsApi } from "@/electron-src/preload-apis/settingsApi"
import type { createStudentApi } from "@/electron-src/preload-apis/studentApi"
import type { createSubtotalApi } from "@/electron-src/preload-apis/subtotalApi"
import type { createSyncApi } from "@/electron-src/preload-apis/syncApi"
import type { createTagApi } from "@/electron-src/preload-apis/tagApi"
import type { createUserExamApi } from "@/electron-src/preload-apis/userExamApi"

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
// MyAPI - preload が公開する実体から導出する
// ---------------------------------------------------------------------------

/**
 * `window.electronAPI` の形。preload.ts の `exposeInMainWorld` に渡す
 * オブジェクトと同じ並びで合成する（片方に足してもう片方に足し忘れると、
 * その API だけ renderer から見えない）。
 */
export type MyAPI = ReturnType<typeof createExamApi> &
  ReturnType<typeof createAuthApi> &
  ReturnType<typeof createStudentApi> &
  ReturnType<typeof createAnswerSheetApi> &
  ReturnType<typeof createCropRegionApi> &
  ReturnType<typeof createScoringApi> &
  ReturnType<typeof createSubtotalApi> &
  ReturnType<typeof createExportApi> &
  ReturnType<typeof createDrawingApi> &
  ReturnType<typeof createArchiveApi> &
  ReturnType<typeof createExamClassroomApi> &
  ReturnType<typeof createUserExamApi> &
  ReturnType<typeof createSettingsApi> &
  ReturnType<typeof createPdfToolsApi> &
  ReturnType<typeof createGradeApi> &
  ReturnType<typeof createCourseworkApi> &
  ReturnType<typeof createTagApi> &
  ReturnType<typeof createOmrApi> &
  ReturnType<typeof createAnswerSheetBuilderApi> &
  ReturnType<typeof createMiscApi> &
  ReturnType<typeof createNavigationApi> &
  ReturnType<typeof createSyncApi> &
  ReturnType<typeof createAuditLogApi>

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
