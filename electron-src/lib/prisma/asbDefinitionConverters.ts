/**
 * 解答用紙ビルダー定義のDB変換レイヤー
 *
 * GlobalSettings ↔ DBフラットカラム変換、DB行 → AnswerSheetDefinition変換、
 * OMRConfig作成など、asbDefinitionのCRUD操作で使われる変換ヘルパー。
 */

import type {
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
  MajorQuestion,
  SubQuestion,
} from "../../../types/answerSheetDefinition.types"
import type { OMRCellConfig, OMRChoiceConfig } from "../../../types/omr.types"
import type { DbDefinitionFull } from "./asbDefinition"

// =============================================================================
// GlobalSettings ↔ DBフラットカラム
// =============================================================================

export type FlatGlobalSettings = {
  paperSize: string
  orientation: string
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

/** DBフラットカラムから GlobalSettings に復元する */
export function unflattenGlobalSettings(row: AsbDefinition): GlobalSettings {
  return {
    paperSize: row.paperSize as GlobalSettings["paperSize"],
    orientation: row.orientation as GlobalSettings["orientation"],
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
export function dbTextElements(elements: AsbTextElement[]): CellTextElement[] {
  return elements.map((te) => ({
    id: te.id,
    text: te.text,
    fontSize: te.fontSize,
    horizontalAlign: te.horizontalAlign as CellTextElement["horizontalAlign"],
    verticalAlign: te.verticalAlign as CellTextElement["verticalAlign"],
  }))
}

/** DB ImageElement 行を CellImageElement 配列に変換する */
export function dbImageElements(
  elements: AsbImageElement[]
): CellImageElement[] {
  return elements.map((ie) => ({
    id: ie.id,
    imagePath: ie.imagePath,
    originalName: ie.originalName,
    objectFit: ie.objectFit as CellImageElement["objectFit"],
    horizontalAlign: ie.horizontalAlign as CellImageElement["horizontalAlign"],
    verticalAlign: ie.verticalAlign as CellImageElement["verticalAlign"],
    opacity: ie.opacity,
    visibility:
      ie.visibility !== "both"
        ? (ie.visibility as CellImageElement["visibility"])
        : undefined,
  }))
}

/** DB OmrConfig 行を OMRCellConfig に変換する */
export function dbToOmrConfig(
  config: AsbOmrConfig & {
    choiceOptions: { choiceIndex: number; label: string; isCorrect: boolean }[]
  }
): OMRCellConfig {
  if (config.type === "choice") {
    return {
      type: "choice",
      numChoices: config.numChoices ?? 4,
      labels: config.choiceOptions.map((o) => o.label),
      correctAnswers: config.choiceOptions
        .filter((o) => o.isCorrect)
        .map((o) => o.choiceIndex),
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
      (hf): HeaderFieldDefinition => ({
        id: hf.id,
        type: (hf.type as HeaderFieldDefinition["type"]) ?? "field",
        label: hf.label,
        widthMm: hf.widthMm,
        heightMm: hf.heightMm,
        gridCount: hf.gridCount,
        lineStyle: hf.lineStyle as LineStyle,
        lineWidth: hf.lineWidth,
        order: hf.order,
        fontSize: hf.fontSize ?? undefined,
      })
    )
  }
  const majorQuestions: MajorQuestion[] = row.majorQuestions.map((mq) => ({
    id: mq.id,
    label: mq.label,
    subQuestions: mq.subQuestions.map((sq): SubQuestion => {
      const manuscriptPaper = sq.manuscriptEnabled
        ? {
            enabled: true as const,
            columns: sq.manuscriptColumns,
            rows: sq.manuscriptRows,
          }
        : undefined
      const borderStyles =
        sq.borderStyleTop ||
        sq.borderStyleBottom ||
        sq.borderStyleLeft ||
        sq.borderStyleRight
          ? {
              top: sq.borderStyleTop as SubQuestion["borderStyles"] extends infer T
                ? T extends { top?: infer U }
                  ? U
                  : undefined
                : undefined,
              bottom:
                sq.borderStyleBottom as SubQuestion["borderStyles"] extends infer T
                  ? T extends { bottom?: infer U }
                    ? U
                    : undefined
                  : undefined,
              left: sq.borderStyleLeft as SubQuestion["borderStyles"] extends infer T
                ? T extends { left?: infer U }
                  ? U
                  : undefined
                : undefined,
              right:
                sq.borderStyleRight as SubQuestion["borderStyles"] extends infer T
                  ? T extends { right?: infer U }
                    ? U
                    : undefined
                  : undefined,
            }
          : undefined

      return {
        id: sq.id,
        label: sq.label,
        branchQuestions: sq.branchQuestions.map((bq): BranchQuestion => {
          const bqBorderStyles =
            bq.borderStyleTop ||
            bq.borderStyleBottom ||
            bq.borderStyleLeft ||
            bq.borderStyleRight
              ? {
                  top: bq.borderStyleTop as BranchQuestion["borderStyles"] extends infer T
                    ? T extends { top?: infer U }
                      ? U
                      : undefined
                    : undefined,
                  bottom:
                    bq.borderStyleBottom as BranchQuestion["borderStyles"] extends infer T
                      ? T extends { bottom?: infer U }
                        ? U
                        : undefined
                      : undefined,
                  left: bq.borderStyleLeft as BranchQuestion["borderStyles"] extends infer T
                    ? T extends { left?: infer U }
                      ? U
                      : undefined
                    : undefined,
                  right:
                    bq.borderStyleRight as BranchQuestion["borderStyles"] extends infer T
                      ? T extends { right?: infer U }
                        ? U
                        : undefined
                      : undefined,
                }
              : undefined

          return {
            id: bq.id,
            label: bq.label,
            heightMultiplier: bq.heightMultiplier,
            points: bq.points,
            textElements: dbTextElements(bq.textElements),
            imageElements: dbImageElements(bq.imageElements),
            borderStyles: bqBorderStyles as BranchQuestion["borderStyles"],
            layoutWidth: bq.layoutWidth ?? undefined,
            nextPlacement: bq.nextPlacement as BranchQuestion["nextPlacement"],
            goUp: bq.goUp ?? undefined,
            omrConfig: bq.omrConfig ? dbToOmrConfig(bq.omrConfig) : undefined,
          }
        }),
        heightMultiplier: sq.heightMultiplier,
        points: sq.points,
        textElements: dbTextElements(sq.textElements),
        imageElements: dbImageElements(sq.imageElements),
        manuscriptPaper,
        borderStyles: borderStyles as SubQuestion["borderStyles"],
        layoutWidth: sq.layoutWidth ?? undefined,
        nextPlacement: sq.nextPlacement as SubQuestion["nextPlacement"],
        goUp: sq.goUp ?? undefined,
        usesBranchPoints: sq.usesBranchPoints ?? undefined,
        omrConfig: sq.omrConfig ? dbToOmrConfig(sq.omrConfig) : undefined,
      }
    }),
  }))

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
