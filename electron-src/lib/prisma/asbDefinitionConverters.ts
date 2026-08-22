/**
 * 解答用紙ビルダー定義のDB変換レイヤー
 *
 * GlobalSettings ↔ DBフラットカラム変換、DB行 → AnswerSheetDefinition変換、
 * OMRConfig作成など、asbDefinitionのCRUD操作で使われる変換ヘルパー。
 */

import type {
  AsbCharGuide,
  AsbDefinition,
  AsbImageElement,
  AsbManuscriptPaper,
  AsbOmrConfig,
  AsbTextElement,
} from "@prisma/client"

import type {
  AnswerSheetDefinition,
  BorderConfig,
  BorderLineStyle,
  BranchQuestion,
  CellImageElement,
  CellTextElement,
  FontConfig,
  GlobalSettings,
  HeaderFieldDefinition,
  LinkedRegionType,
  MajorQuestion,
  ManuscriptCharGuide,
  ManuscriptPaper,
  PaperSettings,
  SubQuestion,
} from "../../../src/types/answerSheetDefinition.types"
import { toManuscriptGuidePosition } from "../../../src/types/answerSheetDefinition.types"
import type {
  OMRCellConfig,
  OMRChoiceConfig,
} from "../../../src/types/omr.types"
import type { DbDefinitionFull } from "./asbDefinition"

// =============================================================================
// GlobalSettings ↔ DBフラットカラム
// =============================================================================

type FlatGlobalSettings = {
  paperSize: string
  orientation: string
  verticalLayout: boolean
  baseRowHeight: number
  numberDisplayMode: string
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  colWidthMajorNumber: number
  colWidthSubNumber: number
  colWidthBranchNumber: number
  majorQuestionSpacing: number
  headerHeight: number
  borderOuterBorder: string
  borderMajorDivider: string
  borderSubDivider: string
  borderBranchDivider: string
  borderMajorNumberDivider: string
  borderSubNumberDivider: string
  borderBranchNumberDivider: string
  borderOuterBorderWidth: number | null
  borderMajorDividerWidth: number | null
  borderSubDividerWidth: number | null
  borderBranchDividerWidth: number | null
  borderMajorNumberDividerWidth: number | null
  borderSubNumberDividerWidth: number | null
  borderBranchNumberDividerWidth: number | null
  borderManuscriptCharDivider: string
  borderManuscriptLineDivider: string
  borderManuscriptCharDividerWidth: number | null
  borderManuscriptLineDividerWidth: number | null
  borderOuterBorderDashRatio: number | null
  borderOuterBorderGapRatio: number | null
  borderMajorDividerDashRatio: number | null
  borderMajorDividerGapRatio: number | null
  borderSubDividerDashRatio: number | null
  borderSubDividerGapRatio: number | null
  borderBranchDividerDashRatio: number | null
  borderBranchDividerGapRatio: number | null
  borderMajorNumberDividerDashRatio: number | null
  borderMajorNumberDividerGapRatio: number | null
  borderSubNumberDividerDashRatio: number | null
  borderSubNumberDividerGapRatio: number | null
  borderBranchNumberDividerDashRatio: number | null
  borderBranchNumberDividerGapRatio: number | null
  borderManuscriptCharDividerDashRatio: number | null
  borderManuscriptCharDividerGapRatio: number | null
  borderManuscriptLineDividerDashRatio: number | null
  borderManuscriptLineDividerGapRatio: number | null
  omrMarkersEnabled: boolean
  omrMarkersSizeMm: number
  omrMarkersOffsetMm: number
  fontFamily: string
  fontDefaultSize: number
  fontMajorNumberSize: number
  fontSubNumberSize: number
  fontBranchNumberSize: number
  multiColumnEnabled: boolean
  multiColumnCount: number
  multiColumnGapMm: number
  multiColumnDividerLine: string | null
  multiColumnDividerLineWidth: number
}

/**
 * 用紙設定をDBフラットカラム形式に変換する。
 *
 * ヘッダー項目は別テーブルなので受け取らない（`PaperSettings`）。`GlobalSettings` を
 * 渡してもよい（余分な `headerFields` は使われない）。
 */
