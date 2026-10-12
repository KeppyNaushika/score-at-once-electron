/**
 * 取り込むアーカイブの、場所を決める値（id とファイルのパス）の形の規則
 *
 * - 統合アーカイブ（.sao）のファイルのパスの列ごとの規則が、`ARCHIVE_FILE_COLUMNS` と
 *   一対一であること（列を足して規則を足し忘れると、ここで落ちる）
 * - 列ごとの許す形と断る形
 * - 同梱ファイルを写す直前の守り（データフォルダ直下の名前へは写さない）
 * - 旧 .score の試験の id と画像のパスの検査
 *
 * データは全て合成したもの。
 */

import * as crypto from "crypto"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ARCHIVE_FILE_COLUMNS } from "../../../electron-src/lib/export/unified-archive/archiveFileCollector"
import { ARCHIVE_TABLES } from "../../../electron-src/lib/export/unified-archive/archiveTableRegistry"
import { describeUnsafeExamArchiveValues } from "../../../electron-src/lib/import/exam-archive/archiveValueValidator"
import { importUnifiedArchiveFiles } from "../../../electron-src/lib/import/unified-archive/archiveFileImporter"
import {
  ARCHIVE_FILE_PATH_RULES,
  isAcceptableArchiveFilePathShape,
  isAcceptableArchiveId,
  isAsbImagePath,
  PATH_SEGMENT_ID_TABLES,
} from "../../../electron-src/lib/import/unified-archive/archiveValueGuards"
import type { OpenedUnifiedArchive } from "../../../electron-src/lib/import/unified-archive/types"
import {
  UNIFIED_ARCHIVE_FORMAT,
  UNIFIED_ARCHIVE_FORMAT_VERSION,
} from "../../../src/types/unifiedArchive.types"

const EXAM_ID = crypto.randomUUID()
const OTHER_EXAM_ID = crypto.randomUUID()
const DEFINITION_ID = crypto.randomUUID()

/** 列の規則に、持ち主の試験を添えて当てる */
const matchesColumn = (
  table: keyof typeof ARCHIVE_FILE_PATH_RULES,
  filePath: string,
  ownerId: string | null = EXAM_ID
): boolean =>
  ARCHIVE_FILE_PATH_RULES[table].matches(filePath.split("/"), ownerId)

/** どの列でも断るべき形（区切りの外し・絶対パス・直下の名前・区切り文字の混在） */
const ESCAPING_PATHS = [
  `exams/${EXAM_ID}/master-answers/../../../database.db`,
  `exams/${EXAM_ID}/answer-sheets/../../x.png`,
  `exams/${EXAM_ID}/ai-question-images/../x.png`,
  `answer-sheet-builder/${DEFINITION_ID}/images/../../../x.png`,
  "/tmp/x.png",
  "C:/x.png",
  "database.db",
  "sync-config.json",
  `exams/${EXAM_ID}\\master-answers\\x.png`,
  `exams//master-answers/x.png`,
  `exams/${EXAM_ID}/master-answers/`,
  `exams/${EXAM_ID}/master-answers/x.png\0.png`,
  "",
]

describe("ファイルのパスの列ごとの規則と ARCHIVE_FILE_COLUMNS の対応", () => {
  it("規則のある表と、ファイルのパスの列を持つ表が一致する", () => {
    expect(Object.keys(ARCHIVE_FILE_PATH_RULES).sort()).toEqual(
      ARCHIVE_FILE_COLUMNS.map((fileColumn) => fileColumn.table).sort()
    )
  })

  it("規則の列名が ARCHIVE_FILE_COLUMNS の列名と同じ", () => {
    for (const fileColumn of ARCHIVE_FILE_COLUMNS) {
      expect(ARCHIVE_FILE_PATH_RULES[fileColumn.table].column).toBe(
        fileColumn.column
      )
    }
  })

  it("id がパスになる表は登録表にある", () => {
    for (const table of PATH_SEGMENT_ID_TABLES) {
      expect(ARCHIVE_TABLES[table], table).toBeDefined()
    }
  })
})

describe("列ごとの許す形", () => {
  it("模範解答: その行の試験の master-answers・master-images の下の画像", () => {
    for (const filePath of [
      `exams/${EXAM_ID}/master-answers/1700000000000-0-模範解答 1.png`,
      `exams/${EXAM_ID}/master-answers/master-1700000000000.PNG`,
      `exams/${EXAM_ID}/master-images/page1.jpg`,
    ]) {
      expect(matchesColumn("ExamPage", filePath), filePath).toBe(true)
    }
  })

  it("答案: その行のページの試験の answer-sheets の下（旧形式の途中のフォルダも可）", () => {
    for (const filePath of [
      `exams/${EXAM_ID}/answer-sheets/1700000000000_scan_01.jpeg`,
      `exams/${EXAM_ID}/answer-sheets/student-1/1.png`,
    ]) {
      expect(matchesColumn("StudentAnswerImage", filePath), filePath).toBe(true)
    }
  })

  it("解答用紙の画像: answer-sheet-builder/<定義>/images の下（旧来の定義の id の形も可）", () => {
    for (const filePath of [
      `answer-sheet-builder/${DEFINITION_ID}/images/figure_1700000000000.png`,
      "answer-sheet-builder/asb_1700000000000_1/images/logo.gif",
      // 画像の追加が SVG を受け付けるので、解答用紙の画像に限って SVG も通す
      `answer-sheet-builder/${DEFINITION_ID}/images/diagram.svg`,
    ]) {
      expect(matchesColumn("AsbImageElement", filePath, null), filePath).toBe(
        true
      )
      expect(isAsbImagePath(filePath), filePath).toBe(true)
    }
  })

  it("AI 採点の問題の画像: その行の試験の ai-question-images の下の PNG・JPEG", () => {
    expect(
      matchesColumn(
        "AiPromptQuestionImage",
        `exams/${EXAM_ID}/ai-question-images/${crypto.randomUUID()}.jpg`
      )
    ).toBe(true)
  })
})

