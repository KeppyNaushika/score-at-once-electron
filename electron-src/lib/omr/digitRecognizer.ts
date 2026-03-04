/**
 * 手書き数字認識エンジン
 *
 * Mark2のType 2認識を移植。
 * ONNX Runtime で MNIST 分類モデルを使用し、
 * 手書き数字画像から数字（0-9）を認識する。
 *
 * アルゴリズム:
 * 1. 座標変換で数字欄の実画像位置を取得
 * 2. 領域切り出し → グレースケール化 → 28x28リサイズ（sharp）
 * 3. 手書き文字の重心をセンタリング
 * 4. 0-1正規化 → ONNX推論 → 数字（0-9）+ 信頼度
 */

import fs from "fs"
import path from "path"
import sharp from "sharp"

import type { ComputedCell } from "../../../types/answerSheetLayout.types"
import type {
  BoundingBox,
  CoordinateTransform,
  OMRCellResult,
  OMRRecognitionParams,
  RawImageData,
} from "../../../types/omr.types"
import { normalizedRectToPixelRect } from "./coordinateTransform"

// ONNX Runtime（遅延ロード）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ort: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let session: any = null
let sessionLoadFailed = false

/**
 * MNISTモデルのファイルパスを解決
 */
function getModelPath(): string {
  // Electron packaged app の場合
  const appPath =
    process.env.NODE_ENV === "production"
      ? path.join(process.resourcesPath ?? "", "public", "models", "mnist.onnx")
      : path.join(process.cwd(), "public", "models", "mnist.onnx")
  return appPath
}

/**
 * ONNX セッションを初期化（遅延ロード）
 */
async function ensureSession(): Promise<boolean> {
  if (session) return true
  if (sessionLoadFailed) return false

  try {
    const modelPath = getModelPath()
    if (!fs.existsSync(modelPath)) {
      console.warn(
        `[OMR] MNISTモデルが見つかりません: ${modelPath}. 手書き数字認識は無効です。`
      )
      sessionLoadFailed = true
      return false
    }

    // onnxruntime-nodeを動的インポート
    if (!ort) {
      ort = await import("onnxruntime-node")
    }

    session = await ort.InferenceSession.create(modelPath)
    return true
  } catch (error) {
    console.error("[OMR] MNISTモデルのロードに失敗:", error)
    sessionLoadFailed = true
    return false
  }
}

/**
 * 画像領域から28x28のMNIST入力テンソルを作成
 *
 * 1. 領域をグレースケール化
 * 2. 28x28にリサイズ
 * 3. 反転（白背景黒文字 → 黒背景白文字）
 * 4. 0-1に正規化
 */
