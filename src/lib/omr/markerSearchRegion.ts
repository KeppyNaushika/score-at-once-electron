/**
 * 隅のマーカーの探索範囲（画像の幅・高さに対する比）。
 *
 * 検出器（electron-src/lib/omr/cornerMarkerDetector.ts）と、解答用紙作成で
 * マーカーが探索範囲に収まるかを検査する側（answer-sheet-builder の omrMarkers.ts）の
 * 両方がここを読む。片方だけ変えると、検査を通った用紙が検出できなくなる
 */

/** 画像の端から外す帯（スキャナの黒い縁を拾わないため） */
export const MARKER_SEARCH_MARGIN_RATIO = 0.01

/** 探索範囲の幅 */
export const MARKER_SEARCH_WIDTH_RATIO = 0.3

/** 探索範囲の高さ */
export const MARKER_SEARCH_HEIGHT_RATIO = 0.08
