/**
 * AI採点のための答案画像の処理
 *
 * - 送信用の切り出し: 解答欄に余白を足して切り出し、PNG にする
 * - 白紙判定: 解答欄の内側のインク率を測る（外部通信も費用も要らない前段の除外）
 * - はみ出し検知: 枠線のすぐ内側の帯で、辺ごとのインク密度を測る
 * - 注釈用の占有グリッド: 約1mm角のセルごとのインクの有無（renderer が注釈の位置探しに使う）
 *
 * 測定は `regionWhiteness.ts` と同じく、ページ画像1枚につきデコードを1回だけ行い、
 * そのページの全解答欄をデコード済みのグレースケールRAWバッファから測る。
 * PNG は途中で打ち切って読めないため、領域ごとに sharp の extract を呼ぶとデコードが
 * 領域数だけ繰り返されて桁違いに遅くなる。
 *
 * 座標はすべて用紙比（0〜1）。x は画像の幅、y は画像の高さに対する比で、
 * 「0.014 寄せ」のような余白も軸ごとにその軸の長さに対する比として扱う。
 */

import sharp from "sharp"

import { getOrientedPaperDimensions } from "../../../src/lib/paperSize"
import type { AnswerInkGrid } from "../../../src/lib/shared/aiGrading/answerInkGrid"

/** 用紙比（0〜1）の矩形 */
interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

/** 測定対象の解答欄（CropRegion の用紙比の矩形） */
export interface InkTargetRegion extends NormalizedRect {
  cropRegionId: string
}

/** 測定対象の答案画像（imagePath は解決済みの絶対パス） */
interface InkTargetImage {
  studentAnswerImageId: string
  imagePath: string
}

/** 送信用の切り出しで足す余白（用紙比、各辺）。枠線が1本入り、解答欄の範囲が伝わる */
const SENDING_PADDING = 0.008

/** インク率を測る内側の寄せ幅（用紙比、各辺）。枠線と枠際のかすれを除く */
const INNER_INSET = 0.014

/**
 * はみ出し検知の帯（解答欄の外側、用紙比）。解答欄の辺から NEAR〜FAR 外へ離れた帯を見る。
 *
 * 枠を越えて書いた答案は、インクが枠の外まで続く。内側の帯を見る作りでは、枠際に印刷された
 * 設問番号や、スキャンのずれで入り込んだ枠線そのものまで「はみ出し」と数えていた
 * （はみ出していない答案の大半に印が付いた）。外側を見れば、枠の内側の印刷物は数えない
 */
const EDGE_BAND_NEAR_OUTSET = 0.002
const EDGE_BAND_FAR_OUTSET = 0.01

/**
 * 帯の長さ方向にこの割合以上インクが続く行（左右の帯では列）は罫線とみなして数えない。
 * 自分の枠線・隣の解答欄の枠線は帯を横切る長い線になり、手書きのはみ出しは短い
 */
const RULED_LINE_RUN_RATIO = 0.5

/** 罫線とみなした行・列の前後で、あわせて除く幅（画素）。線の傾きやにじみの分 */
const RULED_LINE_MARGIN_PIXELS = 2

/** インクとみなす輝度の上限（これ未満がインク） */
const INK_LUMINANCE_THRESHOLD = 100

/*
 * 以下の閾値はいずれも初期値で、実際の答案で検証し直す前提の値。
 */

/** インク率がこれ未満なら白紙 */
export const BLANK_INK_RATIO_THRESHOLD = 0.0005

/** インク率がこれ未満（かつ白紙の閾値以上）なら境界帯。人かモデルに判断を回す */
export const BORDERLINE_INK_RATIO_THRESHOLD = 0.003

/** 外側の帯の（罫線を除いた）インク密度がこれ以上なら、その辺で答案が枠からはみ出しているとみなす */
export const EDGE_TOUCH_DENSITY_THRESHOLD = 0.01

