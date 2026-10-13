/**
 * リアテンダント .dat → .score 変換（issue #1487）
 *
 * テスト対象:
 * - electron-src/lib/import/external-formats/reattendant/datConverter.ts
 *
 * 合成の .dat（zip）をテストの中で組み立て、変換後の .score の中身を見る。DB には触れない。
 * .dat は fflate で書く。adm-zip は書き出すときに項目を名前順に並べ替えるので、
 * 「question_angles.json が angles.json より先に並ぶ zip」を作れない。
 */

import AdmZip from "adm-zip"
import { zipSync } from "fflate"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { convertDatToScore } from "../../../electron-src/lib/import/external-formats/reattendant/datConverter"

/** 変換後の exam.json のうち、ここで見る部分 */
interface ConvertedExamJson {
  examPages: Array<{ id: string; pageNumber: number; imagePath: string }>
  cropRegions: Array<{
    id: string
    examPageId: string
    label: string
    type: string
    x: number
    y: number
    width: number
    height: number
  }>
}

/** 変換後の subtotals.json */
interface ConvertedSubtotalsJson {
  subtotalGroups: Array<{ id: string; name: string }>
  subtotals: Array<{ id: string; name: string; subtotalGroupId: string }>
  cropSubtotals: Array<{
    cropRegionId: string
    subtotalId: string
    assignmentType: string
  }>
}

/** IHDR に幅・高さだけを入れた、PNG ヘッダー相当のバイト列（中身の見分け用の印つき） */
function fakePng(width: number, height: number, marker: string): Buffer {
  const pngBuffer = Buffer.alloc(40)
  pngBuffer.writeUInt32BE(width, 16)
  pngBuffer.writeUInt32BE(height, 20)
  pngBuffer.write(marker, 24)
  return pngBuffer
}

/** FREE 設問1つ分の QuationBlock */
function freeQuestionBlock(seq: number, quizName: string, x: number) {
  return {
    No: seq,
    QuizType: "FREE",
    QuizName: quizName,
    Score: 2,
    Seq: seq,
    PointArea: [{ X: x, Y: x, Width: 40, Height: 20, Type: "POINT" }],
    Completion: null,
  }
}

const ROOT = "1"
const WORK_DIR = `${ROOT}/U@1/1`

/**
 * 合成の .dat を組み立てる
 *
 * - 3ページ。模範解答画像は abc_m01.png と abc_m03.png だけ（2ページ目の画像は無い）
 * - 設問 1-1・1-2 は1ページ目、2-1 は3ページ目
 * - 観点は 知識(id 10, sort 1)・思考(id 20, sort 2)。設問 1-1 は両方の観点に属する
 * - angleScoreAreasXml は abc_xml の AreaInfo に足す AngleScoreArea の要素
 */
