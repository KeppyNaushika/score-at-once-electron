/**
 * プロンプトの問題の画像の取り込み（docs/vlm-grading-design.md §3-1）。
 *
 * 画面がファイル（PNG / JPEG / WebP。PDF はページを選んで画像にしたもの）か貼り付けた画像を、
 * 切り出したうえでバイト列で渡してくる。ここで中身を確かめてから、試験フォルダの
 * `ai-question-images` に保存し、data ディレクトリからの相対パスを返す。
 *
 * 保存するだけで DB には書かない（行はプロンプトを保存するときに作る）。ファイル名は乱数で、
 * 元のファイル名（氏名などが入りうる）は使わない。外部へは何も送らない。
 */

import * as crypto from "crypto"
import * as fsPromises from "fs/promises"
import * as path from "path"
import sharp, { type Metadata } from "sharp"

import {
  AI_QUESTION_IMAGE_MAX_SAVED_BYTES,
  AI_QUESTION_IMAGE_MAX_SIDE,
  AI_QUESTION_IMAGE_MAX_SOURCE_BYTES,
} from "@/lib/shared/aiGrading/questionImageLimits"

import { AI_QUESTION_IMAGES_DIRECTORY_NAME } from "../prisma/aiPrompt"
import prisma from "../prisma/client"

/** 受け付ける画像の形式（sharp の format の名前） */
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp"])

/** 取り込む画像（画面から） */
export interface ImportAiQuestionImageInput {
  cropRegionId: string
  /** 画像のバイト列（IPC では Uint8Array で届く） */
  imageBytes: Uint8Array
}

/** 保存する画像（バイト列と拡張子） */
interface EncodedQuestionImage {
  bytes: Buffer
  extension: ".png" | ".jpg"
}

/**
 * 保存する形にする。PNG・JPEG で向きの指定が無く、大きすぎなければそのまま。
 * それ以外（WebP・向きの指定あり・一辺が上限超え）は向きを直して縮め、PNG（JPEG なら JPEG）にする。
 * 大きさの上限を超えるものは JPEG にして縮める
 */
async function encodeQuestionImage(
  source: Buffer
): Promise<EncodedQuestionImage> {
  let metadata: Metadata
  try {
    metadata = await sharp(source).metadata()
  } catch {
    throw new Error("画像として読めませんでした")
  }
  const format = metadata.format ?? ""
  if (!ACCEPTED_FORMATS.has(format)) {
    throw new Error("PNG・JPEG・WebP の画像か、PDF を選んでください")
  }
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  if (width === 0 || height === 0) {
    throw new Error("画像の大きさが読めませんでした")
  }

  const isOriented =
    metadata.orientation !== undefined && metadata.orientation !== 1
  const isTooLarge =
    width > AI_QUESTION_IMAGE_MAX_SIDE || height > AI_QUESTION_IMAGE_MAX_SIDE
  let encoded: EncodedQuestionImage
  if ((format === "png" || format === "jpeg") && !isOriented && !isTooLarge) {
    encoded = { bytes: source, extension: format === "png" ? ".png" : ".jpg" }
  } else {
    const pipeline = sharp(source).rotate().resize({
      width: AI_QUESTION_IMAGE_MAX_SIDE,
      height: AI_QUESTION_IMAGE_MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    encoded =
      format === "jpeg"
        ? {
            bytes: await pipeline.jpeg({ quality: 92 }).toBuffer(),
            extension: ".jpg",
          }
        : { bytes: await pipeline.png().toBuffer(), extension: ".png" }
  }

  if (encoded.bytes.byteLength <= AI_QUESTION_IMAGE_MAX_SAVED_BYTES) {
    return encoded
  }
  const shrunk = await sharp(encoded.bytes)
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer()
  if (shrunk.byteLength > AI_QUESTION_IMAGE_MAX_SAVED_BYTES) {
    throw new Error(
      "画像が大きすぎます。範囲を切り出すか、小さい画像にしてください"
    )
  }
  return { bytes: shrunk, extension: ".jpg" }
}

/**
 * 問題の画像を確かめて試験フォルダへ保存し、data ディレクトリからの相対パスを返す。
 * `filesDirectory` は共有するファイルの根（テストでは一時ディレクトリ）
 */
export async function importAiQuestionImage(
  input: ImportAiQuestionImageInput,
  filesDirectory: string
): Promise<{ imagePath: string }> {
  const source = Buffer.from(input.imageBytes)
  if (source.byteLength === 0) throw new Error("画像が空です")
  if (source.byteLength > AI_QUESTION_IMAGE_MAX_SOURCE_BYTES) {
    throw new Error("ファイルが大きすぎます（30MB まで）")
  }
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: input.cropRegionId },
    include: { examPage: true },
  })
  if (!cropRegion) throw new Error("設問が見つかりません")

  const encoded = await encodeQuestionImage(source)
  const imagePath = [
    "exams",
    cropRegion.examPage.examId,
    AI_QUESTION_IMAGES_DIRECTORY_NAME,
    `${crypto.randomUUID()}${encoded.extension}`,
  ].join("/")
  const absolutePath = path.join(filesDirectory, ...imagePath.split("/"))
  await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true })
  await fsPromises.writeFile(absolutePath, encoded.bytes)
  return { imagePath }
}
