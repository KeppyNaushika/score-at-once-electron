/**
 * web 版の画像処理の窓口。`electron-src/lib/imageOps.ts`（sharp）と同じ口を、wasm-vips で持つ。
 *
 * `scripts/web/buildWorker.mjs` が、Worker を束ねるときに `imageOps.ts` をこのファイルへ
 * 差し替える。呼び出し側（OMR・マーカー補正・白さの測定・AI に送る画像の切り出しなど）は
 * デスクトップ版と同じコードがそのまま動く。
 *
 * wasm-vips の libvips・libpng・zlib-ng・mozjpeg は sharp 0.35.5 と同じ版なので、sharp と
 * 同じ libvips の操作を同じ順・同じ引数で呼べば、出力はバイト単位で一致する。そのため各関数は、
 * sharp のパイプライン（sharp の `src/pipeline.cc`）が `imageOps.ts` の呼び方のときに通る段を、
 * 同じ順に写したものにしている（下の `runPipeline`）。一致は
 * `__tests__/web/imageOpsVipsParity.test.ts` が縛る。
 *
 * wasm-vips の呼び出しは同期（pthread の完了を待つ）で、Worker の中なので許される。
 */
import { Buffer } from "buffer"
import { readFile } from "fs/promises"
import type Vips from "wasm-vips"

import type { ImageHeader } from "../../electron-src/lib/imageOps"
import { loadVips, type VipsModule } from "./vipsRuntime"

/** ファイルの絶対パス、または符号化された画像のバイト列（Buffer も Uint8Array の一種） */
type ImageInput = string | Uint8Array

/** デコードした画素（行優先、1画素 channels バイト） */
interface RawPixels {
  data: Buffer
  width: number
  height: number
  channels: number
}

/** 画素の矩形 */
interface PixelRegion {
  left: number
  top: number
  width: number
  height: number
}

/** 画素の大きさ */
interface PixelSize {
  width: number
  height: number
}

/** PNG と、その画素の大きさ */
interface EncodedPng extends PixelSize {
  png: Buffer
}

/** 0〜255 の RGBA（sharp が背景色を持つ形） */
type RgbaColour = [number, number, number, number]

const WHITE: RgbaColour = [255, 255, 255, 255]

/** sharp の既定（`limitInputPixels`・`limitInputChannels`） */
const INPUT_PIXEL_LIMIT = 0x3fff ** 2
const INPUT_CHANNEL_LIMIT = 5

/** sharp の入力の既定（`sequentialRead: true`・`failOn: 'warning'`） */
const LOAD_OPTIONS: { access: string; fail_on: string } = {
  access: "sequential",
  fail_on: "warning",
}

/**
 * libvips の読み込み器の名前（`vips-loader`）→ sharp の形式名（sharp の `ImageTypeId`）。
 * sharp が知らない読み込み器の画像は、sharp と同じく受け付けない
 */
const FORMAT_BY_LOADER = new Map<string, string>([
  ["jpegload", "jpeg"],
  ["pngload", "png"],
  ["webpload", "webp"],
  ["tiffload", "tiff"],
  ["gifload", "gif"],
  ["jp2kload", "jp2"],
  ["svgload", "svg"],
  ["heifload", "heif"],
  ["pdfload", "pdf"],
  ["magickload", "magick"],
  ["openslideload", "openslide"],
  ["ppmload", "ppm"],
  ["fitsload", "fits"],
  ["openexrload", "exr"],
  ["jxlload", "jxl"],
  ["radload", "rad"],
  ["dcrawload", "dcraw"],
  ["uhdrload", "uhdr"],
  ["vipsload", "vips"],
])

/** 1回の処理で作った libvips の画像を覚え、終わりにまとめて解放する */
class ImageScope {
  private readonly images: Vips.Image[] = []

  keep(image: Vips.Image): Vips.Image {
    this.images.push(image)
    return image
  }

  dispose(): void {
    this.images.forEach((image) => {
      if (!image.isDeleted()) image.delete()
    })
  }
}

const readInputBytes = async (input: ImageInput): Promise<Uint8Array> =>
  typeof input === "string" ? readFile(input) : input

/** 開いた画像と、sharp の形式名 */
interface OpenedImage {
  image: Vips.Image
  format: string
}

