/**
 * web 版の画像処理の窓口（`web/worker/imageOpsVips.ts`、wasm-vips）が、デスクトップ版の窓口
 * （`electron-src/lib/imageOps.ts`、sharp）と同じ口を持ち、同じ入力に同じバイト列を返すことを縛る。
 *
 * 入力はここで合成する（形式・帯の数・ビット深度・EXIF の向き・ICC プロファイル・CMYK を変えて）。
 * wasm-vips はブラウザでは Worker の隣の `vips-es6.js` を読むが、ここでは Node 版を使う
 * （同じ wasm を同じ libvips で動かす）。
 */
import * as crypto from "crypto"
import { mkdtemp, rm, writeFile } from "fs/promises"
import * as os from "os"
import * as path from "path"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import * as desktopImageOps from "@/electron-src/lib/imageOps"

import * as webImageOps from "../../web/worker/imageOpsVips"

vi.mock("../../web/worker/vipsRuntime", async () => {
  const { default: createVips } = await import("wasm-vips")
  const vips = await createVips({ dynamicLibraries: [] })
  return { loadVips: async () => vips }
})

// 型の上でも同じ口であること（引数・返り値の型が食い違えば typecheck で落ちる）
const webImageOpsAsDesktop: typeof desktopImageOps = webImageOps

const WIDTH = 301
const HEIGHT = 217

/** 決まった種からの擬似乱数（テストの入力を毎回同じにする） */
function createRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

/** 階調・格子・雑音を重ねた画素（拡大縮小や回転の補間が効く絵にする） */
function synthesizePixels(channels: number): Buffer {
  const random = createRandom(channels * 7919)
  const pixels = Buffer.alloc(WIDTH * HEIGHT * channels)
  Array.from({ length: HEIGHT }).forEach((_, y) => {
    Array.from({ length: WIDTH }).forEach((__, x) => {
      const checker = (Math.floor(x / 17) + Math.floor(y / 13)) % 2 === 0
      const offset = (y * WIDTH + x) * channels
      Array.from({ length: channels }).forEach((___, channel) => {
        const isAlpha = channels === 2 || channels === 4
        const isAlphaChannel = isAlpha && channel === channels - 1
        const gradient = isAlphaChannel
          ? 255 - Math.round((x / WIDTH) * 200)
          : Math.round(((x + y * (channel + 1)) / (WIDTH + HEIGHT * 3)) * 255)
        const noise = Math.round(random() * 40) - 20
        const shade = checker && !isAlphaChannel ? 60 : 0
        pixels[offset + channel] = Math.max(
          0,
          Math.min(255, gradient + noise - shade)
        )
      })
    })
  })
  return pixels
}

const rawInput = (channels: 1 | 2 | 3 | 4) =>
  sharp(synthesizePixels(channels), {
    raw: { width: WIDTH, height: HEIGHT, channels },
  })

const WEBP_INPUT = "可逆の WebP"

/** 合成した入力（名前 → 符号化されたバイト列） */
async function synthesizeInputs(): Promise<Map<string, Buffer>> {
  const entries: [string, Promise<Buffer>][] = [
    ["RGB の PNG", rawInput(3).png().toBuffer()],
    ["RGBA の PNG", rawInput(4).png().toBuffer()],
    ["グレーの PNG", rawInput(1).png().toBuffer()],
    ["グレー＋透過の PNG", rawInput(2).png().toBuffer()],
    ["16bit の PNG", rawInput(3).toColourspace("rgb16").png().toBuffer()],
    ["パレットの PNG", rawInput(3).png({ palette: true }).toBuffer()],
    ["ICC つきの PNG", rawInput(3).withIccProfile("p3").png().toBuffer()],
    ["RGB の JPEG", rawInput(3).jpeg({ quality: 90 }).toBuffer()],
    ["グレーの JPEG", rawInput(1).jpeg({ quality: 90 }).toBuffer()],
    [
      "向き 6 の JPEG",
      rawInput(3).jpeg().withMetadata({ orientation: 6 }).toBuffer(),
    ],
    [
      "向き 3 の JPEG",
      rawInput(3).jpeg().withMetadata({ orientation: 3 }).toBuffer(),
    ],
    [
      "向き 5 の JPEG",
      rawInput(3).jpeg().withMetadata({ orientation: 5 }).toBuffer(),
    ],
    ["ICC つきの JPEG", rawInput(3).withIccProfile("p3").jpeg().toBuffer()],
    ["CMYK の JPEG", rawInput(3).toColourspace("cmyk").jpeg().toBuffer()],
    [WEBP_INPUT, rawInput(4).webp({ lossless: true }).toBuffer()],
  ]
  const encoded = await Promise.all(entries.map(([, bytes]) => bytes))
  return new Map(entries.map(([name], index) => [name, encoded[index]]))
}

