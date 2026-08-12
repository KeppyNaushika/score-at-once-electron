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
  dbToDefinition,
  flattenGlobalSettings,
  upsertOmrConfig,
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

/**
 * 解答用紙の一覧を取得する。
 *
 * 誰の解答用紙も一覧に出す（閲覧は全員、編集は担当者だけ）。
 * 自分の分だけを見る絞り込みは表示側の切り替えなので、ここでは絞らない。
 */
export async function listAsbDefinitions(): Promise<ASBDefinitionListItem[]> {
  const rows = await prisma.asbDefinition.findMany({
    include: {
      user: true,
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
      // 担当者（この解答用紙を編集できる唯一の利用者）
      ownerId: row.userId,
      ownerName: row.user.name,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }
  })
}

// =============================================================================
// 単体取得（全リレーション付き → AnswerSheetDefinition型に変換）
// =============================================================================

/** IDで解答用紙を取得し AnswerSheetDefinition に変換する */
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
// 保存（残るものは id ごと残し、消えたものだけ消す）
// =============================================================================

/** 保存後に残るべき id を、木を辿って集めたもの */
interface SurvivingIds {
  headerFields: string[]
  majorQuestions: string[]
  subQuestions: string[]
  branchQuestions: string[]
  charGuides: string[]
  textElements: string[]
  imageElements: string[]
  /** OMR設定を持つ小問・枝問（設定自体は id を持ち回らないので親で数える） */
  omrSubQuestions: string[]
  omrBranchQuestions: string[]
}

function collectSurvivingIds(definition: AnswerSheetDefinition): SurvivingIds {
  const surviving: SurvivingIds = {
    headerFields: definition.settings.headerFields.map((field) => field.id),
    majorQuestions: [],
    subQuestions: [],
    branchQuestions: [],
    charGuides: [],
    textElements: [],
    imageElements: [],
    omrSubQuestions: [],
    omrBranchQuestions: [],
  }

  for (const majorQuestion of definition.majorQuestions) {
    surviving.majorQuestions.push(majorQuestion.id)
    for (const subQuestion of majorQuestion.subQuestions) {
      surviving.subQuestions.push(subQuestion.id)
      for (const charGuide of subQuestion.manuscriptPaper?.charGuides ?? []) {
        surviving.charGuides.push(charGuide.id)
      }
      for (const textElement of subQuestion.textElements) {
        surviving.textElements.push(textElement.id)
      }
      for (const imageElement of subQuestion.imageElements ?? []) {
        surviving.imageElements.push(imageElement.id)
      }
      if (subQuestion.omrConfig) {
        surviving.omrSubQuestions.push(subQuestion.id)
      }
      for (const branchQuestion of subQuestion.branchQuestions) {
        surviving.branchQuestions.push(branchQuestion.id)
        for (const textElement of branchQuestion.textElements) {
          surviving.textElements.push(textElement.id)
        }
        for (const imageElement of branchQuestion.imageElements ?? []) {
          surviving.imageElements.push(imageElement.id)
        }
        if (branchQuestion.omrConfig) {
          surviving.omrBranchQuestions.push(branchQuestion.id)
        }
      }
    }
  }
  return surviving
}

/**
 * 解答用紙を保存する。
 *
 * **消えたものだけを消し、残るものは id ごと残す。** 以前は全消しして作り直して
 * いたため、保存のたびに全行の削除と挿入が同期の変更履歴へ流れていた。削除と挿入は
 * 同一トランザクション＝同一秒に起きるので、受け取る側で「同時刻なら削除が勝つ」
 * 判定に当たり、相手の端末から解答用紙が消えたまま復活しない経路があった。
 *
 * 保存できるのは担当者（`userId`）だけ。担当は保存では変わらない。
 */
