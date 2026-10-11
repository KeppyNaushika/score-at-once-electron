/**
 * 答案に重ねる要素のスタイル（ExamAnswerOverlayStyle）の長さを、答案画像の画素から mm へ変換する
 *
 * migration（20261011100000_answer_overlay_length_in_mm）は既存の行に lengthUnit = "px" の印を
 * 付けるだけで、値は変えない。mm への変換には答案画像の大きさが要るので、ここで JS で行う。
 * migration の続きであって、表示のための計算ではない（計算を renderer に置く規約の対象外）。
 *
 * 走らせる場所は3つ。どれも "px" の行だけを対象にし、変換した行を "mm" にするので何度走らせてもよい。
 * - 起動時（SQL の migration の後、同期の初期化より前）: {@link convertPendingAnswerOverlayLengths}
 * - 統合アーカイブ（.sao）を開いて migration を当てた後: {@link convertArchiveAnswerOverlayLengths}
 * - 旧アーカイブの取り込みで行を書くとき: {@link readRepresentativeAnswerImage} と
 *   {@link convertOverlayRowToMm}（`importExamAttachments.ts`）
 *
 * 変換の式は描画の式（mm × 画像の幅 ÷ 用紙の幅）のちょうど逆（`convertPixelLengthsToMm`）。
 * 代表の画像に描かれる画素は変換の前後で一致する。用紙サイズのラベルが実際の画像と食い違う
 * 試験でも、描画と同じラベルで戻すので一致する。
 *
 * - 代表の画像は、その試験の答案画像の画素幅の最頻値。模範解答は使わない（解答用紙作成で作った
 *   模範解答は答案の2〜4倍の解像度のことがある）
 * - 答案の画像が1枚も無い試験は 144dpi 相当（`FALLBACK_PIXELS_PER_MM`）で代用する。重ねて描く
 *   答案が無いので、見た目には効かない
 * - 答案の画像が1枚でも読めない試験（ファイルが無い・NAS が切れている）は "px" のまま残し、
 *   次の機会に再試行する。読めた分だけで最頻値を取ると端末ごとに結果が変わりうるため
 *   （描画は "px" の行を画素のまま描くので、残っても見た目は変わらない）
 *
 * **updatedAt は変えない。** 統合アーカイブの migration の規約（docs/unified-archive-design.md
 * §8 の1「既存の行の id と時刻を変えない」）に揃える。開いたアーカイブの行の時刻を進めると、
 * 取り込みの後勝ちでアーカイブの古い設定が手元の新しい設定に勝ってしまう。同期は時刻列を
 * 変えない UPDATE も強い版として伝える（sqlite-nas-sync の UPDATE トリガーが lamport を進める）
 * ので、時刻を進めなくても他の端末へ届く。Prisma の `@updatedAt` が時刻を書き換えないよう、
 * 書き込みは生の SQL で行う。
 */

import type { PrismaClient } from "@prisma/client"
import sharp from "sharp"

import {
  convertPixelLengthsToMm,
  FALLBACK_PIXELS_PER_MM,
  overlayPixelsPerMm,
} from "../../../src/lib/answerOverlayPlacement"
import { resolveExamPaperSize } from "../../../src/lib/shared/examPaperSize"
import {
  toOverlayAnchor,
  toOverlayKind,
} from "../../../src/types/scoringOverlay.types"
import { resolveArchiveFile } from "../export/unified-archive/archiveFileCollector"
import type { SqliteDatabase } from "./sqliteSchemaUtils"

/** 画像の metadata を同時に読む数（NAS の往復待ちを重ねるため） */
const IMAGE_READ_CONCURRENCY = 8

/** 試験の代表の答案画像 */
type RepresentativeAnswerImage =
  | { readonly kind: "image"; readonly width: number; readonly height: number }
  /** 答案の画像が1枚も無い */
  | { readonly kind: "noAnswerImages" }
  /** 読めない画像がある（この試験は "px" のまま残す） */
  | { readonly kind: "unreadable"; readonly failedPaths: readonly string[] }

/** 変換する行（"px" の行の、長さと配置の列） */
interface PixelOverlayStyleRow {
  readonly overlayKind: string
  readonly position: string
  readonly size: number
  readonly offsetX: number
  readonly offsetY: number
}

/** 変換後の長さ（mm） */
interface MmOverlayLengths {
  readonly size: number
  readonly offsetX: number
  readonly offsetY: number
}

interface ImageSize {
  width: number
  height: number
}

/** 画像の大きさ（画素）。ブラウザの naturalWidth と同じく EXIF の向きを当てた後の値 */
async function readImageSize(imagePath: string): Promise<ImageSize | null> {
  try {
    const metadata = await sharp(imagePath).metadata()
    const { width, height } = metadata.autoOrient
    return width > 0 && height > 0 ? { width, height } : null
  } catch {
    return null
  }
}

