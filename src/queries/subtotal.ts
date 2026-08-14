import { queryOptions } from "@tanstack/react-query"

import type { CropSubtotalAssignmentType } from "@/electron-src/lib/prisma/cropSubtotal"

import { cropRegionsQuery } from "./cropRegion"
import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 小計点グループ（SubtotalGroup）と、採点領域への割り当て（CropSubtotal）の読み書き。
 *
 * 小計点グループ自体は試験を跨いで共有される1つの集合で、試験との紐付けは
 * ExamSubtotalGroup が持つ。そのため無効化の行き先も、グループ一覧そのものと
 * 「その試験に紐づくもの」の2種類に分かれる。
 *
 * 対応する preload は `electron-src/preload-apis/subtotalApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/** 小計点グループ1件（一覧の行。利用試験とタグを子として持つ） */
export type SubtotalGroupRow = Awaited<
  ReturnType<typeof window.electronAPI.getSubtotalGroups>
>[number]

/** 小計点グループの一覧（試験を跨いで共有される） */
export const subtotalGroupListQuery = () =>
  queryOptions({
    queryKey: ["subtotalGroup", "list"] as const,
    queryFn: () => window.electronAPI.getSubtotalGroups(),
  })

/** その試験と小計点グループの紐付け1件（グループを子として持つ） */
export type ExamSubtotalGroupRow = Awaited<
  ReturnType<typeof window.electronAPI.getActiveSubtotalGroupsForExam>
>[number]

/** その試験で有効になっている小計点グループ（ExamSubtotalGroup を返す） */
export const activeSubtotalGroupsQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "activeSubtotalGroups"] as const,
    queryFn: () => window.electronAPI.getActiveSubtotalGroupsForExam(examId),
  })

/** その試験にまだ追加していない小計点グループ */
export const availableSubtotalGroupsQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "availableSubtotalGroups"] as const,
    queryFn: () => window.electronAPI.getAvailableSubtotalGroupsForExam(examId),
  })

// =====================================================================
// 書き込み（小計点グループ本体）
// =====================================================================

/**
 * 小計点グループを作る。
 *
 * どの試験でも選べるようになるので、試験ごとの「追加できるグループ」も古くなる。
 * 前方一致で試験に紐づくもの全部を取り直す。
 */
export const createSubtotalGroupMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.createSubtotalGroup>[0]
    ) => window.electronAPI.createSubtotalGroup(input),
    meta: {
      invalidates: [subtotalGroupListQuery().queryKey, ["exam"]],
      errorMessage: "小計点グループを作成できませんでした",
    },
  })

export const updateSubtotalGroupMutation = () =>
  defineMutation({
    mutationFn: (input: {
      subtotalGroupId: string
      data: Parameters<typeof window.electronAPI.updateSubtotalGroup>[1]
    }) =>
      window.electronAPI.updateSubtotalGroup(input.subtotalGroupId, input.data),
    meta: {
      invalidates: [subtotalGroupListQuery().queryKey, ["exam"]],
      errorMessage: "小計点グループを保存できませんでした",
    },
  })

export const deleteSubtotalGroupMutation = () =>
  defineMutation({
    mutationFn: (subtotalGroupId: string) =>
      window.electronAPI.deleteSubtotalGroup(subtotalGroupId),
    meta: {
      invalidates: [subtotalGroupListQuery().queryKey, ["exam"]],
      errorMessage: "小計点グループを削除できませんでした",
    },
  })

// =====================================================================
// 書き込み（試験との紐付け）
// =====================================================================

export const addSubtotalGroupToExamMutation = (examId: string) =>
  defineMutation({
    mutationFn: (subtotalGroupId: string) =>
      window.electronAPI.addSubtotalGroupToExam(examId, subtotalGroupId),
    meta: {
      invalidates: [scopeKeys.exam(examId)],
      errorMessage: "小計点グループを追加できませんでした",
    },
  })

export const removeSubtotalGroupFromExamMutation = (examId: string) =>
  defineMutation({
    mutationFn: (subtotalGroupId: string) =>
      window.electronAPI.removeSubtotalGroupFromExam(examId, subtotalGroupId),
    meta: {
      invalidates: [scopeKeys.exam(examId)],
      errorMessage: "小計点グループを削除できませんでした",
    },
  })

// =====================================================================
// 書き込み（採点領域への割り当て）
// =====================================================================

/**
 * 採点領域1つ分の割り当てを丸ごと差し替える。
 *
 * 部分更新という経路が無い（全消し→作り直し）ので、書き込みも1領域単位で1つに
 * まとめる。同じ領域へ2つが同時に走ると、消す方と作る方が入れ違って割り当てが
 * 消えるため `scope` で直列にする。
 */
export const replaceCropSubtotalsMutation = (examId: string) =>
  defineMutation({
    mutationFn: async (input: {
      cropRegionId: string
      subtotalIds: string[]
      assignmentType: CropSubtotalAssignmentType
    }) => {
      await window.electronAPI.deleteCropSubtotalsByCropRegionId(
        input.cropRegionId
      )
      if (input.subtotalIds.length === 0) return
      await window.electronAPI.createManyCropSubtotals(
        input.subtotalIds.map((subtotalId) => ({
          cropRegionId: input.cropRegionId,
          subtotalId,
          assignmentType: input.assignmentType,
        }))
      )
    },
    scope: { id: `exam:${examId}:cropSubtotals` },
    meta: {
      invalidates: [cropRegionsQuery(examId).queryKey],
      errorMessage: "関連付けを保存できませんでした",
    },
  })
