/**
 * 採点枠検出 — メインスレッド側オーケストレーター
 *
 * メインスレッドは画像を取りに行く（fetch、非同期）だけで、デコード・縮小・
 * 検出はすべて Web Worker に任せる。利用者の操作（ページ切替・枠の作成・
 * ドラッグ）を検出が待たせないようにするため。
 *
 * ## 処理フロー
 *
 * 1. メインスレッド: 画像URLを fetch して Blob を得る
 * 2. メインスレッド: Blob を Worker に渡す
 * 3. Worker: デコード → 縮小 → グレースケール → 二値化 → 膨張 → 線検出 → 矩形構築
 * 4. メインスレッド: Worker結果にIDを付与して返却
 *
 * ## 取り消し
 *
 * 検出は一度に1つだけ走らせる。新しい検出を始めたとき、または呼び出し側が
 * AbortSignal で取り消したとき、走っている検出は Worker ごと止める（Worker の中の
 * 計算は同期なので、途中で止めるには terminate するしかない）。次の検出では
 * Worker を作り直す。止めた検出の Promise は AbortError で reject する。
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

/** Worker に渡して応答を待っている検出 */
interface PendingDetection {
  requestId: number
  resolve: (rects: DetectedRect[]) => void
  reject: (error: Error) => void
}

/** 取り消したことを表すエラー（fetch の取り消しと同じ形） */
const createAbortError = (): DOMException =>
  new DOMException("Frame detection was aborted", "AbortError")

/**
 * 枠検出クラス（Worker委譲版）
 */
class FrameDetector {
  private worker: Worker | null = null
  private pendingDetection: PendingDetection | null = null
  private nextRequestId = 1

  /**
   * 画像URLから検出を実行
   */
  async detectFromUrl(
    imageUrl: string,
    settings: DetectionSettings,
    pageSize: string,
    signal: AbortSignal
  ): Promise<DetectedRect[]> {
    const response = await fetch(imageUrl, { signal })
    if (!response.ok) {
      throw new Error(`Failed to load image: ${response.status}`)
    }
    const image = await response.blob()
    if (signal.aborted) {
      throw createAbortError()
    }

    return this.detectWithWorker(image, settings, pageSize, signal)
  }

  /**
   * Workerに検出処理を委譲
   */
  private detectWithWorker(
    image: Blob,
    settings: DetectionSettings,
    pageSize: string,
    signal: AbortSignal
  ): Promise<DetectedRect[]> {
    // 前の検出がまだ走っていれば止める。結果を待つ者はもういない
    this.cancelPendingDetection()

    const worker = this.getOrCreateWorker()
    const requestId = this.nextRequestId++

    return new Promise((resolve, reject) => {
      const onAbort = () => {
        if (this.pendingDetection?.requestId === requestId) {
          this.cancelPendingDetection()
        }
      }

      this.pendingDetection = {
        requestId,
        resolve: (rects) => {
          signal.removeEventListener("abort", onAbort)
          resolve(rects)
        },
        reject: (error) => {
          signal.removeEventListener("abort", onAbort)
          reject(error)
        },
      }
      signal.addEventListener("abort", onAbort, { once: true })

      const request: DetectionRequest = {
        type: "detect",
        requestId,
        image,
        settings,
        pageSize,
      }
      worker.postMessage(request)
    })
  }

  /**
   * Worker からの応答。待っている検出の番号と違う応答（取り消した検出の残り）は捨てる
   */
  private handleResponse(response: DetectionResponse): void {
    const pendingDetection = this.pendingDetection
    if (
      !pendingDetection ||
      pendingDetection.requestId !== response.requestId
    ) {
      return
    }
    this.pendingDetection = null

    if (response.type === "error") {
      pendingDetection.reject(new Error(`Worker error: ${response.message}`))
      return
    }
    const rects: DetectedRect[] = response.rects.map((rect) => ({
      id: generateId(),
      ...rect,
    }))
    pendingDetection.resolve(rects)
  }

  /**
   * Worker そのものが落ちた。待っている検出を失敗にし、次は作り直す
   */
  private handleWorkerError(worker: Worker, event: ErrorEvent): void {
    if (this.worker !== worker) return
    worker.terminate()
    this.worker = null

    const pendingDetection = this.pendingDetection
    this.pendingDetection = null
    pendingDetection?.reject(new Error(`Worker error: ${event.message}`))
  }

  /**
   * 走っている検出を Worker ごと止める
   */
  private cancelPendingDetection(): void {
    const pendingDetection = this.pendingDetection
    if (!pendingDetection) return
    this.pendingDetection = null

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    pendingDetection.reject(createAbortError())
  }

  /**
   * Workerの遅延生成・再利用
   */
  private getOrCreateWorker(): Worker {
    if (!this.worker) {
      // `new Worker(new URL(..., import.meta.url))` の形のまま書く。バンドラはこの形を
      // 見て Worker のスクリプトを別に束ねる
      const worker = new Worker(
        new URL("./frameDetector.worker.ts", import.meta.url)
      )
      worker.addEventListener(
        "message",
        (event: MessageEvent<DetectionResponse>) =>
          this.handleResponse(event.data)
      )
      worker.addEventListener("error", (event: ErrorEvent) =>
        this.handleWorkerError(worker, event)
      )
      this.worker = worker
    }
    return this.worker
  }
}

/** FrameDetectorのシングルトンインスタンス */
export const frameDetector = new FrameDetector()