function buildDat(options: {
  questionAnglesFirst: boolean
  angleScoreAreasXml?: string
}): Uint8Array {
  // 追加した順に zip の項目が並ぶ
  const datEntries: Record<string, Uint8Array> = {}
  const addFile = (entryName: string, content: Buffer) => {
    datEntries[entryName] = content
  }
  const addJson = (entryName: string, content: unknown) => {
    addFile(entryName, Buffer.from(JSON.stringify(content)))
  }

  addFile(`${ROOT}/RealtendantAppVersion.txt`, Buffer.from("1"))
  addJson(`${ROOT}/contents.json`, [
    {
      id: 1,
      contents_uid: "U",
      contents_name: "合成",
      version: "1",
      image_scale: 0.5,
    },
  ])
  addJson(`${ROOT}/workbooks.json`, [
    { id: 1, workbook_uid: "W", workbook_name: "テスト", subject_id: 12 },
  ])
  addJson(`${ROOT}/questions.json`, [
    { id: 1, question_name: "1-1" },
    { id: 2, question_name: "1-2" },
    { id: 3, question_name: "2-1" },
  ])

  const questionAngles = [
    { question_id: 1, angle_id: 10 },
    { question_id: 1, angle_id: 20 },
    { question_id: 2, angle_id: 10 },
    { question_id: 3, angle_id: 20 },
  ]
  const angles = [
    {
      id: 20,
      angle_name: "思考",
      angle_short_name: "思",
      subject_id: 12,
      angle_sort_no: 2,
      delete_flg: false,
    },
    {
      id: 10,
      angle_name: "知識",
      angle_short_name: "知",
      subject_id: 12,
      angle_sort_no: 1,
      delete_flg: false,
    },
    // 他教科（subject_id が試験と違う）の観点。観点の小計には並ばない
    {
      id: 30,
      angle_name: "他教科の観点",
      angle_short_name: "他",
      subject_id: 18,
      angle_sort_no: 1,
      delete_flg: false,
    },
  ]
  // zip 内の並び順で、question_angles.json が angles.json より先に来る場合を作る
  if (options.questionAnglesFirst) {
    addJson(`${ROOT}/question_angles.json`, questionAngles)
    addJson(`${ROOT}/angles.json`, angles)
  } else {
    addJson(`${ROOT}/angles.json`, angles)
    addJson(`${ROOT}/question_angles.json`, questionAngles)
  }

  addJson(`${ROOT}/workbook_infoes.json`, [
    {
      abc_xml:
        '<PointInfoBlock><AreaInfo><LargeQuestionScoreArea Page="3" X="80" Y="110" Width="80" Height="110" LargeQuestionNumber="2" />' +
        (options.angleScoreAreasXml ?? "") +
        "</AreaInfo></PointInfoBlock>",
    },
  ])

  const abcData = {
    PageMax: 3,
    QuizUID: "Q",
    TestName: "テスト",
    PageBlock: [
      {
        PageNo: 1,
        QuizImage: "p1.png",
        AreaBlock: [],
        QuationBlock: [
          freeQuestionBlock(1, "1-1", 50),
          freeQuestionBlock(2, "1-2", 100),
        ],
      },
      { PageNo: 2, QuizImage: "p2.png", AreaBlock: [], QuationBlock: [] },
      {
        PageNo: 3,
        QuizImage: "p3.png",
        AreaBlock: [],
        QuationBlock: [freeQuestionBlock(3, "2-1", 40)],
      },
    ],
  }
  addFile(
    `${WORK_DIR}(html)/W/json/W.js`,
    Buffer.from(`var abcData=${JSON.stringify(abcData)}`)
  )

  addFile(`${WORK_DIR}/Correct/abc_m01.png`, fakePng(1000, 1400, "page1"))
  addFile(`${WORK_DIR}/Correct/abc_m03.png`, fakePng(800, 1100, "page3"))
  return zipSync(datEntries)
}

