/**
 * 統合アーカイブ（.sao）の行の値のうち、ファイルの場所を決める値（id とファイルのパス）を
 * 取り込む前に確かめる
 *
 * 開く側（`archiveOpener.ts`）が現行化の後に呼ぶ。外れた値が1つでもあればアーカイブごと断る
 * （一部だけ取り込むと、断った値を参照する行が宙に浮く）。
 *
 * - **id**: 試験と解答用紙の定義の id は、データフォルダの中のフォルダ名になる
 *   （`exams/<試験の id>`・`answer-sheet-builder/<定義の id>`）。この2表の id と、この2表を指す
 *   外部キーは、パスの1区切りとして安全な形（`pathContainment.ts` の `isSafePathSegment`）に限る。
 *   それ以外の表の id は、空でない・制御文字を含まない・長すぎない文字列に限る。
 *   uuid に限らない理由: 正当なデータに uuid でない id が残っている（初期の版の cuid、
 *   解答用紙の要素の `asb_<時刻>_<連番>`、migration が作った `<試験の id>:<区分>` や `cw-<id>`、
 *   旧 .grade の取り込みが作った名前入りの資料の id）。uuid に絞ると、これらを含む
 *   書き出しが読めなくなる
 * - **ファイルのパス**: 列ごとに、その列をアプリが書く場所の形だけを許す
 *   （{@link ARCHIVE_FILE_PATH_RULES}）。試験の下のファイルは、その行が属する試験のフォルダの
 *   中でなければならない
 */

import { ARCHIVE_FILE_COLUMNS } from "../../export/unified-archive/archiveFileCollector"
import { ARCHIVE_TABLES } from "../../export/unified-archive/archiveTableRegistry"
import { isSafePathSegment } from "../../pathContainment"
import { hasTable, type SqliteDatabase } from "../../prisma/sqliteSchemaUtils"

/** id がデータフォルダの中のフォルダ名になる表 */
export const PATH_SEGMENT_ID_TABLES: ReadonlySet<string> = new Set([
  "Exam",
  "AsbDefinition",
])

/** パスにならない id の長さの上限（旧 .grade の取り込みが作る名前入りの id も収まる長さ） */
const MAX_OPAQUE_ID_LENGTH = 1024

/** ファイル名1つの長さの上限（多くのファイルシステムの上限） */
const MAX_FILE_NAME_LENGTH = 255

/** 答案・模範解答の画像として受け付けてきた拡張子（画面は PDF を PNG にしてから保存する） */
const EXAM_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
])

/**
 * 解答用紙の定義の画像（画面の選択肢と、旧 .asb の取り込みが拾う拡張子）。
 *
 * 画像の追加は SVG も受け付けるので、ここでも許す（許さないと、SVG の画像を含む解答用紙を
 * 書き出した `.sao` が読めなくなる）。描くのは `<img>` と SVG の `<image>` だけで、
 * どちらも SVG の中のスクリプトを動かさない。web 版の Service Worker も、画像としての
 * 読み込みにしか SVG を返さない（`web/serviceWorker/appImageResponse.ts`）
 */
const ASB_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "svg",
])

/** AI 採点の問題の画像（取り込みで PNG か JPEG に符号化し直して保存する） */
const AI_QUESTION_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  "png",
  "jpg",
  "jpeg",
])

/** 制御文字（NUL を含む U+0000〜U+001F と U+007F）を含むか */
const containsControlCharacter = (text: string): boolean =>
  [...text].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1f || codePoint === 0x7f
  })

/** パスにならない id として受け付ける形か */
export function isOpaqueArchiveId(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_OPAQUE_ID_LENGTH &&
    !containsControlCharacter(value)
  )
}

/** 表の id・外部キーの値として受け付ける形か（参照先の表で決まる） */
export function isAcceptableArchiveId(table: string, value: unknown): boolean {
  if (PATH_SEGMENT_ID_TABLES.has(table)) {
    return typeof value === "string" && isSafePathSegment(value)
  }
  return isOpaqueArchiveId(value)
}

/**
 * ディレクトリ名・ファイル名の1区切りとして安全か。区切り文字・`:`（Windows の代替データ
 * ストリーム）・制御文字を含まず、`.` で始まらず、`.` や空白で終わらない（Windows が黙って
 * 落とすので、別の名前と同じ場所を指しうる）
 */
const isSafeNameSegment = (segment: string): boolean =>
  segment.length > 0 &&
  segment.length <= MAX_FILE_NAME_LENGTH &&
  !segment.startsWith(".") &&
  !segment.endsWith(".") &&
  !segment.endsWith(" ") &&
  !segment.includes("/") &&
  !segment.includes("\\") &&
  !segment.includes(":") &&
  !containsControlCharacter(segment)

