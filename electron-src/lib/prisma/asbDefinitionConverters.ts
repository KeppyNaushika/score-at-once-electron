/**
 * 解答用紙ビルダー定義のDB変換レイヤー
 *
 * DB行 → AnswerSheetDefinition変換（設問の木・セルの中身・OMR設定・原稿用紙）。
 * 用紙設定 ↔ DBフラットカラムの変換は `asbPaperSettingsConverters.ts`。
 */

import type {
  AsbCharGuide,
  AsbImageElement,
  AsbManuscriptPaper,
  AsbOmrConfig,
  AsbTextElement,
} from "@prisma/client"

import type {
  AnswerSheetDefinition,
  BorderLineStyle,
  BranchQuestion,
  CellImageElement,
  CellTextElement,
  HeaderFieldDefinition,
  LinkedRegionType,
  MajorQuestion,
  ManuscriptCharGuide,
  ManuscriptPaper,
  SubQuestion,
} from "../../../src/types/answerSheetDefinition.types"
import { toManuscriptGuidePosition } from "../../../src/types/answerSheetDefinition.types"
import type {
  OMRCellConfig,
  OMRChoiceConfig,
} from "../../../src/types/omr.types"
import type { DbDefinitionFull } from "./asbDefinition"
import { unflattenGlobalSettings } from "./asbPaperSettingsConverters"

// =============================================================================
// 原稿用紙
// =============================================================================

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
