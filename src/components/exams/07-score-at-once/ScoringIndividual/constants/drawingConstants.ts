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

// デフォルトの描画設定（mm単位）
export const DEFAULT_DRAWING_SETTINGS = {
  strokeColor: "#ef4444",
  strokeWidth: 0.5,
  lineStyle: "solid" as const,
  fontSize: 5.0,
} as const

// 描画時の許容誤差（正規化座標 0-1）
export const DRAWING_TOLERANCES = {
  hitTest: 0.04, // 汎用的な当たり判定（未使用、後方互換用）
  lineDistance: 0.003, // 線の当たり判定幅（片側）
  rectangleEdge: 0.03, // 矩形の辺の判定（未使用、後方互換用）
  handleRadius: 0.003, // 端点/角ハンドルの半径（線と同等）
} as const

// ズーム設定
export const ZOOM_SETTINGS = {
  min: 0.1,
  max: 5.0,
  step: 0.1,
  wheelDelta: 0.9, // ズームアウト時の倍率
  zoomInDelta: 1.1, // ズームイン時の倍率
} as const
