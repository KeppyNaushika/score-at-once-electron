/**
 * 百問繚乱 .hsz → .score 変換ロジック
 *
 * .hszファイルを内部的に.score形式（テンプレートモード）に変換し、
 * 既存のインポートパイプラインに乗せる。
 *
 * データマッピング:
 *   rim.l / imageW → x (0-1 正規化座標)
 *   rim.t / imageH → y (0-1 正規化座標)
 *   rim.w / imageW → width (0-1 正規化座標)
 *   rim.h / imageH → height (0-1 正規化座標)
 *   part1+part2+part3 → label
 *   allot          → points
 *   kind           → type (HSZ_KIND_TO_CROP_TYPE経由)
 *   page           → examPageId (UUID経由)
 *   correct_N.png  → master-images/ (模範解答画像)
 */

import AdmZip from "adm-zip"
import * as crypto from "crypto"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { EXAM_CURRENT_VERSION } from "../../../../../src/types/examArchive.types"
import type { HszDbInfo, HszSheetField } from "./types"
import { HSZ_KIND_TO_CROP_TYPE, HSZ_SKIP_KINDS, HSZ_SUBJECT_MAP } from "./types"

interface ConvertHszResult {
  success: boolean
  /** 変換後の.scoreファイルパス（一時ディレクトリ内） */
  scorePath?: string
  /** 元の試験タイトル */
  originalTitle?: string
  error?: string
}

/**
 * .hszファイルを.score形式に変換
 */
