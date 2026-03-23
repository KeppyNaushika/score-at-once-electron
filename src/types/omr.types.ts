/**
 * OMR（光学マーク認識）関連の型定義
 *
 * Mark2アルゴリズムをベースとしたOMR認識パイプラインの型。
 * コーナーマーカー検出、座標変換、マーク認識、手書き数字認識、自動採点。
 */

// =====================
// 基本型
// =====================

export interface Point {
  x: number
  y: number
}

// =====================
// OMRセル設定（問題定義に紐付く）
// =====================

export type OMRAnswerType = "choice" | "handwritten-digit"

export interface OMRChoiceConfig {
  type: "choice"
  /** 選択肢数（2-10） */
  numChoices: number
  /** 選択肢ラベル（"ア","イ","ウ"... or "A","B","C"...） */
  labels: string[]
  /** 正解インデックス（複数対応） */
  correctAnswers: number[]
  /** バブル配置方向 */
  layout: "horizontal" | "vertical"
}

export interface OMRDigitConfig {
  type: "handwritten-digit"
  /** 桁数（1-5） */
  numDigits: number
  /** 正解文字列（"42" など） */
  correctAnswer?: string
}

export type OMRCellConfig = OMRChoiceConfig | OMRDigitConfig

// =====================
// コーナーマーカー検出
// =====================

export interface DetectedCornerMarker {
  centerX: number
  centerY: number
  size: number
  corner: "TL" | "TR" | "BL" | "BR"
  confidence: number
}

/** コーナーごとの検出診断情報 */
export interface CornerDiagnostics {
  corner: "TL" | "TR" | "BL" | "BR"
  detected: boolean
  /** 探索領域内の黒ピクセル数 */
  darkPixels: number
  /** 探索領域の総ピクセル数 */
  totalPixels: number
  /** 最大連結成分の面積（px） */
  largestComponentSize: number
  /** 最大連結成分のアスペクト比（0-1、1が正方形） */
  largestComponentAspect: number
  /** 検出失敗理由 */
  failReason?: string
}

export interface MarkerDetectionResult {
  success: boolean
  markers: DetectedCornerMarker[]
  imageWidth: number
  imageHeight: number
  error?: string
  /** 各コーナーの診断情報（デバッグ用） */
  diagnostics?: CornerDiagnostics[]
}

// =====================
// 座標変換
// =====================

export interface CoordinateTransform {
  /** 検出された4隅のピクセル座標 [TL, TR, BL, BR] */
  detectedCorners: [Point, Point, Point, Point]
  /** 期待される4隅の0-1正規化座標 [TL, TR, BL, BR] */
  expectedCorners: [Point, Point, Point, Point]
  imageWidth: number
  imageHeight: number
}

// =====================
// OMR認識パラメータ
// =====================

export interface OMRRecognitionParams {
  /** ピクセル暗さ閾値（0-255、デフォルト25） */
  colorThreshold: number
  /** 塗りつぶし面積閾値（0-1、デフォルト0.4） */
  areaThreshold: number
  /** 信頼度閾値（この値未満は low_confidence としてフラグ、デフォルト0.7） */
  confidenceThreshold?: number
}

export const DEFAULT_OMR_RECOGNITION_PARAMS: OMRRecognitionParams = {
  colorThreshold: 25,
  areaThreshold: 0.4,
}

// =====================
// OMR認識結果
// =====================

export interface OMRCellResult {
  /** セルラベル */
  label: string
  /** 問題パス [majorIndex, subIndex, branchIndex?] */
  questionPath: number[]
  /** 認識された値（選択肢ラベル or 数字） */
  recognizedValues: string[]
  /** 各選択肢の塗りつぶし率（choiceセルのみ） */
  fillRatios?: number[]
  /** 認識信頼度（0-1） */
  confidence: number
  /** 自動採点結果 */
  autoScoreStatus?: "correct" | "incorrect" | "no_answer" | "ambiguous"
}

export interface OMRSheetResult {
  success: boolean
  studentId?: string
  pageIndex: number
  markerDetection: MarkerDetectionResult
  cellResults: OMRCellResult[]
  error?: string
}

// =====================
// バッチ処理進捗
// =====================

export interface OMRBatchProgress {
  total: number
  processed: number
  succeeded: number
  failed: number
  currentStudentName?: string
}

// =====================
// バブル・数字欄の計算結果（ComputedCell拡張用）
// =====================

export interface ComputedOMRBubble {
  /** バブル中心X（0-1正規化） */
  normalizedCx: number
  /** バブル中心Y（0-1正規化） */
  normalizedCy: number
  /** バブル幅（0-1正規化）— 共通テスト準拠の横長楕円 */
  normalizedWidth: number
  /** バブル高さ（0-1正規化）— 共通テスト準拠の横長楕円 */
  normalizedHeight: number
  /** 選択肢インデックス */
  choiceIndex: number
  /** ラベル（"ア", "イ" など） */
  label: string
}

export interface ComputedOMRDigitBox {
  /** 数字欄左上X（0-1正規化） */
  normalizedX: number
  /** 数字欄左上Y（0-1正規化） */
  normalizedY: number
  /** 数字欄幅（0-1正規化） */
  normalizedW: number
  /** 数字欄高さ（0-1正規化） */
  normalizedH: number
  /** 桁インデックス（0始まり） */
  digitIndex: number
}

// =====================
// CropRegion OMR設定（DB管理）
// =====================

export interface CropRegionOmrChoiceOptionData {
  id: string
  omrConfigId: string
  choiceIndex: number
  label: string
  isCorrect: boolean
  shape: string | null
  normalizedCx: number | null
  normalizedCy: number | null
  normalizedWidth: number | null
  normalizedHeight: number | null
  createdAt: Date
  updatedAt: Date
}

export interface CropRegionOmrDigitBoxData {
  id: string
  omrConfigId: string
  digitIndex: number
  normalizedX: number
  normalizedY: number
  normalizedW: number
  normalizedH: number
  createdAt: Date
  updatedAt: Date
}

export interface CropRegionOmrConfigWithOptions {
  id: string
  cropRegionId: string
  type: string // "choice" | "handwritten-digit"
  numChoices: number | null
  choiceLayout: string | null
  numDigits: number | null
  correctAnswer: string | null
  colorThreshold: number | null
  areaThreshold: number | null
  createdAt: Date
  updatedAt: Date
  choiceOptions: CropRegionOmrChoiceOptionData[]
  digitBoxes: CropRegionOmrDigitBoxData[]
}

// =====================
// 画像処理ユーティリティ
// =====================

export interface RawImageData {
  data: Buffer
  width: number
  height: number
  channels: number
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}