export function flattenGlobalSettings(
  settings: PaperSettings
): FlatGlobalSettings {
  return {
    paperSize: settings.paperSize,
    orientation: settings.orientation,
    verticalLayout: settings.verticalLayout ?? false,
    baseRowHeight: settings.baseRowHeight,
    numberDisplayMode: settings.numberDisplayMode,
    marginTop: settings.margins.top,
    marginBottom: settings.margins.bottom,
    marginLeft: settings.margins.left,
    marginRight: settings.margins.right,
    colWidthMajorNumber: settings.columnWidths.majorNumber,
    colWidthSubNumber: settings.columnWidths.subNumber,
    colWidthBranchNumber: settings.columnWidths.branchNumber,
    majorQuestionSpacing: settings.spacing.majorQuestionSpacing,
    headerHeight: settings.spacing.headerHeight,
    borderOuterBorder: settings.borderConfig.outerBorder,
    borderMajorDivider: settings.borderConfig.majorDivider,
    borderSubDivider: settings.borderConfig.subDivider,
    borderBranchDivider: settings.borderConfig.branchDivider,
    borderMajorNumberDivider: settings.borderConfig.majorNumberDivider,
    borderSubNumberDivider: settings.borderConfig.subNumberDivider,
    borderBranchNumberDivider: settings.borderConfig.branchNumberDivider,
    borderOuterBorderWidth: settings.borderConfig.outerBorderWidth ?? null,
    borderMajorDividerWidth: settings.borderConfig.majorDividerWidth ?? null,
    borderSubDividerWidth: settings.borderConfig.subDividerWidth ?? null,
    borderBranchDividerWidth: settings.borderConfig.branchDividerWidth ?? null,
    borderMajorNumberDividerWidth:
      settings.borderConfig.majorNumberDividerWidth ?? null,
    borderSubNumberDividerWidth:
      settings.borderConfig.subNumberDividerWidth ?? null,
    borderBranchNumberDividerWidth:
      settings.borderConfig.branchNumberDividerWidth ?? null,
    borderManuscriptCharDivider:
      settings.borderConfig.manuscriptCharDivider ?? "dashed",
    borderManuscriptLineDivider:
      settings.borderConfig.manuscriptLineDivider ?? "solid",
    borderManuscriptCharDividerWidth:
      settings.borderConfig.manuscriptCharDividerWidth ?? null,
    borderManuscriptLineDividerWidth:
      settings.borderConfig.manuscriptLineDividerWidth ?? null,
    borderOuterBorderDashRatio:
      settings.borderConfig.outerBorderDashRatio ?? null,
    borderOuterBorderGapRatio:
      settings.borderConfig.outerBorderGapRatio ?? null,
    borderMajorDividerDashRatio:
      settings.borderConfig.majorDividerDashRatio ?? null,
    borderMajorDividerGapRatio:
      settings.borderConfig.majorDividerGapRatio ?? null,
    borderSubDividerDashRatio:
      settings.borderConfig.subDividerDashRatio ?? null,
    borderSubDividerGapRatio: settings.borderConfig.subDividerGapRatio ?? null,
    borderBranchDividerDashRatio:
      settings.borderConfig.branchDividerDashRatio ?? null,
    borderBranchDividerGapRatio:
      settings.borderConfig.branchDividerGapRatio ?? null,
    borderMajorNumberDividerDashRatio:
      settings.borderConfig.majorNumberDividerDashRatio ?? null,
    borderMajorNumberDividerGapRatio:
      settings.borderConfig.majorNumberDividerGapRatio ?? null,
    borderSubNumberDividerDashRatio:
      settings.borderConfig.subNumberDividerDashRatio ?? null,
    borderSubNumberDividerGapRatio:
      settings.borderConfig.subNumberDividerGapRatio ?? null,
    borderBranchNumberDividerDashRatio:
      settings.borderConfig.branchNumberDividerDashRatio ?? null,
    borderBranchNumberDividerGapRatio:
      settings.borderConfig.branchNumberDividerGapRatio ?? null,
    borderManuscriptCharDividerDashRatio:
      settings.borderConfig.manuscriptCharDividerDashRatio ?? null,
    borderManuscriptCharDividerGapRatio:
      settings.borderConfig.manuscriptCharDividerGapRatio ?? null,
    borderManuscriptLineDividerDashRatio:
      settings.borderConfig.manuscriptLineDividerDashRatio ?? null,
    borderManuscriptLineDividerGapRatio:
      settings.borderConfig.manuscriptLineDividerGapRatio ?? null,
    omrMarkersEnabled: settings.omrMarkers.enabled,
    omrMarkersSizeMm: settings.omrMarkers.sizeMm,
    omrMarkersOffsetMm: settings.omrMarkers.offsetMm,
    fontFamily: settings.fonts.family,
    fontDefaultSize: settings.fonts.defaultSize,
    fontMajorNumberSize: settings.fonts.majorNumberSize,
    fontSubNumberSize: settings.fonts.subNumberSize,
    fontBranchNumberSize: settings.fonts.branchNumberSize,
    multiColumnEnabled: settings.multiColumn.enabled,
    multiColumnCount: settings.multiColumn.columnCount,
    multiColumnGapMm: settings.multiColumn.columnGapMm,
    multiColumnDividerLine: settings.multiColumn.dividerLine,
    multiColumnDividerLineWidth: settings.multiColumn.dividerLineWidth,
  }
}