async function readImageSizes(
  imagePaths: readonly string[]
): Promise<(ImageSize | null)[]> {
  const imageSizes: (ImageSize | null)[] = new Array(imagePaths.length)
  let nextIndex = 0
  const readNext = async (): Promise<void> => {
    while (nextIndex < imagePaths.length) {
      const index = nextIndex
      nextIndex += 1
      imageSizes[index] = await readImageSize(imagePaths[index])
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(IMAGE_READ_CONCURRENCY, imagePaths.length) },
      readNext
    )
  )
  return imageSizes
}

/** 最も多い値。同数なら小さい値（どの端末でも同じ答えにするため） */
function modeOf(values: readonly number[]): number {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  const [modeValue] = [...counts].sort(
    ([valueA, countA], [valueB, countB]) => countB - countA || valueA - valueB
  )[0]
  return modeValue
}

/**
 * 答案画像のパス（絶対パス、解決できなかったものは null）から、代表の画像を決める。
 * 幅は最頻値、高さ（向きの判定に使う）はその幅の画像の高さの最頻値
 */
export async function readRepresentativeAnswerImage(
  imagePaths: readonly (string | null)[]
): Promise<RepresentativeAnswerImage> {
  if (imagePaths.length === 0) return { kind: "noAnswerImages" }

  const unresolvedCount = imagePaths.filter(
    (imagePath) => imagePath === null
  ).length
  const resolvedPaths = imagePaths.filter(
    (imagePath): imagePath is string => imagePath !== null
  )
  const imageSizes = await readImageSizes(resolvedPaths)
  const failedPaths = resolvedPaths.filter(
    (_imagePath, index) => imageSizes[index] === null
  )
  if (unresolvedCount > 0 || failedPaths.length > 0) {
    return { kind: "unreadable", failedPaths }
  }

  const readSizes = imageSizes.filter(
    (imageSize): imageSize is ImageSize => imageSize !== null
  )
  const width = modeOf(readSizes.map((imageSize) => imageSize.width))
  const height = modeOf(
    readSizes
      .filter((imageSize) => imageSize.width === width)
      .map((imageSize) => imageSize.height)
  )
  return { kind: "image", width, height }
}

/**
 * 代表の画像と試験の用紙サイズから、1mm あたりの画素数を決める。
 * 読めない画像がある試験は変換しない（null）
 */
function conversionPixelsPerMm(
  representative: RepresentativeAnswerImage,
  pageSize: string
): number | null {
  switch (representative.kind) {
    case "image":
      return overlayPixelsPerMm(
        pageSize,
        representative.width,
        representative.height
      )
    case "noAnswerImages":
      return FALLBACK_PIXELS_PER_MM
    case "unreadable":
      return null
  }
}

/** "px" の行1つを mm へ直す（描画の式のちょうど逆） */
export function convertOverlayRowToMm(
  row: PixelOverlayStyleRow,
  pixelsPerMm: number
): MmOverlayLengths {
  return convertPixelLengthsToMm(
    {
      overlayKind: toOverlayKind(row.overlayKind),
      position: toOverlayAnchor(row.position),
      size: row.size,
      offsetX: row.offsetX,
      offsetY: row.offsetY,
    },
    pixelsPerMm
  )
}

/** 1回の変換の結果（ログとテスト用） */
interface AnswerOverlayLengthConversionResult {
  /** mm へ変換した試験 */
  readonly convertedExamIds: string[]
  /** 読めない画像があって "px" のまま残した試験 */
  readonly pendingExamIds: string[]
}

/**
 * 旧アーカイブ（凍結した形式。長さはいつも画素）の取り込みで、"px" の行を mm へ直す係数を決める。
 * 展開した答案画像を読む。読めない画像があれば null（行は "px" のまま書き、起動時の変換が拾う）
 *
 * @param answerSheetPaths 展開した答案画像の絶対パス（`ExtractedArchiveData.answerSheetPaths`）
 * @param examPages アーカイブの試験のページ（用紙サイズを `resolveExamPaperSize` で決める）
 */
export async function legacyArchivePixelsPerMm(
  answerSheetPaths: readonly string[],
  examPages: Parameters<typeof resolveExamPaperSize>[0]
): Promise<number | null> {
  return conversionPixelsPerMm(
    await readRepresentativeAnswerImage(answerSheetPaths),
    resolveExamPaperSize(examPages)
  )
}

/** 変換する行の id と値（updatedAt は書かない） */
interface OverlayLengthUpdate extends MmOverlayLengths {
  readonly id: string
}

interface PixelOverlayStyleRecord extends PixelOverlayStyleRow {
  readonly id: string
  readonly examId: string
}

/** 行を試験ごとに分ける */
function groupByExamId(
  records: readonly PixelOverlayStyleRecord[]
): Map<string, PixelOverlayStyleRecord[]> {
  const recordsByExamId = new Map<string, PixelOverlayStyleRecord[]>()
  for (const record of records) {
    const examRecords = recordsByExamId.get(record.examId) ?? []
    examRecords.push(record)
    recordsByExamId.set(record.examId, examRecords)
  }
  return recordsByExamId
}