/** 安全なファイル名で、拡張子（大文字小文字は問わない）が許したものか */
const isSafeFileName = (
  segment: string,
  extensions: ReadonlySet<string>
): boolean => {
  if (!isSafeNameSegment(segment)) return false
  const dotIndex = segment.lastIndexOf(".")
  if (dotIndex <= 0) return false
  return extensions.has(segment.slice(dotIndex + 1).toLowerCase())
}

/** `exams/<試験の id>/<ディレクトリ>/...` の頭の3区切りが、その試験のものか */
const isInExamDirectory = (
  segments: readonly string[],
  examId: string | null,
  directoryNames: readonly string[]
): boolean =>
  segments[0] === "exams" &&
  examId !== null &&
  isSafePathSegment(examId) &&
  segments[1] === examId &&
  directoryNames.includes(segments[2])

interface ArchiveFilePathRule {
  readonly column: string
  /**
   * 行ごとに id（`rowId`）・パス（`filePath`）・パスの持ち主の id（`ownerId`。試験の下の
   * ファイルなら試験の id、持ち主で縛らない列は NULL）を読む SQL
   */
  readonly rowsSql: string
  /** "/" で区切ったパスが、この列の書く場所の形か */
  readonly matches: (
    segments: readonly string[],
    ownerId: string | null
  ) => boolean
}

/**
 * ファイルのパスの列ごとの許す形。キーは `ARCHIVE_FILE_COLUMNS` の表で、列も一致させる
 * （`unifiedArchiveValueGuards.test.ts` が検査する。列を足したらここにも足すこと）。
 *
 * - ExamPage: `exams/<試験>/master-answers/<名前>`（画面・解答用紙からの変換）か
 *   `exams/<試験>/master-images/<名前>`（旧 .score の取り込み）
 * - StudentAnswerImage: `exams/<ページの試験>/answer-sheets/<名前>`。旧 .score の取り込みは
 *   アーカイブ内の answer-sheets/ より下をそのまま写すので、途中のフォルダも許す
 * - AsbImageElement: `answer-sheet-builder/<定義>/images/<名前>`。定義の複製で画像の写しが
 *   無かったときは複製元の定義のパスのまま残るので、持ち主の定義では縛らない
 * - AiPromptQuestionImage: `exams/<設問の試験>/ai-question-images/<名前>`
 *   （`aiPrompt.ts` の AI_QUESTION_IMAGES_DIRECTORY_NAME。ここは prisma に依存させないため
 *   文字で持つ）
 */
export const ARCHIVE_FILE_PATH_RULES: Readonly<
  Record<(typeof ARCHIVE_FILE_COLUMNS)[number]["table"], ArchiveFilePathRule>
> = {
  ExamPage: {
    column: "imagePath",
    rowsSql: `SELECT "id" AS rowId, "imagePath" AS filePath, "examId" AS ownerId FROM "ExamPage"`,
    matches: (segments, ownerId) =>
      segments.length === 4 &&
      isInExamDirectory(segments, ownerId, [
        "master-answers",
        "master-images",
      ]) &&
      isSafeFileName(segments[3], EXAM_IMAGE_EXTENSIONS),
  },
  StudentAnswerImage: {
    column: "imagePath",
    rowsSql: `SELECT answerImage."id" AS rowId, answerImage."imagePath" AS filePath, examPage."examId" AS ownerId
      FROM "StudentAnswerImage" AS answerImage
      LEFT JOIN "ExamPage" AS examPage ON examPage."id" = answerImage."examPageId"`,
    matches: (segments, ownerId) =>
      segments.length >= 4 &&
      isInExamDirectory(segments, ownerId, ["answer-sheets"]) &&
      segments.slice(3, -1).every(isSafeNameSegment) &&
      isSafeFileName(segments[segments.length - 1], EXAM_IMAGE_EXTENSIONS),
  },
  AsbImageElement: {
    column: "imagePath",
    rowsSql: `SELECT "id" AS rowId, "imagePath" AS filePath, NULL AS ownerId FROM "AsbImageElement"`,
    matches: (segments) => isAsbImagePathSegments(segments),
  },
  AiPromptQuestionImage: {
    column: "imagePath",
    rowsSql: `SELECT questionImage."id" AS rowId, questionImage."imagePath" AS filePath, examPage."examId" AS ownerId
      FROM "AiPromptQuestionImage" AS questionImage
      LEFT JOIN "AiPrompt" AS prompt ON prompt."id" = questionImage."promptId"
      LEFT JOIN "CropRegion" AS cropRegion ON cropRegion."id" = prompt."cropRegionId"
      LEFT JOIN "ExamPage" AS examPage ON examPage."id" = cropRegion."examPageId"`,
    matches: (segments, ownerId) =>
      segments.length === 4 &&
      isInExamDirectory(segments, ownerId, ["ai-question-images"]) &&
      isSafeFileName(segments[3], AI_QUESTION_IMAGE_EXTENSIONS),
  },
}