/** 占有グリッドのセルで、インクの画素がこの割合以上なら「インクあり」とする */
const GRID_CELL_INK_RATIO_THRESHOLD = 0.02

/** 占有グリッドのセルの一辺（mm）の既定値 */
const DEFAULT_GRID_CELL_SIZE_MM = 1

/** 白紙判定の結果 */
export type AnswerBlankness = "blank" | "borderline" | "written"

/** 枠の辺ごとの値 */
interface EdgeSides<T> {
  top: T
  right: T
  bottom: T
  left: T
}

/** 1つの解答欄の測定結果 */
export interface RegionInkMeasurement {
  cropRegionId: string
  /** 内側（0.014 寄せ）の、ノイズ除去後のインク画素の割合 */
  inkRatio: number
  blankness: AnswerBlankness
  /** 枠線のすぐ内側の帯（0.004〜0.014 寄せ）のインク密度 */
  edgeInkDensities: EdgeSides<number>
  /** 辺ごとに、答案が枠に触れているか */
  edgeTouches: EdgeSides<boolean>
  /** いずれかの辺で枠に触れている（スキャンのずれ等で枠からはみ出している疑い） */
  overflowsFrame: boolean
  inkGrid: AnswerInkGrid
}

/** 1枚の答案画像について、対象の全解答欄の測定結果 */
export interface AnswerInkMeasurement {
  studentAnswerImageId: string
  regions: RegionInkMeasurement[]
}

interface InkMeasurementOptions {
  /** 用紙サイズ名（"A4" 等）。向きは画像の縦横比で判定する（`paperSize.ts` と同じ） */
  paperSize: string
  /** 占有グリッドのセルの一辺（mm）。既定 1mm */
  gridCellSizeMm?: number
}

interface SendingCropOptions {
  /** 拡大率。既定 1（原寸のまま。拡大しても情報は増えず、画像トークンが増えるだけ） */
  imageScale?: number
}

/** 送信用に切り出した画像 */
export interface SendingCrop {
  png: Buffer
  /** 画素数（拡大後） */
  width: number
  height: number
}

/** デコード済みのグレースケール1chのページ画像 */
interface GreyscalePage {
  pixels: Buffer
  width: number
  height: number
}

/** 画素座標の矩形（終端は含まない） */
interface PixelRect {
  left: number
  top: number
  right: number
  bottom: number
}

export function classifyAnswerBlankness(inkRatio: number): AnswerBlankness {
  if (inkRatio < BLANK_INK_RATIO_THRESHOLD) return "blank"
  if (inkRatio < BORDERLINE_INK_RATIO_THRESHOLD) return "borderline"
  return "written"
}

/**
 * 用紙比の矩形を、各辺を軸ごとに inset ずつ内側へ寄せる（負なら外へ広げる）
 */
function insetRect(rect: NormalizedRect, inset: number): NormalizedRect {
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    width: rect.width - inset * 2,
    height: rect.height - inset * 2,
  }
}

/** 用紙比の矩形を画素座標へ変換し、画像の範囲でクランプする */
function toPixelRect(
  rect: NormalizedRect,
  imageWidth: number,
  imageHeight: number
): PixelRect {
  const left = Math.max(0, Math.round(rect.x * imageWidth))
  const top = Math.max(0, Math.round(rect.y * imageHeight))
  const right = Math.min(
    imageWidth,
    Math.round((rect.x + rect.width) * imageWidth)
  )
  const bottom = Math.min(
    imageHeight,
    Math.round((rect.y + rect.height) * imageHeight)
  )
  return {
    left,
    top,
    right: Math.max(left, right),
    bottom: Math.max(top, bottom),
  }
}

function pixelArea(rect: PixelRect): number {
  return (rect.right - rect.left) * (rect.bottom - rect.top)
}

