/**
 * @fileoverview 線描画ユーティリティ
 * @description 波線、ジグザグ線、矢印などの特殊な線描画ロジック
 */

/**
 * 波線を描画
 * @param ctx キャンバスの2Dコンテキスト
 * @param startX 開始X座標
 * @param startY 開始Y座標
 * @param endX 終了X座標
 * @param endY 終了Y座標
 */
export function drawWaveLine(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): void {
  const dx = endX - startX
  const dy = endY - startY
  const distance = Math.sqrt(dx * dx + dy * dy)
  const waveLength = 20
  const amplitude = 10

  for (let i = 0; i <= distance; i += 2) {
    const progress = i / distance
    const x = startX + dx * progress
    const y =
      startY +
      dy * progress +
      Math.sin((i / waveLength) * Math.PI * 2) * amplitude

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
}

/**
 * ジグザグ線を描画
 * @param ctx キャンバスの2Dコンテキスト
 * @param startX 開始X座標
 * @param startY 開始Y座標
 * @param endX 終了X座標
 * @param endY 終了Y座標
 */
export function drawZigzagLine(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): void {
  const segments = 10
  const amplitude = 15

  for (let i = 0; i <= segments; i++) {
    const progress = i / segments
    const x = startX + (endX - startX) * progress
    const baseY = startY + (endY - startY) * progress
    const y = baseY + (i % 2 === 0 ? amplitude : -amplitude)

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
}

/**
 * 矢印の頭部分を描画
 * @param ctx キャンバスの2Dコンテキスト
 * @param fromX 矢印の始点X座標
 * @param fromY 矢印の始点Y座標
 * @param toX 矢印の終点X座標（矢印の頭がつく位置）
 * @param toY 矢印の終点Y座標（矢印の頭がつく位置）
 */
export function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): void {
  const angle = Math.atan2(toY - fromY, toX - fromX)
  const arrowLength = 15
  const arrowAngle = Math.PI / 6

  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(
    toX - arrowLength * Math.cos(angle - arrowAngle),
    toY - arrowLength * Math.sin(angle - arrowAngle),
  )
  ctx.moveTo(toX, toY)
  ctx.lineTo(
    toX - arrowLength * Math.cos(angle + arrowAngle),
    toY - arrowLength * Math.sin(angle + arrowAngle),
  )
  ctx.stroke()
}