/**
 * AsbCharGuide テーブル行（order昇順で取得済み）を文字位置マーカー配列へ変換する。
 * boundary は DB移行時に solid/dashed/dotted へ検証済みだが、念のため型を絞る。
 */
function dbCharGuides(rows: AsbCharGuide[]): ManuscriptCharGuide[] {
  const VALID_STYLES = new Set<BorderLineStyle>(["solid", "dashed", "dotted"])
  return rows.map((row): ManuscriptCharGuide => {
    const boundary =
      row.boundary !== null && VALID_STYLES.has(row.boundary as BorderLineStyle)
        ? (row.boundary as BorderLineStyle)
        : undefined
    return {
      id: row.id,
      atChar: row.atChar,
      label: row.label,
      boundary,
      boundaryWidth: row.boundaryWidth ?? undefined,
      boundaryDashRatio: row.boundaryDashRatio ?? undefined,
      boundaryGapRatio: row.boundaryGapRatio ?? undefined,
    }
  })
}

/**
 * AsbManuscriptPaper 行を木の原稿用紙へ変換する。
 *
 * 行そのものを持つので、束ね直しは無い。`guidePosition` だけ DB が `String?` なので
 * 境界コンバータ `toManuscriptGuidePosition` で union へ絞る（`ScoringStatus` と同じ
 * 型注入＋実行時の相棒）。`null` は「未指定」という意味を持つので潰さない。
 */
function dbManuscriptPaper(
  row: AsbManuscriptPaper & { charGuides: AsbCharGuide[] }
): ManuscriptPaper {
  return {
    id: row.id,
    enabled: row.enabled,
    columns: row.columns,
    rows: row.rows,
    guideFontSize: row.guideFontSize,
    guidePosition:
      row.guidePosition === null
        ? null
        : toManuscriptGuidePosition(row.guidePosition),
    guidePadding: row.guidePadding,
    charGuides: dbCharGuides(row.charGuides),
  }
}

