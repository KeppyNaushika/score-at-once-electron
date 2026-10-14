/**
 * 枠検出Web Worker
 *
 * メインスレッドから画像（Blob）を受け取り、デコード・縮小・枠検出までを
 * すべてバックグラウンドで行う。メインスレッドで画像を描いて画素を読み出すと、
 * 大きな画像ではそれだけで画面が固まるため、デコードもここで持つ。
 *
 * 検出の計算そのものは `frameDetection.ts`（純粋関数）にある。
 */

import type { DetectionSettings } from "../types"
import {
  type DetectedRectResult,
  detectRects,
  MAX_PROCESSING_EDGE,
} from "./frameDetection"

/** Workerへのリクエスト */
export interface DetectionRequest {
  type: "detect"
  /** 応答を対応付ける番号。メインスレッドは最新の番号以外の応答を捨てる */
  requestId: number
  image: Blob
  settings: DetectionSettings
  /** ページの用紙サイズ名（"A4"等）。mm の設定を画素に換算するのに使う */
  pageSize: string
}

/** Workerからのレスポンス */
export type DetectionResponse =
  | { type: "result"; requestId: number; rects: DetectedRectResult[] }
  | { type: "error"; requestId: number; message: string }

/**
 * 画像をデコードし、長辺が MAX_PROCESSING_EDGE を超えるなら縮小して画素を取り出す
 */
async function decodeImagePixels(
  image: Blob
): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> {
  const bitmap = await createImageBitmap(image)
  try {
    let drawWidth = bitmap.width
    let drawHeight = bitmap.height
    const maxEdge = Math.max(drawWidth, drawHeight)
    if (maxEdge > MAX_PROCESSING_EDGE) {
      const scale = MAX_PROCESSING_EDGE / maxEdge
      drawWidth = Math.round(drawWidth * scale)
      drawHeight = Math.round(drawHeight * scale)
    }

    const canvas = new OffscreenCanvas(drawWidth, drawHeight)
    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Failed to get canvas context")
    }
    context.drawImage(bitmap, 0, 0, drawWidth, drawHeight)
    const pixels = context.getImageData(0, 0, drawWidth, drawHeight).data
    return { pixels, width: drawWidth, height: drawHeight }
  } finally {
    bitmap.close()
  }
}

// --- Worker メッセージハンドラ ---

self.onmessage = async (event: MessageEvent<DetectionRequest>) => {
  const { requestId, image, settings, pageSize } = event.data
  try {
    const { pixels, width, height } = await decodeImagePixels(image)
    const rects = detectRects(pixels, width, height, settings, pageSize)
    const response: DetectionResponse = { type: "result", requestId, rects }
    self.postMessage(response)
  } catch (error) {
    const response: DetectionResponse = {
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response)
  }
}
