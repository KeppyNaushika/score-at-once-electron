/**
 * 解答用紙（AsbDefinition）そのもののDB操作。
 *
 * 一覧・単体取得・削除・担当の受け渡しと、解答用紙1件の列（{@link asbDefinitionRow}）。
 * 子（ヘッダー項目・設問・セルの中身）の書き込みは実体ごとのモジュールが持ち、
 * 木をまるごと置き換える経路は `asbDefinitionReplace.ts` にある。
 * DB行 ↔ AnswerSheetDefinition の変換は `asbDefinitionConverters.ts`。
 */

import type { Prisma } from "@prisma/client"

import type { ASBDefinitionListItem } from "../../../src/types/answerSheetBuilder.types"
import type { AnswerSheetDefinition } from "../../../src/types/answerSheetDefinition.types"
import {
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
// 解答用紙そのものの列
// =============================================================================

/**
 * 解答用紙1件の列（子は含まない）。
 *
 * 用紙設定は列としてフラットに並ぶので、`flattenGlobalSettings` が広げたものを
 * そのまま載せる。**担当（`userId`）と作成日時はここに含めない** — どちらも
 * 保存で動くものではない（作成時と担当の受け渡しでだけ決まる）。
 */
export function asbDefinitionRow(definition: AnswerSheetDefinition) {
  return {
    name: definition.name,
    labelPresetMajor: definition.labelPresets?.major ?? null,
    labelPresetSub: definition.labelPresets?.sub ?? null,
    labelPresetBranch: definition.labelPresets?.branch ?? null,
    ...flattenGlobalSettings(definition.settings),
  }
}

// =============================================================================
// 削除
// =============================================================================

/**
 * 解答用紙を削除する。削除できるのは担当者だけ。
 *
 * 担当でないことは `false`（＝見つからない）ではなく**例外で伝える**。`false` にすると
 * 呼び出し側が「解答用紙が見つかりません」と言うことになり、消えたように読める。
 */
export async function deleteAsbDefinition(
  id: string,
  userId: string
): Promise<boolean> {
  const before = await prisma.asbDefinition.findUnique({
    where: { id },
  })
  if (before && before.userId !== userId) {
    throw new Error(
      "この解答用紙の担当ではないため削除できません。担当を譲ってもらってください。"
    )
  }

  try {
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