/** 画像の大きさ（画素）を読む */
async function readImageSize(
  imagePath: string
): Promise<{ imageWidth: number; imageHeight: number }> {
  const metadata = await sharp(imagePath).metadata()
  const imageWidth = metadata.width
  const imageHeight = metadata.height
  if (!imageWidth || !imageHeight) {
    throw new Error(`画像の大きさを読み取れません: ${imagePath}`)
  }
  return { imageWidth, imageHeight }
}

/** 送信用の切り出し範囲（余白 0.008 を足し、画像の範囲でクランプした画素の矩形） */
function computeSendingCropRect(
  imagePath: string,
  region: NormalizedRect,
  imageWidth: number,
  imageHeight: number
): PixelRect {
  const cropRect = toPixelRect(
    insetRect(region, -SENDING_PADDING),
    imageWidth,
    imageHeight
  )
  if (pixelArea(cropRect) === 0) {
    throw new Error(`解答欄が画像の外にあります: ${imagePath}`)
  }
  return cropRect
}

/** 拡大率を掛けた画素数（最低1） */
function scaledLength(length: number, imageScale: number): number {
  return imageScale === 1
    ? length
    : Math.max(1, Math.round(length * imageScale))
}

/**
 * 送信用に切り出したときの大きさ（画素）だけを求める。画像はデコードしない
 * （件数と費用の見積もりに使う。金額の計算は renderer が行う）
 */
export async function measureSendingCropSize(
  imagePath: string,
  region: NormalizedRect,
  options: SendingCropOptions = {}
): Promise<{ width: number; height: number }> {
  const imageScale = options.imageScale ?? 1
  const { imageWidth, imageHeight } = await readImageSize(imagePath)
  const cropRect = computeSendingCropRect(
    imagePath,
    region,
    imageWidth,
    imageHeight
  )
  return {
    width: scaledLength(cropRect.right - cropRect.left, imageScale),
    height: scaledLength(cropRect.bottom - cropRect.top, imageScale),
  }
}

/**
 * 解答欄を、余白 0.008 を足して切り出した PNG にする（AI へ送る画像）。
 *
 * 余白で枠線が1本入るので、どこまでが解答欄かがモデルに伝わる。余白は画像の範囲でクランプする。
 * 返す画像は1枚なので、ここは呼び出しごとにデコードしてよい。
 */
export async function cropRegionForSending(
  imagePath: string,
  region: NormalizedRect,
  options: SendingCropOptions = {}
): Promise<SendingCrop> {
  const imageScale = options.imageScale ?? 1
  const { imageWidth, imageHeight } = await readImageSize(imagePath)
  const cropRect = computeSendingCropRect(
    imagePath,
    region,
    imageWidth,
    imageHeight
  )
  const cropWidth = cropRect.right - cropRect.left
  const cropHeight = cropRect.bottom - cropRect.top

  let pipeline = sharp(imagePath).extract({
    left: cropRect.left,
    top: cropRect.top,
    width: cropWidth,
    height: cropHeight,
  })
  if (imageScale !== 1) {
    pipeline = pipeline.resize(
      scaledLength(cropWidth, imageScale),
      scaledLength(cropHeight, imageScale)
    )
  }

  const { data, info } = await pipeline
    .png()
    .toBuffer({ resolveWithObject: true })
  return { png: data, width: info.width, height: info.height }
}

/**
 * 矩形の範囲について、median(3) を掛けたうえでインクかどうかの印を作る。
 *
 * 3x3 の中央値が閾値未満になるのは、9画素のうち5画素以上が閾値未満のときに限る。
 * そのため輝度の中央値を求めずに、暗い画素を数えるだけで median(3) → 二値化と同じ結果になる。
 * 近傍は矩形の外（ページ上の周囲の画素）も読み、ページの端では端の画素を繰り返す。
 *
 * 返す配列は矩形内の行優先で、1 がインク。
 */
