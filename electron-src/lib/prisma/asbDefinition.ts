/**
 * 解答用紙ビルダー定義のDB操作レイヤー
 *
 * AnswerSheetDefinition型 ↔ DB(7テーブル) のCRUD操作を提供する。
 * 変換ロジックは asbDefinitionConverters.ts に分離。
 */

import type {
  AsbBranchQuestion,
  AsbDefinition,
  AsbHeaderField,
  AsbImageElement,
  AsbMajorQuestion,
  AsbOmrConfig,
  AsbSubQuestion,
  AsbTextElement,
} from "@prisma/client"

import type { ASBDefinitionListItem } from "../../../types/answerSheetBuilder.types"
import type { AnswerSheetDefinition } from "../../../types/answerSheetDefinition.types"
import {
  createOmrConfig,
  dbToDefinition,
  flattenGlobalSettings,
} from "./asbDefinitionConverters"
import prisma from "./client"

// =============================================================================
// DB型定義（fullInclude用）
// =============================================================================

export type DbDefinitionFull = AsbDefinition & {
  headerFields: AsbHeaderField[]
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
  headerFields: { orderBy: { order: "asc" as const } },
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

// =============================================================================
// 一覧取得（軽量）
// =============================================================================

/** ユーザーに紐づく解答用紙定義の一覧を取得する */
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
              usesBranchPoints: true,
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
          if (sq.usesBranchPoints === false) {
            // 完答モード: 小問の点数を使用
            questionCount += 1
            totalPoints += sq.points
          } else {
            // 枝問ごとの配点モード: 枝問の点数を合計
            questionCount += sq.branchQuestions.length
            totalPoints += sq.branchQuestions.reduce((s, b) => s + b.points, 0)
          }
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

/** IDで解答用紙定義を取得し AnswerSheetDefinition に変換する */
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

/** 解答用紙定義を保存する（既存があれば delete → recreate） */
export async function saveAsbDefinition(
  definition: AnswerSheetDefinition,
  userId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 既存があれば子テーブルごと削除（Cascade）
    await tx.asbDefinition.deleteMany({ where: { id: definition.id } })

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

    // ヘッダーフィールドを作成
    for (let hi = 0; hi < definition.settings.headerFields.length; hi++) {
      const hf = definition.settings.headerFields[hi]
      await tx.asbHeaderField.create({
        data: {
          id: hf.id,
          definitionId: definition.id,
          type: hf.type ?? "field",
          label: hf.label,
          widthMm: hf.widthMm,
          heightMm: hf.heightMm,
          gridCount: hf.gridCount,
          lineStyle: hf.lineStyle,
          lineWidth: hf.lineWidth,
          order: hi,
          fontSize: hf.fontSize ?? null,
          linkedRegionType: hf.linkedRegionType ?? null,
        },
      })
    }

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
                visibility: ie.visibility ?? "both",
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
                  visibility: ie.visibility ?? "both",
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

/** 解答用紙定義を削除する */
export async function deleteAsbDefinition(id: string): Promise<boolean> {
  try {
    await prisma.asbDefinition.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}
