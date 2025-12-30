/**
 * @fileoverview 座標変換ユーティリティ
 * @description キャンバス上のマウス座標と相対座標の変換を行う
 */

import React from "react"

/**
 * マウス座標を相対座標に変換
 * @param event マウスイベント
 * @param canvas キャンバス要素
 * @returns 相対座標 (0.0 - 1.0)
 */
export function getRelativeCoordinates(
  event: React.MouseEvent,
  canvas: HTMLCanvasElement
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
}

/**
 * 相対座標を絶対座標に変換
 * @param relativeX 相対X座標 (0.0 - 1.0)
 * @param relativeY 相対Y座標 (0.0 - 1.0)
 * @param canvas キャンバス要素
 * @returns 絶対座標 (ピクセル)
 */
export function getAbsoluteCoordinates(
  relativeX: number,
  relativeY: number,
  canvas: HTMLCanvasElement
): { x: number; y: number } {
  return {
    x: relativeX * canvas.width,
    y: relativeY * canvas.height,
  }
}
