/**
 * リアテンダント .dat → .score 変換ロジック
 *
 * .datファイルを内部的に.score形式（テンプレートモード）に変換し、
 * 既存のインポートパイプラインに乗せる。
 *
 * データマッピング:
 *   AreaBlock[AREA_NO]               → type: STUDENT_ID, label: "出席番号"
 *   AreaBlock[AREA_NAME]             → type: STUDENT_NAME, label: "氏名"
 *   QuationBlock[FREE].PointArea     → type: QUESTION_ANSWER
 *   QuationBlock[PARTIAL_MATCH]
 *     .Completion[i].PointArea       → type: QUESTION_ANSWER, label: "QuizName(i+1)"
 *   TotalScoreArea (abc_xml)         → type: TOTAL_SCORE, label: "合計"
 *   LargeQuestionScoreArea (abc_xml) → type: SUBTOTAL_SCORE, label: "小計N"
 *   AngleScoreArea (abc_xml)         → type: SUBTOTAL_SCORE, label: "観点"
 *   座標正規化:
 *     abcData JS座標 / (フル画像幅 × image_scale)
 *     abc_xml座標 / フル画像サイズ（PageSize）
 *   Correct/abc_m*.png               → master-images/
 */

import AdmZip from "adm-zip"
import * as crypto from "crypto"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { CURRENT_VERSION } from "../../transformers/types"
import type {
  DatAbcData,
  DatAngle,
  DatContents,
  DatPageBlock,
  DatQuationBlock,
  DatQuestion,
  DatQuestionAngle,
  DatWorkbook,
} from "./types"
import {
  DAT_AREA_TYPE_TO_CROP_TYPE,
  DAT_AREA_TYPE_TO_LABEL,
  DAT_SUBJECT_MAP,
} from "./types"

/** CropRegionデータ */
interface CropRegionData {
  id: string
  examPageId: string
  label: string
  type: string
  x: number
  y: number
  width: number
  height: number
  points: number | null
  orderIndex: number | null
  createdAt: string
  updatedAt: string
}

interface ConvertDatResult {
  success: boolean
  /** 変換後の.scoreファイルパス（一時ディレクトリ内） */
  scorePath?: string
  /** 元の試験タイトル */
  originalTitle?: string
  error?: string
}

/**
 * .datファイルを.score形式に変換
 */