function buildDenoisedInkMask(
  page: GreyscalePage,
  rect: PixelRect
): Uint8Array {
  const rectWidth = rect.right - rect.left
  const rectHeight = rect.bottom - rect.top
  const inkMask = new Uint8Array(rectWidth * rectHeight)

  const isDarkAt = (pageX: number, pageY: number): number => {
    const clampedX = Math.min(page.width - 1, Math.max(0, pageX))
    const clampedY = Math.min(page.height - 1, Math.max(0, pageY))
    return page.pixels[clampedY * page.width + clampedX] <
      INK_LUMINANCE_THRESHOLD
      ? 1
      : 0
  }

  for (let rowIndex = 0; rowIndex < rectHeight; rowIndex += 1) {
    const pageY = rect.top + rowIndex
    for (let columnIndex = 0; columnIndex < rectWidth; columnIndex += 1) {
      const pageX = rect.left + columnIndex
      let darkNeighborCount = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          darkNeighborCount += isDarkAt(pageX + dx, pageY + dy)
        }
      }
      inkMask[rowIndex * rectWidth + columnIndex] =
        darkNeighborCount >= 5 ? 1 : 0
    }
  }

  return inkMask
}

/**
 * 解答欄全体のインクの印から、部分矩形のインク画素数を数える
 */
function countInk(
  inkMask: Uint8Array,
  maskRect: PixelRect,
  targetRect: PixelRect
): number {
  const maskWidth = maskRect.right - maskRect.left
  const left = Math.max(targetRect.left, maskRect.left)
  const right = Math.min(targetRect.right, maskRect.right)
  const top = Math.max(targetRect.top, maskRect.top)
  const bottom = Math.min(targetRect.bottom, maskRect.bottom)

  let inkCount = 0
  for (let pageY = top; pageY < bottom; pageY += 1) {
    const rowOffset = (pageY - maskRect.top) * maskWidth - maskRect.left
    for (let pageX = left; pageX < right; pageX += 1) {
      inkCount += inkMask[rowOffset + pageX]
    }
  }
  return inkCount
}

function inkDensity(
  inkMask: Uint8Array,
  maskRect: PixelRect,
  targetRect: PixelRect
): number {
  const area = pixelArea(targetRect)
  if (area === 0) return 0
  return countInk(inkMask, maskRect, targetRect) / area
}

/**
 * 枠の辺ごとに、解答欄のすぐ外側の帯（NEAR〜FAR 外）を用紙比で返す。
 * 帯の長さ方向は解答欄の幅・高さにとどめ、角で隣の辺の線を拾わない
 */
function edgeBands(region: NormalizedRect): EdgeSides<NormalizedRect> {
  const bandThickness = EDGE_BAND_FAR_OUTSET - EDGE_BAND_NEAR_OUTSET
  return {
    top: {
      x: region.x,
      y: region.y - EDGE_BAND_FAR_OUTSET,
      width: region.width,
      height: bandThickness,
    },
    bottom: {
      x: region.x,
      y: region.y + region.height + EDGE_BAND_NEAR_OUTSET,
      width: region.width,
      height: bandThickness,
    },
    left: {
      x: region.x - EDGE_BAND_FAR_OUTSET,
      y: region.y,
      width: bandThickness,
      height: region.height,
    },
    right: {
      x: region.x + region.width + EDGE_BAND_NEAR_OUTSET,
      y: region.y,
      width: bandThickness,
      height: region.height,
    },
  }
}

/**
 * 帯のインク密度を、罫線とみなした行・列（と前後 RULED_LINE_MARGIN_PIXELS）を除いて測る。
 * `along` は帯の長さの向き（上下の帯は "horizontal"、左右の帯は "vertical"）
 */