let inputs = new Map<string, Buffer>()
let workDirectory = ""

beforeAll(async () => {
  inputs = await synthesizeInputs()
  workDirectory = await mkdtemp(path.join(os.tmpdir(), "image-ops-vips-"))
})

afterAll(async () => {
  await rm(workDirectory, { recursive: true, force: true })
})

/**
 * 結果を比べやすい形にする。バイト列は大きさと SHA-256 に置き換える
 * （食い違ったときに、何万行ものバイトの差分ではなく、どの入力で食い違ったかを見せる）
 */
function fingerprintOf(result: unknown): unknown {
  if (result instanceof Uint8Array) {
    const digest = crypto.createHash("sha256").update(result).digest("hex")
    return `${result.byteLength} bytes sha256:${digest}`
  }
  if (result !== null && typeof result === "object") {
    return Object.fromEntries(
      Object.entries(result).map(([key, field]) => [key, fingerprintOf(field)])
    )
  }
  return result
}

/** 窓口の1つの呼び方（同じ引数で両方の窓口を呼ぶ） */
interface OperationCase {
  label: string
  operate: (imageOps: typeof desktopImageOps, input: Buffer) => Promise<unknown>
  /**
   * 縮小を伴う（WebP なら縮小読み込みになる）呼び方。libwebp の縮小読み込みは、native と
   * wasm で丸めが食い違うことがある（実測: 100x100 への縮小で 1 画素の 1 チャンネルが 2 違う）。
   * libvips の操作の違いではないので、WebP だけは画素の差 2 までを許して比べる
   */
  scalesOnLoad?: boolean
}

/** WebP の縮小読み込みで許す、画素ごとの差 */
const WEBP_SCALED_LOAD_TOLERANCE = 2

/** 符号化された2枚の画像が、同じ大きさで、画素の差が `tolerance` 以内か */
async function expectNearlySameImage(
  desktopEncoded: unknown,
  webEncoded: unknown,
  tolerance: number
): Promise<void> {
  if (!(desktopEncoded instanceof Buffer) || !(webEncoded instanceof Buffer)) {
    throw new Error("符号化された画像（Buffer）を比べる")
  }
  const [desktopPixels, webPixels] = await Promise.all(
    [desktopEncoded, webEncoded].map((encoded) =>
      sharp(encoded).raw().toBuffer({ resolveWithObject: true })
    )
  )
  expect(webPixels.info).toEqual(desktopPixels.info)
  const largestDifference = desktopPixels.data.reduce(
    (largest, desktopValue, index) =>
      Math.max(largest, Math.abs(desktopValue - webPixels.data[index])),
    0
  )
  expect(largestDifference).toBeLessThanOrEqual(tolerance)
}

const CROP_REGION = { left: 13, top: 7, width: 120, height: 90 }

const OPERATION_CASES: OperationCase[] = [
  {
    label: "readImageHeader",
    operate: (imageOps, input) => imageOps.readImageHeader(input),
  },
  {
    label: "decodeRgb",
    operate: (imageOps, input) => imageOps.decodeRgb(input),
  },
  {
    label: "decodeGreyscale",
    operate: (imageOps, input) => imageOps.decodeGreyscale(input),
  },
  {
    label: "decodeGreyscaleOnWhite",
    operate: (imageOps, input) => imageOps.decodeGreyscaleOnWhite(input),
  },
  {
    label: "encodePng",
    operate: (imageOps, input) => imageOps.encodePng(input),
  },
  // 切り出しのみ・同じ縦横比・縦横比の違う縮小（cover の中央切り）・拡大・同じ大きさ
  ...[
    undefined,
    { width: 60, height: 45 },
    { width: 50, height: 50 },
    { width: 200, height: 100 },
    { width: 120, height: 90 },
  ].map((size): OperationCase => ({
    label: `cropToPng ${size ? `${size.width}x${size.height}` : "そのまま"}`,
    operate: (imageOps, input) => imageOps.cropToPng(input, CROP_REGION, size),
  })),
  ...[
    { top: 3, bottom: 5, left: 7, right: 11 },
    { top: 0, bottom: 0, left: 0, right: 0 },
  ].map((padding): OperationCase => ({
    label: `extendWithWhiteToPng ${JSON.stringify(padding)}`,
    operate: (imageOps, input) => imageOps.extendWithWhiteToPng(input, padding),
  })),
  // 任意角（小数・整数）と 90 度の倍数（負・360 超えを含む）
  ...[0.7, -1.3, 1, 0, 90, -90, 180, 450].map((degrees): OperationCase => ({
    label: `rotateToPng ${degrees}°`,
    operate: (imageOps, input) => imageOps.rotateToPng(input, degrees),
  })),
  ...[
    { width: 150, height: 108 },
    { width: 100, height: 100 },
    { width: 400, height: 300 },
    { width: WIDTH, height: HEIGHT },
    { width: 31, height: 97 },
  ].map((size): OperationCase => ({
    label: `resizeToPng ${size.width}x${size.height}`,
    operate: (imageOps, input) => imageOps.resizeToPng(input, size),
    scalesOnLoad: true,
  })),
  // 縮小読み込みの倍率が変わる境目（JPEG は 1/2・1/4・1/8、WebP は実数倍）と、拡大しない場合
  ...[40, 60, 100, 150, 1000].flatMap((maxSide): OperationCase[] => [
    {
      label: `orientAndFitInside ${maxSide} PNG`,
      operate: (imageOps, input) =>
        imageOps.orientAndFitInside(input, maxSide, { format: "png" }),
      scalesOnLoad: true,
    },
    {
      label: `orientAndFitInside ${maxSide} JPEG`,
      operate: (imageOps, input) =>
        imageOps.orientAndFitInside(input, maxSide, {
          format: "jpeg",
          jpegQuality: 85,
        }),
      scalesOnLoad: true,
    },
  ]),
  ...[80, 95].map((quality): OperationCase => ({
    label: `flattenOnWhiteToJpeg 品質 ${quality}`,
    operate: (imageOps, input) => imageOps.flattenOnWhiteToJpeg(input, quality),
  })),
]