async function prepareDigitInput(
  rawImage: RawImageData,
  bbox: BoundingBox
): Promise<Float32Array> {
  // 領域をクランプ
  const x0 = Math.max(0, Math.floor(bbox.x))
  const y0 = Math.max(0, Math.floor(bbox.y))
  const x1 = Math.min(rawImage.width, Math.ceil(bbox.x + bbox.width))
  const y1 = Math.min(rawImage.height, Math.ceil(bbox.y + bbox.height))
  const regionW = x1 - x0
  const regionH = y1 - y0

  if (regionW <= 0 || regionH <= 0) {
    return new Float32Array(28 * 28)
  }

  // RAW RGBバッファから領域を切り出し
  const regionBuf = Buffer.alloc(regionW * regionH * rawImage.channels)
  for (let row = 0; row < regionH; row++) {
    const srcOffset = ((y0 + row) * rawImage.width + x0) * rawImage.channels
    const dstOffset = row * regionW * rawImage.channels
    rawImage.data.copy(
      regionBuf,
      dstOffset,
      srcOffset,
      srcOffset + regionW * rawImage.channels
    )
  }

  // sharpでグレースケール→28x28リサイズ
  const resized = await sharp(regionBuf, {
    raw: {
      width: regionW,
      height: regionH,
      channels: rawImage.channels as 1 | 2 | 3 | 4,
    },
  })
    .greyscale()
    .resize(28, 28, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
    .raw()
    .toBuffer()

  // Float32Arrayに変換（反転 + 正規化）
  const tensor = new Float32Array(28 * 28)
  for (let i = 0; i < 28 * 28; i++) {
    // MNISTは黒背景白文字なので反転: (255 - pixel) / 255
    tensor[i] = (255 - resized[i]) / 255
  }

  return tensor
}

/**
 * ONNX推論で数字を認識
 *
 * @returns [認識された数字, 信頼度(0-1)]
 */
async function inferDigit(
  input: Float32Array
): Promise<[number, number] | null> {
  if (!session || !ort) return null

  try {
    const inputTensor = new ort.Tensor("float32", input, [1, 1, 28, 28])
    const feeds: Record<string, InstanceType<typeof ort.Tensor>> = {}

    // モデルの入力名を取得
    const inputName = session.inputNames[0] ?? "input"
    feeds[inputName] = inputTensor

    const results = await session.run(feeds)
    const outputName = session.outputNames[0] ?? "output"
    const output = results[outputName]

    if (!output) return null

    const data = output.data as Float32Array

    // softmaxして最大値のインデックスを取得
    let maxVal = -Infinity
    let maxIdx = 0
    let sumExp = 0

    for (let i = 0; i < 10; i++) {
      const v = Math.exp(data[i])
      sumExp += v
      if (v > maxVal) {
        maxVal = v
        maxIdx = i
      }
    }

    const confidence = maxVal / sumExp

    return [maxIdx, confidence]
  } catch (error) {
    console.error("[OMR] ONNX推論エラー:", error)
    return null
  }
}

/**
 * 1つのセルの手書き数字を認識
 */
export async function recognizeDigitCell(
  cell: ComputedCell,
  rawImage: RawImageData,
  transform: CoordinateTransform,
  params: OMRRecognitionParams
): Promise<OMRCellResult> {
  const modelAvailable = await ensureSession()

  if (
    !modelAvailable ||
    !cell.omrDigitBoxes ||
    cell.omrDigitBoxes.length === 0
  ) {
    return {
      label: cell.label,
      questionPath: cell.questionPath,
      recognizedValues: [],
      confidence: 0,
      autoScoreStatus: "no_answer",
    }
  }

  const recognizedDigits: string[] = []
  let totalConfidence = 0

  for (const box of cell.omrDigitBoxes) {
    // 正規化座標→ピクセル座標
    const pixelRect = normalizedRectToPixelRect(
      box.normalizedX,
      box.normalizedY,
      box.normalizedW,
      box.normalizedH,
      transform
    )

    // MNIST入力テンソル作成
    const input = await prepareDigitInput(rawImage, pixelRect)

    // 空欄チェック: ほとんど白い場合はスキップ
    // colorThresholdを0-1スケールに変換して空欄判定に利用
    const blankThreshold = params.colorThreshold / 255
    const nonZeroCount = input.filter((v) => v > blankThreshold).length
    if (nonZeroCount < 10) {
      recognizedDigits.push("")
      continue
    }

    // ONNX推論
    const result = await inferDigit(input)
    if (result) {
      const [digit, conf] = result
      recognizedDigits.push(String(digit))
      totalConfidence += conf
    } else {
      recognizedDigits.push("")
    }
  }

  const validDigits = recognizedDigits.filter((d) => d !== "")
  const recognizedValue = recognizedDigits.join("")
  const confidence =
    validDigits.length > 0 ? totalConfidence / validDigits.length : 0

  return {
    label: cell.label,
    questionPath: cell.questionPath,
    recognizedValues: recognizedValue ? [recognizedValue] : [],
    confidence,
    autoScoreStatus: recognizedValue ? undefined : "no_answer",
  }
}