function bandInkDensityExcludingRuledLines(
  inkMask: Uint8Array,
  maskRect: PixelRect,
  band: PixelRect,
  along: "horizontal" | "vertical"
): number {
  const area = pixelArea(band)
  if (area === 0) return 0
  const lineCount =
    along === "horizontal" ? band.bottom - band.top : band.right - band.left
  const lineLength =
    along === "horizontal" ? band.right - band.left : band.bottom - band.top
  const inkCountByLine = Array.from({ length: lineCount }, (_, lineIndex) =>
    countInk(
      inkMask,
      maskRect,
      along === "horizontal"
        ? {
            left: band.left,
            right: band.right,
            top: band.top + lineIndex,
            bottom: band.top + lineIndex + 1,
          }
        : {
            left: band.left + lineIndex,
            right: band.left + lineIndex + 1,
            top: band.top,
            bottom: band.bottom,
          }
    )
  )
  const isRuledLine = inkCountByLine.map(
    (inkCount) => inkCount >= lineLength * RULED_LINE_RUN_RATIO
  )
  const isNearRuledLine = (lineIndex: number): boolean =>
    isRuledLine.some(
      (ruled, ruledIndex) =>
        ruled && Math.abs(ruledIndex - lineIndex) <= RULED_LINE_MARGIN_PIXELS
    )
  const keptInkCount = inkCountByLine.reduce(
    (acc, inkCount, lineIndex) =>
      isNearRuledLine(lineIndex) ? acc : acc + inkCount,
    0
  )
  return keptInkCount / area
}

/**
 * 内側の範囲を約 cellSizeMm 角のセルに区切った占有グリッドを作る。
 * セルの数は内側の寸法（mm）÷ セルの一辺を丸めた整数にし、内側をちょうど敷き詰める。
 */
function buildInkGrid(
  page: GreyscalePage,
  inkMask: Uint8Array,
  maskRect: PixelRect,
  inner: NormalizedRect,
  paperDimensions: { width: number; height: number },
  cellSizeMm: number
): AnswerInkGrid {
  const columnCount = Math.max(
    1,
    Math.round((inner.width * paperDimensions.width) / cellSizeMm)
  )
  const rowCount = Math.max(
    1,
    Math.round((inner.height * paperDimensions.height) / cellSizeMm)
  )
  const cellWidth = inner.width / columnCount
  const cellHeight = inner.height / rowCount

  const occupiedCells = Array.from(
    { length: rowCount * columnCount },
    (_, cellIndex) => {
      const column = cellIndex % columnCount
      const row = Math.floor(cellIndex / columnCount)
      const cellRect = toPixelRect(
        {
          x: inner.x + column * cellWidth,
          y: inner.y + row * cellHeight,
          width: cellWidth,
          height: cellHeight,
        },
        page.width,
        page.height
      )
      const area = pixelArea(cellRect)
      if (area === 0) return false
      const inkCount = countInk(inkMask, maskRect, cellRect)
      return inkCount >= Math.max(1, area * GRID_CELL_INK_RATIO_THRESHOLD)
    }
  )

  return {
    originX: inner.x,
    originY: inner.y,
    cellWidth,
    cellHeight,
    columnCount,
    rowCount,
    occupiedCells,
  }
}

/**
 * デコード済みのページから、1つの解答欄を測る。
 * 内側が画像の中に1画素も無い場合は null（測れない）。
 */