/** sharp の `OpenInput`（圧縮されたバイト列から開く。画素数・チャンネル数の上限も同じ） */
function openImage(
  vips: VipsModule,
  scope: ImageScope,
  bytes: Uint8Array
): OpenedImage {
  if (bytes.byteLength === 0) throw new Error("Input Buffer is empty")
  let image: Vips.Image
  try {
    image = scope.keep(vips.Image.newFromBuffer(bytes, "", LOAD_OPTIONS))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Input buffer has corrupt header: ${reason}`, {
      cause: error,
    })
  }
  const loader = image.getString("vips-loader").replace(/_(buffer|source)$/, "")
  const format = FORMAT_BY_LOADER.get(loader)
  if (format === undefined) {
    throw new Error("Input buffer contains unsupported image format")
  }
  if (image.width * image.height > INPUT_PIXEL_LIMIT) {
    throw new Error("Input image exceeds pixel limit")
  }
  if (image.bands > INPUT_CHANNEL_LIMIT) {
    throw new Error("Input image exceeds channel limit")
  }
  return { image, format }
}

const is16Bit = (interpretation: string): boolean =>
  interpretation === "rgb16" || interpretation === "grey16"

/** EXIF の向き（無ければ 0。sharp の `ExifOrientation`） */
const exifOrientationOf = (image: Vips.Image): number =>
  image.getTypeof("orientation") !== 0 ? image.getInt("orientation") : 0

/** libvips の 90 度単位の角度 */
type RightAngle = "d0" | "d90" | "d180" | "d270"

/** EXIF の向きを当てるための回転と左右反転 */
interface OrientationTransform {
  angle: RightAngle
  flop: boolean
}

const NO_ORIENTATION_TRANSFORM: OrientationTransform = {
  angle: "d0",
  flop: false,
}

/** EXIF の向き → 回す角度と左右反転（sharp の `CalculateExifRotationAndFlop`） */
function exifRotationAndFlop(orientation: number): OrientationTransform {
  switch (orientation) {
    case 6:
      return { angle: "d90", flop: false }
    case 3:
      return { angle: "d180", flop: false }
    case 8:
      return { angle: "d270", flop: false }
    case 2:
      return { angle: "d0", flop: true }
    case 7:
      return { angle: "d270", flop: true }
    case 4:
      return { angle: "d180", flop: true }
    case 5:
      return { angle: "d90", flop: true }
    default:
      return NO_ORIENTATION_TRANSFORM
  }
}

/** 90 度の倍数の角度 → libvips の角度（sharp の `CalculateAngleRotation`） */
function rightAngleOf(degrees: number): RightAngle {
  const normalized = ((degrees % 360) + 360) % 360
  if (normalized === 90) return "d90"
  if (normalized === 180) return "d180"
  if (normalized === 270) return "d270"
  return "d0"
}

/** sharp の `GetRgbaAsColourspace`: sRGB の色を、画像の色空間の値にする */
function colourInImageSpace(
  vips: VipsModule,
  scope: ImageScope,
  colour: number[],
  interpretation: string,
  premultiply: boolean
): number[] {
  if (colour.length < 3) return colour
  let pixel = scope.keep(
    scope
      .keep(vips.Image.newMatrix(1, 1))
      .newFromImage(colour)
      .colourspace(interpretation, { source_space: "srgb" })
  )
  if (premultiply) pixel = scope.keep(pixel.premultiply())
  return pixel.getpoint(0, 0)
}

/** sharp の `ApplyAlpha`: 背景色を画像の帯の数・色空間に合わせる（不透明でない色なら画像に透過を足す） */
function applyAlpha(
  vips: VipsModule,
  scope: ImageScope,
  image: Vips.Image,
  colour: RgbaColour,
  premultiply: boolean
): { image: Vips.Image; background: number[] } {
  const multiplier = is16Bit(image.interpretation) ? 256 : 1
  const [red, green, blue, alpha] = colour
  const background =
    image.bands > 2
      ? [multiplier * red, multiplier * green, multiplier * blue]
      : [multiplier * (0.2126 * red + 0.7152 * green + 0.0722 * blue)]
  if (alpha < 255 || image.hasAlpha()) {
    const extraBands = image.bands > 4 ? image.bands - 3 : 1
    background.push(
      ...Array.from({ length: extraBands }, () => alpha * multiplier)
    )
  }
  const converted = colourInImageSpace(
    vips,
    scope,
    background,
    image.interpretation,
    premultiply
  )
  const withAlpha =
    alpha < 255 && !image.hasAlpha()
      ? scope.keep(image.bandjoin([255 * multiplier]))
      : image
  return { image: withAlpha, background: converted }
}

/** sharp の `ResolveShrink`（縦横の縮める比） */
function resolveShrink(
  width: number,
  height: number,
  resize: ResizeStep
): { hshrink: number; vshrink: number } {
  let hshrink = width / resize.width
  let vshrink = height / resize.height
  // cover（crop）は小さい方、inside（max）は大きい方の比に揃える
  const shared =
    resize.canvas === "crop"
      ? Math.min(hshrink, vshrink)
      : Math.max(hshrink, vshrink)
  hshrink = shared
  vshrink = shared
  if (resize.withoutEnlargement) {
    hshrink = Math.max(1, hshrink)
    vshrink = Math.max(1, vshrink)
  }
  return {
    hshrink: Math.min(hshrink, width),
    vshrink: Math.min(vshrink, height),
  }
}

/** sharp の JPEG の縮小読み込みの倍率（`fastShrinkOnLoad: true` のとき） */
function jpegShrinkOnLoadOf(shrink: number): number {
  let jpegShrink = 1
  if (shrink >= 8) jpegShrink = 8
  else if (shrink >= 4) jpegShrink = 4
  else if (shrink >= 2) jpegShrink = 2
  // libjpeg の丸めの誤差が出る倍率は1段下げる
  if (jpegShrink > 1 && Math.trunc(shrink) === jpegShrink) jpegShrink /= 2
  return jpegShrink
}

/** 大きさを変える段（`imageOps.ts` が使う fit は cover と inside だけ） */
interface ResizeStep {
  width: number
  height: number
  /** cover = "crop"、inside = "max"（sharp の canvas） */
  canvas: "crop" | "max"
  withoutEnlargement: boolean
}

/** パイプラインの段（sharp のメソッドで指定するもの。`imageOps.ts` が使う分だけ） */
interface PipelineSteps {
  /** `.rotate()`（引数なし）＝ EXIF の向きを当てる */
  autoOrient?: boolean
  /** `.rotate(角度, { background })` */
  rotation?: { degrees: number; background: RgbaColour }
  /** `.extract()`（resize より前） */
  extract?: PixelRegion
  /** `.resize()`（kernel は lanczos3） */
  resize?: ResizeStep
  /** `.extend()` */
  extend?: {
    top: number
    bottom: number
    left: number
    right: number
    background: RgbaColour
  }
  /** `.flatten({ background })` */
  flattenBackground?: RgbaColour
  /** `.greyscale()` */
  greyscale?: boolean
  /** `.removeAlpha()` */
  removeAlpha?: boolean
}

/** 出力の形（`.raw()` / `.png()` / `.jpeg({ quality })`） */
type PipelineOutput =
  { format: "raw" } | { format: "png" } | { format: "jpeg"; quality: number }

interface PipelineResult {
  data: Buffer
  width: number
  height: number
  channels: number
}

/**
 * sharp の `PipelineWorker::Execute` のうち、`imageOps.ts` の呼び方で通る段を同じ順に行う。
 *
 * `imageOps.ts` は回転と resize・extract を組み合わせないので、sharp が回転を前へ出す
 * （`rotateBefore`・`orientBefore`）経路は通らない。多ページ・ゲインマップ・ICC の書き出しも
 * 使わない。メタデータは残さない（sharp の既定 `keep: none`）ので、メタデータだけを触る段
 * （EXIF の向きやゲインマップの削除）は省く
 */
function runPipeline(
  vips: VipsModule,
  bytes: Uint8Array,
  steps: PipelineSteps,
  output: PipelineOutput
): PipelineResult {
  const scope = new ImageScope()
  try {
    const opened = openImage(vips, scope, bytes)
    let image = opened.image

    const autoOrientation = steps.autoOrient
      ? exifRotationAndFlop(exifOrientationOf(image))
      : NO_ORIENTATION_TRANSFORM
    // `.rotate(角度)`: 90 度の倍数の整数なら rot、それ以外は任意角の rotate（sharp の rotate()）
    const rotation = steps.rotation
    const isRightAngleRotation =
      rotation !== undefined &&
      Number.isInteger(rotation.degrees) &&
      rotation.degrees % 90 === 0
    const rightAngle: RightAngle =
      rotation && isRightAngleRotation ? rightAngleOf(rotation.degrees) : "d0"
    const arbitraryRotation = isRightAngleRotation ? undefined : rotation

    // resize より前の切り出し
    if (steps.extract) {
      const { left, top, width, height } = steps.extract
      image = scope.keep(image.extractArea(left, top, width, height))
    }

    // EXIF の向きで 90/270 度回すなら、回した後の大きさになるよう縦横を入れ替えて比を求める
    const resize =
      steps.resize &&
      (autoOrientation.angle === "d90" || autoOrientation.angle === "d270")
        ? {
            ...steps.resize,
            width: steps.resize.height,
            height: steps.resize.width,
          }
        : steps.resize

    // 縮小読み込み（resize があり、前の切り出しが無いとき）。JPEG は整数倍、WebP は実数倍で
    // 読み直す（sharp の shrink-on-load。SVG・PDF は wasm-vips に読み込み器が無い）
    if (resize && !steps.extract) {
      const { hshrink, vshrink } = resolveShrink(
        image.width,
        image.height,
        resize
      )
      const commonShrink = Math.min(hshrink, vshrink)
      if (opened.format === "jpeg") {
        const jpegShrink = jpegShrinkOnLoadOf(commonShrink)
        if (jpegShrink > 1) {
          image = scope.keep(
            vips.Image.jpegloadBuffer(bytes, {
              ...LOAD_OPTIONS,
              shrink: jpegShrink,
            })
          )
        }
      } else if (opened.format === "webp" && commonShrink > 1) {
        image = scope.keep(
          vips.Image.webploadBuffer(bytes, {
            ...LOAD_OPTIONS,
            scale: 1 / commonShrink,
          })
        )
      }
    }

    const shrink = resize
      ? resolveShrink(image.width, image.height, resize)
      : { hshrink: 1, vshrink: 1 }

    // 埋め込みの ICC プロファイル（または CMYK）から、処理用の sRGB（16bit RGB なら P3）へ
    const processingProfile = image.interpretation === "rgb16" ? "p3" : "srgb"
    if (
      image.getTypeof("icc-profile-data") !== 0 &&
      image.interpretation !== "labs" &&
      image.interpretation !== "grey16"
    ) {
      try {
        image = scope.keep(
          image.iccTransform(processingProfile, {
            embedded: true,
            depth: is16Bit(image.interpretation) ? 16 : 8,
            intent: "perceptual",
          })
        )
      } catch {
        // sharp も壊れたプロファイルは警告だけで先へ進む
        console.warn("[web] Invalid embedded profile")
      }
    } else if (image.interpretation === "cmyk") {
      image = scope.keep(
        image.iccTransform(processingProfile, {
          input_profile: "cmyk",
          intent: "perceptual",
        })
      )
    }

    if (steps.flattenBackground && image.hasAlpha()) {
      const multiplier = is16Bit(image.interpretation) ? 256 : 1
      const [red, green, blue] = steps.flattenBackground
      image = scope.keep(
        image.flatten({
          background: [red * multiplier, green * multiplier, blue * multiplier],
        })
      )
    }

    if (steps.greyscale) image = scope.keep(image.colourspace("b-w"))

    const shouldResize = shrink.hshrink !== 1 || shrink.vshrink !== 1
    const premultipliedFormat = image.format
    const shouldPremultiply = image.hasAlpha() && shouldResize
    if (shouldPremultiply) {
      image = scope.keep(
        scope.keep(image.premultiply()).cast(premultipliedFormat)
      )
    }

    if (shouldResize) {
      image = scope.keep(
        image.resize(1 / shrink.hshrink, {
          vscale: 1 / shrink.vshrink,
          kernel: "lanczos3",
        })
      )
    }

    // 順に読む（sequential）画像は、行の順を崩す回転・反転の前にメモリへ写す。写さないと
    // 「out of order read」で失敗する（sharp の StaySequential と同じ扱い）
    if (
      autoOrientation.angle !== "d0" ||
      autoOrientation.flop ||
      rightAngle !== "d0" ||
      arbitraryRotation
    ) {
      image = scope.keep(image.copyMemory())
    }

    if (autoOrientation.angle !== "d0") {
      image = scope.keep(image.rot(autoOrientation.angle))
    }
    if (autoOrientation.flop) {
      image = scope.keep(image.flip("horizontal"))
    }
    if (rightAngle !== "d0") image = scope.keep(image.rot(rightAngle))

    // cover: 同じ倍率で覆った後、中央を切る（sharp の Canvas::CROP と CalculateCrop の中央）
    if (resize && resize.canvas === "crop") {
      const targetWidth = Math.min(steps.resize?.width ?? 0, image.width)
      const targetHeight = Math.min(steps.resize?.height ?? 0, image.height)
      if (image.width !== targetWidth || image.height !== targetHeight) {
        const left = Math.trunc((image.width - targetWidth + 1) / 2)
        const top = Math.trunc((image.height - targetHeight + 1) / 2)
        image = scope.keep(
          image.extractArea(left, top, targetWidth, targetHeight)
        )
      }
    }

    if (arbitraryRotation) {
      const applied = applyAlpha(
        vips,
        scope,
        image,
        arbitraryRotation.background,
        shouldPremultiply
      )
      image = scope.keep(
        applied.image.rotate(arbitraryRotation.degrees, {
          background: applied.background,
        })
      )
    }

    if (steps.extend) {
      const { top, bottom, left, right, background } = steps.extend
      if (top > 0 || bottom > 0 || left > 0 || right > 0) {
        const applied = applyAlpha(
          vips,
          scope,
          image,
          background,
          shouldPremultiply
        )
        image = scope.keep(
          applied.image.embed(
            left,
            top,
            applied.image.width + left + right,
            applied.image.height + top + bottom,
            { extend: "background", background: applied.background }
          )
        )
      }
    }

    if (shouldPremultiply) {
      image = scope.keep(
        scope.keep(image.unpremultiply()).cast(premultipliedFormat)
      )
    }

    if (steps.removeAlpha) {
      while (image.bands > 1 && image.hasAlpha()) {
        image = scope.keep(image.extractBand(0, { n: image.bands - 1 }))
      }
    }

    // 出力の色空間（sharp の既定 srgb）
    if (is16Bit(image.interpretation)) {
      image = scope.keep(image.cast("ushort"))
    }
    if (image.interpretation !== "srgb") {
      image = scope.keep(
        image.colourspace("srgb", { source_space: image.interpretation })
      )
    }

    return encodeOutput(scope, image, steps, output)
  } finally {
    scope.dispose()
  }
}

/** sharp の出力（`raw` / `pngsave_buffer` / `jpegsave_buffer` を sharp の既定の引数で） */
function encodeOutput(
  scope: ImageScope,
  encodedImage: Vips.Image,
  steps: PipelineSteps,
  output: PipelineOutput
): PipelineResult {
  let image = encodedImage
  if (output.format === "raw") {
    // グレースケールは1帯目だけを返す
    if (steps.greyscale || image.interpretation === "b-w") {
      image = scope.keep(image.extractBand(0))
    }
    if (image.format !== "uchar") image = scope.keep(image.cast("uchar"))
    const memory = image.writeToMemory()
    return {
      // 写しを取る（wasm のヒープを指したままにしない）
      data: Buffer.from(
        new Uint8Array(memory.buffer, memory.byteOffset, memory.byteLength)
      ),
      width: image.width,
      height: image.height,
      channels: image.bands,
    }
  }
  const encoded =
    output.format === "png"
      ? image.pngsaveBuffer({
          keep: "none",
          interlace: false,
          compression: 6,
          filter: "none",
          palette: false,
          Q: 100,
          effort: 7,
          bitdepth: is16Bit(image.interpretation) ? 16 : 8,
          dither: 1,
        })
      : image.jpegsaveBuffer({
          keep: "none",
          Q: output.quality,
          interlace: false,
          subsample_mode: "on",
          trellis_quant: false,
          quant_table: 0,
          overshoot_deringing: false,
          optimize_scans: false,
          optimize_coding: true,
        })
  return {
    data: Buffer.from(encoded),
    width: image.width,
    height: image.height,
    channels: image.bands,
  }
}

async function runOnInput(
  input: ImageInput,
  steps: PipelineSteps,
  output: PipelineOutput
): Promise<PipelineResult> {
  const [vips, bytes] = await Promise.all([loadVips(), readInputBytes(input)])
  return runPipeline(vips, bytes, steps, output)
}

const toRawPixels = ({
  data,
  width,
  height,
  channels,
}: PipelineResult): RawPixels => ({ data, width, height, channels })

/** 見出しを読む。画像として読めなければ例外 */
export async function readImageHeader(input: ImageInput): Promise<ImageHeader> {
  const [vips, bytes] = await Promise.all([loadVips(), readInputBytes(input)])
  const scope = new ImageScope()
  try {
    const { image, format } = openImage(vips, scope, bytes)
    const orientation = exifOrientationOf(image)
    const swapsSides = orientation >= 5
    return {
      format,
      width: image.width,
      height: image.height,
      orientation: orientation > 0 ? orientation : undefined,
      orientedWidth: swapsSides ? image.height : image.width,
      orientedHeight: swapsSides ? image.width : image.height,
    }
  } finally {
    scope.dispose()
  }
}

/** RGB の画素にする（透過は捨てる。白の上に重ねはしない） */
export async function decodeRgb(input: ImageInput): Promise<RawPixels> {
  return toRawPixels(
    await runOnInput(input, { removeAlpha: true }, { format: "raw" })
  )
}

/** グレースケール1chの画素にする */
export async function decodeGreyscale(input: ImageInput): Promise<RawPixels> {
  return toRawPixels(
    await runOnInput(input, { greyscale: true }, { format: "raw" })
  )
}

/** 透過を白の上に重ねてから、グレースケール1chの画素にする */
export async function decodeGreyscaleOnWhite(
  input: ImageInput
): Promise<RawPixels> {
  return toRawPixels(
    await runOnInput(
      input,
      { flattenBackground: WHITE, greyscale: true },
      { format: "raw" }
    )
  )
}

/** PNG にし直す */
export async function encodePng(input: ImageInput): Promise<Buffer> {
  return (await runOnInput(input, {}, { format: "png" })).data
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
  const { data, width, height } = await runOnInput(
    input,
    {
      extract: region,
      resize: resizeTo && {
        width: resizeTo.width,
        height: resizeTo.height,
        canvas: "crop",
        withoutEnlargement: false,
      },
    },
    { format: "png" }
  )
  return { png: data, width, height }
}

/** 四辺を白で広げて PNG にする */
export async function extendWithWhiteToPng(
  input: ImageInput,
  padding: { top: number; bottom: number; left: number; right: number }
): Promise<Buffer> {
  return (
    await runOnInput(
      input,
      { extend: { ...padding, background: WHITE } },
      { format: "png" }
    )
  ).data
}

/**
 * 画像の中心を基点に回転して PNG にする（角度の向きは sharp の rotate と同じ）。
 * 90 度の倍数でなければ外接矩形に広がり、角は白で埋める（90 度の倍数なら背景は使われない）
 */
export async function rotateToPng(
  input: ImageInput,
  degrees: number
): Promise<Buffer> {
  return (
    await runOnInput(
      input,
      { rotation: { degrees, background: WHITE } },
      { format: "png" }
    )
  ).data
}

/**
 * 指定の大きさへ変えて PNG にする（lanczos3）。縦横比が違えば同じ倍率で覆ってから
 * 中央を切る（sharp の fit "cover"）
 */
export async function resizeToPng(
  input: ImageInput,
  size: PixelSize
): Promise<Buffer> {
  return (
    await runOnInput(
      input,
      {
        resize: {
          width: size.width,
          height: size.height,
          canvas: "crop",
          withoutEnlargement: false,
        },
      },
      { format: "png" }
    )
  ).data
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
  return (
    await runOnInput(
      input,
      {
        autoOrient: true,
        resize: {
          width: maxSide,
          height: maxSide,
          canvas: "max",
          withoutEnlargement: true,
        },
      },
      output.format === "jpeg"
        ? { format: "jpeg", quality: output.jpegQuality }
        : { format: "png" }
    )
  ).data
}

/** 透過を白の上に重ねて JPEG にする */
export async function flattenOnWhiteToJpeg(
  input: ImageInput,
  jpegQuality: number
): Promise<Buffer> {
  return (
    await runOnInput(
      input,
      { flattenBackground: WHITE },
      { format: "jpeg", quality: jpegQuality }
    )
  ).data
}