/** 解答用紙の定義の画像のパスの形（`answer-sheet-builder/<定義>/images/<名前>`） */
function isAsbImagePathSegments(segments: readonly string[]): boolean {
  return (
    segments.length === 4 &&
    segments[0] === "answer-sheet-builder" &&
    isSafePathSegment(segments[1]) &&
    segments[2] === "images" &&
    isSafeFileName(segments[3], ASB_IMAGE_EXTENSIONS)
  )
}

/** 解答用紙の定義の画像のパスとして受け付ける形か（旧 .asb の取り込みも使う） */
export function isAsbImagePath(filePath: string): boolean {
  return isAsbImagePathSegments(filePath.split("/"))
}

/** 答案・模範解答の画像のファイル名として受け付ける形か（旧 .score の取り込みも使う） */
export function isSafeExamImageFileName(fileName: string): boolean {
  return isSafeFileName(fileName, EXAM_IMAGE_EXTENSIONS)
}

/** 答案画像の置き場の途中のフォルダ名として受け付ける形か（旧 .score の取り込みも使う） */
export function isSafeImageDirectoryName(directoryName: string): boolean {
  return isSafeNameSegment(directoryName)
}

/**
 * どの列のものであれ、ファイルのパスとして受け付ける形か。同梱ファイルを写す直前に、
 * 写す先をもう一度確かめる（多層の守り。持ち主の試験は問わない）
 */
export function isAcceptableArchiveFilePathShape(filePath: string): boolean {
  const segments = filePath.split("/")
  if (segments[0] !== "exams") return isAsbImagePathSegments(segments)
  const examId = segments[1] ?? null
  return [
    ARCHIVE_FILE_PATH_RULES.ExamPage,
    ARCHIVE_FILE_PATH_RULES.StudentAnswerImage,
    ARCHIVE_FILE_PATH_RULES.AiPromptQuestionImage,
  ].some((rule) => rule.matches(segments, examId))
}

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

/** 表の列名の集合 */
const columnsOf = (db: SqliteDatabase, table: string): Set<string> =>
  new Set(
    db
      .prepare<[string], { name: string }>(
        "SELECT name FROM pragma_table_info(?)"
      )
      .all(table)
      .map((column) => column.name)
  )

/** 登録表の全ての表の id と外部キーの列を確かめ、外れた値の件数を `表.列` ごとに返す */
function findUnacceptableIds(db: SqliteDatabase): Map<string, number> {
  const problemCounts = new Map<string, number>()
  for (const [table, spec] of Object.entries(ARCHIVE_TABLES)) {
    if (!hasTable(db, table)) continue
    const columns = columnsOf(db, table)
    const checks = [
      { column: "id", referencedTable: table, nullable: false },
      ...spec.references.map((reference) => ({
        column: reference.column,
        referencedTable: reference.table,
        nullable: true,
      })),
    ]
    for (const check of checks) {
      if (!columns.has(check.column)) continue
      const values = db
        .prepare<[], { value: unknown }>(
          `SELECT ${quote(check.column)} AS value FROM ${quote(table)}`
        )
        .all()
      const count = values.filter(
        ({ value }) =>
          !(check.nullable && value === null) &&
          !isAcceptableArchiveId(check.referencedTable, value)
      ).length
      if (count > 0) problemCounts.set(`${table}.${check.column}`, count)
    }
  }
  return problemCounts
}

/** ファイルのパスの列を確かめ、外れた値の件数を `表.列` ごとに返す */
function findUnacceptableFilePaths(db: SqliteDatabase): Map<string, number> {
  const problemCounts = new Map<string, number>()
  for (const fileColumn of ARCHIVE_FILE_COLUMNS) {
    if (!hasTable(db, fileColumn.table)) continue
    const rule = ARCHIVE_FILE_PATH_RULES[fileColumn.table]
    const records = db
      .prepare<[], { rowId: unknown; filePath: unknown; ownerId: unknown }>(
        rule.rowsSql
      )
      .all()
    const count = records.filter(({ filePath, ownerId }) => {
      // 空と NULL は「画像なし」（書き出しも集めない）
      if (filePath === null || filePath === "") return false
      if (typeof filePath !== "string") return true
      const owner = typeof ownerId === "string" ? ownerId : null
      return !rule.matches(filePath.split("/"), owner)
    }).length
    if (count > 0) {
      problemCounts.set(`${fileColumn.table}.${fileColumn.column}`, count)
    }
  }
  return problemCounts
}

/**
 * archive.db の id とファイルのパスの値を確かめ、外れたものを人に見せる文で返す
 * （外れが無ければ空）。値そのものは載せない（外から来た文字列をそのまま画面に出さない）
 */
export function describeUnacceptableArchiveValues(
  db: SqliteDatabase
): string[] {
  return [
    ...[...findUnacceptableIds(db)].map(
      ([columnName, count]) => `${columnName}: id として扱えない値 ${count}件`
    ),
    ...[...findUnacceptableFilePaths(db)].map(
      ([columnName, count]) =>
        `${columnName}: ファイルの場所として扱えない値 ${count}件`
    ),
  ]
}
