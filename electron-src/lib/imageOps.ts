/**
 * main プロセスの画像処理の窓口。sharp を import してよいのはこのファイルだけ（eslint で縛る）。
 *
 * web 版はこのファイルの中身だけを wasm-vips で差し替える。wasm-vips は sharp と同じ
 * libvips を WASM にしたもので、同じ操作なら出力がバイト単位で一致する（2026-10-11 実測）。
 * そのため各関数は「sharp の呼び出しを1つ包んだもの」に留め、どこを切るか・何を測るかは
 * 呼び出し側に残す。窓口の外へ sharp の型や既定値（fit・kernel 等）を漏らさない。
 */
import sharp, { type OutputInfo } from "sharp"

/** ファイルの絶対パス、または符号化された画像のバイト列 */
type ImageInput = string | Buffer

/** 画像の見出し（デコードしないで読める値） */
export interface ImageHeader {
  /** 画像の形式（"png" / "jpeg" / "webp" など） */
  format: string
  /** 画素の幅・高さ（EXIF の向きを当てる前） */
  width: number
  height: number
  /** EXIF の向き（無ければ undefined。1 は「そのまま」） */
  orientation: number | undefined
  /** EXIF の向きを当てた後の幅・高さ（ブラウザの naturalWidth と同じ） */
  orientedWidth: number
  orientedHeight: number
}

/** デコードした画素（行優先、1画素 channels バイト） */
export interface RawPixels {
  data: Buffer
  width: number
  height: number
  channels: number
}

/** 画素の矩形 */
export interface PixelRegion {
  left: number
  top: number
  width: number
  height: number
}

/** 画素の大きさ */
export interface PixelSize {
  width: number
  height: number
}

/** PNG と、その画素の大きさ */
export interface EncodedPng extends PixelSize {
  png: Buffer
}

const WHITE = "#ffffff"

const toRawPixels = ({
  data,
  info,
}: {
  data: Buffer
  info: OutputInfo
}): RawPixels => ({
  data,
  width: info.width,
  height: info.height,
  channels: info.channels,
})

/** 見出しを読む。画像として読めなければ例外 */
export async function readImageHeader(input: ImageInput): Promise<ImageHeader> {
  const metadata = await sharp(input).metadata()
  return {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    orientation: metadata.orientation,
    orientedWidth: metadata.autoOrient.width,
    orientedHeight: metadata.autoOrient.height,
  }
}

/** RGB の画素にする（透過は捨てる。白の上に重ねはしない） */
export async function decodeRgb(input: ImageInput): Promise<RawPixels> {
  return toRawPixels(
    await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  )
}

/** グレースケール1chの画素にする */
export async function decodeGreyscale(input: ImageInput): Promise<RawPixels> {
  return toRawPixels(
    await sharp(input).greyscale().raw().toBuffer({ resolveWithObject: true })
  )
}

/** 透過を白の上に重ねてから、グレースケール1chの画素にする */
export async function decodeGreyscaleOnWhite(
  input: ImageInput
): Promise<RawPixels> {
  return toRawPixels(
    await sharp(input)
      .flatten({ background: WHITE })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
  )
}

/** PNG にし直す */
export async function encodePng(input: ImageInput): Promise<Buffer> {
  return sharp(input).png().toBuffer()
}

/**
 * 矩形を切り出して PNG にする。`resizeTo` があれば切り出した後にその大きさへ変える
 * （縦横比が違えば同じ倍率で覆ってから中央を切る＝sharp の既定 fit "cover"、lanczos3）
 */
export async function cropToPng(
  input: ImageInput,
  region: PixelRegion,
  resizeTo?: PixelSize
): Promise<EncodedPng> {
  let pipeline = sharp(input).extract(region)
  if (resizeTo) pipeline = pipeline.resize(resizeTo.width, resizeTo.height)
  const { data, info } = await pipeline
    .png()
    .toBuffer({ resolveWithObject: true })
  return { png: data, width: info.width, height: info.height }
}

/** 四辺を白で広げて PNG にする */
export async function extendWithWhiteToPng(
  input: ImageInput,
  padding: { top: number; bottom: number; left: number; right: number }
): Promise<Buffer> {
  return sharp(input)
    .extend({ ...padding, background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer()
}

/**
 * 画像の中心を基点に回転して PNG にする（角度の向きは sharp の rotate と同じ）。
 * 90 度の倍数でなければ外接矩形に広がり、角は白で埋める（90 度の倍数なら背景は使われない）
 */
export async function rotateToPng(
  input: ImageInput,
  degrees: number
): Promise<Buffer> {
  return sharp(input)
    .rotate(degrees, { background: "#FFFFFF" })
    .png()
    .toBuffer()
}

/**
 * 指定の大きさへ変えて PNG にする（lanczos3）。
 * `fit: "cover"` は同じ倍率で覆ってから中央を切る、`fit: "fill"` は縦横を別々に伸ばす
 */
export async function resizeToPng(
  input: ImageInput,
  size: PixelSize,
  fit: "cover" | "fill"
): Promise<Buffer> {
  return sharp(input)
    .resize(size.width, size.height, { fit, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer()
}

/**
 * EXIF の向きを当て、一辺が `maxSide` を超えるなら収まるまで縮める（拡大はしない）。
 * `format` の形式で符号化する（JPEG は品質 `jpegQuality`）
 */
export async function orientAndFitInside(
  input: ImageInput,
  maxSide: number,
  output: { format: "png" } | { format: "jpeg"; jpegQuality: number }
): Promise<Buffer> {
  const pipeline = sharp(input).rotate().resize({
    width: maxSide,
    height: maxSide,
    fit: "inside",
    withoutEnlargement: true,
  })
  return output.format === "jpeg"
    ? pipeline.jpeg({ quality: output.jpegQuality }).toBuffer()
    : pipeline.png().toBuffer()
}

/** 透過を白の上に重ねて JPEG にする */
export async function flattenOnWhiteToJpeg(
  input: ImageInput,
  jpegQuality: number
): Promise<Buffer> {
  return sharp(input)
    .flatten({ background: WHITE })
    .jpeg({ quality: jpegQuality })
    .toBuffer()
}
