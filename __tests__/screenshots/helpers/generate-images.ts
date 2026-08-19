/**
 * スクリーンショット用の画像・採点領域定義
 *
 * ASBテンプレートから computeMultiPageLayoutFromDefinition でレイアウト計算し、
 * 正確な正規化座標を取得する。
 * マスター画像はテスト実行時にASBプレビューからキャプチャして上書きする。
 */

import * as fs from "fs"
import * as path from "path"
import sharp from "sharp"

import { computeMultiPageLayoutFromDefinition } from "@/components/answer-sheet-builder/hooks/layout/computeMultiPageLayout"
import type {
  AnswerSheetDefinition,
  BorderLineStyle,
  BranchQuestion,
  HeaderFieldType,
  LinkedRegionType,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

// 解答用紙（B4, 200dpi相当）の画像サイズ
const SHEET_WIDTH = 2024
const SHEET_HEIGHT = 2866

interface RegionDef {
  label: string
  x: number
  y: number
  width: number
  height: number
  points: number
  orderIndex: number
}

/**
 * ASBテンプレートJSONから AnswerSheetDefinition を構築
 */
function templateToDefinition(
  template: Record<string, unknown>
): AnswerSheetDefinition {
  const templateRecord = template as Record<string, unknown>
  const headerFields = (
    templateRecord.headerFields as Array<Record<string, unknown>>
  ).map((headerField) => ({
    id: headerField.id as string,
    type: ((headerField.type as string) ?? "field") as HeaderFieldType,
    label: headerField.label as string,
    widthMm: headerField.widthMm as number,
    heightMm: headerField.heightMm as number,
    gridCount: headerField.gridCount as number,
    lineStyle: headerField.lineStyle as BorderLineStyle,
    lineWidth: headerField.lineWidth as number,
    order: headerField.order as number,
    fontSize: (headerField.fontSize as number) ?? undefined,
    linkedRegionType:
      (headerField.linkedRegionType as LinkedRegionType) ?? undefined,
  }))

  const majorQuestions = (
    templateRecord.majorQuestions as Array<Record<string, unknown>>
  ).map((majorQuestion) => ({
    id: majorQuestion.id as string,
    label: majorQuestion.label as string,
    subQuestions: (
      majorQuestion.subQuestions as Array<Record<string, unknown>>
    ).map((subQuestion): SubQuestion => {
      const manuscriptPaper = subQuestion.manuscriptEnabled
        ? {
            enabled: true as const,
            columns: subQuestion.manuscriptColumns as number,
            rows: subQuestion.manuscriptRows as number,
          }
        : undefined
      return {
        id: subQuestion.id as string,
        label: subQuestion.label as string,
        branchQuestions: (
          (subQuestion.branchQuestions as Array<Record<string, unknown>>) || []
        ).map((branchQuestion): BranchQuestion => ({
          id: branchQuestion.id as string,
          label: branchQuestion.label as string,
          heightMultiplier: branchQuestion.heightMultiplier as number,
          points: branchQuestion.points as number,
          textElements: [],
          imageElements: [],
          layoutWidth: (branchQuestion.layoutWidth as string) ?? undefined,
          nextPlacement:
            (branchQuestion.nextPlacement as BranchQuestion["nextPlacement"]) ??
            undefined,
          goUp: (branchQuestion.goUp as number) ?? undefined,
        })),
        heightMultiplier: subQuestion.heightMultiplier as number,
        points: subQuestion.points as number,
        textElements: (
          (subQuestion.textElements as Array<Record<string, unknown>>) || []
        ).map((textElement) => ({
          id: (textElement.id as string) ?? crypto.randomUUID(),
          text: textElement.text as string,
          fontSize: textElement.fontSize as number,
          horizontalAlign:
            (textElement.horizontalAlign as "left" | "center" | "right") ??
            "left",
          verticalAlign:
            (textElement.verticalAlign as "top" | "middle" | "bottom") ?? "top",
        })),
        imageElements: [],
        manuscriptPaper,
        layoutWidth: (subQuestion.layoutWidth as string) ?? undefined,
        nextPlacement:
          (subQuestion.nextPlacement as SubQuestion["nextPlacement"]) ??
          undefined,
        goUp: (subQuestion.goUp as number) ?? undefined,
        usesBranchPoints:
          (subQuestion.usesBranchPoints as boolean) ?? undefined,
      }
    }),
  }))

  return {
    id: templateRecord.id as string,
    name: templateRecord.name as string,
    settings: {
      paperSize: templateRecord.paperSize as "B4",
      orientation: templateRecord.orientation as "portrait",
      baseRowHeight: templateRecord.baseRowHeight as number,
      numberDisplayMode: templateRecord.numberDisplayMode as "multirow",
      margins: {
        top: templateRecord.marginTop as number,
        bottom: templateRecord.marginBottom as number,
        left: templateRecord.marginLeft as number,
        right: templateRecord.marginRight as number,
      },
      columnWidths: {
        majorNumber: templateRecord.colWidthMajorNumber as number,
        subNumber: templateRecord.colWidthSubNumber as number,
        branchNumber: templateRecord.colWidthBranchNumber as number,
      },
      spacing: {
        majorQuestionSpacing: templateRecord.majorQuestionSpacing as number,
        headerHeight: templateRecord.headerHeight as number,
      },
      borderConfig: {
        outerBorder: templateRecord.borderOuterBorder as BorderLineStyle,
        majorDivider: templateRecord.borderMajorDivider as BorderLineStyle,
        subDivider: templateRecord.borderSubDivider as BorderLineStyle,
        branchDivider: templateRecord.borderBranchDivider as BorderLineStyle,
        majorNumberDivider:
          templateRecord.borderMajorNumberDivider as BorderLineStyle,
        subNumberDivider:
          templateRecord.borderSubNumberDivider as BorderLineStyle,
        branchNumberDivider:
          templateRecord.borderBranchNumberDivider as BorderLineStyle,
        outerBorderWidth:
          (templateRecord.borderOuterBorderWidth as number) ?? undefined,
        majorDividerWidth:
          (templateRecord.borderMajorDividerWidth as number) ?? undefined,
        subDividerWidth:
          (templateRecord.borderSubDividerWidth as number) ?? undefined,
        branchDividerWidth:
          (templateRecord.borderBranchDividerWidth as number) ?? undefined,
        majorNumberDividerWidth:
          (templateRecord.borderMajorNumberDividerWidth as number) ?? undefined,
        subNumberDividerWidth:
          (templateRecord.borderSubNumberDividerWidth as number) ?? undefined,
        branchNumberDividerWidth:
          (templateRecord.borderBranchNumberDividerWidth as number) ??
          undefined,
      },
      omrMarkers: {
        enabled: templateRecord.omrMarkersEnabled as boolean,
        sizeMm: templateRecord.omrMarkersSizeMm as number,
        offsetMm: templateRecord.omrMarkersOffsetMm as number,
      },
      fonts: {
        family: templateRecord.fontFamily as string,
        defaultSize: templateRecord.fontDefaultSize as number,
        majorNumberSize: templateRecord.fontMajorNumberSize as number,
        subNumberSize: templateRecord.fontSubNumberSize as number,
        branchNumberSize: templateRecord.fontBranchNumberSize as number,
      },
      multiColumn: {
        enabled: templateRecord.multiColumnEnabled as boolean,
        columnCount: (templateRecord.multiColumnCount as 2 | 3) ?? 2,
        columnGapMm: templateRecord.multiColumnGapMm as number,
        dividerLine:
          (templateRecord.multiColumnDividerLine as BorderLineStyle) ?? null,
        dividerLineWidth:
          (templateRecord.multiColumnDividerLineWidth as number) ?? 0.3,
      },
      headerFields,
    },
    majorQuestions,
    labelPresets: {
      major: (templateRecord.labelPresetMajor as string) ?? undefined,
      sub: (templateRecord.labelPresetSub as string) ?? undefined,
      branch: (templateRecord.labelPresetBranch as string) ?? undefined,
    },
  }
}

/**
 * ASBテンプレートからレイアウト計算し、answerセルの正規化座標を取得
 */
export function computeRegionDefinitions(templatePath: string): RegionDef[] {
  const template = JSON.parse(fs.readFileSync(templatePath, "utf-8"))
  const definition = templateToDefinition(template)
  const layout = computeMultiPageLayoutFromDefinition(definition)

  // ページ0の answer セルのみ取得
  const page0 = layout.pages[0]
  if (!page0) return []

  const answerCells = page0.cells.filter((cell) => cell.cellType === "answer")

  // examConverter と同じロジック: usesBranchPoints === false の枝問は統合
  const mergedCells: Array<{
    label: string
    normalizedX: number
    normalizedY: number
    normalizedW: number
    normalizedH: number
    points: number
  }> = []
  const processedKeys = new Set<string>()

  for (const cell of answerCells) {
    const [majorIndex, subIndex, branchIndex] = cell.questionPath
    const isBranch = branchIndex !== undefined

    if (isBranch) {
      const key = `${majorIndex}-${subIndex}`
      if (processedKeys.has(key)) continue

      const sub = definition.majorQuestions[majorIndex]?.subQuestions[subIndex]
      if (sub?.usesBranchPoints === false) {
        processedKeys.add(key)
        const siblings = answerCells.filter(
          (siblingCell) =>
            siblingCell.questionPath[0] === majorIndex &&
            siblingCell.questionPath[1] === subIndex &&
            siblingCell.questionPath.length === 3
        )
        const minX = Math.min(
          ...siblings.map((siblingCell) => siblingCell.normalizedX)
        )
        const minY = Math.min(
          ...siblings.map((siblingCell) => siblingCell.normalizedY)
        )
        const maxX = Math.max(
          ...siblings.map(
            (siblingCell) => siblingCell.normalizedX + siblingCell.normalizedW
          )
        )
        const maxY = Math.max(
          ...siblings.map(
            (siblingCell) => siblingCell.normalizedY + siblingCell.normalizedH
          )
        )
        mergedCells.push({
          label: sub.label,
          normalizedX: minX,
          normalizedY: minY,
          normalizedW: maxX - minX,
          normalizedH: maxY - minY,
          points: sub.points,
        })
        continue
      }
    }

    mergedCells.push({
      label: cell.label,
      normalizedX: cell.normalizedX,
      normalizedY: cell.normalizedY,
      normalizedW: cell.normalizedW,
      normalizedH: cell.normalizedH,
      points: cell.points,
    })
  }

  return mergedCells.map((cell, i) => ({
    label: cell.label,
    x: cell.normalizedX,
    y: cell.normalizedY,
    width: cell.normalizedW,
    height: cell.normalizedH,
    points: cell.points,
    orderIndex: i,
  }))
}

// ---------------------------------------------------------------------------
// 正解データ（各設問の模範解答テキスト）
// ---------------------------------------------------------------------------
const CORRECT_ANSWERS: Record<string, string> = {
  "1-(1)-ア": "3",
  "1-(1)-イ": "−5",
  "1-(1)-ウ": "7",
  "1-(1)-エ": "−2",
  "1-(2)": "3",
  "1-(3)": "(2, 3)",
  "2-(1)": "2x + 3y = 12\nx − y = 1\nを加減法で解く\n3x = 15\nx = 5, y = 4",
  "2-(2)": "6n − 3",
  "2-(3)": "1/2",
  "": "△ABCにおいて\n中点連結定理より\nDE//BC\nDE = 1/2 BC\nよって四角形DBCEは\n台形である",
  "4-(1)": "辺AD, 辺DC, 辺EH, 辺HG",
  "4-(2)": "80π",
  "4-(3)": "12/5",
  "5-(1)": "0.4",
  "5-(2)": "ウ",
  "6-(1)": "(3, 2)",
  "6-(2)-ア": "y = 2x − 4",
  "6-(2)-イ":
    "y = 2x − 4 と\ny = −x + 5 の交点\n2x − 4 = −x + 5\n3x = 9\nx = 3, y = 2\nよって (3, 2)",
  "7-(1)":
    "△AOCと△BODにおいて\n半径は等しいから\nOA = OB = OC = OD …①\n①より△OAC, △OBDは\n二等辺三角形だから\n∠OAC = ∠OCA …②\n∠OBD = ∠ODB …③\n仮定より\n∠BAC = ∠ABD\nすなわち\n∠OAC = ∠OBD …④\nよって①②③④より\n△AOC ≡ △BOD",
  "7-(2)": "108",
}

// 誤答パターン（各設問に対する典型的な間違い）
const WRONG_ANSWERS: Record<string, string[]> = {
  "1-(1)-ア": ["4", "−3", "2"],
  "1-(1)-イ": ["5", "−3", "4"],
  "1-(1)-ウ": ["−7", "5", "8"],
  "1-(1)-エ": ["2", "−4", "3"],
  "1-(2)": ["−3", "9", "4"],
  "1-(3)": ["(3, 2)", "(−2, 3)", "(2, −3)"],
  "2-(1)": ["x + y = 5\nよくわからない", "2x + 3y = 12\nx = 4, y = 2", ""],
  "2-(2)": ["6n + 3", "3n − 6", "6n"],
  "2-(3)": ["2", "1/3", "−1/2"],
  "": ["△ABCで\n中点連結定理？\nよくわからない", "DE = BC\nDE//BC", ""],
  "4-(1)": ["辺AB, 辺BC", "辺AD, 辺EH", "辺AB, 辺DC, 辺EF"],
  "4-(2)": ["160π", "40π", "80"],
  "4-(3)": ["12", "5/12", "2"],
  "5-(1)": ["0.6", "4", "0.2"],
  "5-(2)": ["ア", "イ", "エ"],
  "6-(1)": ["(2, 3)", "(−3, 2)", "(3, −2)"],
  "6-(2)-ア": ["y = x − 4", "y = −2x + 4", "y = 2x + 4"],
  "6-(2)-イ": [
    "y = 2x − 4\ny = −x + 5\nを代入して\n計算ミス…\nx = 2",
    "わからない",
    "",
  ],
  "7-(1)": [
    "△AOCと△BODで\nOA = OB …①\n仮定より\n∠BAC = ∠ABD\nよって合同",
    "△AOCと△BODにおいて\nよくわからない",
    "",
  ],
  "7-(2)": ["120", "72", "144"],
}

// ---------------------------------------------------------------------------
// 手書きフォントプール（生徒ごとに異なるフォントを使用）
// ---------------------------------------------------------------------------
const HANDWRITE_FONTS = [
  "Natsume, なつめもじ",
  "Yomogi",
  "Klee One, クレー One",
  "Zen Kurenaido",
  "GenEi POPle, 源暎ぽっぷる",
  "Hiragino Maru Gothic ProN, ヒラギノ丸ゴ ProN",
]

function pickFont(seed: number): string {
  return HANDWRITE_FONTS[seed % HANDWRITE_FONTS.length]
}

/**
 * SVGエスケープ
 */
function svgEsc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * 手書き風テキストSVGを生成
 */
function createHandwrittenSvg(
  text: string,
  width: number,
  height: number,
  color: string = "#1a1a1a",
  seed: number = 0
): string {
  const lines = text.split("\n")
  const isLargeArea = height > 200
  const fontFamily = pickFont(seed)

  // フォントサイズ計算: 採点グリッドのカード表示時にも読める大きさ
  // カードは元画像の約1/3〜1/4に縮小されるため、元画像上で十分大きく描画する
  let fontSize: number
  if (isLargeArea) {
    // 大きい領域（証明等）: 行数に応じたサイズ、最小52px
    fontSize = Math.max(
      52,
      Math.min(80, Math.floor((height / (lines.length + 1)) * 0.9))
    )
  } else {
    // 小さい領域: 高さの80%を目安に、大きめに描画
    const byHeight = Math.floor(height * 0.8)
    const maxTextLen = Math.max(...lines.map((line) => line.length), 1)
    const byWidth = Math.floor((width / maxTextLen) * 1.8)
    fontSize = Math.max(64, Math.min(byHeight, byWidth, 140))
  }

  const lineHeight = fontSize * 1.35
  const startY = isLargeArea
    ? fontSize + 16
    : (height - lines.length * lineHeight) / 2 + fontSize * 0.8

  let tspans = ""
  for (let i = 0; i < lines.length; i++) {
    const dx = ((seed + i * 3) % 7) - 3
    const dy = ((seed + i * 7) % 5) - 2
    const y = startY + i * lineHeight + dy
    const x = isLargeArea ? 20 + dx : width / 2 + dx
    tspans += `<tspan x="${x}" y="${y}">${svgEsc(lines[i])}</tspan>`
  }

  const rotation = ((seed % 7) - 3) * 0.4
  const anchor = isLargeArea ? "start" : "middle"

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text
    font-family="${svgEsc(fontFamily)}, sans-serif"
    font-size="${fontSize}"
    fill="${color}"
    text-anchor="${anchor}"
    transform="rotate(${rotation.toFixed(1)}, ${width / 2}, ${height / 2})"
  >${tspans}</text>
</svg>`
}

/**
 * 生徒答案画像を生成（マスター画像 + 手書き風解答オーバーレイ）
 */
export async function generateStudentAnswerImage(
  outputDir: string,
  studentIndex: number,
  studentId: string,
  masterDir: string,
  regions?: RegionDef[],
  scores?: { regionIndex: number; score: number; status: string }[]
): Promise<string> {
  fs.mkdirSync(outputDir, { recursive: true })
  const masterPath = path.join(masterDir, "master-page-1.png")
  const outputPath = path.join(outputDir, `${studentId}_page1.png`)

  if (!fs.existsSync(masterPath) || !regions || !scores) {
    if (fs.existsSync(masterPath)) fs.copyFileSync(masterPath, outputPath)
    return outputPath
  }

  const masterMeta = await sharp(masterPath).metadata()
  const imgW = masterMeta.width || SHEET_WIDTH
  const imgH = masterMeta.height || SHEET_HEIGHT

  const composites: { input: Buffer; left: number; top: number }[] = []

  for (const score of scores) {
    const region = regions[score.regionIndex]
    if (!region) continue

    const rx = Math.round(region.x * imgW)
    const ry = Math.round(region.y * imgH)
    const rw = Math.round(region.width * imgW)
    const rh = Math.round(region.height * imgH)

    if (rw < 5 || rh < 5) continue

    let answerText: string
    const correctAns = CORRECT_ANSWERS[region.label] ?? ""
    const wrongPool = WRONG_ANSWERS[region.label] ?? ["?"]

    if (score.status === "correct") {
      answerText = correctAns
    } else if (score.status === "partial") {
      // 部分点: 正解の一部を書く or 途中まで
      const partial =
        wrongPool[0] ?? correctAns.split("\n").slice(0, 2).join("\n")
      answerText = partial
    } else {
      // 誤答: 間違った答えをseedに応じて選ぶ
      const wrongIndex = (studentIndex + score.regionIndex) % wrongPool.length
      answerText = wrongPool[wrongIndex]
    }

    if (!answerText) continue

    const color = score.status === "correct" ? "#1a1a1a" : "#1a1a1a"
    const svg = createHandwrittenSvg(
      answerText,
      rw,
      rh,
      color,
      studentIndex * 7 + score.regionIndex
    )
    composites.push({
      input: Buffer.from(svg),
      left: rx,
      top: ry,
    })
  }

  if (composites.length > 0) {
    await sharp(masterPath).composite(composites).png().toFile(outputPath)
  } else {
    fs.copyFileSync(masterPath, outputPath)
  }

  return outputPath
}

/**
 * 模範解答画像を生成（マスター画像 + 正答テキストを赤インクでオーバーレイ）
 * 採点画面の「模範解答」カードに正答が表示されるようにする
 */
export async function generateMasterAnswerImage(
  masterDir: string,
  regions: RegionDef[]
): Promise<void> {
  const masterPath = path.join(masterDir, "master-page-1.png")
  if (!fs.existsSync(masterPath)) return

  const masterMeta = await sharp(masterPath).metadata()
  const imgW = masterMeta.width || SHEET_WIDTH
  const imgH = masterMeta.height || SHEET_HEIGHT

  const composites: { input: Buffer; left: number; top: number }[] = []

  for (const region of regions) {
    const rx = Math.round(region.x * imgW)
    const ry = Math.round(region.y * imgH)
    const rw = Math.round(region.width * imgW)
    const rh = Math.round(region.height * imgH)

    if (rw < 5 || rh < 5) continue

    const correctAns = CORRECT_ANSWERS[region.label] ?? ""
    if (!correctAns) continue

    // 模範解答は赤インクで、きれいなフォント（Klee One）で書く
    const svg = createHandwrittenSvg(
      correctAns,
      rw,
      rh,
      "#cc0000",
      region.orderIndex * 3
    )
    composites.push({
      input: Buffer.from(svg),
      left: rx,
      top: ry,
    })
  }

  if (composites.length > 0) {
    // 元のマスター画像を一旦バックアップ → 上書き
    const tempPath = masterPath + ".bak"
    fs.copyFileSync(masterPath, tempPath)
    await sharp(tempPath).composite(composites).png().toFile(masterPath)
    fs.unlinkSync(tempPath)
  }
}

/**
 * 生徒の採点結果を決定的に生成
 */
export function generateStudentScores(
  studentIndex: number,
  regions: RegionDef[]
): { regionIndex: number; score: number; status: string }[] {
  const seed = studentIndex * 7 + 3
  return regions.map((region) => {
    const hash = (seed + region.orderIndex * 13) % 100
    if (hash < 60) {
      return {
        regionIndex: region.orderIndex,
        score: region.points,
        status: "correct",
      }
    } else if (hash < 80) {
      const partial = Math.max(1, Math.floor(region.points * 0.5))
      return {
        regionIndex: region.orderIndex,
        score: partial,
        status: "partial",
      }
    } else {
      return { regionIndex: region.orderIndex, score: 0, status: "incorrect" }
    }
  })
}
