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
 * はみ出し検知の帯の外側の寄せ幅（用紙比）。ここより外は印刷された枠線そのものなので数えない
 */
const EDGE_BAND_OUTER_INSET = 0.004

/** インクとみなす輝度の上限（これ未満がインク） */
const INK_LUMINANCE_THRESHOLD = 100

/*
 * 以下の閾値はいずれも初期値で、実際の答案で検証し直す前提の値。
 */

/** インク率がこれ未満なら白紙 */
export const BLANK_INK_RATIO_THRESHOLD = 0.0005

/** インク率がこれ未満（かつ白紙の閾値以上）なら境界帯。人かモデルに判断を回す */
export const BORDERLINE_INK_RATIO_THRESHOLD = 0.003

/** 枠際の帯のインク密度がこれ以上なら、その辺で答案が枠に触れている（はみ出している）とみなす */
export const EDGE_TOUCH_DENSITY_THRESHOLD = 0.003

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
  const metadata = await sharp(imagePath).metadata()
  const imageWidth = metadata.width
  const imageHeight = metadata.height
  if (!imageWidth || !imageHeight) {
    throw new Error(`画像の大きさを読み取れません: ${imagePath}`)
  }

  const cropRect = toPixelRect(
    insetRect(region, -SENDING_PADDING),
    imageWidth,
    imageHeight
  )
  const cropWidth = cropRect.right - cropRect.left
  const cropHeight = cropRect.bottom - cropRect.top
  if (cropWidth === 0 || cropHeight === 0) {
    throw new Error(`解答欄が画像の外にあります: ${imagePath}`)
  }

  let pipeline = sharp(imagePath).extract({
    left: cropRect.left,
    top: cropRect.top,
    width: cropWidth,
    height: cropHeight,
  })
  if (imageScale !== 1) {
    pipeline = pipeline.resize(
      Math.max(1, Math.round(cropWidth * imageScale)),
      Math.max(1, Math.round(cropHeight * imageScale))
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
 * 枠の辺ごとに、枠線のすぐ内側の帯（0.004〜0.014 寄せ）を用紙比で返す。
 * 帯の長さ方向は 0.004 寄せの範囲にとどめ、隣の辺の枠線を含めない。
 */
function edgeBands(region: NormalizedRect): EdgeSides<NormalizedRect> {
  const outer = insetRect(region, EDGE_BAND_OUTER_INSET)
  const bandThickness = INNER_INSET - EDGE_BAND_OUTER_INSET
  return {
    top: { x: outer.x, y: outer.y, width: outer.width, height: bandThickness },
    bottom: {
      x: outer.x,
      y: outer.y + outer.height - bandThickness,
      width: outer.width,
      height: bandThickness,
    },
    left: {
      x: outer.x,
      y: outer.y,
      width: bandThickness,
      height: outer.height,
    },
    right: {
      x: outer.x + outer.width - bandThickness,
      y: outer.y,
      width: bandThickness,
      height: outer.height,
    },
  }
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

  // 帯は内側より外（0.004 寄せ）まで広がるので、印はその範囲で作る
  const maskRect = toPixelRect(
    insetRect(region, EDGE_BAND_OUTER_INSET),
    page.width,
    page.height
  )
  const inkMask = buildDenoisedInkMask(page, maskRect)

  // 輝度を引き伸ばす正規化（sharp の normalise() 等）は入れない。白紙のスキャンでは
  // 薄い紙のむらやノイズしか無く、それを 0〜255 へ引き伸ばすとむらが濃い「インク」に
  // 化けて、白紙が記入ありに判定される。閾値は生の輝度に対して掛ける。
  const inkRatio = inkDensity(inkMask, maskRect, innerRect)

  const bands = edgeBands(region)
  const densityOf = (band: NormalizedRect): number =>
    inkDensity(inkMask, maskRect, toPixelRect(band, page.width, page.height))
  const edgeInkDensities: EdgeSides<number> = {
    top: densityOf(bands.top),
    right: densityOf(bands.right),
    bottom: densityOf(bands.bottom),
    left: densityOf(bands.left),
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
