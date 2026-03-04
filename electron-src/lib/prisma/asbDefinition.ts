/**
 * 解答用紙ビルダー定義のDB操作レイヤー
 *
 * AnswerSheetDefinition型 ↔ DB(7テーブル) の変換・CRUD
 */

import type {
  AsbBranchQuestion,
  AsbDefinition,
  AsbImageElement,
  AsbMajorQuestion,
  AsbOmrConfig,
  AsbSubQuestion,
  AsbTextElement,
  PrismaClient,
} from "@prisma/client"

import type {
  AnswerSheetDefinition,
  ASBDefinitionListItem,
  BorderConfig,
  BranchQuestion,
  CellImageElement,
  CellTextElement,
  FontConfig,
  GlobalSettings,
  MajorQuestion,
  SubQuestion,
} from "../../../types/answerSheetBuilder.types"
import type { OMRCellConfig, OMRChoiceConfig } from "../../../types/omr.types"
import prisma from "./client"

// =============================================================================
// 一覧取得（軽量）
// =============================================================================

export async function listAsbDefinitions(
  userId: string
): Promise<ASBDefinitionListItem[]> {
  const rows = await prisma.asbDefinition.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      paperSize: true,
      orientation: true,
      updatedAt: true,
      createdAt: true,
      majorQuestions: {
        select: {
          subQuestions: {
            select: {
              points: true,
              branchQuestions: {
                select: { points: true },
              },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  return rows.map((row) => {
    let questionCount = 0
    let totalPoints = 0
    for (const mq of row.majorQuestions) {
      for (const sq of mq.subQuestions) {
        if (sq.branchQuestions.length > 0) {
          questionCount += sq.branchQuestions.length
          totalPoints += sq.branchQuestions.reduce((s, b) => s + b.points, 0)
        } else {
          questionCount += 1
          totalPoints += sq.points
        }
      }
    }
    return {
      id: row.id,
      name: row.name,
      paperSize: row.paperSize,
      orientation: row.orientation,
      questionCount,
      totalPoints,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }
  })
}

// =============================================================================
// 単体取得（全リレーション付き → AnswerSheetDefinition型に変換）
// =============================================================================

type DbDefinitionFull = AsbDefinition & {
  majorQuestions: (AsbMajorQuestion & {
    subQuestions: (AsbSubQuestion & {
      branchQuestions: (AsbBranchQuestion & {
        textElements: AsbTextElement[]
        imageElements: AsbImageElement[]
        omrConfig:
          | (AsbOmrConfig & {
              choiceOptions: {
                choiceIndex: number
                label: string
                isCorrect: boolean
              }[]
            })
          | null
      })[]
      textElements: AsbTextElement[]
      imageElements: AsbImageElement[]
      omrConfig:
        | (AsbOmrConfig & {
            choiceOptions: {
              choiceIndex: number
              label: string
              isCorrect: boolean
            }[]
          })
        | null
    })[]
  })[]
}

const fullInclude = {
  majorQuestions: {
    orderBy: { order: "asc" as const },
    include: {
      subQuestions: {
        orderBy: { order: "asc" as const },
        include: {
          branchQuestions: {
            orderBy: { order: "asc" as const },
            include: {
              textElements: { orderBy: { order: "asc" as const } },
              imageElements: { orderBy: { order: "asc" as const } },
              omrConfig: {
                include: {
                  choiceOptions: {
                    orderBy: { choiceIndex: "asc" as const },
                    select: { choiceIndex: true, label: true, isCorrect: true },
                  },
                },
              },
            },
          },
          textElements: { orderBy: { order: "asc" as const } },
          imageElements: { orderBy: { order: "asc" as const } },
          omrConfig: {
            include: {
              choiceOptions: {
                orderBy: { choiceIndex: "asc" as const },
                select: { choiceIndex: true, label: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  },
}

export async function getAsbDefinition(
  id: string
): Promise<AnswerSheetDefinition | null> {
  const row = await prisma.asbDefinition.findUnique({
    where: { id },
    include: fullInclude,
  })
  if (!row) return null
  return dbToDefinition(row as DbDefinitionFull)
}

// =============================================================================
// 保存（トランザクション内 delete → recreate）
// =============================================================================

export async function saveAsbDefinition(
  definition: AnswerSheetDefinition,
  userId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 既存があれば子テーブルごと削除（Cascade）
    await tx.asbDefinition
      .delete({ where: { id: definition.id } })
      .catch(() => {
        // 新規作成時は存在しないので無視
      })

    // 定義を作成
    const flat = flattenGlobalSettings(definition.settings)
    await tx.asbDefinition.create({
      data: {
        id: definition.id,
        name: definition.name,
        renderMode: definition.renderMode,
        labelPresetMajor: definition.labelPresets?.major ?? null,
        labelPresetSub: definition.labelPresets?.sub ?? null,
        labelPresetBranch: definition.labelPresets?.branch ?? null,
        userId,
        ...flat,
      },
    })

    // 大問 → 小問 → 枝問 を再帰的に作成
    for (let mi = 0; mi < definition.majorQuestions.length; mi++) {
      const mq = definition.majorQuestions[mi]
      await tx.asbMajorQuestion.create({
        data: {
          id: mq.id,
          definitionId: definition.id,
          label: mq.label,
          order: mi,
        },
      })

      for (let si = 0; si < mq.subQuestions.length; si++) {
        const sq = mq.subQuestions[si]
        await tx.asbSubQuestion.create({
          data: {
            id: sq.id,
            majorQuestionId: mq.id,
            label: sq.label,
            order: si,
            heightMultiplier: sq.heightMultiplier,
            points: sq.points,
            usesBranchPoints: sq.usesBranchPoints ?? null,
            layoutWidth: sq.layoutWidth ?? null,
            nextPlacement: sq.nextPlacement ?? null,
            goUp: sq.goUp ?? null,
            manuscriptEnabled: sq.manuscriptPaper?.enabled ?? false,
            manuscriptColumns: sq.manuscriptPaper?.columns ?? 20,
            manuscriptRows: sq.manuscriptPaper?.rows ?? 10,
            manuscriptCellSizeMm: 0, // 廃止: cellHeight / rows から逆算
            borderStyleTop: sq.borderStyles?.top ?? null,
            borderStyleBottom: sq.borderStyles?.bottom ?? null,
            borderStyleLeft: sq.borderStyles?.left ?? null,
            borderStyleRight: sq.borderStyles?.right ?? null,
          },
        })

        // テキスト要素（小問）
        for (let ti = 0; ti < sq.textElements.length; ti++) {
          const te = sq.textElements[ti]
          await tx.asbTextElement.create({
            data: {
              id: te.id,
              subQuestionId: sq.id,
              text: te.text,
              fontSize: te.fontSize,
              horizontalAlign: te.horizontalAlign,
              verticalAlign: te.verticalAlign,
              order: ti,
            },
          })
        }

        // 画像要素（小問）
        if (sq.imageElements) {
          for (let ii = 0; ii < sq.imageElements.length; ii++) {
            const ie = sq.imageElements[ii]
            await tx.asbImageElement.create({
              data: {
                id: ie.id,
                subQuestionId: sq.id,
                imagePath: ie.imagePath,
                originalName: ie.originalName,
                objectFit: ie.objectFit,
                horizontalAlign: ie.horizontalAlign,
                verticalAlign: ie.verticalAlign,
                opacity: ie.opacity,
                order: ii,
              },
            })
          }
        }

        // OMR設定（小問）
        if (sq.omrConfig) {
          await createOmrConfig(tx, { subQuestionId: sq.id }, sq.omrConfig)
        }

        // 枝問
        for (let bi = 0; bi < sq.branchQuestions.length; bi++) {
          const bq = sq.branchQuestions[bi]
          await tx.asbBranchQuestion.create({
            data: {
              id: bq.id,
              subQuestionId: sq.id,
              label: bq.label,
              order: bi,
              heightMultiplier: bq.heightMultiplier,
              points: bq.points,
              layoutWidth: bq.layoutWidth ?? null,
              nextPlacement: bq.nextPlacement ?? null,
              goUp: bq.goUp ?? null,
              borderStyleTop: bq.borderStyles?.top ?? null,
              borderStyleBottom: bq.borderStyles?.bottom ?? null,
              borderStyleLeft: bq.borderStyles?.left ?? null,
              borderStyleRight: bq.borderStyles?.right ?? null,
            },
          })

          // テキスト要素（枝問）
          for (let ti = 0; ti < bq.textElements.length; ti++) {
            const te = bq.textElements[ti]
            await tx.asbTextElement.create({
              data: {
                id: te.id,
                branchQuestionId: bq.id,
                text: te.text,
                fontSize: te.fontSize,
                horizontalAlign: te.horizontalAlign,
                verticalAlign: te.verticalAlign,
                order: ti,
              },
            })
          }

          // 画像要素（枝問）
          if (bq.imageElements) {
            for (let ii = 0; ii < bq.imageElements.length; ii++) {
              const ie = bq.imageElements[ii]
              await tx.asbImageElement.create({
                data: {
                  id: ie.id,
                  branchQuestionId: bq.id,
                  imagePath: ie.imagePath,
                  originalName: ie.originalName,
                  objectFit: ie.objectFit,
                  horizontalAlign: ie.horizontalAlign,
                  verticalAlign: ie.verticalAlign,
                  opacity: ie.opacity,
                  order: ii,
                },
              })
            }
          }

          // OMR設定（枝問）
          if (bq.omrConfig) {
            await createOmrConfig(tx, { branchQuestionId: bq.id }, bq.omrConfig)
          }
        }
      }
    }
  })
}

// =============================================================================
// 削除
// =============================================================================

export async function deleteAsbDefinition(id: string): Promise<boolean> {
  try {
    await prisma.asbDefinition.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

// =============================================================================
// 内部ヘルパー: GlobalSettings ↔ DBフラットカラム
// =============================================================================

type FlatGlobalSettings = {
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
}

function flattenGlobalSettings(s: GlobalSettings): FlatGlobalSettings {
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
  }
}

function unflattenGlobalSettings(row: AsbDefinition): GlobalSettings {
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
  }
}

// =============================================================================
// 内部ヘルパー: DB → AnswerSheetDefinition 変換
// =============================================================================

function dbTextElements(elements: AsbTextElement[]): CellTextElement[] {
  return elements.map((te) => ({
    id: te.id,
    text: te.text,
    fontSize: te.fontSize,
    horizontalAlign: te.horizontalAlign as CellTextElement["horizontalAlign"],
    verticalAlign: te.verticalAlign as CellTextElement["verticalAlign"],
  }))
}

function dbImageElements(elements: AsbImageElement[]): CellImageElement[] {
  return elements.map((ie) => ({
    id: ie.id,
    imagePath: ie.imagePath,
    originalName: ie.originalName,
    objectFit: ie.objectFit as CellImageElement["objectFit"],
    horizontalAlign: ie.horizontalAlign as CellImageElement["horizontalAlign"],
    verticalAlign: ie.verticalAlign as CellImageElement["verticalAlign"],
    opacity: ie.opacity,
  }))
}

function dbToOmrConfig(
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

function dbToDefinition(row: DbDefinitionFull): AnswerSheetDefinition {
  const settings = unflattenGlobalSettings(row)
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
// 内部ヘルパー: OMRConfig作成
// =============================================================================

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

async function createOmrConfig(
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
