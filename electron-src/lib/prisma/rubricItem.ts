/**
 * ルーブリック項目（RubricItem）と設問の採点方式の読み書き（docs/vlm-grading-design.md §4・§5-2）。
 *
 * 項目は設問ごとに、その試験の協働採点者の間で共有する。作成者は記録するが持ち主ではない
 * （他の教員の項目も直せる。設問の基準を揃えるのが共有の目的）。
 *
 * **点の計算はここでしない。** 項目の値を変えたときに他の採点者の点を計算し直すのは
 * renderer の仕事で、材料は `getRubricRecalculationSource`（rubricApplication.ts）が返す。
 * 項目を消すと適用はカスケードで消えるので、renderer は消す前に材料を読んで計算しておく。
 */

import { Prisma } from "@prisma/client"

import {
  type RubricItemEffect,
  validateRubricItemEffect,
} from "@/lib/shared/rubric/rubricItemValidator"
import { isScoringMethod } from "@/types/rubric.types"

import { type AuditChange, diffFields, recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import { cropRegionAuditTarget } from "./auditTargets"
import prisma from "./client"
import { PUBLIC_USER_OMIT } from "./publicUser"

/** 項目を画面へ返すときの木。作成者は秘密（passcode）を落として連れてくる */
const rubricItemInclude = {
  createdBy: { omit: PUBLIC_USER_OMIT },
} satisfies Prisma.RubricItemInclude

/** 並び順（set が複数当たったときに先のものを採る順と同じ） */
const rubricItemOrder = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.RubricItemOrderByWithRelationInput[]

/** 設問の項目を並び順に全部（作成者付き） */
export async function listRubricItemsByCropRegion(cropRegionId: string) {
  return prisma.rubricItem.findMany({
    where: { cropRegionId },
    include: rubricItemInclude,
    orderBy: rubricItemOrder,
  })
}

/** 試験の全設問の項目（設問一覧の印や、設問をまたぐ表示に使う） */
export async function listRubricItemsByExam(examId: string) {
  return prisma.rubricItem.findMany({
    where: { cropRegion: { examPage: { examId } } },
    include: rubricItemInclude,
    orderBy: [{ cropRegionId: "asc" }, ...rubricItemOrder],
  })
}

/** 項目の効き方を書く列の値へ（検証を通ったものだけを受ける） */
const toEffectColumns = (
  effect: RubricItemEffect,
  maxPoints: number | null
) => {
  const validation = validateRubricItemEffect(effect, maxPoints)
  if (!validation.ok) throw new Error(validation.reasons.join("・"))
  const { value } = validation
  return {
    effectKind: value.effectKind,
    pointDelta:
      value.pointDelta === null ? null : new Prisma.Decimal(value.pointDelta),
    setStatus: value.setStatus,
    setScore:
      value.setScore === null ? null : new Prisma.Decimal(value.setScore),
  }
}

/** 設問の配点（検証の上限）。設問が無ければ投げる */
async function findCropRegionOrThrow(cropRegionId: string) {
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: cropRegionId },
  })
  if (!cropRegion) throw new Error("設問が見つかりません")
  return cropRegion
}

/** 項目の作成の引数。作成者は main が操作者から決める */
export interface CreateRubricItemData extends RubricItemEffect {
  cropRegionId: string
  label: string
  adviceText: string
  sortOrder: number
}

/** 項目を1つ作る。効き方は §6-4 の規則で検証してから書く */
export async function createRubricItem(
  data: CreateRubricItemData,
  actorUserId: string
) {
  const cropRegion = await findCropRegionOrThrow(data.cropRegionId)
  const created = await prisma.rubricItem.create({
    data: {
      cropRegionId: data.cropRegionId,
      label: data.label,
      adviceText: data.adviceText,
      sortOrder: data.sortOrder,
      createdByUserId: actorUserId,
      ...toEffectColumns(data, cropRegion.points),
    },
    include: rubricItemInclude,
  })

  const scope = await resolveExamScopeByCropRegion(data.cropRegionId)
  await recordAuditLog({
    action: "exam.rubric_item.create",
    userId: actorUserId,
    entityType: "RubricItem",
    entityId: created.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: created.label || null,
    targets: [cropRegionAuditTarget(cropRegion)],
  })

  return created
}

/**
 * 項目の変更の引数。効き方は4列を1組で受ける（1列ずつ直すと、途中の組が検証を通らない）。
 * 省略した欄は触らない
 */