export async function convertHszToScore(
  hszPath: string
): Promise<ConvertHszResult> {
  try {
    // 1. .hszをZIPとして開く
    const hszZip = new AdmZip(hszPath)
    const entries = hszZip.getEntries()

    // 2. db_info.json を取得・パース
    const dbInfoEntry = entries.find(
      (entry) => entry.entryName === "db_info.json"
    )
    if (!dbInfoEntry) {
      return { success: false, error: "db_info.json が見つかりません" }
    }

    const dbInfo: HszDbInfo = JSON.parse(dbInfoEntry.getData().toString("utf8"))
    const { sheets, sheet_pages, sheet_fields } = dbInfo

    // 3. UUID生成
    const examId = generateUuid()
    const now = new Date().toISOString()

    // ページ番号 → UUID マッピング
    const pageUuidMap = new Map<number, string>()
    for (const sheetPage of sheet_pages) {
      pageUuidMap.set(sheetPage.page, generateUuid())
    }

    // 4. ExamPages 生成
    const examPages = sheet_pages.map((sheetPage) => ({
      id: pageUuidMap.get(sheetPage.page)!,
      examId,
      pageNumber: sheetPage.page + 1, // Score at Onceは1始まり
      createdAt: now,
      updatedAt: now,
    }))

    // 5. MasterImages 生成
    const masterImages: Array<{
      id: string
      examPageId: string
      imagePath: string
      createdAt: string
      updatedAt: string
    }> = []

    for (const sheetPage of sheet_pages) {
      const imgFileName = `correct_${sheetPage.page}.png`
      const imgEntry = entries.find((entry) => entry.entryName === imgFileName)
      if (imgEntry) {
        masterImages.push({
          id: generateUuid(),
          examPageId: pageUuidMap.get(sheetPage.page)!,
          imagePath: imgFileName,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    // 6. CropRegions 生成（sheet_fields → cropRegions変換）
    // ページ番号 → 画像サイズ マッピング（ピクセル→正規化座標変換用）
    const pageImageSizeMap = new Map<number, { w: number; h: number }>()
    for (const sheetPage of sheet_pages) {
      pageImageSizeMap.set(sheetPage.page, sheetPage.correct_image_size)
    }

    const {
      regions: cropRegions,
      part1ToCropIds,
      regionToCropIds,
      scorePCropIdByPart1,
      scoreRCropIdByRegion,
    } = convertFieldsToCropRegions(
      sheet_fields,
      pageUuidMap,
      pageImageSizeMap,
      now
    )

    // 7. SubtotalGroup / Subtotal / CropSubtotal 生成
    const subtotalData = generateHszSubtotalData(
      part1ToCropIds,
      regionToCropIds,
      scorePCropIdByPart1,
      scoreRCropIdByRegion,
      examId,
      now
    )

    // 8. 試験データ構築
    const subjectName =
      HSZ_SUBJECT_MAP[sheets.subject_id] || `教科${sheets.subject_id}`

    const examData = {
      exam: {
        id: examId,
        examName: sheets.title_name,
        examDate: null,
        description: `百問繚乱からインポート（${subjectName}・${sheets.course}）`,
        createdAt: now,
        updatedAt: now,
      },
      examPages,
      cropRegions,
      pageImages: [], // v1.2.0以降は使用しない
      masterImages,
      studentAnswerImages: [],
      examStudents: [],
      userExams: [],
      examSubtotalGroups: subtotalData.examSubtotalGroups,
      examClassrooms: [],
      examMarkingFormats: [],
      examExportSettings: null,
      cropRegionMarkingOverrides: [],
    }

    // 9. manifest 生成
    const manifest = {
      version: EXAM_CURRENT_VERSION,
      schemaVersion: "hsz-import",
      appVersion: "0.0.0",
      exportedAt: now,
      sourceDbId: `hsz:${sheets.id}`,
      examId,
      examName: sheets.title_name,
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

    // 10. .score ZIP ファイルを生成
    const scoreZip = new AdmZip()

    // JSON ファイル追加
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
        JSON.stringify(
          { tags: [], tagSubtotalGroups: [], examTags: [] },
          null,
          2
        )
      )
    )

    // 模範解答画像をmaster-images/にコピー
    for (const sheetPage of sheet_pages) {
      const imgFileName = `correct_${sheetPage.page}.png`
      const imgEntry = entries.find((entry) => entry.entryName === imgFileName)
      if (imgEntry) {
        scoreZip.addFile(`master-images/${imgFileName}`, imgEntry.getData())
      }
    }

    // 一時ファイルに書き出し
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hsz-convert-"))
    const scorePath = path.join(tempDir, "converted.score")
    scoreZip.writeZip(scorePath)

    return {
      success: true,
      scorePath,
      originalTitle: sheets.title_name,
    }
  } catch (error) {
    console.error("Error converting HSZ to Score:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : ".hsz ファイルの変換に失敗しました",
    }
  }
}

/** convertFieldsToCropRegions の結果 */
interface HszCropRegionsResult {
  regions: Array<{
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
  }>
  /** part1 → QUESTION_ANSWER CropRegion ID（大問グループ紐付け用） */
  part1ToCropIds: Map<string, string[]>
  /** region → QUESTION_ANSWER CropRegion ID（観点グループ紐付け用） */
  regionToCropIds: Map<string, string[]>
  /** part1 → score_p CropRegion ID（小計表示エリア → 大問 SUBTOTAL_DEFINITION） */
  scorePCropIdByPart1: Map<string, string>
  /** region → score_r CropRegion ID（観点表示エリア → 観点 SUBTOTAL_DEFINITION） */
  scoreRCropIdByRegion: Map<string, string>
}

/**
 * sheet_fields → CropRegions 変換
 *
 * 百問繚乱のrim座標（ピクセル）をScore at Onceの正規化座標（0-1）に変換する
 */
function convertFieldsToCropRegions(
  fields: HszSheetField[],
  pageUuidMap: Map<number, string>,
  pageImageSizeMap: Map<number, { w: number; h: number }>,
  now: string
): HszCropRegionsResult {
  const regions: HszCropRegionsResult["regions"] = []
  const part1ToCropIds = new Map<string, string[]>()
  const regionToCropIds = new Map<string, string[]>()
  const scorePCropIdByPart1 = new Map<string, string>()
  const scoreRCropIdByRegion = new Map<string, string>()

  let orderIndex = 0

  for (const field of fields) {
    // rimがnullまたはスキップ対象のkindはスキップ
    if (!field.rim) continue
    if (HSZ_SKIP_KINDS.has(field.kind)) continue

    // kindからCropRegionタイプを決定
    const cropType = HSZ_KIND_TO_CROP_TYPE[field.kind]
    if (!cropType) continue

    // ページのUUIDを取得
    const examPageId = pageUuidMap.get(field.page)
    if (!examPageId) continue

    // ページの画像サイズを取得（正規化用）
    const imageSize = pageImageSizeMap.get(field.page)
    if (!imageSize || imageSize.w === 0 || imageSize.h === 0) continue

    // ラベル生成
    const label = buildLabel(field)

    const id = generateUuid()

    // ピクセル座標 → 正規化座標（0-1）に変換
    regions.push({
      id,
      examPageId,
      label,
      type: cropType,
      x: field.rim.l / imageSize.w,
      y: field.rim.t / imageSize.h,
      width: field.rim.w / imageSize.w,
      height: field.rim.h / imageSize.h,
      points: field.allot ?? null,
      orderIndex: cropType === "QUESTION_ANSWER" ? orderIndex++ : null,
      createdAt: now,
      updatedAt: now,
    })

    // サブトータル紐付け用マッピングを記録
    if (field.kind === "q") {
      if (field.part1) {
        const ids = part1ToCropIds.get(field.part1) || []
        ids.push(id)
        part1ToCropIds.set(field.part1, ids)
      }
      if (field.region) {
        const ids = regionToCropIds.get(field.region) || []
        ids.push(id)
        regionToCropIds.set(field.region, ids)
      }
    } else if (field.kind === "score_p" && field.part1) {
      scorePCropIdByPart1.set(field.part1, id)
    } else if (field.kind === "score_r" && field.region) {
      scoreRCropIdByRegion.set(field.region, id)
    }
  }

  return {
    regions,
    part1ToCropIds,
    regionToCropIds,
    scorePCropIdByPart1,
    scoreRCropIdByRegion,
  }
}

/**
 * フィールドのpart1/part2/part3からラベルを生成
 *
 * 例:
 * - part1="1", part2="", part3="1" → "1(1)"
 * - part1="1", part2=null, part3=null → "1"
 * - kind="ssk_no" → "出席番号"
 * - kind="name" → "氏名"
 * - kind="score" → "合計"
 * - kind="score_r", region="11" → "観点11"
 * - kind="score_p", part1="1" → "小計1"
 */
function buildLabel(field: HszSheetField): string {
  switch (field.kind) {
    case "ssk_no":
      return "出席番号"
    case "name":
      return "氏名"
    case "score":
      return "合計"
    case "score_r":
      return field.region ? `観点${field.region}` : "観点"
    case "score_p":
      return field.part1 ? `小計${field.part1}` : "小計"
    case "q": {
      const parts: string[] = []
      if (field.part1) parts.push(field.part1)
      if (field.part2) parts.push(field.part2)
      if (field.part3) parts.push(field.part3)

      if (parts.length === 0) return `問${field.sort_no}`
      if (parts.length === 1) return parts[0]
      // part1(part2) or part1(part3)
      return `${parts[0]}(${parts.slice(1).join("-")})`
    }
    default:
      return `field_${field.sort_no}`
  }
}

/** SubtotalGroup/Subtotal/CropSubtotal/ExamSubtotalGroup の生成結果 */
interface HszSubtotalResult {
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
 * 百問繚乱のフィールドデータから SubtotalGroup/Subtotal/CropSubtotal を生成
 *
 * 2つのSubtotalGroupを作成:
 * 1. 「大問」: part1（大問番号）でグループ化
 *    - QUESTION_ASSIGNMENT: 各設問CropRegion → 対応する大問Subtotal
 *    - SUBTOTAL_DEFINITION: score_p CropRegion → 対応する大問Subtotal
 * 2. 「観点」: region（観点コード）でグループ化
 *    - QUESTION_ASSIGNMENT: 各設問CropRegion → 対応する観点Subtotal
 *    - SUBTOTAL_DEFINITION: score_r CropRegion → 対応する観点Subtotal
 */
function generateHszSubtotalData(
  part1ToCropIds: Map<string, string[]>,
  regionToCropIds: Map<string, string[]>,
  scorePCropIdByPart1: Map<string, string>,
  scoreRCropIdByRegion: Map<string, string>,
  examId: string,
  now: string
): HszSubtotalResult {
  const subtotalGroups: HszSubtotalResult["subtotalGroups"] = []
  const subtotals: HszSubtotalResult["subtotals"] = []
  const cropSubtotals: HszSubtotalResult["cropSubtotals"] = []
  const examSubtotalGroups: HszSubtotalResult["examSubtotalGroups"] = []

  // ========================================
  // 1. 「大問」SubtotalGroup
  // ========================================

  if (part1ToCropIds.size > 0) {
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

    // part1をソートしてSubtotalを作成
    const sortedPart1s = Array.from(part1ToCropIds.keys()).sort(
      (part1A, part1B) => parseInt(part1A, 10) - parseInt(part1B, 10)
    )
    const part1ToSubtotalId = new Map<string, string>()

    for (let i = 0; i < sortedPart1s.length; i++) {
      const part1 = sortedPart1s[i]
      const subtotalId = generateUuid()
      part1ToSubtotalId.set(part1, subtotalId)

      subtotals.push({
        id: subtotalId,
        name: `大問${part1}`,
        subtotalGroupId: daimonGroupId,
        order: i,
        createdAt: now,
        updatedAt: now,
      })
    }

    // QUESTION_ASSIGNMENT: 各設問CropRegion → 大問Subtotal
    for (const [part1, cropIds] of part1ToCropIds) {
      const subtotalId = part1ToSubtotalId.get(part1)
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

    // SUBTOTAL_DEFINITION: score_p CropRegion → 大問Subtotal
    for (const [part1, cropId] of scorePCropIdByPart1) {
      const subtotalId = part1ToSubtotalId.get(part1)
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

  if (regionToCropIds.size > 0) {
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

    // regionをソートしてSubtotalを作成
    const sortedRegions = Array.from(regionToCropIds.keys()).sort(
      (regionA, regionB) => parseInt(regionA, 10) - parseInt(regionB, 10)
    )
    const regionToSubtotalId = new Map<string, string>()

    for (let i = 0; i < sortedRegions.length; i++) {
      const region = sortedRegions[i]
      const subtotalId = generateUuid()
      regionToSubtotalId.set(region, subtotalId)

      subtotals.push({
        id: subtotalId,
        name: `観点${region}`,
        subtotalGroupId: kantenGroupId,
        order: i,
        createdAt: now,
        updatedAt: now,
      })
    }

    // QUESTION_ASSIGNMENT: 各設問CropRegion → 観点Subtotal
    for (const [region, cropIds] of regionToCropIds) {
      const subtotalId = regionToSubtotalId.get(region)
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

    // SUBTOTAL_DEFINITION: score_r CropRegion → 観点Subtotal
    for (const [region, cropId] of scoreRCropIdByRegion) {
      const subtotalId = regionToSubtotalId.get(region)
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

  return { subtotalGroups, subtotals, cropSubtotals, examSubtotalGroups }
}

/**
 * UUID v4 生成
 */
function generateUuid(): string {
  return crypto.randomUUID()
}
