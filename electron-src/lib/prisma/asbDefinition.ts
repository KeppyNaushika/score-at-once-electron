/**
 * 解答用紙ビルダー定義のDB操作レイヤー
 *
 * AnswerSheetDefinition型 ↔ DB(7テーブル) のCRUD操作を提供する。
 * 変換ロジックは asbDefinitionConverters.ts に分離。
 */

import type { Prisma } from "@prisma/client"

import type { ASBDefinitionListItem } from "../../../src/types/answerSheetBuilder.types"
import type { AnswerSheetDefinition } from "../../../src/types/answerSheetDefinition.types"
import {
  createOmrConfig,
  dbToDefinition,
  flattenGlobalSettings,
} from "./asbDefinitionConverters"
import { recordAuditLog } from "./auditLog"
import prisma from "./client"

// =============================================================================
// DB型定義（fullInclude用）
// =============================================================================

const fullInclude = {
  headerFields: { orderBy: { order: "asc" } },
  majorQuestions: {
    orderBy: { order: "asc" },
    include: {
      subQuestions: {
        orderBy: { order: "asc" },
        include: {
          branchQuestions: {
            orderBy: { order: "asc" },
            include: {
              textElements: { orderBy: { order: "asc" } },
              imageElements: { orderBy: { order: "asc" } },
              omrConfig: {
                include: {
                  choiceOptions: {
                    orderBy: { choiceIndex: "asc" },
                  },
                },
              },
            },
          },
          textElements: { orderBy: { order: "asc" } },
          imageElements: { orderBy: { order: "asc" } },
          charGuides: { orderBy: { order: "asc" } },
          omrConfig: {
            include: {
              choiceOptions: {
                orderBy: { choiceIndex: "asc" },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.AsbDefinitionInclude

/**
 * `fullInclude` で取得した1行。形の SSOT は include 側にあり、ここは導出だけを行う。
 *
 * 以前は同じ形を手書きで複製し、取得箇所で `as DbDefinitionFull` と名乗らせていた。
 * include に列やリレーションを足しても型は追随せず、逆に include から落としても
 * 型検査が通ってしまう状態だった。
 */
export type DbDefinitionFull = Prisma.AsbDefinitionGetPayload<{
  include: typeof fullInclude
}>

// =============================================================================
// 一覧取得（軽量）
// =============================================================================

/** ユーザーに紐づく解答用紙定義の一覧を取得する */
export async function listAsbDefinitions(
  userId: string
): Promise<ASBDefinitionListItem[]> {
  const rows = await prisma.asbDefinition.findMany({
    where: { userId },
    include: {
      tags: { include: { tag: true } },
      majorQuestions: {
        include: { subQuestions: { include: { branchQuestions: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  return rows.map((row) => {
    let questionCount = 0
    let totalPoints = 0
    for (const majorQuestion of row.majorQuestions) {
      for (const subQuestion of majorQuestion.subQuestions) {
        if (subQuestion.branchQuestions.length > 0) {
          if (subQuestion.usesBranchPoints === false) {
            // 完答モード: 小問の点数を使用
            questionCount += 1
            totalPoints += subQuestion.points
          } else {
            // 枝問ごとの配点モード: 枝問の点数を合計
            questionCount += subQuestion.branchQuestions.length
            totalPoints += subQuestion.branchQuestions.reduce(
              (sum, branchQuestion) => sum + branchQuestion.points,
              0
            )
          }
        } else {
          questionCount += 1
          totalPoints += subQuestion.points
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
      tags: row.tags.map((asbDefinitionTag) => asbDefinitionTag.tag),
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
  return dbToDefinition(row)
}

// =============================================================================
// 保存（トランザクション内 delete → recreate）
// =============================================================================

/** 解答用紙定義を保存する（既存があれば delete → recreate） */
export async function saveAsbDefinition(
  definition: AnswerSheetDefinition,
  userId: string
): Promise<void> {
  // 新規/更新の判定（saveは delete→recreate のため、事前に存在確認）
  const existed =
    (await prisma.asbDefinition.count({ where: { id: definition.id } })) > 0

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
      const headerField = definition.settings.headerFields[hi]
      await tx.asbHeaderField.create({
        data: {
          id: headerField.id,
          definitionId: definition.id,
          type: headerField.type ?? "field",
          label: headerField.label,
          widthMm: headerField.widthMm,
          heightMm: headerField.heightMm,
          gridCount: headerField.gridCount,
          lineStyle: headerField.lineStyle,
          lineWidth: headerField.lineWidth,
          order: hi,
          fontSize: headerField.fontSize ?? null,
          linkedRegionType: headerField.linkedRegionType ?? null,
        },
      })
    }

    // 大問 → 小問 → 枝問 を再帰的に作成
    for (let mi = 0; mi < definition.majorQuestions.length; mi++) {
      const majorQuestion = definition.majorQuestions[mi]
      await tx.asbMajorQuestion.create({
        data: {
          id: majorQuestion.id,
          definitionId: definition.id,
          label: majorQuestion.label,
          order: mi,
        },
      })

      for (let si = 0; si < majorQuestion.subQuestions.length; si++) {
        const subQuestion = majorQuestion.subQuestions[si]
        await tx.asbSubQuestion.create({
          data: {
            id: subQuestion.id,
            majorQuestionId: majorQuestion.id,
            label: subQuestion.label,
            order: si,
            heightMultiplier: subQuestion.heightMultiplier,
            points: subQuestion.points,
            usesBranchPoints: subQuestion.usesBranchPoints ?? null,
            layoutWidth: subQuestion.layoutWidth ?? null,
            nextPlacement: subQuestion.nextPlacement ?? null,
            goUp: subQuestion.goUp ?? null,
            manuscriptEnabled: subQuestion.manuscriptPaper?.enabled ?? false,
            manuscriptColumns: subQuestion.manuscriptPaper?.columns ?? 20,
            manuscriptRows: subQuestion.manuscriptPaper?.rows ?? 10,
            manuscriptCellSizeMm: 0, // 廃止: cellHeight / rows から逆算
            manuscriptGuideFontSize:
              subQuestion.manuscriptPaper?.guideFontSize ?? null,
            manuscriptGuidePosition:
              subQuestion.manuscriptPaper?.guidePosition ?? null,
            manuscriptGuidePadding:
              subQuestion.manuscriptPaper?.guidePadding ?? null,
            borderStyleTop: subQuestion.borderStyles?.top ?? null,
            borderStyleBottom: subQuestion.borderStyles?.bottom ?? null,
            borderStyleLeft: subQuestion.borderStyles?.left ?? null,
            borderStyleRight: subQuestion.borderStyles?.right ?? null,
          },
        })

        // 文字位置マーカー（数字ガイド＋区切り罫線）
        const charGuides = subQuestion.manuscriptPaper?.charGuides ?? []
        for (let gi = 0; gi < charGuides.length; gi++) {
          const charGuide = charGuides[gi]
          await tx.asbCharGuide.create({
            data: {
              id: charGuide.id,
              subQuestionId: subQuestion.id,
              order: gi,
              atChar: charGuide.atChar,
              label: charGuide.label,
              boundary: charGuide.boundary ?? null,
              boundaryWidth: charGuide.boundaryWidth ?? null,
              boundaryDashRatio: charGuide.boundaryDashRatio ?? null,
              boundaryGapRatio: charGuide.boundaryGapRatio ?? null,
            },
          })
        }

        // テキスト要素（小問）
        for (let ti = 0; ti < subQuestion.textElements.length; ti++) {
          const textElement = subQuestion.textElements[ti]
          await tx.asbTextElement.create({
            data: {
              id: textElement.id,
              subQuestionId: subQuestion.id,
              text: textElement.text,
              fontSize: textElement.fontSize,
              horizontalAlign: textElement.horizontalAlign,
              verticalAlign: textElement.verticalAlign,
              order: ti,
            },
          })
        }

        // 画像要素（小問）
        if (subQuestion.imageElements) {
          for (let ii = 0; ii < subQuestion.imageElements.length; ii++) {
            const imageElement = subQuestion.imageElements[ii]
            await tx.asbImageElement.create({
              data: {
                id: imageElement.id,
                subQuestionId: subQuestion.id,
                imagePath: imageElement.imagePath,
                originalName: imageElement.originalName,
                objectFit: imageElement.objectFit,
                horizontalAlign: imageElement.horizontalAlign,
                verticalAlign: imageElement.verticalAlign,
                opacity: imageElement.opacity,
                visibility: imageElement.visibility ?? "both",
                order: ii,
              },
            })
          }
        }

        // OMR設定（小問）
        if (subQuestion.omrConfig) {
          await createOmrConfig(
            tx,
            { subQuestionId: subQuestion.id },
            subQuestion.omrConfig
          )
        }

        // 枝問
        for (let bi = 0; bi < subQuestion.branchQuestions.length; bi++) {
          const branchQuestion = subQuestion.branchQuestions[bi]
          await tx.asbBranchQuestion.create({
            data: {
              id: branchQuestion.id,
              subQuestionId: subQuestion.id,
              label: branchQuestion.label,
              order: bi,
              heightMultiplier: branchQuestion.heightMultiplier,
              points: branchQuestion.points,
              layoutWidth: branchQuestion.layoutWidth ?? null,
              nextPlacement: branchQuestion.nextPlacement ?? null,
              goUp: branchQuestion.goUp ?? null,
              borderStyleTop: branchQuestion.borderStyles?.top ?? null,
              borderStyleBottom: branchQuestion.borderStyles?.bottom ?? null,
              borderStyleLeft: branchQuestion.borderStyles?.left ?? null,
              borderStyleRight: branchQuestion.borderStyles?.right ?? null,
            },
          })

          // テキスト要素（枝問）
          for (let ti = 0; ti < branchQuestion.textElements.length; ti++) {
            const textElement = branchQuestion.textElements[ti]
            await tx.asbTextElement.create({
              data: {
                id: textElement.id,
                branchQuestionId: branchQuestion.id,
                text: textElement.text,
                fontSize: textElement.fontSize,
                horizontalAlign: textElement.horizontalAlign,
                verticalAlign: textElement.verticalAlign,
                order: ti,
              },
            })
          }

          // 画像要素（枝問）
          if (branchQuestion.imageElements) {
            for (let ii = 0; ii < branchQuestion.imageElements.length; ii++) {
              const imageElement = branchQuestion.imageElements[ii]
              await tx.asbImageElement.create({
                data: {
                  id: imageElement.id,
                  branchQuestionId: branchQuestion.id,
                  imagePath: imageElement.imagePath,
                  originalName: imageElement.originalName,
                  objectFit: imageElement.objectFit,
                  horizontalAlign: imageElement.horizontalAlign,
                  verticalAlign: imageElement.verticalAlign,
                  opacity: imageElement.opacity,
                  visibility: imageElement.visibility ?? "both",
                  order: ii,
                },
              })
            }
          }

          // OMR設定（枝問）
          if (branchQuestion.omrConfig) {
            await createOmrConfig(
              tx,
              { branchQuestionId: branchQuestion.id },
              branchQuestion.omrConfig
            )
          }
        }
      }
    }
  })

  // 監査ログ: 解答用紙の作成/更新
  await recordAuditLog({
    action: existed ? "answer_sheet.update" : "answer_sheet.create",
    userId,
    entityType: "AsbDefinition",
    entityId: definition.id,
    scopeId: definition.id,
    scopeLabel: definition.name,
    target: definition.name,
  })
}

// =============================================================================
// 削除
// =============================================================================

/** 解答用紙定義を削除する */
export async function deleteAsbDefinition(id: string): Promise<boolean> {
  try {
    const before = await prisma.asbDefinition.findUnique({
      where: { id },
    })
    await prisma.asbDefinition.delete({ where: { id } })

    await recordAuditLog({
      action: "answer_sheet.delete",
      entityType: "AsbDefinition",
      entityId: id,
      scopeId: id,
      scopeLabel: before?.name ?? null,
      target: before?.name ?? null,
    })

    return true
  } catch {
    return false
  }
}
