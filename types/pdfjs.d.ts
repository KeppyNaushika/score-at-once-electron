// PDF.js type definitions

declare module 'pdfjs-dist/legacy/build/pdf.min.mjs' {
  export * from 'pdfjs-dist'
}

declare module 'pdfjs-dist' {
  export interface PDFDocumentProxy {
    numPages: number
    getPage(pageNum: number): Promise<PDFPageProxy>
  }

  export interface PDFPageProxy {
    getViewport(params: { scale: number }): PDFPageViewport
    render(params: {
      canvasContext: CanvasRenderingContext2D
      viewport: PDFPageViewport
    }): PDFRenderTask
  }

  export interface PDFPageViewport {
    width: number
    height: number
  }

  export interface PDFRenderTask {
    promise: Promise<void>
  }

  export interface LoadingTask {
    promise: Promise<PDFDocumentProxy>
  }

  export const GlobalWorkerOptions: {
    workerSrc: string
  }

  export function getDocument(params: {
    data: ArrayBuffer
    password?: string
  }): LoadingTask
}