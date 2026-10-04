/**
 * AI採点のための答案画像の処理 テスト
 *
 * 合成した答案画像（白い用紙に枠線と黒い記入を描いたもの）だけを使う。
 * - 白紙判定: 枠線だけの解答欄・むらのある白紙は白紙、記入があれば記入あり
 * - normalise() を入れると、むらのある白紙が記入ありに化けることを固定する
 * - はみ出し検知: 枠際の帯だけを数え、印刷された枠線そのものは数えない
 * - 占有グリッド: 約1mm角のセルで、記入のある位置だけが埋まる
 * - 送信用の切り出し: 余白 0.008 を足し、画像の範囲でクランプし、拡大率に従う
 */

import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  BLANK_INK_RATIO_THRESHOLD,
  classifyAnswerBlankness,
  cropRegionForSending,
  type InkTargetRegion,
  measureAnswerInk,
  type RegionInkMeasurement,
} from "../../electron-src/lib/aiGrading/answerImage"

/** A4 縦の比率に合わせた合成ページ（約 4.76px/mm） */
const PAGE_WIDTH = 1000
const PAGE_HEIGHT = 1414

/** 画素で x 100〜500、y 141〜424 の解答欄 */
const ANSWER_REGION: InkTargetRegion = {
  cropRegionId: "region-answer",
  x: 0.1,
  y: 0.1,
  width: 0.4,
  height: 0.2,
}
const REGION_LEFT = 100
const REGION_TOP = 141
const REGION_RIGHT = 500
const REGION_BOTTOM = 424
/** 印刷された枠線の太さ（px）。解答欄の縁の内側に描く */
const FRAME_THICKNESS = 3

/** 1ch の合成ページ（白で初期化） */
interface SyntheticPage {
  pixels: Buffer
  width: number
  height: number
}

interface PixelBox {
  left: number
  top: number
  right: number
  bottom: number
}

let workDirectory: string

function createWhitePage(width = PAGE_WIDTH, height = PAGE_HEIGHT) {
  return { pixels: Buffer.alloc(width * height, 255), width, height }
}

function fillBox(page: SyntheticPage, box: PixelBox, luminance: number) {
  for (let y = box.top; y < box.bottom; y += 1) {
    page.pixels.fill(
      luminance,
      y * page.width + box.left,
      y * page.width + box.right
    )
  }
}

/** 解答欄の縁に沿って、内側へ FRAME_THICKNESS の黒い枠線を描く */
function drawFrame(page: SyntheticPage) {
  const frameBoxes: PixelBox[] = [
    {
      left: REGION_LEFT,
      top: REGION_TOP,
      right: REGION_RIGHT,
      bottom: REGION_TOP + FRAME_THICKNESS,
    },
    {
      left: REGION_LEFT,
      top: REGION_BOTTOM - FRAME_THICKNESS,
      right: REGION_RIGHT,
      bottom: REGION_BOTTOM,
    },
    {
      left: REGION_LEFT,
      top: REGION_TOP,
      right: REGION_LEFT + FRAME_THICKNESS,
      bottom: REGION_BOTTOM,
    },
    {
      left: REGION_RIGHT - FRAME_THICKNESS,
      top: REGION_TOP,
      right: REGION_RIGHT,
      bottom: REGION_BOTTOM,
    },
  ]
  frameBoxes.forEach((frameBox) => fillBox(page, frameBox, 0))
}

async function savePage(
  page: SyntheticPage,
  fileName: string
): Promise<string> {
  const filePath = path.join(workDirectory, fileName)
  await sharp(page.pixels, {
    raw: { width: page.width, height: page.height, channels: 1 },
  })
    .png()
    .toFile(filePath)
  return filePath
}