describe("web 版の画像処理の窓口（wasm-vips）", () => {
  it("デスクトップ版と同じ名前の口を持つ", () => {
    expect(Object.keys(webImageOps).sort()).toEqual(
      Object.keys(desktopImageOps).sort()
    )
  })

  it.each(OPERATION_CASES)(
    "$label: 合成したすべての入力で、結果が sharp と一致する",
    async ({ operate, scalesOnLoad }) => {
      const results = await Promise.all(
        [...inputs].map(async ([inputName, input]) => ({
          inputName,
          desktop: await operate(desktopImageOps, input),
          web: await operate(webImageOpsAsDesktop, input),
        }))
      )
      const isTolerated = (inputName: string) =>
        scalesOnLoad === true && inputName === WEBP_INPUT
      const mismatches = results
        .filter(({ inputName }) => !isTolerated(inputName))
        .map(({ inputName, desktop, web }) => ({
          inputName,
          desktop: fingerprintOf(desktop),
          web: fingerprintOf(web),
        }))
        .filter(
          ({ desktop, web }) => JSON.stringify(desktop) !== JSON.stringify(web)
        )
      expect(mismatches).toEqual([])
      await Promise.all(
        results
          .filter(({ inputName }) => isTolerated(inputName))
          .map(({ desktop, web }) =>
            expectNearlySameImage(desktop, web, WEBP_SCALED_LOAD_TOLERANCE)
          )
      )
    }
  )

  it("ファイルのパスで渡しても一致する", async () => {
    const filePath = path.join(workDirectory, "input.png")
    const input = inputs.get("RGBA の PNG")
    if (input === undefined) throw new Error("入力が無い")
    await writeFile(filePath, input)
    expect(await webImageOps.readImageHeader(filePath)).toEqual(
      await desktopImageOps.readImageHeader(filePath)
    )
    expect(await webImageOps.decodeRgb(filePath)).toEqual(
      await desktopImageOps.decodeRgb(filePath)
    )
    expect(await webImageOps.encodePng(filePath)).toEqual(
      await desktopImageOps.encodePng(filePath)
    )
  })

  it("ページ大の画像の回転も、順に読む読み込みのまま一致する", async () => {
    // 小さな画像は1枚のタイルに収まり、行の順を崩す回転でも読み直しが起きない。
    // 答案・PDF のページの大きさでは、メモリへ写さずに回すと読めずに失敗する
    const pageInput = await sharp({
      create: {
        width: 1190,
        height: 1684,
        channels: 3,
        background: { r: 250, g: 250, b: 250 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 300,
              height: 200,
              channels: 3,
              background: { r: 20, g: 40, b: 200 },
            },
          })
            .png()
            .toBuffer(),
          left: 100,
          top: 150,
        },
      ])
      .png()
      .toBuffer()
    for (const degrees of [90, 180, 270, 1.5]) {
      expect(
        await webImageOps.rotateToPng(pageInput, degrees),
        `${degrees}°`
      ).toEqual(await desktopImageOps.rotateToPng(pageInput, degrees))
    }
  })

  it("画像でないバイト列は、どちらも例外になる", async () => {
    const notImage = Buffer.from("これは画像ではない")
    await expect(desktopImageOps.readImageHeader(notImage)).rejects.toThrow()
    await expect(webImageOps.readImageHeader(notImage)).rejects.toThrow()
    await expect(webImageOps.encodePng(notImage)).rejects.toThrow()
  })
})
