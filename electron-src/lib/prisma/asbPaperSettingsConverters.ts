/**
 * 解答用紙の用紙設定 ↔ DBフラットカラムの変換。
 *
 * 用紙設定（余白・列幅・罫線・フォント・段組みなど）は木の中では入れ子だが、DB では
 * `AsbDefinition` の列として平らに並ぶ。その行き来だけを受け持つ。
 */

import type { AsbDefinition } from "@prisma/client"

import type {
  BorderConfig,
  BorderLineStyle,
  FontConfig,
  GlobalSettings,
  PaperSettings,
} from "../../../src/types/answerSheetDefinition.types"

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

/** DBフラットカラムから GlobalSettings に復元する */
export function unflattenGlobalSettings(row: AsbDefinition): GlobalSettings {
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