/** 決定的な疑似乱数（0 以上 1 未満） */
function createRandomGenerator(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/**
 * 全面にむらのある白紙: 輝度 150〜255 の薄いむらに、孤立した真っ黒な点を 12px 間隔で散らす。
 * 黒い点は全画素の 1% 未満なので、normalise() の下限（1パーセンタイル）はむらの側に来る。
 */
function createNoisyBlankPage(): SyntheticPage {
  const page = createWhitePage()
  const nextRandom = createRandomGenerator(20261004)
  page.pixels.forEach((_, pixelIndex) => {
    page.pixels[pixelIndex] = 150 + Math.floor(nextRandom() * 106)
  })
  for (let y = 6; y < page.height; y += 12) {
    for (let x = 6; x < page.width; x += 12) {
      page.pixels[y * page.width + x] = 0
    }
  }
  return page
}

async function measureSingleRegion(
  imagePath: string,
  region: InkTargetRegion = ANSWER_REGION
): Promise<RegionInkMeasurement> {
  const [answer] = await measureAnswerInk(
    [{ studentAnswerImageId: "answer", imagePath }],
    [region],
    { paperSize: "A4" }
  )
  return answer.regions[0]
}

describe("measureAnswerInk", () => {
  let frameOnlyPath: string
  let writtenPath: string
  let touchingPath: string
  let noisyBlankPath: string
  let normalisedNoisyBlankPath: string

  beforeAll(async () => {
    workDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "ai-answer-image-test-")
    )

    const frameOnlyPage = createWhitePage()
    drawFrame(frameOnlyPage)
    frameOnlyPath = await savePage(frameOnlyPage, "frame-only.png")

    const writtenPage = createWhitePage()
    drawFrame(writtenPage)
    fillBox(writtenPage, { left: 250, top: 250, right: 330, bottom: 300 }, 20)
    writtenPath = await savePage(writtenPage, "written.png")

    // 右の枠線まで届く記入（スキャンのずれで枠からはみ出した答案）
    const touchingPage = createWhitePage()
    drawFrame(touchingPage)
    fillBox(
      touchingPage,
      { left: 440, top: 250, right: REGION_RIGHT, bottom: 300 },
      20
    )
    touchingPath = await savePage(touchingPage, "touching.png")

    noisyBlankPath = await savePage(createNoisyBlankPage(), "noisy-blank.png")
    normalisedNoisyBlankPath = path.join(
      workDirectory,
      "noisy-blank-normalised.png"
    )
    await sharp(noisyBlankPath)
      .normalise()
      .png()
      .toFile(normalisedNoisyBlankPath)
  })

  afterAll(() => {
    fs.rmSync(workDirectory, { recursive: true, force: true })
  })

  it("枠線だけの解答欄は白紙で、枠線ははみ出しとして数えない", async () => {
    const measurement = await measureSingleRegion(frameOnlyPath)

    expect(measurement.inkRatio).toBe(0)
    expect(measurement.blankness).toBe("blank")
    expect(measurement.overflowsFrame).toBe(false)
    expect(measurement.edgeInkDensities).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })
  })

  it("記入のある解答欄は記入ありになる", async () => {
    const measurement = await measureSingleRegion(writtenPath)

    expect(measurement.inkRatio).toBeGreaterThan(0.03)
    expect(measurement.blankness).toBe("written")
    expect(measurement.overflowsFrame).toBe(false)
  })

  it("むらと孤立した黒点だけの白紙は、median(3) で黒点が消えて白紙になる", async () => {
    const measurement = await measureSingleRegion(noisyBlankPath)

    expect(measurement.inkRatio).toBeLessThan(BLANK_INK_RATIO_THRESHOLD)
    expect(measurement.blankness).toBe("blank")
  })

  it("むらのある白紙に normalise() を掛けると記入ありに化ける（測定に normalise を入れてはならない根拠）", async () => {
    // この合成画像が normalise の混入を検出できること自体を確かめる。
    // 測定側に normalise() が入ると、上のテストがこの結果と同じになって落ちる
    const measurement = await measureSingleRegion(normalisedNoisyBlankPath)

    expect(measurement.blankness).not.toBe("blank")
  })

  it("枠際の帯まで届く記入は、その辺だけはみ出しとして検知する", async () => {
    const measurement = await measureSingleRegion(touchingPath)

    expect(measurement.edgeTouches).toEqual({
      top: false,
      right: true,
      bottom: false,
      left: false,
    })
    expect(measurement.overflowsFrame).toBe(true)
  })

  it("占有グリッドは内側を約1mm角に区切り、記入のある位置のセルだけが埋まる", async () => {
    const { inkGrid } = await measureSingleRegion(writtenPath)

    // 内側の幅 0.372 × 210mm ≒ 78mm、高さ 0.172 × 297mm ≒ 51mm
    expect(inkGrid.columnCount).toBe(78)
    expect(inkGrid.rowCount).toBe(51)
    expect(inkGrid.originX).toBeCloseTo(0.114)
    expect(inkGrid.originY).toBeCloseTo(0.114)
    expect(inkGrid.occupiedCells).toHaveLength(78 * 51)

    const occupiedCellRects = inkGrid.occupiedCells.flatMap(
      (isOccupied, cellIndex) => {
        if (!isOccupied) return []
        const column = cellIndex % inkGrid.columnCount
        const row = Math.floor(cellIndex / inkGrid.columnCount)
        return [
          {
            left: inkGrid.originX + column * inkGrid.cellWidth,
            top: inkGrid.originY + row * inkGrid.cellHeight,
          },
        ]
      }
    )
    expect(occupiedCellRects.length).toBeGreaterThan(0)

    // 埋まったセルはすべて記入（x 0.25〜0.33、y 250〜300px）の範囲にある
    occupiedCellRects.forEach((cellRect) => {
      expect(cellRect.left).toBeGreaterThanOrEqual(0.25 - inkGrid.cellWidth)
      expect(cellRect.left).toBeLessThan(0.33)
      expect(cellRect.top).toBeGreaterThanOrEqual(
        250 / PAGE_HEIGHT - inkGrid.cellHeight
      )
      expect(cellRect.top).toBeLessThan(300 / PAGE_HEIGHT)
    })
  })

  it("横長の画像では用紙を横向きとして mm に換算する", async () => {
    const landscapePath = await savePage(
      createWhitePage(PAGE_HEIGHT, PAGE_WIDTH),
      "landscape.png"
    )
    const { inkGrid } = await measureSingleRegion(landscapePath)

    // 内側の幅 0.372 × 297mm ≒ 110mm、高さ 0.172 × 210mm ≒ 36mm
    expect(inkGrid.columnCount).toBe(110)
    expect(inkGrid.rowCount).toBe(36)
  })

  it("読み込めない画像と、画像の外にある解答欄は結果に含めない", async () => {
    const outsideRegion: InkTargetRegion = {
      cropRegionId: "region-outside",
      x: 1.2,
      y: 0.1,
      width: 0.2,
      height: 0.2,
    }
    const answers = await measureAnswerInk(
      [
        {
          studentAnswerImageId: "answer-missing",
          imagePath: path.join(workDirectory, "missing.png"),
        },
        { studentAnswerImageId: "answer-written", imagePath: writtenPath },
      ],
      [ANSWER_REGION, outsideRegion],
      { paperSize: "A4" }
    )

    expect(answers.map((answer) => answer.studentAnswerImageId)).toEqual([
      "answer-written",
    ])
    expect(answers[0].regions.map((region) => region.cropRegionId)).toEqual([
      ANSWER_REGION.cropRegionId,
    ])
  })
})