describe("列ごとの断る形", () => {
  it("外へ出る・絶対パス・直下の名前・区切り文字の混在は、どの列でも断る", () => {
    for (const fileColumn of ARCHIVE_FILE_COLUMNS) {
      for (const filePath of ESCAPING_PATHS) {
        expect(
          matchesColumn(fileColumn.table, filePath),
          `${fileColumn.table}: ${JSON.stringify(filePath)}`
        ).toBe(false)
      }
    }
    for (const filePath of ESCAPING_PATHS) {
      expect(isAcceptableArchiveFilePathShape(filePath), filePath).toBe(false)
    }
  })

  it("別の試験のフォルダは断る", () => {
    expect(
      matchesColumn(
        "ExamPage",
        `exams/${OTHER_EXAM_ID}/master-answers/page1.png`
      )
    ).toBe(false)
    expect(
      matchesColumn(
        "StudentAnswerImage",
        `exams/${OTHER_EXAM_ID}/answer-sheets/page1.png`
      )
    ).toBe(false)
    // 持ち主の試験が分からない行も断る
    expect(
      matchesColumn("ExamPage", `exams/${EXAM_ID}/master-answers/a.png`, null)
    ).toBe(false)
  })

  it("許していない拡張子（SVG・HTML・拡張子なし）は断る", () => {
    for (const fileName of ["a.svg", "a.html", "a.db", "noextension", ".png"]) {
      expect(
        matchesColumn(
          "ExamPage",
          `exams/${EXAM_ID}/master-answers/${fileName}`
        ),
        fileName
      ).toBe(false)
      // 解答用紙の画像は画像の追加が SVG を受け付けるので、SVG だけは通す
      if (fileName === "a.svg") continue
      expect(
        isAsbImagePath(
          `answer-sheet-builder/${DEFINITION_ID}/images/${fileName}`
        ),
        fileName
      ).toBe(false)
    }
  })

  it("列の置き場でないディレクトリは断る", () => {
    expect(
      matchesColumn("ExamPage", `exams/${EXAM_ID}/answer-sheets/a.png`)
    ).toBe(false)
    expect(
      matchesColumn(
        "AiPromptQuestionImage",
        `exams/${EXAM_ID}/master-answers/a.png`
      )
    ).toBe(false)
    expect(isAsbImagePath(`answer-sheet-builder/${DEFINITION_ID}/a.png`)).toBe(
      false
    )
  })
})

describe("id の形", () => {
  it("試験・解答用紙の定義の id はパスの1区切りとして安全な形だけ", () => {
    for (const table of PATH_SEGMENT_ID_TABLES) {
      expect(isAcceptableArchiveId(table, crypto.randomUUID())).toBe(true)
      for (const value of ["..", ".", "a/b", "a\\b", "", "a:b", null, 1]) {
        expect(isAcceptableArchiveId(table, value), String(value)).toBe(false)
      }
    }
    expect(isAcceptableArchiveId("AsbDefinition", "asb_1700000000000_1")).toBe(
      true
    )
  })

  it("それ以外の表は、空でなく制御文字を含まない文字列（正当な旧来の形を含む）", () => {
    for (const value of [
      crypto.randomUUID(),
      `${EXAM_ID}:mark`,
      `cw-${crypto.randomUUID()}`,
      "asb_1700000000000_12",
      "legacy-manual-cw:前期::観点1::小テスト",
    ]) {
      expect(isAcceptableArchiveId("CourseworkItem", value), value).toBe(true)
    }
    for (const value of ["", "a\0b", "a\nb", "x".repeat(2000), null, 42]) {
      expect(
        isAcceptableArchiveId("CourseworkItem", value),
        String(value)
      ).toBe(false)
    }
  })
})

