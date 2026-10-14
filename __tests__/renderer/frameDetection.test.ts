/**
 * 採点枠検出（`frameDetection.ts`）を、コードで描いた合成画像で縛る。
 *
 * 方式は「罫線で囲まれた領域」: 罫線で閉じた白い領域だけが枠になり、
 * 他の枠に丸ごと含まれる枠は落ちる。壁に届かなくても十分に長い線は仕切り線として
 * 枠を割るが、割ってできる枠が最小高さ・最小幅に満たないなら割らない。
 */
import { describe, expect, it } from "vitest"

import { DEFAULT_DETECTION_SETTINGS } from "@/components/exams/02-template/constants/detection"
import type { DetectionSettings } from "@/components/exams/02-template/types"
import {
  type DetectedRectResult,
  detectRects,
} from "@/components/exams/02-template/utils/frameDetection"

const IMAGE_WIDTH = 1000
const IMAGE_HEIGHT = 700
/** 横長の画像なので A4 横（297mm × 210mm）とみなされ、1mm ≒ 3.37px */
const PAGE_SIZE = "A4"
const LINE_THICKNESS = 3

/** 白地の RGBA 画像に黒い線を描く */
class SyntheticImage {
  readonly pixels = new Uint8ClampedArray(IMAGE_WIDTH * IMAGE_HEIGHT * 4).fill(
    255
  )

  fillBlack(left: number, top: number, right: number, bottom: number) {
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const offset = (y * IMAGE_WIDTH + x) * 4
        this.pixels[offset] = 0
        this.pixels[offset + 1] = 0
        this.pixels[offset + 2] = 0
      }
    }
  }

  horizontalLine(y: number, left: number, right: number) {
    this.fillBlack(left, y, right, y + LINE_THICKNESS)
  }

  verticalLine(x: number, top: number, bottom: number) {
    this.fillBlack(x, top, x + LINE_THICKNESS, bottom)
  }

  /** 外周の罫線。内側は left+3〜right-1, top+3〜bottom-1 */
  frame(left: number, top: number, right: number, bottom: number) {
    this.horizontalLine(top, left, right + LINE_THICKNESS)
    this.horizontalLine(bottom, left, right + LINE_THICKNESS)
    this.verticalLine(left, top, bottom + LINE_THICKNESS)
    this.verticalLine(right, top, bottom + LINE_THICKNESS)
  }

  detect(overrides: Partial<DetectionSettings> = {}): DetectedRectResult[] {
    return detectRects(
      this.pixels,
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
      { ...DEFAULT_DETECTION_SETTINGS, ...overrides },
      PAGE_SIZE
    )
  }
}

/** 相対座標の検出結果をピクセルに戻す（比べやすくするため） */
const toPixels = (rect: DetectedRectResult) => ({
  left: Math.round(rect.x * IMAGE_WIDTH),
  top: Math.round(rect.y * IMAGE_HEIGHT),
  right: Math.round((rect.x + rect.width) * IMAGE_WIDTH),
  bottom: Math.round((rect.y + rect.height) * IMAGE_HEIGHT),
})

const sortByPosition = (rects: DetectedRectResult[]) =>
  rects.map(toPixels).sort((rectA, rectB) => rectA.top - rectB.top || rectA.left - rectB.left)

/** 罫線を太らせる分（1px）だけ内側に縮むので、数px の誤差を許す */
const expectNear = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(3)

