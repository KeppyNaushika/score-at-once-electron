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
  AsbOmrConfig,
  AsbTextElement,
  PrismaClient,
} from "@prisma/client"

import type {
  AnswerSheetDefinition,
  BorderConfig,
  BranchQuestion,
  CellImageElement,
  CellTextElement,
  FontConfig,
  GlobalSettings,
  HeaderFieldDefinition,
  LineStyle,
  LinkedRegionType,
  MajorQuestion,
  ManuscriptCharGuide,
  ManuscriptGuidePosition,
  SubQuestion,
} from "../../../src/types/answerSheetDefinition.types"
import type {
  OMRCellConfig,
  OMRChoiceConfig,
} from "../../../src/types/omr.types"
import type { DbDefinitionFull } from "./asbDefinition"

// =============================================================================
// GlobalSettings ↔ DBフラットカラム
// =============================================================================

export type FlatGlobalSettings = {
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

/** GlobalSettings をDBフラットカラム形式に変換する */
export function flattenGlobalSettings(s: GlobalSettings): FlatGlobalSettings {
  return {
    paperSize: s.paperSize,
    orientation: s.orientation,
    verticalLayout: s.verticalLayout ?? false,
    baseRowHeight: s.baseRowHeight,
    numberDisplayMode: s.numberDisplayMode,
    marginTop: s.margins.top,
    marginBottom: s.margins.bottom,
    marginLeft: s.margins.left,
    marginRight: s.margins.right,
    colWidthMajorNumber: s.columnWidths.majorNumber,
    colWidthSubNumber: s.columnWidths.subNumber,
    colWidthBranchNumber: s.columnWidths.branchNumber,
    majorQuestionSpacing: s.spacing.majorQuestionSpacing,
    headerHeight: s.spacing.headerHeight,
    borderOuterBorder: s.borderConfig.outerBorder,
    borderMajorDivider: s.borderConfig.majorDivider,
    borderSubDivider: s.borderConfig.subDivider,
    borderBranchDivider: s.borderConfig.branchDivider,
    borderMajorNumberDivider: s.borderConfig.majorNumberDivider,
    borderSubNumberDivider: s.borderConfig.subNumberDivider,
    borderBranchNumberDivider: s.borderConfig.branchNumberDivider,
    borderOuterBorderWidth: s.borderConfig.outerBorderWidth ?? null,
    borderMajorDividerWidth: s.borderConfig.majorDividerWidth ?? null,
    borderSubDividerWidth: s.borderConfig.subDividerWidth ?? null,
    borderBranchDividerWidth: s.borderConfig.branchDividerWidth ?? null,
    borderMajorNumberDividerWidth:
      s.borderConfig.majorNumberDividerWidth ?? null,
    borderSubNumberDividerWidth: s.borderConfig.subNumberDividerWidth ?? null,
    borderBranchNumberDividerWidth:
      s.borderConfig.branchNumberDividerWidth ?? null,
    borderManuscriptCharDivider:
      s.borderConfig.manuscriptCharDivider ?? "dashed",
    borderManuscriptLineDivider:
      s.borderConfig.manuscriptLineDivider ?? "solid",
    borderManuscriptCharDividerWidth:
      s.borderConfig.manuscriptCharDividerWidth ?? null,
    borderManuscriptLineDividerWidth:
      s.borderConfig.manuscriptLineDividerWidth ?? null,
    borderOuterBorderDashRatio: s.borderConfig.outerBorderDashRatio ?? null,
    borderOuterBorderGapRatio: s.borderConfig.outerBorderGapRatio ?? null,
    borderMajorDividerDashRatio: s.borderConfig.majorDividerDashRatio ?? null,
    borderMajorDividerGapRatio: s.borderConfig.majorDividerGapRatio ?? null,
    borderSubDividerDashRatio: s.borderConfig.subDividerDashRatio ?? null,
    borderSubDividerGapRatio: s.borderConfig.subDividerGapRatio ?? null,
    borderBranchDividerDashRatio: s.borderConfig.branchDividerDashRatio ?? null,
    borderBranchDividerGapRatio: s.borderConfig.branchDividerGapRatio ?? null,
    borderMajorNumberDividerDashRatio:
      s.borderConfig.majorNumberDividerDashRatio ?? null,
    borderMajorNumberDividerGapRatio:
      s.borderConfig.majorNumberDividerGapRatio ?? null,
    borderSubNumberDividerDashRatio:
      s.borderConfig.subNumberDividerDashRatio ?? null,
    borderSubNumberDividerGapRatio:
      s.borderConfig.subNumberDividerGapRatio ?? null,
    borderBranchNumberDividerDashRatio:
      s.borderConfig.branchNumberDividerDashRatio ?? null,
    borderBranchNumberDividerGapRatio:
      s.borderConfig.branchNumberDividerGapRatio ?? null,
    borderManuscriptCharDividerDashRatio:
      s.borderConfig.manuscriptCharDividerDashRatio ?? null,
    borderManuscriptCharDividerGapRatio:
      s.borderConfig.manuscriptCharDividerGapRatio ?? null,
    borderManuscriptLineDividerDashRatio:
      s.borderConfig.manuscriptLineDividerDashRatio ?? null,
    borderManuscriptLineDividerGapRatio:
      s.borderConfig.manuscriptLineDividerGapRatio ?? null,
    omrMarkersEnabled: s.omrMarkers.enabled,
    omrMarkersSizeMm: s.omrMarkers.sizeMm,
    omrMarkersOffsetMm: s.omrMarkers.offsetMm,
    fontFamily: s.fonts.family,
    fontDefaultSize: s.fonts.defaultSize,
    fontMajorNumberSize: s.fonts.majorNumberSize,
    fontSubNumberSize: s.fonts.subNumberSize,
    fontBranchNumberSize: s.fonts.branchNumberSize,
    multiColumnEnabled: s.multiColumn.enabled,
    multiColumnCount: s.multiColumn.columnCount,
    multiColumnGapMm: s.multiColumn.columnGapMm,
    multiColumnDividerLine: s.multiColumn.dividerLine,
    multiColumnDividerLineWidth: s.multiColumn.dividerLineWidth,
  }
}

/**
 * AsbCharGuide テーブル行（order昇順で取得済み）を文字位置マーカー配列へ変換する。
 * boundary は DB移行時に solid/dashed/dotted へ検証済みだが、念のため型を絞る。
 */
function dbCharGuides(rows: AsbCharGuide[]): ManuscriptCharGuide[] | undefined {
  if (rows.length === 0) return undefined
  const VALID_STYLES = new Set<LineStyle>(["solid", "dashed", "dotted"])
  return rows.map((row): ManuscriptCharGuide => {
    const boundary =
      row.boundary !== null && VALID_STYLES.has(row.boundary as LineStyle)
        ? (row.boundary as LineStyle)
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
      dividerLine: (row.multiColumnDividerLine as LineStyle) ?? null,
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

/** DB OmrConfig 行を OMRCellConfig に変換する */
function dbToOmrConfig(
  config: AsbOmrConfig & {
    choiceOptions: { choiceIndex: number; label: string; isCorrect: boolean }[]
  }
): OMRCellConfig {
  if (config.type === "choice") {
    return {
      type: "choice",
      numChoices: config.numChoices ?? 4,
      labels: config.choiceOptions.map((option) => option.label),
      correctAnswers: config.choiceOptions
        .filter((option) => option.isCorrect)
        .map((option) => option.choiceIndex),
      layout: (config.choiceLayout ??
        "horizontal") as OMRChoiceConfig["layout"],
    }
  }
  return {
    type: "handwritten-digit",
    numDigits: config.numDigits ?? 1,
    correctAnswer: config.correctAnswer ?? undefined,
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
        lineStyle: headerField.lineStyle as LineStyle,
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
          const manuscriptPaper = subQuestion.manuscriptEnabled
            ? {
                enabled: true as const,
                columns: subQuestion.manuscriptColumns,
                rows: subQuestion.manuscriptRows,
                charGuides: dbCharGuides(subQuestion.charGuides),
                guideFontSize: subQuestion.manuscriptGuideFontSize ?? undefined,
                guidePosition:
                  (subQuestion.manuscriptGuidePosition as ManuscriptGuidePosition | null) ??
                  undefined,
                guidePadding: subQuestion.manuscriptGuidePadding ?? undefined,
              }
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
    settings,
    majorQuestions,
    renderMode: row.renderMode as AnswerSheetDefinition["renderMode"],
    labelPresets: {
      major: row.labelPresetMajor ?? undefined,
      sub: row.labelPresetSub ?? undefined,
      branch: row.labelPresetBranch ?? undefined,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// =============================================================================
// OMRConfig作成
// =============================================================================

export type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

/** トランザクション内でOMRConfig + ChoiceOptionsを作成する */
export async function createOmrConfig(
  tx: TxClient,
  parentFK: { subQuestionId?: string; branchQuestionId?: string },
  config: OMRCellConfig
): Promise<void> {
  const omrConfigId = crypto.randomUUID()

  if (config.type === "choice") {
    await tx.asbOmrConfig.create({
      data: {
        id: omrConfigId,
        ...parentFK,
        type: "choice",
        numChoices: config.numChoices,
        choiceLayout: config.layout,
      },
    })
    for (let ci = 0; ci < config.labels.length; ci++) {
      await tx.asbOmrChoiceOption.create({
        data: {
          omrConfigId,
          choiceIndex: ci,
          label: config.labels[ci],
          isCorrect: config.correctAnswers.includes(ci),
        },
      })
    }
  } else {
    await tx.asbOmrConfig.create({
      data: {
        id: omrConfigId,
        ...parentFK,
        type: "handwritten-digit",
        numDigits: config.numDigits,
        correctAnswer: config.correctAnswer ?? null,
      },
    })
  }
}