export async function convertDatToScore(
  datPath: string
): Promise<ConvertDatResult> {
  try {
    // 1. .datをZIPとして開く
    const datZip = new AdmZip(datPath)
    const entries = datZip.getEntries()

    // 2. RealtendantAppVersion.txt で検証
    const versionEntry = entries.find((e) =>
      e.entryName.endsWith("RealtendantAppVersion.txt")
    )
    if (!versionEntry) {
      return {
        success: false,
        error:
          "リアテンダントのデータファイルではありません（RealtendantAppVersion.txt が見つかりません）",
      }
    }

    // 3. contents.json → image_scale取得
    const contentsEntry = entries.find((e) =>
      e.entryName.endsWith("contents.json")
    )
    if (!contentsEntry) {
      return { success: false, error: "contents.json が見つかりません" }
    }
    const contentsArray: DatContents[] = JSON.parse(
      contentsEntry.getData().toString("utf8")
    )
    const contents = contentsArray[0]
    if (!contents) {
      return { success: false, error: "contents.json が空です" }
    }
    const imageScale = contents.image_scale || 0.5

    // 4. workbooks.json → 試験名・教科取得
    const workbooksEntry = entries.find((e) =>
      e.entryName.endsWith("workbooks.json")
    )
    if (!workbooksEntry) {
      return { success: false, error: "workbooks.json が見つかりません" }
    }
    const workbooks: DatWorkbook[] = JSON.parse(
      workbooksEntry.getData().toString("utf8")
    )
    const workbook = workbooks[0]
    if (!workbook) {
      return { success: false, error: "workbooks.json が空です" }
    }

    // 5. .jsファイルを発見し、abcDataをパース
    const jsEntry = entries.find(
      (e) => e.entryName.endsWith(".js") && !e.entryName.endsWith("_answer.js")
    )
    if (!jsEntry) {
      return {
        success: false,
        error: "座標データの .js ファイルが見つかりません",
      }
    }
    const jsContent = jsEntry.getData().toString("utf8")
    const jsonStr = jsContent.replace(/^var\s+abcData\s*=\s*/, "")
    let abcData: DatAbcData
    try {
      abcData = JSON.parse(jsonStr)
    } catch {
      return { success: false, error: "座標データのパースに失敗しました" }
    }

    // 6. workbook_infoes.json → abc_xml（スコア印字エリア情報）
    const workbookInfoEntry = entries.find((e) =>
      e.entryName.endsWith("workbook_infoes.json")
    )
    let abcXml: string | null = null
    if (workbookInfoEntry) {
      try {
        const infoes: Array<{ abc_xml?: string | null }> = JSON.parse(
          workbookInfoEntry.getData().toString("utf8")
        )
        abcXml = infoes[0]?.abc_xml ?? null
      } catch {
        // パース失敗時はスコアエリア無しで続行
      }
    }

    // 7. 模範解答画像を発見し、PNGヘッダーから画像サイズを取得
    const masterImageEntries = entries
      .filter(
        (e) =>
          e.entryName.includes("/Correct/abc_m") && e.entryName.endsWith(".png")
      )
      .sort((a, b) => a.entryName.localeCompare(b.entryName))

    if (masterImageEntries.length === 0) {
      return { success: false, error: "模範解答画像が見つかりません" }
    }

    // ページ番号 → 画像サイズ（フルスケール）
    const pageImageSizes = new Map<number, { w: number; h: number }>()
    for (let i = 0; i < masterImageEntries.length; i++) {
      const imgBuffer = masterImageEntries[i].getData()
      const width = imgBuffer.readUInt32BE(16)
      const height = imgBuffer.readUInt32BE(20)
      pageImageSizes.set(i + 1, { w: width, h: height })
    }

    // 8. UUID生成と試験構築
    const examId = generateUuid()
    const now = new Date().toISOString()

    // ページ番号 → UUID マッピング
    const pageUuidMap = new Map<number, string>()
    for (let pageNo = 1; pageNo <= abcData.PageMax; pageNo++) {
      pageUuidMap.set(pageNo, generateUuid())
    }

    // ExamPages 生成
    const examPages = Array.from(pageUuidMap.entries()).map(([pageNo, id]) => ({
      id,
      examId,
      pageNumber: pageNo,
      createdAt: now,
      updatedAt: now,
    }))

    // MasterImages 生成
    const masterImages: Array<{
      id: string
      examPageId: string
      imagePath: string
      createdAt: string
      updatedAt: string
    }> = []
    for (let i = 0; i < masterImageEntries.length; i++) {
      const pageNo = i + 1
      const pageId = pageUuidMap.get(pageNo)
      if (pageId) {
        masterImages.push({
          id: generateUuid(),
          examPageId: pageId,
          imagePath: `abc_m${String(pageNo).padStart(2, "0")}.png`,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    // 9. questions.json, angles.json, question_angles.json 読み込み
    const questionsEntry = entries.find((e) =>
      e.entryName.endsWith("questions.json")
    )
    const questions: DatQuestion[] = questionsEntry
      ? JSON.parse(questionsEntry.getData().toString("utf8"))
      : []

    const anglesEntry = entries.find((e) => e.entryName.endsWith("angles.json"))
    const angles: DatAngle[] = anglesEntry
      ? JSON.parse(anglesEntry.getData().toString("utf8"))
      : []

    const questionAnglesEntry = entries.find((e) =>
      e.entryName.endsWith("question_angles.json")
    )
    const questionAngles: DatQuestionAngle[] = questionAnglesEntry
      ? JSON.parse(questionAnglesEntry.getData().toString("utf8"))
      : []

    // 10. CropRegions 生成（設問 + 出席番号/氏名）
    const { regions: questionRegions, quizNameToCropIds } =
      convertPageBlocksToCropRegions(
        abcData.PageBlock,
        pageUuidMap,
        pageImageSizes,
        imageScale,
        now
      )
    const cropRegions = [...questionRegions]

    // 11. abc_xml からスコア印字エリアを抽出してCropRegionsに追加
    let largeQuestionToCropId = new Map<string, string>()
    if (abcXml) {
      const scoreAreaResult = extractScoreAreasFromAbcXml(
        abcXml,
        pageUuidMap,
        pageImageSizes,
        now
      )
      cropRegions.push(...scoreAreaResult.regions)
      largeQuestionToCropId = scoreAreaResult.largeQuestionToCropId
    }

    // 12. SubtotalGroup / Subtotal / CropSubtotal 生成
    const subtotalData = generateSubtotalData(
      questions,
      angles,
      questionAngles,
      quizNameToCropIds,
      largeQuestionToCropId,
      examId,
      now
    )

    // 13. 試験データ構築
    const subjectName =
      DAT_SUBJECT_MAP[workbook.subject_id] || `教科${workbook.subject_id}`
    const examTitle = `${contents.contents_name} ${workbook.workbook_name}`

    const examData = {
      exam: {
        id: examId,
        examName: examTitle,
        examDate: null,
        description: `リアテンダントからインポート（${subjectName}）`,
        createdAt: now,
        updatedAt: now,
      },
      examPages,
      cropRegions,
      pageImages: [],
      masterImages,
      studentAnswerImages: [],
      examStudents: [],
      userExams: [],
      examSubtotalGroups: subtotalData.examSubtotalGroups,
      examClasses: [],
      examMarkingFormats: [],
      examExportSettings: null,
      cropRegionMarkingOverrides: [],
    }

    // 14. manifest 生成
    const manifest = {
      version: CURRENT_VERSION,
      schemaVersion: "dat-import",
      appVersion: "0.0.0",
      exportedAt: now,
      sourceDbId: `dat:${contents.contents_uid}`,
      examId,
      examName: examTitle,
      exportMode: "template_with_subtotals",
      counts: {
        students: 0,
        classes: 0,
        users: 0,
        pages: examPages.length,
        regions: cropRegions.length,
        scores: 0,
        annotations: 0,
        subtotalGroups: subtotalData.subtotalGroups.length,
        masterImages: masterImages.length,
        answerSheetImages: 0,
      },
    }

    // 15. .score ZIP ファイルを生成
    const scoreZip = new AdmZip()

    scoreZip.addFile(
      "manifest.json",
      Buffer.from(JSON.stringify(manifest, null, 2))
    )
    scoreZip.addFile(
      "exam.json",
      Buffer.from(JSON.stringify(examData, null, 2))
    )
    scoreZip.addFile(
      "students.json",
      Buffer.from(JSON.stringify({ students: [] }, null, 2))
    )
    scoreZip.addFile(
      "classes.json",
      Buffer.from(JSON.stringify({ classes: [], memberships: [] }, null, 2))
    )
    scoreZip.addFile(
      "users.json",
      Buffer.from(JSON.stringify({ users: [] }, null, 2))
    )
    scoreZip.addFile(
      "subtotals.json",
      Buffer.from(
        JSON.stringify(
          {
            subtotalGroups: subtotalData.subtotalGroups,
            subtotals: subtotalData.subtotals,
            cropSubtotals: subtotalData.cropSubtotals,
          },
          null,
          2
        )
      )
    )
    scoreZip.addFile(
      "scores.json",
      Buffer.from(
        JSON.stringify({ questionScores: [], drawingAnnotations: [] }, null, 2)
      )
    )
    scoreZip.addFile(
      "tags.json",
      Buffer.from(
        JSON.stringify({ tags: [], tagSubtotalGroups: [], examTags: [] }, null, 2)
      )
    )

    // 模範解答画像をmaster-images/にコピー
    for (let i = 0; i < masterImageEntries.length; i++) {
      const fileName = `abc_m${String(i + 1).padStart(2, "0")}.png`
      scoreZip.addFile(
        `master-images/${fileName}`,
        masterImageEntries[i].getData()
      )
    }

    // 一時ファイルに書き出し
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dat-convert-"))
    const scorePath = path.join(tempDir, "converted.score")
    scoreZip.writeZip(scorePath)

    return {
      success: true,
      scorePath,
      originalTitle: examTitle,
    }
  } catch (error) {
    console.error("Error converting DAT to Score:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : ".dat ファイルの変換に失敗しました",
    }
  }
}

/** extractScoreAreasFromAbcXml の結果 */
interface ScoreAreasResult {
  regions: CropRegionData[]
  /** LargeQuestionNumber → CropRegion ID（大問小計の紐付け用） */
  largeQuestionToCropId: Map<string, string>
}

/**
 * abc_xml (workbook_infoes.json内) からスコア印字エリアを抽出
 *
 * abc_xmlの<PointInfoBlock>/<AreaInfo>に以下が含まれる:
 * - TotalScoreArea: 合計点印字位置（フルスケール座標）
 * - LargeQuestionScoreArea: 大問小計印字位置（LargeQuestionNumber付き）
 * - AngleScoreArea: 観点別得点印字位置
 *
 * 座標はフルスケール（PageSize基準）。正規化: 座標 / フル画像サイズ
 */
function extractScoreAreasFromAbcXml(
  abcXml: string,
  pageUuidMap: Map<number, string>,
  pageImageSizes: Map<number, { w: number; h: number }>,
  now: string
): ScoreAreasResult {
  const regions: CropRegionData[] = []
  const largeQuestionToCropId = new Map<string, string>()

  // 簡易XMLパース（DOMParser不要、正規表現で自己完結型要素を抽出）
  // TotalScoreArea, LargeQuestionScoreArea, AngleScoreArea は全て自己閉じタグ

  // TotalScoreArea
  const totalMatches = abcXml.matchAll(/<TotalScoreArea\s+([^/]*?)\/>/g)
  for (const match of totalMatches) {
    const attrs = parseXmlAttributes(match[1])
    const page = parseInt(attrs.Page || "1", 10)
    const region = createScoreRegion(
      attrs,
      page,
      "TOTAL_SCORE",
      "合計",
      pageUuidMap,
      pageImageSizes,
      now
    )
    if (region) regions.push(region)
  }

  // LargeQuestionScoreArea（大問小計）
  const largeMatches = abcXml.matchAll(/<LargeQuestionScoreArea\s+([^/]*?)\/>/g)
  for (const match of largeMatches) {
    const attrs = parseXmlAttributes(match[1])
    if (attrs.Visible === "false") continue
    const page = parseInt(attrs.Page || "1", 10)
    const lqNum = attrs.LargeQuestionNumber || "?"
    const region = createScoreRegion(
      attrs,
      page,
      "SUBTOTAL_SCORE",
      `小計${lqNum}`,
      pageUuidMap,
      pageImageSizes,
      now
    )
    if (region) {
      regions.push(region)
      largeQuestionToCropId.set(lqNum, region.id)
    }
  }

  // AngleScoreArea（観点別得点）
  const angleMatches = abcXml.matchAll(/<AngleScoreArea\s+([^/]*?)\/>/g)
  let angleIndex = 0
  for (const match of angleMatches) {
    const attrs = parseXmlAttributes(match[1])
    if (attrs.Visible === "false") continue
    const page = parseInt(attrs.Page || "1", 10)
    angleIndex++
    const label = angleIndex === 1 ? "観点" : `観点${angleIndex}`
    const region = createScoreRegion(
      attrs,
      page,
      "SUBTOTAL_SCORE",
      label,
      pageUuidMap,
      pageImageSizes,
      now
    )
    if (region) regions.push(region)
  }

  return { regions, largeQuestionToCropId }
}

/**
 * XML属性文字列をパースしてRecord<string,string>に変換
 * 例: 'Page="1" X="901" Y="88"' → { Page: "1", X: "901", Y: "88" }
 */
function parseXmlAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /(\w+)="([^"]*)"/g
  let m
  while ((m = re.exec(attrString)) !== null) {
    attrs[m[1]] = m[2]
  }
  return attrs
}

/**
 * スコアエリア属性からCropRegionDataを生成
 *
 * abc_xmlの座標はフルスケール（PageSize基準）
 * 正規化: フル画像サイズで割る
 */
function createScoreRegion(
  attrs: Record<string, string>,
  page: number,
  type: string,
  label: string,
  pageUuidMap: Map<number, string>,
  pageImageSizes: Map<number, { w: number; h: number }>,
  now: string
): CropRegionData | null {
  const examPageId = pageUuidMap.get(page)
  if (!examPageId) return null

  const imageSize = pageImageSizes.get(page)
  if (!imageSize || imageSize.w === 0 || imageSize.h === 0) return null

  const x = parseInt(attrs.X || "0", 10)
  const y = parseInt(attrs.Y || "0", 10)
  const w = parseInt(attrs.Width || "0", 10)
  const h = parseInt(attrs.Height || "0", 10)

  // フルスケール座標 → 正規化座標
  return {
    id: generateUuid(),
    examPageId,
    label,
    type,
    x: x / imageSize.w,
    y: y / imageSize.h,
    width: w / imageSize.w,
    height: h / imageSize.h,
    points: null,
    orderIndex: null,
    createdAt: now,
    updatedAt: now,
  }
}

/** convertPageBlocksToCropRegions の結果 */
interface CropRegionsResult {
  regions: CropRegionData[]
  /** QuizName → CropRegion ID（小計グループ紐付け用） */
  quizNameToCropIds: Map<string, string[]>
}

/**
 * PageBlock[] → CropRegions 変換
 *
 * リアテンダントのJS座標（半スケール）をScore at Onceの正規化座標（0-1）に変換する。
 * 正規化: JS座標 / (フル画像幅 × image_scale)
 */
function convertPageBlocksToCropRegions(
  pageBlocks: DatPageBlock[],
  pageUuidMap: Map<number, string>,
  pageImageSizes: Map<number, { w: number; h: number }>,
  imageScale: number,
  now: string
): CropRegionsResult {
  const regions: CropRegionData[] = []
  const quizNameToCropIds = new Map<string, string[]>()

  // 全ページを通した設問の連番
  let questionOrderIndex = 0

  // まず全PageBlockのQuationBlockをSeqでソートして順序を確定
  const allQuestions: Array<{
    pageNo: number
    question: DatQuationBlock
  }> = []
  for (const page of pageBlocks) {
    for (const q of page.QuationBlock) {
      allQuestions.push({ pageNo: page.PageNo, question: q })
    }
  }
  allQuestions.sort((a, b) => a.question.Seq - b.question.Seq)

  // Seq → orderIndex マッピング
  const seqToOrderIndex = new Map<number, number>()
  for (const { question } of allQuestions) {
    if (question.QuizType === "PARTIAL_MATCH" && question.Completion) {
      // PARTIAL_MATCH: 各Completionに個別orderIndex
      for (let i = 0; i < question.Completion.length; i++) {
        // Seq*1000+i で一意キー（Completion内の順番を区別）
        seqToOrderIndex.set(question.Seq * 1000 + i, questionOrderIndex++)
      }
    } else {
      seqToOrderIndex.set(question.Seq * 1000, questionOrderIndex++)
    }
  }

  /** QuizName → CropRegion ID のヘルパー */
  function trackQuizName(quizName: string, cropId: string) {
    const ids = quizNameToCropIds.get(quizName) || []
    ids.push(cropId)
    quizNameToCropIds.set(quizName, ids)
  }

  for (const page of pageBlocks) {
    const examPageId = pageUuidMap.get(page.PageNo)
    if (!examPageId) continue

    const imageSize = pageImageSizes.get(page.PageNo)
    if (!imageSize || imageSize.w === 0 || imageSize.h === 0) continue

    // 正規化用の分母: フル画像サイズ × image_scale
    const normW = imageSize.w * imageScale
    const normH = imageSize.h * imageScale

    // AreaBlock → STUDENT_ID / STUDENT_NAME
    for (const area of page.AreaBlock) {
      const cropType = DAT_AREA_TYPE_TO_CROP_TYPE[area.Type]
      if (!cropType) continue

      regions.push({
        id: generateUuid(),
        examPageId,
        label: DAT_AREA_TYPE_TO_LABEL[area.Type] || area.Type,
        type: cropType,
        x: area.X / normW,
        y: area.Y / normH,
        width: area.Width / normW,
        height: area.Height / normH,
        points: null,
        orderIndex: null,
        createdAt: now,
        updatedAt: now,
      })
    }

    // QuationBlock → QUESTION_ANSWER
    for (const q of page.QuationBlock) {
      if (q.QuizType === "PARTIAL_MATCH" && q.Completion) {
        // PARTIAL_MATCH: 各Completionに個別CropRegion
        for (let i = 0; i < q.Completion.length; i++) {
          const completion = q.Completion[i]
          const pointArea = completion.PointArea?.[0]
          if (!pointArea) continue

          const id = generateUuid()
          regions.push({
            id,
            examPageId,
            label: `${q.QuizName}(${i + 1})`,
            type: "QUESTION_ANSWER",
            x: pointArea.X / normW,
            y: pointArea.Y / normH,
            width: pointArea.Width / normW,
            height: pointArea.Height / normH,
            points: q.Score,
            orderIndex: seqToOrderIndex.get(q.Seq * 1000 + i) ?? null,
            createdAt: now,
            updatedAt: now,
          })
          trackQuizName(q.QuizName, id)
        }
      } else {
        // FREE: PointArea[0] → 1つのCropRegion
        const pointArea = q.PointArea?.[0]
        if (!pointArea) continue

        const id = generateUuid()
        regions.push({
          id,
          examPageId,
          label: q.QuizName,
          type: "QUESTION_ANSWER",
          x: pointArea.X / normW,
          y: pointArea.Y / normH,
          width: pointArea.Width / normW,
          height: pointArea.Height / normH,
          points: q.Score,
          orderIndex: seqToOrderIndex.get(q.Seq * 1000) ?? null,
          createdAt: now,
          updatedAt: now,
        })
        trackQuizName(q.QuizName, id)
      }
    }
  }

  return { regions, quizNameToCropIds }
}

/** SubtotalGroup/Subtotal/CropSubtotal/ExamSubtotalGroup の生成結果 */
interface SubtotalGenerationResult {
  subtotalGroups: Array<{
    id: string
    name: string
    createdAt: string
    updatedAt: string
  }>
  subtotals: Array<{
    id: string
    name: string
    subtotalGroupId: string
    order: number
    createdAt: string
    updatedAt: string
  }>
  cropSubtotals: Array<{
    id: string
    cropRegionId: string
    subtotalId: string
    assignmentType: string
    createdAt: string
    updatedAt: string
  }>
  examSubtotalGroups: Array<{
    id: string
    examId: string
    subtotalGroupId: string
  }>
}

/**
 * リアテンダントのデータから SubtotalGroup/Subtotal/CropSubtotal を生成
 *
 * 2つのSubtotalGroupを作成:
 * 1. 「大問」: QuizName のプレフィックス（"1-1"→"1"）でグループ化
 *    - QUESTION_ASSIGNMENT: 各設問CropRegion → 対応する大問Subtotal
 *    - SUBTOTAL_DEFINITION: 小計N CropRegion → 大問N Subtotal
 * 2. 「観点」: angles.json の観点名（知識・技能, 思考・判断・表現）
 *    - QUESTION_ASSIGNMENT: 各設問CropRegion → question_angles経由で対応する観点Subtotal
 */
function generateSubtotalData(
  questions: DatQuestion[],
  angles: DatAngle[],
  questionAngles: DatQuestionAngle[],
  quizNameToCropIds: Map<string, string[]>,
  largeQuestionToCropId: Map<string, string>,
  examId: string,
  now: string
): SubtotalGenerationResult {
  const subtotalGroups: SubtotalGenerationResult["subtotalGroups"] = []
  const subtotals: SubtotalGenerationResult["subtotals"] = []
  const cropSubtotals: SubtotalGenerationResult["cropSubtotals"] = []
  const examSubtotalGroups: SubtotalGenerationResult["examSubtotalGroups"] = []

  // question_name → question_id マッピング
  const questionNameToId = new Map<string, number>()
  for (const q of questions) {
    questionNameToId.set(q.question_name, q.id)
  }

  // question_id → angle_id マッピング
  const questionIdToAngleId = new Map<number, number>()
  for (const qa of questionAngles) {
    questionIdToAngleId.set(qa.question_id, qa.angle_id)
  }

  // ========================================
  // 1. 「大問」SubtotalGroup
  // ========================================

  // QuizName のプレフィックスを抽出（"1-1" → "1", "2-3" → "2"）
  const prefixSet = new Set<string>()
  for (const quizName of quizNameToCropIds.keys()) {
    const prefix = quizName.split("-")[0]
    if (prefix) prefixSet.add(prefix)
  }

  if (prefixSet.size > 0) {
    const daimonGroupId = generateUuid()
    subtotalGroups.push({
      id: daimonGroupId,
      name: "大問",
      createdAt: now,
      updatedAt: now,
    })
    examSubtotalGroups.push({
      id: generateUuid(),
      examId,
      subtotalGroupId: daimonGroupId,
    })

    // プレフィックスをソートしてSubtotalを作成
    const sortedPrefixes = Array.from(prefixSet).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10)
    )
    const prefixToSubtotalId = new Map<string, string>()

    for (let i = 0; i < sortedPrefixes.length; i++) {
      const prefix = sortedPrefixes[i]
      const subtotalId = generateUuid()
      prefixToSubtotalId.set(prefix, subtotalId)

      subtotals.push({
        id: subtotalId,
        name: `大問${prefix}`,
        subtotalGroupId: daimonGroupId,
        order: i,
        createdAt: now,
        updatedAt: now,
      })
    }

    // QUESTION_ASSIGNMENT: 各設問CropRegion → 大問Subtotal
    for (const [quizName, cropIds] of quizNameToCropIds) {
      const prefix = quizName.split("-")[0]
      const subtotalId = prefixToSubtotalId.get(prefix)
      if (!subtotalId) continue

      for (const cropId of cropIds) {
        cropSubtotals.push({
          id: generateUuid(),
          cropRegionId: cropId,
          subtotalId,
          assignmentType: "QUESTION_ASSIGNMENT",
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    // SUBTOTAL_DEFINITION: 小計N CropRegion → 大問N Subtotal
    for (const [lqNum, cropId] of largeQuestionToCropId) {
      const subtotalId = prefixToSubtotalId.get(lqNum)
      if (!subtotalId) continue

      cropSubtotals.push({
        id: generateUuid(),
        cropRegionId: cropId,
        subtotalId,
        assignmentType: "SUBTOTAL_DEFINITION",
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // ========================================
  // 2. 「観点」SubtotalGroup
  // ========================================

  const activeAngles = angles
    .filter((a) => !a.delete_flg)
    .sort((a, b) => a.angle_sort_no - b.angle_sort_no)

  if (activeAngles.length > 0 && questionAngles.length > 0) {
    const kantenGroupId = generateUuid()
    subtotalGroups.push({
      id: kantenGroupId,
      name: "観点",
      createdAt: now,
      updatedAt: now,
    })
    examSubtotalGroups.push({
      id: generateUuid(),
      examId,
      subtotalGroupId: kantenGroupId,
    })

    // angle_id → Subtotal ID マッピング
    const angleIdToSubtotalId = new Map<number, string>()

    for (let i = 0; i < activeAngles.length; i++) {
      const angle = activeAngles[i]
      const subtotalId = generateUuid()
      angleIdToSubtotalId.set(angle.id, subtotalId)

      subtotals.push({
        id: subtotalId,
        name: angle.angle_name,
        subtotalGroupId: kantenGroupId,
        order: i,
        createdAt: now,
        updatedAt: now,
      })
    }

    // QUESTION_ASSIGNMENT: 各設問CropRegion → 観点Subtotal
    // QuizName → question_id → angle_id → Subtotal
    for (const [quizName, cropIds] of quizNameToCropIds) {
      const questionId = questionNameToId.get(quizName)
      if (questionId === undefined) continue

      const angleId = questionIdToAngleId.get(questionId)
      if (angleId === undefined) continue

      const subtotalId = angleIdToSubtotalId.get(angleId)
      if (!subtotalId) continue

      for (const cropId of cropIds) {
        cropSubtotals.push({
          id: generateUuid(),
          cropRegionId: cropId,
          subtotalId,
          assignmentType: "QUESTION_ASSIGNMENT",
          createdAt: now,
          updatedAt: now,
        })
      }
    }
  }

  return { subtotalGroups, subtotals, cropSubtotals, examSubtotalGroups }
}

/**
 * UUID v4 生成
 */
function generateUuid(): string {
  return crypto.randomUUID()
}