function measureRegionInk(
  page: GreyscalePage,
  region: InkTargetRegion,
  paperDimensions: { width: number; height: number },
  cellSizeMm: number
): RegionInkMeasurement | null {
  const inner = insetRect(region, INNER_INSET)
  const innerRect = toPixelRect(inner, page.width, page.height)
  if (pixelArea(innerRect) === 0) return null

  // はみ出し検知の帯は解答欄の外側まで広がるので、印はその範囲で作る
  const maskRect = toPixelRect(
    insetRect(region, -EDGE_BAND_FAR_OUTSET),
    page.width,
    page.height
  )
  const inkMask = buildDenoisedInkMask(page, maskRect)

  // 輝度を引き伸ばす正規化（sharp の normalise() 等）は入れない。白紙のスキャンでは
  // 薄い紙のむらやノイズしか無く、それを 0〜255 へ引き伸ばすとむらが濃い「インク」に
  // 化けて、白紙が記入ありに判定される。閾値は生の輝度に対して掛ける。
  const inkRatio = inkDensity(inkMask, maskRect, innerRect)

  const bands = edgeBands(region)
  const densityOf = (
    band: NormalizedRect,
    along: "horizontal" | "vertical"
  ): number =>
    bandInkDensityExcludingRuledLines(
      inkMask,
      maskRect,
      toPixelRect(band, page.width, page.height),
      along
    )
  const edgeInkDensities: EdgeSides<number> = {
    top: densityOf(bands.top, "horizontal"),
    right: densityOf(bands.right, "vertical"),
    bottom: densityOf(bands.bottom, "horizontal"),
    left: densityOf(bands.left, "vertical"),
  }
  const edgeTouches: EdgeSides<boolean> = {
    top: edgeInkDensities.top >= EDGE_TOUCH_DENSITY_THRESHOLD,
    right: edgeInkDensities.right >= EDGE_TOUCH_DENSITY_THRESHOLD,
    bottom: edgeInkDensities.bottom >= EDGE_TOUCH_DENSITY_THRESHOLD,
    left: edgeInkDensities.left >= EDGE_TOUCH_DENSITY_THRESHOLD,
  }

  return {
    cropRegionId: region.cropRegionId,
    inkRatio,
    blankness: classifyAnswerBlankness(inkRatio),
    edgeInkDensities,
    edgeTouches,
    overflowsFrame:
      edgeTouches.top ||
      edgeTouches.right ||
      edgeTouches.bottom ||
      edgeTouches.left,
    inkGrid: buildInkGrid(
      page,
      inkMask,
      maskRect,
      inner,
      paperDimensions,
      cellSizeMm
    ),
  }
}

/**
 * 答案画像ごとに、指定された全解答欄のインク（白紙判定・はみ出し・占有グリッド）を測る。
 *
 * 読み込めない画像はスキップする（結果に含めない）。解答欄の内側が画像の外にあって
 * 測れない解答欄も結果に含めない。呼び出し側はどちらも「測定不能」として扱い、
 * 白紙とはみなさないこと（白紙は採点対象から外れるため）。
 * メモリ上に載るのは常に1枚分のRAWバッファのみになるよう逐次処理する。
 */
export async function measureAnswerInk(
  answerImages: InkTargetImage[],
  regions: InkTargetRegion[],
  options: InkMeasurementOptions
): Promise<AnswerInkMeasurement[]> {
  if (regions.length === 0) return []

  const cellSizeMm = options.gridCellSizeMm ?? DEFAULT_GRID_CELL_SIZE_MM
  const results: AnswerInkMeasurement[] = []

  for (const answerImage of answerImages) {
    try {
      // 透過は白の上に重ねて落とし、1ch のバッファにする（透明部分を黒＝インクにしない）
      const { data, info } = await sharp(answerImage.imagePath)
        .flatten({ background: "#ffffff" })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true })
      if (info.channels !== 1) {
        throw new Error(`グレースケール1chに変換できません: ${info.channels}ch`)
      }
      const page: GreyscalePage = {
        pixels: data,
        width: info.width,
        height: info.height,
      }
      const paperDimensions = getOrientedPaperDimensions(
        options.paperSize,
        info.width > info.height
      )

      results.push({
        studentAnswerImageId: answerImage.studentAnswerImageId,
        regions: regions.flatMap((region) => {
          const measurement = measureRegionInk(
            page,
            region,
            paperDimensions,
            cellSizeMm
          )
          return measurement ? [measurement] : []
        }),
      })
    } catch (error) {
      console.warn(
        `答案画像のインク測定に失敗しました: ${answerImage.imagePath}`,
        error
      )
    }
  }

  return results
}