/** DBフラットカラムから GlobalSettings に復元する */
function unflattenGlobalSettings(row: AsbDefinition): GlobalSettings {
  return {
    paperSize: row.paperSize as GlobalSettings["paperSize"],
    orientation: row.orientation as GlobalSettings["orientation"],
    verticalLayout: row.verticalLayout,
    baseRowHeight: row.baseRowHeight,
    numberDisplayMode:
      row.numberDisplayMode as GlobalSettings["numberDisplayMode"],
    margins: {
      top: row.marginTop,
      bottom: row.marginBottom,
      left: row.marginLeft,
      right: row.marginRight,
    },
    columnWidths: {
      majorNumber: row.colWidthMajorNumber,
      subNumber: row.colWidthSubNumber,
      branchNumber: row.colWidthBranchNumber,
    },
    spacing: {
      majorQuestionSpacing: row.majorQuestionSpacing,
      headerHeight: row.headerHeight,
    },
    borderConfig: {
      outerBorder: row.borderOuterBorder,
      majorDivider: row.borderMajorDivider,
      subDivider: row.borderSubDivider,
      branchDivider: row.borderBranchDivider,
      majorNumberDivider: row.borderMajorNumberDivider,
      subNumberDivider: row.borderSubNumberDivider,
      branchNumberDivider: row.borderBranchNumberDivider,
      outerBorderWidth: row.borderOuterBorderWidth ?? undefined,
      majorDividerWidth: row.borderMajorDividerWidth ?? undefined,
      subDividerWidth: row.borderSubDividerWidth ?? undefined,
      branchDividerWidth: row.borderBranchDividerWidth ?? undefined,
      majorNumberDividerWidth: row.borderMajorNumberDividerWidth ?? undefined,
      subNumberDividerWidth: row.borderSubNumberDividerWidth ?? undefined,
      branchNumberDividerWidth: row.borderBranchNumberDividerWidth ?? undefined,
      manuscriptCharDivider:
        (row.borderManuscriptCharDivider as BorderConfig["manuscriptCharDivider"]) ??
        undefined,
      manuscriptLineDivider:
        (row.borderManuscriptLineDivider as BorderConfig["manuscriptLineDivider"]) ??
        undefined,
      manuscriptCharDividerWidth:
        row.borderManuscriptCharDividerWidth ?? undefined,
      manuscriptLineDividerWidth:
        row.borderManuscriptLineDividerWidth ?? undefined,
      outerBorderDashRatio: row.borderOuterBorderDashRatio ?? undefined,
      outerBorderGapRatio: row.borderOuterBorderGapRatio ?? undefined,
      majorDividerDashRatio: row.borderMajorDividerDashRatio ?? undefined,
      majorDividerGapRatio: row.borderMajorDividerGapRatio ?? undefined,
      subDividerDashRatio: row.borderSubDividerDashRatio ?? undefined,
      subDividerGapRatio: row.borderSubDividerGapRatio ?? undefined,
      branchDividerDashRatio: row.borderBranchDividerDashRatio ?? undefined,
      branchDividerGapRatio: row.borderBranchDividerGapRatio ?? undefined,
      majorNumberDividerDashRatio:
        row.borderMajorNumberDividerDashRatio ?? undefined,
      majorNumberDividerGapRatio:
        row.borderMajorNumberDividerGapRatio ?? undefined,
      subNumberDividerDashRatio:
        row.borderSubNumberDividerDashRatio ?? undefined,
      subNumberDividerGapRatio: row.borderSubNumberDividerGapRatio ?? undefined,
      branchNumberDividerDashRatio:
        row.borderBranchNumberDividerDashRatio ?? undefined,
      branchNumberDividerGapRatio:
        row.borderBranchNumberDividerGapRatio ?? undefined,
      manuscriptCharDividerDashRatio:
        row.borderManuscriptCharDividerDashRatio ?? undefined,
      manuscriptCharDividerGapRatio:
        row.borderManuscriptCharDividerGapRatio ?? undefined,
      manuscriptLineDividerDashRatio:
        row.borderManuscriptLineDividerDashRatio ?? undefined,
      manuscriptLineDividerGapRatio:
        row.borderManuscriptLineDividerGapRatio ?? undefined,
    } as BorderConfig,
    omrMarkers: {
      enabled: row.omrMarkersEnabled,
      sizeMm: row.omrMarkersSizeMm,
      offsetMm: row.omrMarkersOffsetMm,
    },
    fonts: {
      family: row.fontFamily,
      defaultSize: row.fontDefaultSize,
      majorNumberSize: row.fontMajorNumberSize,
      subNumberSize: row.fontSubNumberSize,
      branchNumberSize: row.fontBranchNumberSize,
    } as FontConfig,
    multiColumn: {
      enabled: row.multiColumnEnabled,
      columnCount: row.multiColumnCount as 2 | 3,
      columnGapMm: row.multiColumnGapMm,
      dividerLine: (row.multiColumnDividerLine as BorderLineStyle) ?? null,
      dividerLineWidth: row.multiColumnDividerLineWidth,
    },
    headerFields: [],
  }
}