export interface UpdateRubricItemData {
  label?: string
  adviceText?: string
  sortOrder?: number
  effect?: RubricItemEffect
}

/** 監査ログの差分に載せる項目の値（Decimal は数へ） */
const auditedRubricItemFields = (item: {
  label: string
  adviceText: string
  sortOrder: number
  effectKind: string
  pointDelta: Prisma.Decimal | null
  setStatus: string | null
  setScore: Prisma.Decimal | null
}) => ({
  label: item.label,
  adviceText: item.adviceText,
  sortOrder: item.sortOrder,
  effectKind: item.effectKind,
  pointDelta: item.pointDelta === null ? null : item.pointDelta.toNumber(),
  setStatus: item.setStatus,
  setScore: item.setScore === null ? null : item.setScore.toNumber(),
})

/** 項目を直す。他の採点者の点の計算し直しは、renderer が続けて行う */
export async function updateRubricItem(
  rubricItemId: string,
  data: UpdateRubricItemData,
  actorUserId: string
) {
  const before = await prisma.rubricItem.findUnique({
    where: { id: rubricItemId },
    include: { cropRegion: true },
  })
  if (!before) throw new Error("ルーブリック項目が見つかりません")

  const updated = await prisma.rubricItem.update({
    where: { id: rubricItemId },
    data: {
      label: data.label,
      adviceText: data.adviceText,
      sortOrder: data.sortOrder,
      ...(data.effect
        ? toEffectColumns(data.effect, before.cropRegion.points)
        : {}),
    },
    include: rubricItemInclude,
  })

  const changes: AuditChange[] = diffFields(
    auditedRubricItemFields(before),
    auditedRubricItemFields(updated),
    [
      { field: "label", label: "判断理由" },
      { field: "adviceText", label: "助言" },
      { field: "sortOrder", label: "並び順" },
      { field: "effectKind", label: "種類" },
      { field: "pointDelta", label: "加減" },
      { field: "setStatus", label: "判定" },
      { field: "setScore", label: "点" },
    ]
  )
  const scope = await resolveExamScopeByCropRegion(before.cropRegionId)
  await recordAuditLog({
    action: "exam.rubric_item.update",
    userId: actorUserId,
    entityType: "RubricItem",
    entityId: rubricItemId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: updated.label || null,
    changes,
    targets: [cropRegionAuditTarget(before.cropRegion)],
  })

  return updated
}

/**
 * 項目を消す。**適用はカスケードで一緒に消える**（「要再採点」の印は持たない。#836）。
 * 消えた適用の点の計算し直しは renderer が、消す前に読んだ材料で行う。消した行を返す
 */
export async function deleteRubricItem(
  rubricItemId: string,
  actorUserId: string
) {
  const before = await prisma.rubricItem.findUnique({
    where: { id: rubricItemId },
    include: { cropRegion: true },
  })
  if (!before) throw new Error("ルーブリック項目が見つかりません")

  const scope = await resolveExamScopeByCropRegion(before.cropRegionId)
  const deleted = await prisma.rubricItem.delete({
    where: { id: rubricItemId },
  })

  await recordAuditLog({
    action: "exam.rubric_item.delete",
    userId: actorUserId,
    entityType: "RubricItem",
    entityId: rubricItemId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: before.label || null,
    targets: [cropRegionAuditTarget(before.cropRegion)],
  })

  return deleted
}

/**
 * 設問の採点方式を変える。点の計算し直し（方式の変更は4つのきっかけの1つ。§4-4）は
 * renderer が続けて行う。値は境界の外から来るので、文字列で受けて値の集合で確かめる
 */
export async function setCropRegionScoringMethod(
  cropRegionId: string,
  scoringMethod: string,
  actorUserId: string
) {
  if (!isScoringMethod(scoringMethod)) {
    throw new Error(`採点方式「${scoringMethod}」は使えません`)
  }
  const before = await findCropRegionOrThrow(cropRegionId)
  const updated = await prisma.cropRegion.update({
    where: { id: cropRegionId },
    data: { scoringMethod },
  })

  const scope = await resolveExamScopeByCropRegion(cropRegionId)
  await recordAuditLog({
    action: "exam.region.scoring_method_update",
    userId: actorUserId,
    entityType: "CropRegion",
    entityId: cropRegionId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: updated.label || null,
    changes: [
      {
        field: "scoringMethod",
        label: "採点方式",
        before: before.scoringMethod,
        after: updated.scoringMethod,
      },
    ],
    targets: [cropRegionAuditTarget(updated)],
  })

  return updated
}