describe("convertDatToScore", () => {
  let tempDir: string
  const convertedPaths: string[] = []

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dat-converter-test-"))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    for (const convertedPath of convertedPaths.splice(0)) {
      fs.rmSync(path.dirname(convertedPath), { recursive: true, force: true })
    }
  })

  async function convert(options: {
    questionAnglesFirst: boolean
    angleScoreAreasXml?: string
  }) {
    const datPath = path.join(tempDir, "synthetic.dat")
    fs.writeFileSync(datPath, buildDat(options))
    const { scorePath } = await convertDatToScore(datPath)
    convertedPaths.push(scorePath)

    const scoreZip = new AdmZip(scorePath)
    const readJson = (entryName: string): string => {
      const entry = scoreZip.getEntry(entryName)
      if (!entry) throw new Error(`${entryName} が無い`)
      return entry.getData().toString("utf8")
    }
    const examJson: ConvertedExamJson = JSON.parse(readJson("exam.json"))
    const subtotalsJson: ConvertedSubtotalsJson = JSON.parse(
      readJson("subtotals.json")
    )
    return { scoreZip, examJson, subtotalsJson }
  }

  function angleSubtotals(subtotalsJson: ConvertedSubtotalsJson) {
    const angleGroup = subtotalsJson.subtotalGroups.find(
      (subtotalGroup) => subtotalGroup.name === "観点"
    )
    if (!angleGroup) throw new Error("観点の小計グループが無い")
    return subtotalsJson.subtotals.filter(
      (subtotal) => subtotal.subtotalGroupId === angleGroup.id
    )
  }

  it("question_angles.json が先に並んでいても angles.json を観点の表として読む", async () => {
    const { subtotalsJson } = await convert({ questionAnglesFirst: true })

    expect(
      angleSubtotals(subtotalsJson).map((subtotal) => subtotal.name)
    ).toEqual(["知識", "思考"])
  })

  it("他教科の観点は観点の小計に並べない", async () => {
    const { subtotalsJson } = await convert({ questionAnglesFirst: false })

    expect(
      angleSubtotals(subtotalsJson).map((subtotal) => subtotal.name)
    ).not.toContain("他教科の観点")
  })

  it("1つの設問に観点が複数あれば、すべての観点の小計に割り当てる", async () => {
    const { examJson, subtotalsJson } = await convert({
      questionAnglesFirst: false,
    })

    const question11 = examJson.cropRegions.find(
      (cropRegion) => cropRegion.label === "1-1"
    )
    if (!question11) throw new Error("設問 1-1 が無い")

    const angleSubtotalNameById = new Map(
      angleSubtotals(subtotalsJson).map((subtotal) => [
        subtotal.id,
        subtotal.name,
      ])
    )
    const assignedAngleNames = subtotalsJson.cropSubtotals
      .filter(
        (cropSubtotal) =>
          cropSubtotal.cropRegionId === question11.id &&
          cropSubtotal.assignmentType === "QUESTION_ASSIGNMENT"
      )
      .flatMap((cropSubtotal) => {
        const angleName = angleSubtotalNameById.get(cropSubtotal.subtotalId)
        return angleName ? [angleName] : []
      })
      .sort()

    expect(assignedAngleNames).toEqual(["思考", "知識"].sort())
  })

  /** 観点の得点欄（SUBTOTAL_DEFINITION）を、欄のラベル → 結ばれた観点の小計の名前 で */
  function angleScoreAreaBindings(
    examJson: ConvertedExamJson,
    subtotalsJson: ConvertedSubtotalsJson
  ) {
    const angleSubtotalNameById = new Map(
      angleSubtotals(subtotalsJson).map((subtotal) => [
        subtotal.id,
        subtotal.name,
      ])
    )
    return examJson.cropRegions
      .filter(
        (cropRegion) =>
          cropRegion.type === "SUBTOTAL_SCORE" &&
          !cropRegion.label.startsWith("小計")
      )
      .map((cropRegion) => ({
        label: cropRegion.label,
        angleNames: subtotalsJson.cropSubtotals
          .filter(
            (cropSubtotal) =>
              cropSubtotal.cropRegionId === cropRegion.id &&
              cropSubtotal.assignmentType === "SUBTOTAL_DEFINITION"
          )
          .flatMap((cropSubtotal) => {
            const angleName = angleSubtotalNameById.get(cropSubtotal.subtotalId)
            return angleName ? [angleName] : []
          }),
      }))
  }

  it("観点の得点欄は AngleId の観点の小計に結び、ラベルを観点名にする", async () => {
    const { examJson, subtotalsJson } = await convert({
      questionAnglesFirst: false,
      angleScoreAreasXml:
        '<AngleScoreArea Page="1" X="100" Y="20" Width="150" Height="62" Visible="true" AngleId="20" />' +
        '<AngleScoreArea Page="1" X="300" Y="20" Width="150" Height="62" Visible="true" AngleId="10" />',
    })

    expect(angleScoreAreaBindings(examJson, subtotalsJson)).toEqual([
      { label: "思考", angleNames: ["思考"] },
      { label: "知識", angleNames: ["知識"] },
    ])
  })

  it("AngleId の無い観点の得点欄は、観点が複数あればどの観点の小計にも結ばない", async () => {
    const { examJson, subtotalsJson } = await convert({
      questionAnglesFirst: false,
      angleScoreAreasXml:
        '<AngleScoreArea Page="1" X="100" Y="20" Width="150" Height="62" Visible="true" />',
    })

    expect(angleScoreAreaBindings(examJson, subtotalsJson)).toEqual([
      { label: "観点", angleNames: [] },
    ])
  })

  it("模範解答画像はファイル名の番号のページに割り当てる（番号が飛んでもずれない）", async () => {
    const { scoreZip, examJson } = await convert({ questionAnglesFirst: false })

    const pageByNumber = new Map(
      examJson.examPages.map((examPage) => [examPage.pageNumber, examPage])
    )
    expect(pageByNumber.get(1)?.imagePath).toBe("abc_m01.png")
    expect(pageByNumber.get(2)?.imagePath).toBe("")
    expect(pageByNumber.get(3)?.imagePath).toBe("abc_m03.png")

    // 3ページ目の画像は abc_m03.png の中身
    const page3Image = scoreZip.getEntry("master-images/abc_m03.png")
    expect(page3Image?.getData().toString("utf8", 24, 29)).toBe("page3")

    // 3ページ目の設問・小計欄は3ページ目の画像サイズ（800×1100）で正規化される
    const page3Id = pageByNumber.get(3)?.id
    const question21 = examJson.cropRegions.find(
      (cropRegion) => cropRegion.label === "2-1"
    )
    expect(question21?.examPageId).toBe(page3Id)
    expect(question21?.x).toBeCloseTo(40 / (800 * 0.5))
    expect(question21?.y).toBeCloseTo(40 / (1100 * 0.5))

    const largeQuestionArea = examJson.cropRegions.find(
      (cropRegion) => cropRegion.label === "小計2"
    )
    expect(largeQuestionArea?.examPageId).toBe(page3Id)
    expect(largeQuestionArea?.x).toBeCloseTo(0.1)
    expect(largeQuestionArea?.height).toBeCloseTo(0.1)
  })
})
