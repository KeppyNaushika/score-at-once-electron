/**
 * 注釈の線種描画（個別表示・一覧・PDF の3経路が共有する）の形を縛る
 */
import { describe, expect, it } from "vitest"

import {
  drawAnnotationLine,
  drawAnnotationRectangle,
} from "@/lib/annotationShapeCanvas"

interface RecordedPath {
  points: [number, number][]
  painted: "stroke" | "fill"
}

/** パスごとに通った点と、塗ったか線を引いたかだけを記録する */
function createRecordingContext() {
  const paths: RecordedPath[] = []
  let points: [number, number][] = []
  let saveDepth = 0
  const cornerStyles: string[] = []
  const recorder = {
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    setLineDash: () => {},
    save: () => {
      saveDepth += 1
    },
    restore: () => {
      saveDepth -= 1
    },
    beginPath: () => {
      points = []
    },
    closePath: () => {},
    moveTo: (x: number, y: number) => points.push([x, y]),
    lineTo: (x: number, y: number) => points.push([x, y]),
    stroke: () => paths.push({ points, painted: "stroke" }),
    fill: () => paths.push({ points, painted: "fill" }),
    strokeRect: () => {
      cornerStyles.push(`${recorder.lineCap}/${recorder.lineJoin}`)
    },
  }
  return {
    // 記録に要るメソッドだけを持つ偽物を Canvas として渡す
    ctx: recorder as unknown as CanvasRenderingContext2D,
    paths,
    cornerStyles,
    getSaveDepth: () => saveDepth,
  }
}

const horizontalSegment = { startX: 10, startY: 50, endX: 110, endY: 50 }

describe("drawAnnotationLine", () => {
  it("ctx の状態を save / restore で囲む", () => {
    const recording = createRecordingContext()
    drawAnnotationLine(recording.ctx, horizontalSegment, "wave", 2)
    expect(recording.getSaveDepth()).toBe(0)
  })

  it("矢じりは先端から線の内側へ開く（終点は左へ、始点は右へ）", () => {
    const recording = createRecordingContext()
    drawAnnotationLine(recording.ctx, horizontalSegment, "both_arrow", 2)

    const [shaft, endHead, startHead] = recording.paths
    expect(shaft.painted).toBe("stroke")
    expect(endHead.painted).toBe("fill")
    expect(startHead.painted).toBe("fill")
    expect(endHead.points[0]).toEqual([110, 50])
    endHead.points.slice(1).forEach(([x]) => expect(x).toBeLessThan(110))
    expect(startHead.points[0]).toEqual([10, 50])
    startHead.points.slice(1).forEach(([x]) => expect(x).toBeGreaterThan(10))
  })

  it("波線は短くても64分割以上で描き、中央が頂点になる", () => {
    const recording = createRecordingContext()
    // 波長 200 (= 線幅 × 20) に対して長さ 100 なので、比例分の 16 分割より 64 が勝つ
    drawAnnotationLine(recording.ctx, horizontalSegment, "wave", 10)

    const [wave] = recording.paths
    expect(wave.points).toHaveLength(65)
    // 法線は (0, 1) なので、中央の点は振幅 15 (= 線幅 × 1.5) だけ下へ
    expect(wave.points[32][1]).toBeCloseTo(65)
  })

  it("ジグザグは始点・終点が直線上にあり、中央が頂点になる", () => {
    const recording = createRecordingContext()
    drawAnnotationLine(recording.ctx, horizontalSegment, "zigzag", 2)

    const [zigzag] = recording.paths
    expect(zigzag.points[0]).toEqual([10, 50])
    expect(zigzag.points.at(-1)).toEqual([110, 50])
    expect(zigzag.points).toContainEqual([60, 53])
  })
})

describe("線の長さ・線幅が 0 のとき", () => {
  const pointSegment = { startX: 30, startY: 30, endX: 30, endY: 30 }

  it.each(["wave", "zigzag"] as const)(
    "%s は長さ 0 でも NaN の点を打たず直線として描く",
    (lineStyle) => {
      const recording = createRecordingContext()
      drawAnnotationLine(recording.ctx, pointSegment, lineStyle, 2)
      const points = recording.paths.flatMap((path) => path.points)
      expect(points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true)
      expect(recording.paths).toHaveLength(1)
    }
  )

  it.each(["wave", "zigzag"] as const)(
    "%s は線幅 0 でも止まらず直線として描く",
    (lineStyle) => {
      const recording = createRecordingContext()
      drawAnnotationLine(recording.ctx, horizontalSegment, lineStyle, 0)
      expect(recording.paths).toEqual([
        { points: [[10, 50], [110, 50]], painted: "stroke" },
      ])
    }
  )
})

describe("drawAnnotationRectangle", () => {
  it("ctx が round でも角は尖らせて描き、状態を戻す", () => {
    const recording = createRecordingContext()
    recording.ctx.lineCap = "round"
    recording.ctx.lineJoin = "round"
    drawAnnotationRectangle(recording.ctx, { x: 0, y: 0, width: 10, height: 10 })
    expect(recording.cornerStyles).toEqual(["butt/miter"])
    expect(recording.getSaveDepth()).toBe(0)
  })
})