// =============================================================================
// DB → AnswerSheetDefinition 変換
// =============================================================================

/** DB TextElement 行を CellTextElement 配列に変換する */
function dbTextElements(elements: AsbTextElement[]): CellTextElement[] {
  return elements.map((textElement) => ({
    id: textElement.id,
    text: textElement.text,
    fontSize: textElement.fontSize,
    horizontalAlign:
      textElement.horizontalAlign as CellTextElement["horizontalAlign"],
    verticalAlign:
      textElement.verticalAlign as CellTextElement["verticalAlign"],
  }))
}

/** DB ImageElement 行を CellImageElement 配列に変換する */
function dbImageElements(elements: AsbImageElement[]): CellImageElement[] {
  return elements.map((imageElement) => ({
    id: imageElement.id,
    imagePath: imageElement.imagePath,
    originalName: imageElement.originalName,
    objectFit: imageElement.objectFit as CellImageElement["objectFit"],
    horizontalAlign:
      imageElement.horizontalAlign as CellImageElement["horizontalAlign"],
    verticalAlign:
      imageElement.verticalAlign as CellImageElement["verticalAlign"],
    opacity: imageElement.opacity,
    visibility:
      imageElement.visibility !== "both"
        ? (imageElement.visibility as CellImageElement["visibility"])
        : undefined,
  }))
}

/**
 * DB OmrConfig 行を OMRCellConfig に変換する
 *
 * 選択式以外（廃止した手書き数字）の行は OMR 設定なしとして扱う。
 */
function dbToOmrConfig(
  config: AsbOmrConfig & {
    choiceOptions: { choiceIndex: number; label: string; isCorrect: boolean }[]
  }
): OMRCellConfig | undefined {
  if (config.type !== "choice") return undefined

  return {
    type: "choice",
    numChoices: config.numChoices ?? 4,
    labels: config.choiceOptions.map((option) => option.label),
    correctAnswers: config.choiceOptions
      .filter((option) => option.isCorrect)
      .map((option) => option.choiceIndex),
    layout: (config.choiceLayout ?? "horizontal") as OMRChoiceConfig["layout"],
  }
}