/**
 * 試験ごとに代表の画像を読み、変換する行を決める。DB の読み書きは呼び出し側が渡す
 */
async function convertExams(
  records: readonly PixelOverlayStyleRecord[],
  readExam: (examId: string) => Promise<{
    pageSize: string
    answerImagePaths: (string | null)[]
  }>,
  writeUpdates: (updates: OverlayLengthUpdate[]) => Promise<void>
): Promise<AnswerOverlayLengthConversionResult> {
  const convertedExamIds: string[] = []
  const pendingExamIds: string[] = []

  for (const [examId, examRecords] of groupByExamId(records)) {
    const { pageSize, answerImagePaths } = await readExam(examId)
    const representative = await readRepresentativeAnswerImage(answerImagePaths)
    const pixelsPerMm = conversionPixelsPerMm(representative, pageSize)
    if (pixelsPerMm === null) {
      pendingExamIds.push(examId)
      continue
    }
    await writeUpdates(
      examRecords.map((record) => ({
        id: record.id,
        ...convertOverlayRowToMm(record, pixelsPerMm),
      }))
    )
    convertedExamIds.push(examId)
  }

  return { convertedExamIds, pendingExamIds }
}

/**
 * アプリの DB の "px" の行を mm へ変換する（起動時）。
 *
 * @param resolveImagePath DB の imagePath（データディレクトリからの相対）を絶対パスへ
 */
export async function convertPendingAnswerOverlayLengths(
  prisma: PrismaClient,
  resolveImagePath: (imagePath: string) => string
): Promise<AnswerOverlayLengthConversionResult> {
  const records = await prisma.examAnswerOverlayStyle.findMany({
    where: { lengthUnit: "px" },
  })
  if (records.length === 0) {
    return { convertedExamIds: [], pendingExamIds: [] }
  }

  return convertExams(
    records,
    async (examId) => {
      const examPages = await prisma.examPage.findMany({
        where: { examId },
        include: { studentAnswerImages: true },
      })
      return {
        pageSize: resolveExamPaperSize(examPages),
        answerImagePaths: examPages.flatMap((examPage) =>
          examPage.studentAnswerImages.map((studentAnswerImage) =>
            resolveImagePath(studentAnswerImage.imagePath)
          )
        ),
      }
    },
    async (updates) => {
      await prisma.$transaction(
        updates.map(
          (update) =>
            prisma.$executeRaw`UPDATE "ExamAnswerOverlayStyle" SET "size" = ${update.size}, "offsetX" = ${update.offsetX}, "offsetY" = ${update.offsetY}, "lengthUnit" = 'mm' WHERE "id" = ${update.id} AND "lengthUnit" = 'px'`
        )
      )
    }
  )
}

/**
 * 開いた統合アーカイブの DB の "px" の行を mm へ変換する（migration を当てた後）。
 * 画像はアーカイブに同梱された files/ から読む
 */
export async function convertArchiveAnswerOverlayLengths(
  db: SqliteDatabase,
  filesDirectory: string
): Promise<AnswerOverlayLengthConversionResult> {
  const records = db
    .prepare<[], PixelOverlayStyleRecord>(
      `SELECT "id", "examId", "overlayKind", "position", "size", "offsetX", "offsetY"
       FROM "ExamAnswerOverlayStyle" WHERE "lengthUnit" = 'px'`
    )
    .all()
  if (records.length === 0) {
    return { convertedExamIds: [], pendingExamIds: [] }
  }

  const selectPages = db.prepare<
    [string],
    { pageNumber: number; imagePath: string | null; pageSize: string }
  >(
    `SELECT "pageNumber", "imagePath", "pageSize" FROM "ExamPage" WHERE "examId" = ?`
  )
  const selectAnswerImagePaths = db.prepare<[string], { imagePath: string }>(
    `SELECT "StudentAnswerImage"."imagePath" AS "imagePath"
     FROM "StudentAnswerImage"
     JOIN "ExamPage" ON "ExamPage"."id" = "StudentAnswerImage"."examPageId"
     WHERE "ExamPage"."examId" = ?`
  )
  const updateRow = db.prepare<[number, number, number, string]>(
    `UPDATE "ExamAnswerOverlayStyle" SET "size" = ?, "offsetX" = ?, "offsetY" = ?, "lengthUnit" = 'mm'
     WHERE "id" = ? AND "lengthUnit" = 'px'`
  )
  const writeUpdates = db.transaction((updates: OverlayLengthUpdate[]) => {
    for (const update of updates) {
      updateRow.run(update.size, update.offsetX, update.offsetY, update.id)
    }
  })

  return convertExams(
    records,
    async (examId) => ({
      pageSize: resolveExamPaperSize(selectPages.all(examId)),
      answerImagePaths: selectAnswerImagePaths
        .all(examId)
        .map((answerImage) => {
          const resolved = resolveArchiveFile(
            filesDirectory,
            answerImage.imagePath
          )
          return resolved.kind === "ok" ? resolved.absolutePath : null
        }),
    }),
    async (updates) => {
      writeUpdates(updates)
    }
  )
}