describe("classifyAnswerBlankness", () => {
  it("白紙・境界帯・記入ありを閾値で分ける", () => {
    expect(classifyAnswerBlankness(0)).toBe("blank")
    expect(classifyAnswerBlankness(0.0004)).toBe("blank")
    expect(classifyAnswerBlankness(0.0005)).toBe("borderline")
    expect(classifyAnswerBlankness(0.0029)).toBe("borderline")
    expect(classifyAnswerBlankness(0.003)).toBe("written")
  })
})

describe("cropRegionForSending", () => {
  let pagePath: string

  beforeAll(async () => {
    workDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "ai-answer-crop-test-")
    )
    const page = createWhitePage()
    drawFrame(page)
    pagePath = await savePage(page, "page.png")
  })

  afterAll(() => {
    fs.rmSync(workDirectory, { recursive: true, force: true })
  })

  it("各辺に用紙比 0.008 の余白を足して原寸で切り出す", async () => {
    const crop = await cropRegionForSending(pagePath, ANSWER_REGION)

    // 端ごとに画素へ丸める。幅 (0.092〜0.508) × 1000 = 92〜508、
    // 高さ (0.092〜0.308) × 1414 = 130.1〜435.5 → 130〜436
    expect(crop.width).toBe(416)
    expect(crop.height).toBe(306)
    const metadata = await sharp(crop.png).metadata()
    expect(metadata.format).toBe("png")
    expect(metadata.width).toBe(416)
    expect(metadata.height).toBe(306)
  })

  it("余白は画像の範囲でクランプする", async () => {
    const crop = await cropRegionForSending(pagePath, {
      x: 0,
      y: 0,
      width: 0.2,
      height: 0.1,
    })

    // 左・上の余白は画像の外なので付かない
    expect(crop.width).toBe(208)
    expect(crop.height).toBe(153)
  })

  it("拡大率を指定するとその倍率で拡大する", async () => {
    const crop = await cropRegionForSending(pagePath, ANSWER_REGION, {
      imageScale: 2,
    })

    expect(crop.width).toBe(832)
    expect(crop.height).toBe(612)
  })
})
