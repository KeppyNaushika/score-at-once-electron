/**
 * 採点枠検出 — メインスレッド側オーケストレーター
 *
 * 画像のロード（DOM操作）はメインスレッドで行い、
 * 重い計算処理はWeb Workerに委譲してUIブロッキングを防ぐ。
 *
 * ## 処理フロー
 *
 * 1. メインスレッド: 画像をCanvasにロード＆ダウンサンプリング
 * 2. メインスレッド: ImageDataのArrayBufferをWorkerに転送
 * 3. Worker: グレースケール → 二値化 → 膨張 → 線検出 → 矩形構築
 * 4. メインスレッド: Worker結果にIDを付与して返却
 *
 * ## 座標系
 * - 出力: 相対座標（0-1、画像サイズ非依存）
 */

import type { DetectedRect, DetectionSettings } from "../types"
import type {
  DetectionRequest,
  DetectionResponse,
} from "./frameDetector.worker"
import { generateId } from "./rectUtils"

/** 枠検出用の最大長辺ピクセル数（これを超える画像は縮小して処理） */
const MAX_PROCESSING_EDGE = 2000

/**
 * 枠検出クラス（Worker委譲版）
 */
class FrameDetector {
  private worker: Worker | null = null

  /**
   * 画像URLから検出を実行
   */
  async detectFromUrl(
    imageUrl: string,
    settings: DetectionSettings
  ): Promise<DetectedRect[]> {
    const { imageData, width, height } = await this.loadImageData(imageUrl)

    return this.detectWithWorker(imageData, width, height, settings)
  }

  /**
   * 画像をロードしてダウンサンプリング済みImageDataを取得
   */
  private async loadImageData(
    imageUrl: string
  ): Promise<{ imageData: ImageData; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        let drawWidth = img.width
        let drawHeight = img.height
        const maxEdge = Math.max(drawWidth, drawHeight)
        if (maxEdge > MAX_PROCESSING_EDGE) {
          const scale = MAX_PROCESSING_EDGE / maxEdge
          drawWidth = Math.round(drawWidth * scale)
          drawHeight = Math.round(drawHeight * scale)
        }

        const canvas = document.createElement("canvas")
        canvas.width = drawWidth
        canvas.height = drawHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Failed to get canvas context"))
          return
        }
        ctx.drawImage(img, 0, 0, drawWidth, drawHeight)
        const imageData = ctx.getImageData(0, 0, drawWidth, drawHeight)
        resolve({ imageData, width: drawWidth, height: drawHeight })
      }
      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = imageUrl
    })
  }

  /**
   * Workerに検出処理を委譲
   */
  private detectWithWorker(
    imageData: ImageData,
    width: number,
    height: number,
    settings: DetectionSettings
  ): Promise<DetectedRect[]> {
    const worker = this.getOrCreateWorker()

    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<DetectionResponse>) => {
        worker.removeEventListener("message", onMessage)
        worker.removeEventListener("error", onError)

        const rects: DetectedRect[] = event.data.rects.map((rect) => ({
          id: generateId(),
          ...rect,
        }))
        resolve(rects)
      }

      const onError = (event: ErrorEvent) => {
        worker.removeEventListener("message", onMessage)
        worker.removeEventListener("error", onError)
        reject(new Error(`Worker error: ${event.message}`))
      }

      worker.addEventListener("message", onMessage)
      worker.addEventListener("error", onError)

      // ArrayBufferを転送（コピーではなく所有権移譲）
      const buffer = imageData.data.buffer.slice(0)
      const request: DetectionRequest = {
        type: "detect",
        imageBuffer: buffer,
        width,
        height,
        settings: {
          lineExtension: settings.lineExtension,
          minWidth: settings.minWidth,
          minHeight: settings.minHeight,
          sensitivity: settings.sensitivity,
        },
      }
      worker.postMessage(request, [buffer])
    })
  }

  /**
   * Workerの遅延生成・再利用
   */
  private getOrCreateWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL("./frameDetector.worker.ts", import.meta.url)
      )
    }
    return this.worker
  }

  /**
   * Workerを終了
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}

/** FrameDetectorのシングルトンインスタンス */
export const frameDetector = new FrameDetector()
