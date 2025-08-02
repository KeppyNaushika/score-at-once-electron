// 採点用カラーパレット（彩度が高く目立つ色）
export const COLOR_PALETTE = [
  "#000000", // 黒
  "#ff0000", // 赤
  "#ff8000", // オレンジ
  "#ffd700", // 金
  "#00ff00", // 緑
  "#00ffff", // シアン
  "#0000ff", // 青
  "#8000ff", // 紫
] as const

// デフォルトの描画設定
export const DEFAULT_DRAWING_SETTINGS = {
  strokeColor: "#ef4444",
  strokeWidth: 3,
  lineStyle: "solid" as const,
  fontSize: 16,
} as const

// 描画時の許容誤差
export const DRAWING_TOLERANCES = {
  hitTest: 0.03,
  lineDistance: 0.02,
  rectangleEdge: 0.02,
} as const

// ズーム設定
export const ZOOM_SETTINGS = {
  min: 0.1,
  max: 5.0,
  step: 0.1,
  wheelDelta: 0.9, // ズームアウト時の倍率
  zoomInDelta: 1.1, // ズームイン時の倍率
} as const

// パン設定
export const PAN_SETTINGS = {
  arrowKeyStep: 20, // 矢印キーでのパン量
  pageKeyStep: 100, // Page Up/Downでのパン量
} as const