describe("採点枠検出（罫線で囲まれた領域）", () => {
  it("2×2 の表から4つのセルを取る", () => {
    const image = new SyntheticImage()
    image.frame(100, 100, 700, 400)
    image.horizontalLine(250, 100, 703)
    image.verticalLine(400, 100, 403)

    const cells = sortByPosition(image.detect())

    expect(cells).toHaveLength(4)
    const expectedCells = [
      { left: 103, top: 103, right: 400, bottom: 250 },
      { left: 403, top: 103, right: 700, bottom: 250 },
      { left: 103, top: 253, right: 400, bottom: 400 },
      { left: 403, top: 253, right: 700, bottom: 400 },
    ]
    cells.forEach((cell, index) => {
      expectNear(cell.left, expectedCells[index].left)
      expectNear(cell.top, expectedCells[index].top)
      expectNear(cell.right, expectedCells[index].right)
      expectNear(cell.bottom, expectedCells[index].bottom)
    })
  })

  it("枠の壁に届かない短い横棒（分数の線・下線）では枠が割れない", () => {
    const image = new SyntheticImage()
    image.frame(100, 100, 700, 400)
    // 枠の幅の約67%
    image.horizontalLine(250, 200, 600)

    expect(image.detect()).toHaveLength(1)
  })

  it("壁に届かなくても枠の幅の9割以上ある線は仕切り線として枠を割る", () => {
    const image = new SyntheticImage()
    image.frame(100, 100, 700, 400)
    // 枠の幅の約94%（両端は壁から約17px 離れている）
    image.horizontalLine(250, 120, 683)

    const cells = sortByPosition(image.detect())

    expect(cells).toHaveLength(2)
    expectNear(cells[0].bottom, 250)
    expectNear(cells[1].top, 253)
  })

  it("仕切り線の長さが 100% なら、壁に届かない線では割らない", () => {
    const image = new SyntheticImage()
    image.frame(100, 100, 700, 400)
    image.horizontalLine(250, 120, 683)

    expect(image.detect({ minDividerLength: 1 })).toHaveLength(1)
  })

  it("割ってできる枠が最小高さに満たないなら、仕切り線があっても割らない", () => {
    const image = new SyntheticImage()
    image.frame(100, 100, 700, 400)
    // 上の壁から 5px（最小高さ 3mm ≒ 10px 未満）
    image.horizontalLine(108, 120, 683)

    expect(image.detect()).toHaveLength(1)
  })

  it("線の間隔が最小高さより狭い横線の並びは、仕切り線とみなさず割らない", () => {
    const image = new SyntheticImage()
    image.frame(100, 100, 700, 400)
    // 9px 刻み（線の間の白は 6px。点線の隙間 4px より広く、罫線を太らせたあとの
    // 4px は最小高さ 3mm ≒ 10px より狭い）で並ぶ、枠いっぱいの横線
    for (let y = 200; y <= 263; y += 9) image.horizontalLine(y, 120, 683)

    expect(image.detect()).toHaveLength(1)
  })

  it("枠の中の方眼は落とし、外側の枠だけを残す", () => {
    const image = new SyntheticImage()
    image.frame(100, 100, 700, 500)
    // 方眼（40px 刻み。マスも最小幅・最小高さを超える大きさ）
    for (let y = 200; y <= 400; y += 40) image.horizontalLine(y, 200, 603)
    for (let x = 200; x <= 600; x += 40) image.verticalLine(x, 200, 403)

    const cells = sortByPosition(image.detect())

    expect(cells).toHaveLength(1)
    expectNear(cells[0].left, 103)
    expectNear(cells[0].right, 700)
  })

  it("画像の端に触れる余白は枠にしない", () => {
    const image = new SyntheticImage()
    image.horizontalLine(300, 0, IMAGE_WIDTH)

    expect(image.detect()).toHaveLength(0)
  })

  it("隙間 4px 以下の点線も罫線として枠を区切る", () => {
    const image = new SyntheticImage()
    image.frame(100, 100, 700, 400)
    for (let x = 100; x < 703; x += 10) image.fillBlack(x, 250, x + 6, 253)

    expect(image.detect()).toHaveLength(2)
  })

  it("罫線の最短の長さより短い壁の枠は取らず、設定を短くすれば取る", () => {
    const image = new SyntheticImage()
    // 壁の長さ 18px（≒ 5.3mm）。既定の 6mm（≒ 20px）に届かない
    image.frame(100, 100, 115, 115)

    expect(image.detect({ minWidthMm: 1, minHeightMm: 1 })).toHaveLength(0)
    expect(
      image.detect({ minWidthMm: 1, minHeightMm: 1, minLineLengthMm: 3 })
    ).toHaveLength(1)
  })
})
