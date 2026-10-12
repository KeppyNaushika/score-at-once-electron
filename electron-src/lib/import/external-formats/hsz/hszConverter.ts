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

import { assertLegacyZipWithinLimits } from "../../shared/legacyZipLimits"
import type {
  ConvertedCropRegion,
  ConvertedSubtotalData,
} from "../templateScoreArchive"
import {
  appendSubtotalGroup,
  createEmptySubtotalData,
  generateUuid,
  writeTemplateScoreArchive,
} from "../templateScoreArchive"
import type { HszDbInfo, HszSheetField } from "./types"
import { HSZ_KIND_TO_CROP_TYPE, HSZ_SKIP_KINDS, HSZ_SUBJECT_MAP } from "./types"

/**
 * .hszファイルを.score形式に変換
 */
export async function convertHszToScore(
  hszPath: string
): Promise<{ scorePath: string; originalTitle: string }> {
  try {
    // 1. .hszをZIPとして開く
    const hszZip = new AdmZip(hszPath)
    assertLegacyZipWithinLimits(hszZip)
    const entries = hszZip.getEntries()

    // 2. db_info.json を取得・パース
    const dbInfoEntry = entries.find(
      (entry) => entry.entryName === "db_info.json"
    )
    if (!dbInfoEntry) {
      throw new Error("db_info.json が見つかりません")
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

    // 4. ExamPages 生成（模範解答画像はページが持つ）
    const examPages = sheet_pages.map((sheetPage) => {
      const imgFileName = `correct_${sheetPage.page}.png`
      const hasImage = entries.some((entry) => entry.entryName === imgFileName)
      return {
        id: pageUuidMap.get(sheetPage.page)!,
        examId,
        pageNumber: sheetPage.page + 1, // Score at Onceは1始まり
        imagePath: hasImage ? imgFileName : "",
        pageSize: "A4",
        createdAt: now,
        updatedAt: now,
      }
    })

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

    // 9. .score ZIP ファイルを生成（模範解答画像は master-images/ にコピー）
    const masterImages = sheet_pages.flatMap((sheetPage) => {
      const imgFileName = `correct_${sheetPage.page}.png`
      const imgEntry = entries.find((entry) => entry.entryName === imgFileName)
      return imgEntry
        ? [{ fileName: imgFileName, image: imgEntry.getData() }]
        : []
    })

    const scorePath = writeTemplateScoreArchive({
      examId,
      examName: sheets.title_name,
      description: `百問繚乱からインポート（${subjectName}・${sheets.course}）`,
      schemaVersion: "hsz-import",
      sourceDbId: `hsz:${sheets.id}`,
      examPages,
      cropRegions,
      subtotalData,
      masterImages,
      tempDirPrefix: "hsz-convert-",
      now,
    })

    return {
      scorePath,
      originalTitle: sheets.title_name,
    }
  } catch (error) {
    console.error("Error converting HSZ to Score:", error)
    throw error
  }
}

/** convertFieldsToCropRegions の結果 */
interface HszCropRegionsResult {
  regions: ConvertedCropRegion[]
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
): ConvertedSubtotalData {
  const subtotalData = createEmptySubtotalData()

  // 1. 「大問」SubtotalGroup（part1を数値順に並べる）
  if (part1ToCropIds.size > 0) {
    appendSubtotalGroup(
      subtotalData,
      {
        groupName: "大問",
        subtotals: Array.from(part1ToCropIds.keys())
          .sort((part1A, part1B) => parseInt(part1A, 10) - parseInt(part1B, 10))
          .map((part1) => ({ key: part1, name: `大問${part1}` })),
        questionAssignments: Array.from(
          part1ToCropIds,
          ([part1, cropRegionIds]) => ({ key: part1, cropRegionIds })
        ),
        definitionAssignments: Array.from(
          scorePCropIdByPart1,
          ([part1, cropRegionId]) => ({ key: part1, cropRegionId })
        ),
      },
      examId,
      now
    )
  }

  // 2. 「観点」SubtotalGroup（regionを数値順に並べる）
  if (regionToCropIds.size > 0) {
    appendSubtotalGroup(
      subtotalData,
      {
        groupName: "観点",
        subtotals: Array.from(regionToCropIds.keys())
          .sort(
            (regionA, regionB) => parseInt(regionA, 10) - parseInt(regionB, 10)
          )
          .map((region) => ({ key: region, name: `観点${region}` })),
        questionAssignments: Array.from(
          regionToCropIds,
          ([region, cropRegionIds]) => ({ key: region, cropRegionIds })
        ),
        definitionAssignments: Array.from(
          scoreRCropIdByRegion,
          ([region, cropRegionId]) => ({ key: region, cropRegionId })
        ),
      },
      examId,
      now
    )
  }

  return subtotalData
}
