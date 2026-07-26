/**
 * 答案の採点領域の白さ算出 テスト
 *
 * 空欄の答案が「白い」側に並ぶこと、記入量に応じて平均輝度が下がること、
 * 画像1枚から複数の採点領域が独立に測られることを検証する。
 */

import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { measureAnswerWhiteness } from "../../../electron-src/lib/scoring/regionWhiteness"
import type { WhitenessTargetRegion } from "../../../src/types/answerWhiteness.types"

const IMAGE_WIDTH = 200
const IMAGE_HEIGHT = 100

/** 上半分・下半分に分かれた2つの採点領域 */
const TOP_REGION: WhitenessTargetRegion = {
  cropRegionId: "region-top",
  x: 0,
  y: 0,
  width: 1,
  height: 0.5,
}
const BOTTOM_REGION: WhitenessTargetRegion = {
  cropRegionId: "region-bottom",
  x: 0,
  y: 0.5,
  width: 1,
  height: 0.5,
}

let workDirectory: string

/**
 * 白紙に黒い矩形を描いたPNGを作る。
 * marks は画像ピクセル座標の矩形。
 */
async function createAnswerImage(
  fileName: string,
  marks: { left: number; top: number; width: number; height: number }[]
): Promise<string> {
  const pixels = Buffer.alloc(IMAGE_WIDTH * IMAGE_HEIGHT * 3, 255)

  for (const mark of marks) {
    for (let y = mark.top; y < mark.top + mark.height; y += 1) {
      for (let x = mark.left; x < mark.left + mark.width; x += 1) {
        const offset = (y * IMAGE_WIDTH + x) * 3
        pixels[offset] = 0
        pixels[offset + 1] = 0
        pixels[offset + 2] = 0
      }
    }
  }

  const filePath = path.join(workDirectory, fileName)
  await sharp(pixels, {
    raw: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, channels: 3 },
  })
    .png()
    .toFile(filePath)

  return filePath
}

describe("measureAnswerWhiteness", () => {
  let blankPath: string
  let lightPath: string
  let heavyPath: string

  beforeAll(async () => {
    workDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "region-whiteness-test-")
    )

    blankPath = await createAnswerImage("blank.png", [])
    // 上半分に少しだけ記入（10x10）
    lightPath = await createAnswerImage("light.png", [
      { left: 10, top: 10, width: 10, height: 10 },
    ])
    // 上半分にたくさん記入（100x40）
    heavyPath = await createAnswerImage("heavy.png", [
      { left: 10, top: 5, width: 100, height: 40 },
    ])
  })

  afterAll(() => {
    fs.rmSync(workDirectory, { recursive: true, force: true })
  })

  it("空欄の答案は平均輝度255になる", async () => {
    const [answer] = await measureAnswerWhiteness(
      [{ studentAnswerImageId: "answer-blank", imagePath: blankPath }],
      [TOP_REGION]
    )

    expect(answer.studentAnswerImageId).toBe("answer-blank")
    expect(answer.regions[0].meanLuminance).toBe(255)
  })

  it("記入量が多いほど平均輝度が低い", async () => {
    const answers = await measureAnswerWhiteness(
      [
        { studentAnswerImageId: "answer-blank", imagePath: blankPath },
        { studentAnswerImageId: "answer-light", imagePath: lightPath },
        { studentAnswerImageId: "answer-heavy", imagePath: heavyPath },
      ],
      [TOP_REGION]
    )

    const [blank, light, heavy] = answers.map((answer) => answer.regions[0])

    expect(blank.meanLuminance).toBeGreaterThan(light.meanLuminance)
    expect(light.meanLuminance).toBeGreaterThan(heavy.meanLuminance)
  })

  it("同じ画像でも採点領域ごとに独立して測られる", async () => {
    const [answer] = await measureAnswerWhiteness(
      [{ studentAnswerImageId: "answer-light", imagePath: lightPath }],
      [TOP_REGION, BOTTOM_REGION]
    )

    const top = answer.regions.find(
      (region) => region.cropRegionId === TOP_REGION.cropRegionId
    )
    const bottom = answer.regions.find(
      (region) => region.cropRegionId === BOTTOM_REGION.cropRegionId
    )

    // 記入は上半分だけなので、下半分は完全な白のまま
    expect(top?.meanLuminance).toBeLessThan(255)
    expect(bottom?.meanLuminance).toBe(255)
  })

  it("読み込めない画像はスキップし、他の答案の算出は継続する", async () => {
    const answers = await measureAnswerWhiteness(
      [
        {
          studentAnswerImageId: "answer-missing",
          imagePath: path.join(workDirectory, "not-exist.png"),
        },
        { studentAnswerImageId: "answer-blank", imagePath: blankPath },
      ],
      [TOP_REGION]
    )

    expect(answers.map((answer) => answer.studentAnswerImageId)).toEqual([
      "answer-blank",
    ])
  })

  it("採点領域が空なら何も算出しない", async () => {
    const answers = await measureAnswerWhiteness(
      [{ studentAnswerImageId: "answer-blank", imagePath: blankPath }],
      []
    )

    expect(answers).toEqual([])
  })
})