describe("同梱ファイルを写す直前の守り", () => {
  let workDirectory = ""
  let dataDirectory = ""
  let filesDirectory = ""

  beforeEach(() => {
    workDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "archive-value-guards-")
    )
    dataDirectory = path.join(workDirectory, "data")
    filesDirectory = path.join(workDirectory, "opened", "files")
    fs.mkdirSync(dataDirectory, { recursive: true })
    fs.mkdirSync(filesDirectory, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(workDirectory, { recursive: true, force: true })
  })

  /** 開いた後のアーカイブ（manifest は写す処理が読まないので最小のもの） */
  const openedArchive = (): OpenedUnifiedArchive => ({
    manifest: {
      format: UNIFIED_ARCHIVE_FORMAT,
      formatVersion: UNIFIED_ARCHIVE_FORMAT_VERSION,
      appVersion: "0.0.0-test",
      lastMigration: null,
      exportedAt: "2026-10-12T00:00:00.000Z",
      exportedByUserId: null,
      selection: {
        roots: {},
        shared: {},
        scoring: { kind: "all" },
        includeAnswers: true,
        optionalItems: [],
      },
      exclusions: { requested: {}, excludedRowCounts: {} },
      rowCounts: {},
      files: { count: 0, missing: [] },
    },
    databasePath: path.join(workDirectory, "opened", "archive.db"),
    filesDirectory,
    appliedMigrations: [],
    migratedRowIds: {},
  })

  const placeArchiveFile = (relativePath: string) => {
    const absolutePath = path.join(filesDirectory, ...relativePath.split("/"))
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, `archive:${relativePath}`)
  }

  it("データフォルダ直下の名前へは、行が参照していても写さない（既存のファイルも残す）", async () => {
    const rootNames = ["database.db", "sync-config.json"]
    for (const rootName of rootNames) {
      placeArchiveFile(rootName)
      fs.writeFileSync(path.join(dataDirectory, rootName), "original")
    }
    const result = await importUnifiedArchiveFiles(
      openedArchive(),
      dataDirectory,
      {
        action: "overwrite",
        idMap: {},
        filePaths: { written: rootNames, kept: [] },
      }
    )
    expect(result.copied).toEqual([])
    expect(result.replaced).toEqual([])
    expect(result.failed.map((failure) => failure.path).sort()).toEqual(
      [...rootNames].sort()
    )
    for (const rootName of rootNames) {
      expect(fs.readFileSync(path.join(dataDirectory, rootName), "utf-8")).toBe(
        "original"
      )
    }
  })

  it("列の形のパスは今までどおり写す", async () => {
    const imagePath = `exams/${EXAM_ID}/master-answers/page1.png`
    placeArchiveFile(imagePath)
    const result = await importUnifiedArchiveFiles(
      openedArchive(),
      dataDirectory,
      {
        action: "merge",
        idMap: {},
        filePaths: { written: [imagePath], kept: [] },
      }
    )
    expect(result.copied).toEqual([imagePath])
    expect(result.failed).toEqual([])
  })
})

describe("旧 .score の試験の id と画像のパス", () => {
  const validExamData = () => ({
    exam: { id: EXAM_ID },
    examPages: [
      { imagePath: `exams/${EXAM_ID}/master-images/page1.png` },
      { imagePath: null },
      { imagePath: "" },
    ],
    pageImages: [],
    studentAnswerImages: [
      { imagePath: `exams/${EXAM_ID}/answer-sheets/S001_page1.png` },
      { imagePath: "answer-sheets/student-1/1.jpg" },
    ],
  })

  it("アプリの書く形なら問題なし（旧来の cuid の id も通す）", () => {
    expect(describeUnsafeExamArchiveValues(validExamData())).toEqual([])
    expect(
      describeUnsafeExamArchiveValues({
        ...validExamData(),
        exam: { id: "ckabcdefghijklmnopqrstuvw" },
      })
    ).toEqual([])
  })

  it("パスにならない試験の id は断る", () => {
    for (const examId of ["..", "a/b", "a\\b", ""]) {
      expect(
        describeUnsafeExamArchiveValues({
          ...validExamData(),
          exam: { id: examId },
        }),
        examId
      ).toHaveLength(1)
    }
  })

  it("模範解答のファイル名が外を指す・拡張子が違うものは断る", () => {
    for (const imagePath of ["master-images/..", "a\\..", "page.svg", "x/"]) {
      expect(
        describeUnsafeExamArchiveValues({
          ...validExamData(),
          examPages: [{ imagePath }],
        }),
        imagePath
      ).toHaveLength(1)
    }
  })

  it("答案の answer-sheets より下が外を指すもの・answer-sheets の無いものは断る", () => {
    for (const imagePath of [
      "answer-sheets/../../database.db",
      "answer-sheets\\..\\..\\x.png",
      "answer-sheets/",
      "elsewhere/x.png",
    ]) {
      expect(
        describeUnsafeExamArchiveValues({
          ...validExamData(),
          studentAnswerImages: [{ imagePath }],
        }),
        imagePath
      ).toHaveLength(1)
    }
    // v1.1.0 以前の答案（pageImages）も同じ
    expect(
      describeUnsafeExamArchiveValues({
        ...validExamData(),
        studentAnswerImages: [],
        pageImages: [
          {
            imagePath: "answer-sheets/../../x.png",
            imageType: "STUDENT_ANSWER",
          },
        ],
      })
    ).toHaveLength(1)
  })
})