export async function saveAsbDefinition(
  definition: AnswerSheetDefinition,
  userId: string
): Promise<void> {
  const existing = await prisma.asbDefinition.findUnique({
    where: { id: definition.id },
    select: { userId: true },
  })
  if (existing && existing.userId !== userId) {
    throw new Error(
      "この解答用紙の担当ではないため保存できません。担当を譲ってもらってください。"
    )
  }
  const existed = existing !== null
  const surviving = collectSurvivingIds(definition)
  const inDefinition = { majorQuestion: { definitionId: definition.id } }
  const inSubQuestions = { subQuestion: inDefinition }

  await prisma.$transaction(async (tx) => {
    // 1. 無くなったものだけ消す（親が消えれば子は Cascade で消える）
    await tx.asbHeaderField.deleteMany({
      where: {
        definitionId: definition.id,
        id: { notIn: surviving.headerFields },
      },
    })
    await tx.asbMajorQuestion.deleteMany({
      where: {
        definitionId: definition.id,
        id: { notIn: surviving.majorQuestions },
      },
    })
    await tx.asbSubQuestion.deleteMany({
      where: { ...inDefinition, id: { notIn: surviving.subQuestions } },
    })
    await tx.asbBranchQuestion.deleteMany({
      where: { ...inSubQuestions, id: { notIn: surviving.branchQuestions } },
    })
    await tx.asbCharGuide.deleteMany({
      where: { ...inSubQuestions, id: { notIn: surviving.charGuides } },
    })
    const inQuestions = [
      { subQuestion: inDefinition },
      { branchQuestion: inSubQuestions },
    ]
    await tx.asbTextElement.deleteMany({
      where: { OR: inQuestions, id: { notIn: surviving.textElements } },
    })
    await tx.asbImageElement.deleteMany({
      where: { OR: inQuestions, id: { notIn: surviving.imageElements } },
    })
    await tx.asbOmrConfig.deleteMany({
      where: {
        OR: [
          {
            subQuestion: inDefinition,
            subQuestionId: { notIn: surviving.omrSubQuestions },
          },
          {
            branchQuestion: inSubQuestions,
            branchQuestionId: { notIn: surviving.omrBranchQuestions },
          },
        ],
      },
    })

    // 2. 解答用紙そのもの。担当と作成日時は保存では動かさない
    const flat = flattenGlobalSettings(definition.settings)
    const definitionData = {
      name: definition.name,
      renderMode: definition.renderMode,
      labelPresetMajor: definition.labelPresets?.major ?? null,
      labelPresetSub: definition.labelPresets?.sub ?? null,
      labelPresetBranch: definition.labelPresets?.branch ?? null,
      ...flat,
    }
    await tx.asbDefinition.upsert({
      where: { id: definition.id },
      create: { id: definition.id, userId, ...definitionData },
      update: definitionData,
    })

    // ヘッダーフィールドを作成
    for (let hi = 0; hi < definition.settings.headerFields.length; hi++) {
      const headerField = definition.settings.headerFields[hi]
      await tx.asbHeaderField.upsert({
        where: { id: headerField.id },
        create: {
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
        update: {
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
      await tx.asbMajorQuestion.upsert({
        where: { id: majorQuestion.id },
        create: {
          id: majorQuestion.id,
          definitionId: definition.id,
          label: majorQuestion.label,
          order: mi,
        },
        update: {
          definitionId: definition.id,
          label: majorQuestion.label,
          order: mi,
        },
      })

      for (let si = 0; si < majorQuestion.subQuestions.length; si++) {
        const subQuestion = majorQuestion.subQuestions[si]
        await tx.asbSubQuestion.upsert({
          where: { id: subQuestion.id },
          create: {
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
          update: {
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
          await tx.asbCharGuide.upsert({
            where: { id: charGuide.id },
            create: {
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
            update: {
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
          await tx.asbTextElement.upsert({
            where: { id: textElement.id },
            create: {
              id: textElement.id,
              subQuestionId: subQuestion.id,
              text: textElement.text,
              fontSize: textElement.fontSize,
              horizontalAlign: textElement.horizontalAlign,
              verticalAlign: textElement.verticalAlign,
              order: ti,
            },
            update: {
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
            await tx.asbImageElement.upsert({
              where: { id: imageElement.id },
              create: {
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
              update: {
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
          await upsertOmrConfig(
            tx,
            { subQuestionId: subQuestion.id },
            subQuestion.omrConfig
          )
        }

        // 枝問
        for (let bi = 0; bi < subQuestion.branchQuestions.length; bi++) {
          const branchQuestion = subQuestion.branchQuestions[bi]
          await tx.asbBranchQuestion.upsert({
            where: { id: branchQuestion.id },
            create: {
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
            update: {
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
            await tx.asbTextElement.upsert({
              where: { id: textElement.id },
              create: {
                id: textElement.id,
                branchQuestionId: branchQuestion.id,
                text: textElement.text,
                fontSize: textElement.fontSize,
                horizontalAlign: textElement.horizontalAlign,
                verticalAlign: textElement.verticalAlign,
                order: ti,
              },
              update: {
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
              await tx.asbImageElement.upsert({
                where: { id: imageElement.id },
                create: {
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
                update: {
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
            await upsertOmrConfig(
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

/** 解答用紙を削除する。削除できるのは担当者だけ */
export async function deleteAsbDefinition(
  id: string,
  userId: string
): Promise<boolean> {
  try {
    const before = await prisma.asbDefinition.findUnique({
      where: { id },
    })
    if (before && before.userId !== userId) {
      throw new Error(
        "この解答用紙の担当ではないため削除できません。担当を譲ってもらってください。"
      )
    }
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

// =============================================================================
// 担当
// =============================================================================

/** 解答用紙の担当者を引く（編集できるのはこの利用者だけ） */
export async function getAsbDefinitionOwner(
  id: string
): Promise<{ ownerId: string; ownerName: string } | null> {
  const definition = await prisma.asbDefinition.findUnique({
    where: { id },
    select: { userId: true, user: { select: { name: true } } },
  })
  if (!definition) return null
  return { ownerId: definition.userId, ownerName: definition.user.name }
}

// =============================================================================
// 担当の受け渡し
// =============================================================================

/**
 * 解答用紙の担当を別の利用者へ渡す。
 *
 * 編集できるのは担当者ひとりだけで、他の利用者は閲覧と書き出しだけができる。
 * 渡せるのは今の担当者だけ（横から取り上げられないようにする）。
 */
export async function transferAsbDefinitionOwner(
  id: string,
  currentUserId: string,
  nextUserId: string
): Promise<void> {
  const definition = await prisma.asbDefinition.findUnique({
    where: { id },
    select: { name: true, userId: true },
  })
  if (!definition) {
    throw new Error("解答用紙が見つかりません")
  }
  if (definition.userId !== currentUserId) {
    throw new Error("担当を渡せるのは今の担当者だけです")
  }
  const nextUser = await prisma.user.findUnique({
    where: { id: nextUserId },
    select: { name: true },
  })
  if (!nextUser) {
    throw new Error("渡す相手の利用者が見つかりません")
  }

  await prisma.asbDefinition.update({
    where: { id },
    data: { userId: nextUserId },
  })

  await recordAuditLog({
    action: "answer_sheet.transfer_owner",
    userId: currentUserId,
    entityType: "AsbDefinition",
    entityId: id,
    scopeId: id,
    scopeLabel: definition.name,
    target: definition.name,
    summary: `解答用紙の担当を${nextUser.name}へ渡しました`,
  })
}