/** DbDefinitionFull を AnswerSheetDefinition に変換する */
export function dbToDefinition(row: DbDefinitionFull): AnswerSheetDefinition {
  const settings = unflattenGlobalSettings(row)

  // ヘッダーフィールドをDBから復元
  if (row.headerFields) {
    settings.headerFields = row.headerFields.map(
      (headerField): HeaderFieldDefinition => ({
        id: headerField.id,
        type: (headerField.type as HeaderFieldDefinition["type"]) ?? "field",
        label: headerField.label,
        widthMm: headerField.widthMm,
        heightMm: headerField.heightMm,
        gridCount: headerField.gridCount,
        lineStyle: headerField.lineStyle as BorderLineStyle,
        lineWidth: headerField.lineWidth,
        order: headerField.order,
        fontSize: headerField.fontSize ?? undefined,
        linkedRegionType:
          (headerField.linkedRegionType as LinkedRegionType) ?? undefined,
      })
    )
  }
  const majorQuestions: MajorQuestion[] = row.majorQuestions.map(
    (majorQuestion) => ({
      id: majorQuestion.id,
      label: majorQuestion.label,
      subQuestions: majorQuestion.subQuestions.map(
        (subQuestion): SubQuestion => {
          const manuscriptPaper = subQuestion.manuscriptPaper
            ? dbManuscriptPaper(subQuestion.manuscriptPaper)
            : undefined
          const borderStyles =
            subQuestion.borderStyleTop ||
            subQuestion.borderStyleBottom ||
            subQuestion.borderStyleLeft ||
            subQuestion.borderStyleRight
              ? {
                  top: subQuestion.borderStyleTop as SubQuestion["borderStyles"] extends infer T
                    ? T extends { top?: infer U }
                      ? U
                      : undefined
                    : undefined,
                  bottom:
                    subQuestion.borderStyleBottom as SubQuestion["borderStyles"] extends infer T
                      ? T extends { bottom?: infer U }
                        ? U
                        : undefined
                      : undefined,
                  left: subQuestion.borderStyleLeft as SubQuestion["borderStyles"] extends infer T
                    ? T extends { left?: infer U }
                      ? U
                      : undefined
                    : undefined,
                  right:
                    subQuestion.borderStyleRight as SubQuestion["borderStyles"] extends infer T
                      ? T extends { right?: infer U }
                        ? U
                        : undefined
                      : undefined,
                }
              : undefined

          return {
            id: subQuestion.id,
            label: subQuestion.label,
            branchQuestions: subQuestion.branchQuestions.map(
              (branchQuestion): BranchQuestion => {
                const bqBorderStyles =
                  branchQuestion.borderStyleTop ||
                  branchQuestion.borderStyleBottom ||
                  branchQuestion.borderStyleLeft ||
                  branchQuestion.borderStyleRight
                    ? {
                        top: branchQuestion.borderStyleTop as BranchQuestion["borderStyles"] extends infer T
                          ? T extends { top?: infer U }
                            ? U
                            : undefined
                          : undefined,
                        bottom:
                          branchQuestion.borderStyleBottom as BranchQuestion["borderStyles"] extends infer T
                            ? T extends { bottom?: infer U }
                              ? U
                              : undefined
                            : undefined,
                        left: branchQuestion.borderStyleLeft as BranchQuestion["borderStyles"] extends infer T
                          ? T extends { left?: infer U }
                            ? U
                            : undefined
                          : undefined,
                        right:
                          branchQuestion.borderStyleRight as BranchQuestion["borderStyles"] extends infer T
                            ? T extends { right?: infer U }
                              ? U
                              : undefined
                            : undefined,
                      }
                    : undefined

                return {
                  id: branchQuestion.id,
                  label: branchQuestion.label,
                  heightMultiplier: branchQuestion.heightMultiplier,
                  points: branchQuestion.points,
                  textElements: dbTextElements(branchQuestion.textElements),
                  imageElements: dbImageElements(branchQuestion.imageElements),
                  borderStyles:
                    bqBorderStyles as BranchQuestion["borderStyles"],
                  layoutWidth: branchQuestion.layoutWidth ?? undefined,
                  nextPlacement:
                    branchQuestion.nextPlacement as BranchQuestion["nextPlacement"],
                  goUp: branchQuestion.goUp ?? undefined,
                  omrConfig: branchQuestion.omrConfig
                    ? dbToOmrConfig(branchQuestion.omrConfig)
                    : undefined,
                  manuscriptPaper: branchQuestion.manuscriptPaper
                    ? dbManuscriptPaper(branchQuestion.manuscriptPaper)
                    : undefined,
                }
              }
            ),
            heightMultiplier: subQuestion.heightMultiplier,
            points: subQuestion.points,
            textElements: dbTextElements(subQuestion.textElements),
            imageElements: dbImageElements(subQuestion.imageElements),
            manuscriptPaper,
            borderStyles: borderStyles as SubQuestion["borderStyles"],
            layoutWidth: subQuestion.layoutWidth ?? undefined,
            nextPlacement:
              subQuestion.nextPlacement as SubQuestion["nextPlacement"],
            goUp: subQuestion.goUp ?? undefined,
            usesBranchPoints: subQuestion.usesBranchPoints ?? undefined,
            omrConfig: subQuestion.omrConfig
              ? dbToOmrConfig(subQuestion.omrConfig)
              : undefined,
          }
        }
      ),
    })
  )

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    referenceDate: row.referenceDate?.toISOString() ?? null,
    settings,
    majorQuestions,
    labelPresets: {
      major: row.labelPresetMajor ?? undefined,
      sub: row.labelPresetSub ?? undefined,
      branch: row.labelPresetBranch ?? undefined,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
