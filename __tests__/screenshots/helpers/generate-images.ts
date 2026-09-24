/**
 * スクリーンショット用の画像・採点領域定義
 *
 * ASBテンプレートから computeMultiPageLayoutFromDefinition でレイアウト計算し、
 * 正確な正規化座標を取得する。
 * マスター画像はテスト実行時にASBプレビューからキャプチャして上書きする。
 */

import * as fs from "fs"
import * as path from "path"
import sharp, { type OverlayOptions, type Sharp } from "sharp"

import { computeMultiPageLayoutFromDefinition } from "@/components/answer-sheet-builder/hooks/layout/computeMultiPageLayout"
import type {
  AnswerSheetDefinition,
  BorderLineStyle,
  BranchQuestion,
  HeaderFieldType,
  LinkedRegionType,
  ManuscriptPaper,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"
import { toManuscriptGuidePosition } from "@/types/answerSheetDefinition.types"

import { readScreenshotTemplate } from "./screenshotTemplate"

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
      const manuscriptPaperRecord = subQuestion.manuscriptPaper as
        Record<string, unknown> | undefined
      const manuscriptPaper: ManuscriptPaper | undefined = manuscriptPaperRecord
        ? {
            id: manuscriptPaperRecord.id as string,
            enabled: manuscriptPaperRecord.enabled as boolean,
            columns: manuscriptPaperRecord.columns as number,
            rows: manuscriptPaperRecord.rows as number,
            guideFontSize:
              (manuscriptPaperRecord.guideFontSize as number | null) ?? null,
            guidePosition:
              typeof manuscriptPaperRecord.guidePosition === "string"
                ? toManuscriptGuidePosition(manuscriptPaperRecord.guidePosition)
                : null,
            guidePadding:
              (manuscriptPaperRecord.guidePadding as number | null) ?? null,
            charGuides: [],
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
    description: null,
    referenceDate: null,
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
  const template = readScreenshotTemplate(templatePath)
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
        // アプリの examConverter と同じ形（「大問-小問」、小問が無名なら大問だけ）
        const majorLabel = definition.majorQuestions[majorIndex]?.label ?? ""
        mergedCells.push({
          label: [majorLabel, sub.label].filter(Boolean).join("-"),
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

/** 解答用紙の記入欄（受験番号・氏名など）の位置。座標は用紙に対する割合 */
export interface HeaderFieldBox {
  label: string
  x: number
  y: number
  width: number
  height: number
  /** 桁ごとの升目の数（受験番号）。升目が無ければ 0 */
  gridCount: number
}

/**
 * ASBテンプレートから記入欄の位置を取る
 *
 * 答案に生徒の受験番号と氏名を書き込むのに使う。答案アップロードの確認画面は
 * 氏名欄を拡大して生徒名と照合する画面なので、ここが空だと図が成り立たない。
 */
export function computeHeaderFieldBoxes(
  templatePath: string
): HeaderFieldBox[] {
  const template = readScreenshotTemplate(templatePath)
  const layout = computeMultiPageLayoutFromDefinition(
    templateToDefinition(template)
  )
  const page0 = layout.pages[0]
  if (!page0) return []
  return page0.headerFields
    .filter((headerField) => headerField.type === "field")
    .map((headerField) => ({
      label: headerField.label,
      x: headerField.x / layout.pageWidthMm,
      y: headerField.y / layout.pageHeightMm,
      width: headerField.width / layout.pageWidthMm,
      height: headerField.height / layout.pageHeightMm,
      gridCount: headerField.gridCount,
    }))
}

/** 答案の記入欄に書く生徒の情報 */
export interface StudentHeader {
  /** 受験番号（升目の数に合わせた桁の数字） */
  examineeNumber: string
  /** 氏名 */
  name: string
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
  // 欄に「(x, y) = (   ,   )」が印刷されているので、空欄ごとに分けて持つ
  "1-(3)": "2|3",
  "2-(1)": "2x + 3y = 12\nx − y = 1\nを加減法で解く\n3x = 15\nx = 5, y = 4",
  "2-(2)": "6n − 3",
  "2-(3)": "1/2",
  "3": "△ABCにおいて\n中点連結定理より\nDE//BC\nDE = 1/2 BC\nよって四角形DBCEは\n台形である",
  "4-(1)": "辺AD, 辺DC, 辺EH, 辺HG",
  "4-(2)": "80π",
  "4-(3)": "12/5",
  "5-(1)": "0.4",
  "5-(2)": "ウ",
  // 欄に「(   ,   )」が印刷されている
  "6-(1)": "3|2",
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
  "1-(3)": ["3|2", "−2|3", "2|−3"],
  "2-(1)": ["x + y = 5\nよくわからない", "2x + 3y = 12\nx = 4, y = 2", ""],
  "2-(2)": ["6n + 3", "3n − 6", "6n"],
  "2-(3)": ["2", "1/3", "−1/2"],
  "3": ["△ABCで\n中点連結定理？\nよくわからない", "DE = BC\nDE//BC", ""],
  "4-(1)": ["辺AB, 辺BC", "辺AD, 辺EH", "辺AB, 辺DC, 辺EF"],
  "4-(2)": ["160π", "40π", "80"],
  "4-(3)": ["12", "5/12", "2"],
  "5-(1)": ["0.6", "4", "0.2"],
  "5-(2)": ["ア", "イ", "エ"],
  "6-(1)": ["2|3", "−3|2", "3|−2"],
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
// 手書き風の文字
// ---------------------------------------------------------------------------

/**
 * 生徒の筆跡に使うフォント。**1人の生徒は1つのフォントで書く**（設問ごとに
 * 変えると、1枚の答案の中で筆跡が入れ替わる不自然な絵になる）。
 *
 * 撮った図は公式サイトで公開するので、**商用でも自由に使える SIL Open Font
 * License のフォントだけ**を使う（どれも Google Fonts で配布されている）。
 * 撮影機にインストールされている前提（sharp の SVG 描画は fontconfig でフォントを
 * 探す）。無ければ sans-serif に落ちて活字の答案になるので、撮った絵で筆跡に
 * 見えるかを確かめること。
 */
const STUDENT_HANDWRITING_FONTS = ["Yomogi", "Klee One", "Zen Kurenaido"]

/** 模範解答の赤字（教員が丁寧に書いた字） */
const MODEL_ANSWER_FONT = "Klee One"
const MODEL_ANSWER_COLOR = "#cc0000"
const STUDENT_INK_COLOR = "#1a1a1a"

/**
 * 答えの区切り。解答欄に `(x, y) = (   ,   )` のような文字が印刷されている設問は、
 * 答えを空欄ごとに分けて持つ（`"2|3"` なら1つ目の空欄に 2、2つ目に 3）。
 */
const ANSWER_PART_SEPARATOR = "|"

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
 * 1行の幅を em 単位で見積もる
 *
 * sharp（librsvg）には文字幅を測る口が無いので、全角を 1em、半角を 0.6em、
 * 空白を 0.35em として足す。手書き風フォントは字幅の揺れが大きいので、
 * 収める側（`fitFontSize`）で余白を取る。
 */
function estimateLineWidthEm(line: string): number {
  let widthEm = 0
  for (const character of line) {
    if (character === " ") widthEm += 0.35
    else if (/[ -~]/.test(character)) widthEm += 0.6
    else widthEm += 1
  }
  return widthEm
}

/**
 * 枠に収まる文字の大きさ（px）
 *
 * 高さは行数、幅はいちばん長い行で決まる。どちらからも溢れない方を取る。
 * 下限を設けない。**欄から溢れた答案は、欄に収まった小さい字より不自然**なので。
 */
function fitFontSize(lines: string[], width: number, height: number): number {
  const longestLineEm = Math.max(...lines.map(estimateLineWidthEm), 1)
  const byWidth = (width * 0.88) / longestLineEm
  const byHeight =
    lines.length === 1 ? height * 0.68 : (height * 0.9) / (lines.length * 1.3)
  return Math.floor(Math.min(byWidth, byHeight, lines.length === 1 ? 110 : 72))
}

/** 答えを書く矩形（画像上の px） */
interface WritingSlot {
  left: number
  top: number
  width: number
  height: number
}

/**
 * 解答欄の中で、印刷された文字や罫線の無い横の区間を探す
 *
 * 白紙の解答用紙の画素を見る。欄いっぱいに引かれた横線（罫線）の行は除いてから
 * 列ごとの墨の有無を数えるので、枝問をまとめた欄の中の仕切り線には反応しない。
 *
 * @returns 墨の無い区間（左から順）と、墨があった範囲の左端・右端
 */
async function findBlankColumnRuns(
  blankSheet: Sharp,
  slot: WritingSlot
): Promise<{
  runs: { start: number; end: number }[]
  firstInk: number | null
  lastInk: number | null
}> {
  const { data, info } = await blankSheet
    .clone()
    .extract(slot)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const isInk = (x: number, y: number) => data[y * info.width + x] < 160
  const textRows: number[] = []
  for (let y = 0; y < info.height; y++) {
    let inkCount = 0
    for (let x = 0; x < info.width; x++) if (isInk(x, y)) inkCount++
    if (inkCount < info.width * 0.5) textRows.push(y)
  }

  const columnHasInk: boolean[] = []
  for (let x = 0; x < info.width; x++) {
    let inkCount = 0
    for (const y of textRows) if (isInk(x, y)) inkCount++
    columnHasInk.push(inkCount > 2)
  }

  const runs: { start: number; end: number }[] = []
  let runStart: number | null = null
  columnHasInk.forEach((hasInk, x) => {
    if (!hasInk && runStart === null) runStart = x
    if (hasInk && runStart !== null) {
      runs.push({ start: runStart, end: x })
      runStart = null
    }
  })
  if (runStart !== null) runs.push({ start: runStart, end: info.width })

  const firstInk = columnHasInk.indexOf(true)
  const lastInk = columnHasInk.lastIndexOf(true)
  return {
    runs,
    firstInk: firstInk === -1 ? null : firstInk,
    lastInk: lastInk === -1 ? null : lastInk,
  }
}

/**
 * 答えの各部分を書く矩形を決める
 *
 * - 欄に何も印刷されていなければ、欄の内側いっぱい
 * - 答えが1つなら、印刷の無い区間のうちいちばん広いところ
 *   （`80π` を `cm³` の左に、`108` を `°` の左に書く）
 * - 答えが複数なら、印刷に挟まれた区間を広い順に取り、左から割り当てる
 *   （`(x, y) = (   ,   )` の2つの空欄）
 */
async function planWritingSlots(
  blankSheet: Sharp,
  region: WritingSlot,
  partCount: number
): Promise<WritingSlot[]> {
  // 欄の縁の罫線を避ける
  const inset = Math.max(
    8,
    Math.round(Math.min(region.width, region.height) * 0.06)
  )
  const inner: WritingSlot = {
    left: region.left + inset,
    top: region.top + inset,
    width: region.width - inset * 2,
    height: region.height - inset * 2,
  }
  if (inner.width < 10 || inner.height < 10) return []

  const { runs, firstInk, lastInk } = await findBlankColumnRuns(
    blankSheet,
    inner
  )
  if (firstInk === null || lastInk === null) return [inner]

  const minimumRunWidth = Math.max(24, inner.height * 0.5)
  const wideRuns = runs.filter((run) => run.end - run.start >= minimumRunWidth)
  const candidates =
    partCount >= 2
      ? wideRuns.filter((run) => run.start > firstInk && run.end <= lastInk)
      : wideRuns
  const chosen = [...candidates]
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, partCount)
    .sort((a, b) => a.start - b.start)

  return chosen.map((run) => ({
    left: inner.left + run.start,
    top: inner.top,
    width: run.end - run.start,
    height: inner.height,
  }))
}

/**
 * 複数行の答え（途中式・証明）を書く矩形を決める
 *
 * 枝問をまとめた欄は中に仕切りの横線を持つ（大問3は証明の欄と空欄が1つの
 * 設問になっている）。欄全体に書くと文字が線をまたぐので、横線で区切られた段の
 * うちいちばん高いところに書く。欄の中に印刷された文字は無い前提。
 */
async function planMultiLineSlot(
  blankSheet: Sharp,
  region: WritingSlot
): Promise<WritingSlot[]> {
  const inset = Math.max(
    8,
    Math.round(Math.min(region.width, region.height) * 0.04)
  )
  const inner: WritingSlot = {
    left: region.left + inset,
    top: region.top + inset,
    width: region.width - inset * 2,
    height: region.height - inset * 2,
  }
  if (inner.width < 10 || inner.height < 10) return []

  const { data, info } = await blankSheet
    .clone()
    .extract(inner)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const isRuleRow = (y: number) => {
    let inkCount = 0
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] < 160) inkCount++
    }
    return inkCount >= info.width * 0.5
  }

  let tallestBand = { start: 0, end: 0 }
  let bandStart = 0
  for (let y = 0; y <= info.height; y++) {
    if (y === info.height || isRuleRow(y)) {
      if (y - bandStart > tallestBand.end - tallestBand.start) {
        tallestBand = { start: bandStart, end: y }
      }
      bandStart = y + 1
    }
  }

  // 線のすぐ際に字が付かないよう、段の上下に少し余白を取る
  const bandMargin = Math.min(inset, (tallestBand.end - tallestBand.start) / 10)
  return [
    {
      left: inner.left,
      top: Math.round(inner.top + tallestBand.start + bandMargin),
      width: inner.width,
      height: Math.round(tallestBand.end - tallestBand.start - bandMargin * 2),
    },
  ]
}

/**
 * 手書き風の文字を1つの矩形に描く SVG
 *
 * 1行なら中央寄せ、複数行（途中式・証明）なら左寄せで上から書く。行ごとに
 * わずかに位置を揺らし、全体を少し傾けて、活字の整列感を崩す。
 */
function createHandwrittenSvg(
  text: string,
  width: number,
  height: number,
  fontFamily: string,
  color: string,
  seed: number
): string {
  const lines = text.split("\n")
  const fontSize = fitFontSize(lines, width, height)
  const lineHeight = fontSize * 1.3
  const isSingleLine = lines.length === 1
  const firstBaseline = isSingleLine
    ? height / 2 + fontSize * 0.36
    : Math.max(fontSize, (height - lines.length * lineHeight) / 2 + fontSize)

  let tspans = ""
  for (let i = 0; i < lines.length; i++) {
    const jitterX = (((seed + i * 3) % 5) - 2) * (fontSize * 0.04)
    const jitterY = (((seed + i * 7) % 5) - 2) * (fontSize * 0.03)
    const x = isSingleLine ? width / 2 + jitterX : fontSize * 0.2 + jitterX
    const y = firstBaseline + i * lineHeight + jitterY
    tspans += `<tspan x="${x.toFixed(1)}" y="${y.toFixed(1)}">${svgEsc(lines[i])}</tspan>`
  }

  const rotation = ((seed % 5) - 2) * 0.35
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text
    font-family="${svgEsc(fontFamily)}, sans-serif"
    font-size="${fontSize}"
    fill="${color}"
    text-anchor="${isSingleLine ? "middle" : "start"}"
    transform="rotate(${rotation.toFixed(2)}, ${width / 2}, ${height / 2})"
  >${tspans}</text>
</svg>`
}

/**
 * 1つの解答欄に答えを書く合成部品を作る
 *
 * @param blankSheet - 白紙の解答用紙（印刷された文字の位置を知るため）
 */
async function composeAnswerInRegion(
  blankSheet: Sharp,
  region: RegionDef,
  answerText: string,
  sheetSize: { width: number; height: number },
  pen: { fontFamily: string; color: string; seed: number }
): Promise<OverlayOptions[]> {
  const regionBox: WritingSlot = {
    left: Math.round(region.x * sheetSize.width),
    top: Math.round(region.y * sheetSize.height),
    width: Math.round(region.width * sheetSize.width),
    height: Math.round(region.height * sheetSize.height),
  }
  const parts = answerText.split(ANSWER_PART_SEPARATOR)
  const slots = answerText.includes("\n")
    ? await planMultiLineSlot(blankSheet, regionBox)
    : await planWritingSlots(blankSheet, regionBox, parts.length)

  return slots.flatMap((slot, partIndex) => {
    const partText = parts[partIndex]?.trim()
    if (!partText) return []
    const svg = createHandwrittenSvg(
      partText,
      slot.width,
      slot.height,
      pen.fontFamily,
      pen.color,
      pen.seed + partIndex
    )
    return [{ input: Buffer.from(svg), left: slot.left, top: slot.top }]
  })
}

/**
 * 記入欄（受験番号・氏名）に生徒の情報を書く合成部品を作る
 *
 * 受験番号は升目に1桁ずつ、氏名は欄の中央に書く。欄の名前で見分けるので、
 * テンプレートの記入欄の名前を変えたらここも合わせる。
 */
function composeStudentHeader(
  student: StudentHeader,
  boxes: HeaderFieldBox[],
  sheetSize: { width: number; height: number },
  pen: { fontFamily: string; seed: number }
): OverlayOptions[] {
  const toPixels = (box: HeaderFieldBox): WritingSlot => ({
    left: Math.round(box.x * sheetSize.width),
    top: Math.round(box.y * sheetSize.height),
    width: Math.round(box.width * sheetSize.width),
    height: Math.round(box.height * sheetSize.height),
  })
  const writeInto = (slot: WritingSlot, text: string, seed: number) => ({
    input: Buffer.from(
      createHandwrittenSvg(
        text,
        slot.width,
        slot.height,
        pen.fontFamily,
        STUDENT_INK_COLOR,
        seed
      )
    ),
    left: slot.left,
    top: slot.top,
  })

  const overlays: OverlayOptions[] = []
  for (const box of boxes) {
    const slot = toPixels(box)
    if (box.label === "氏名") {
      overlays.push(writeInto(slot, student.name, pen.seed))
    } else if (box.label === "受験番号" && box.gridCount > 0) {
      const digitWidth = slot.width / box.gridCount
      student.examineeNumber
        .slice(0, box.gridCount)
        .split("")
        .forEach((digit, digitIndex) => {
          overlays.push(
            writeInto(
              {
                left: Math.round(slot.left + digitWidth * digitIndex),
                top: slot.top,
                width: Math.round(digitWidth),
                height: slot.height,
              },
              digit,
              pen.seed + digitIndex
            )
          )
        })
    }
  }
  return overlays
}

/**
 * 生徒答案画像を生成（白紙の解答用紙 + 手書き風の解答）
 *
 * **白紙の解答用紙から作ること。** 模範解答の赤字を重ねた後の画像から作ると、
 * 全員の答案に模範解答が写り込む（`regenerateAnswerImages` は生徒を先に作る）。
 */
export async function generateStudentAnswerImage(
  outputDir: string,
  studentIndex: number,
  studentId: string,
  masterDir: string,
  regions?: RegionDef[],
  scores?: { regionIndex: number; score: number; status: string }[],
  header?: { student: StudentHeader; boxes: HeaderFieldBox[] }
): Promise<string> {
  fs.mkdirSync(outputDir, { recursive: true })
  const masterPath = path.join(masterDir, "master-page-1.png")
  const outputPath = path.join(outputDir, `${studentId}_page1.png`)

  if (!fs.existsSync(masterPath) || !regions || !scores) {
    if (fs.existsSync(masterPath)) fs.copyFileSync(masterPath, outputPath)
    return outputPath
  }

  const blankSheet = sharp(fs.readFileSync(masterPath))
  const masterMeta = await blankSheet.metadata()
  const sheetSize = {
    width: masterMeta.width || SHEET_WIDTH,
    height: masterMeta.height || SHEET_HEIGHT,
  }
  const fontFamily =
    STUDENT_HANDWRITING_FONTS[studentIndex % STUDENT_HANDWRITING_FONTS.length]

  const composites: OverlayOptions[] = []
  if (header) {
    composites.push(
      ...composeStudentHeader(header.student, header.boxes, sheetSize, {
        fontFamily,
        seed: studentIndex,
      })
    )
  }
  for (const score of scores) {
    const region = regions[score.regionIndex]
    if (!region) continue

    const correctAnswer = CORRECT_ANSWERS[region.label] ?? ""
    const wrongPool = WRONG_ANSWERS[region.label] ?? ["?"]
    let answerText: string
    if (score.status === "correct") {
      answerText = correctAnswer
    } else if (score.status === "partial") {
      // 部分点: 典型的な誤りの1つ目（途中まで書けている答え）
      answerText =
        wrongPool[0] ?? correctAnswer.split("\n").slice(0, 2).join("\n")
    } else {
      const wrongIndex = (studentIndex + score.regionIndex) % wrongPool.length
      answerText = wrongPool[wrongIndex]
    }
    if (!answerText) continue

    composites.push(
      ...(await composeAnswerInRegion(
        blankSheet,
        region,
        answerText,
        sheetSize,
        {
          fontFamily,
          color: STUDENT_INK_COLOR,
          seed: studentIndex * 7 + score.regionIndex,
        }
      ))
    )
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
 *
 * マスター画像を**上書きする**。生徒の答案はこれより前に作ること。
 */
export async function generateMasterAnswerImage(
  masterDir: string,
  regions: RegionDef[]
): Promise<void> {
  const masterPath = path.join(masterDir, "master-page-1.png")
  if (!fs.existsSync(masterPath)) return

  const blankSheet = sharp(fs.readFileSync(masterPath))
  const masterMeta = await blankSheet.metadata()
  const sheetSize = {
    width: masterMeta.width || SHEET_WIDTH,
    height: masterMeta.height || SHEET_HEIGHT,
  }

  const composites: OverlayOptions[] = []
  for (const region of regions) {
    const correctAnswer = CORRECT_ANSWERS[region.label] ?? ""
    if (!correctAnswer) continue
    composites.push(
      ...(await composeAnswerInRegion(
        blankSheet,
        region,
        correctAnswer,
        sheetSize,
        {
          fontFamily: MODEL_ANSWER_FONT,
          color: MODEL_ANSWER_COLOR,
          seed: region.orderIndex * 3,
        }
      ))
    )
  }

  if (composites.length > 0) {
    // 読み込み済みのバッファから書くので、同じファイルへそのまま上書きできる
    await sharp(fs.readFileSync(masterPath))
      .composite(composites)
      .png()
      .toFile(masterPath)
  }
}

/**
 * 生徒の採点結果を決定的に生成
 *
 * 正誤は「生徒の実力」と「設問の難しさ」で決め、少しだけ揺らす。どちらとも
 * 関係なく決めると、よくできる生徒ほど正答するという当たり前の関係が無くなり、
 * 問題分析の識別係数の半分がマイナス、α係数も負という、でたらめな採点に見える
 * 図になる（実際そうなっていた）。この配分で正答およそ6割・部分点2割、
 * 識別係数はどの設問も正、α係数はおよそ 0.95 になる。
 */
export function generateStudentScores(
  studentIndex: number,
  regions: RegionDef[]
): { regionIndex: number; score: number; status: string }[] {
  const studentCount = 40
  // 出席番号順に実力が並ばないよう、番号をかき混ぜてから 0〜1 に割り付ける。
  // 30 ずらすのは、一覧の先頭（佐藤 翔太）を上位寄りにするため。先頭の生徒は多くの
  // 図で最初に目に入り、個人成績表の見本にもなるので、最低点だと寂しい図になる
  const ability = ((studentIndex * 17 + 30) % studentCount) / (studentCount - 1)
  return regions.map((region) => {
    const regionCount = Math.max(regions.length, 2)
    const difficulty =
      ((region.orderIndex * 7) % regionCount) / (regionCount - 1)
    const noise = ((studentIndex * 31 + region.orderIndex * 57 + 11) % 97) / 96
    const mastery =
      0.6 * ability + 0.4 * (1 - difficulty) + 0.35 * (noise - 0.5)

    if (mastery > 0.45) {
      return {
        regionIndex: region.orderIndex,
        score: region.points,
        status: "correct",
      }
    }
    if (mastery > 0.32) {
      return {
        regionIndex: region.orderIndex,
        score: Math.max(1, Math.floor(region.points * 0.5)),
        status: "partial",
      }
    }
    return { regionIndex: region.orderIndex, score: 0, status: "incorrect" }
  })
}
