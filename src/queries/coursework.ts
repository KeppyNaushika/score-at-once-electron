import { queryOptions } from "@tanstack/react-query"

import type { CourseworkScoreUpsertInput } from "@/types/coursework.types"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 試験外成績資料（Coursework）の読み書き。
 *
 * 対応する preload は `electron-src/preload-apis/courseworkApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

export const courseworkListQuery = () =>
  queryOptions({
    queryKey: ["coursework", "list"] as const,
    queryFn: () => window.electronAPI.coursework.getAll(),
  })

/** データソースに指定できる資料の候補1件 */
export type CourseworkCandidate = Awaited<
  ReturnType<typeof window.electronAPI.coursework.getCandidates>
>[number]

/** データソースに指定できる資料の候補 */
export const courseworkCandidatesQuery = () =>
  queryOptions({
    queryKey: ["coursework", "candidates"] as const,
    queryFn: () => window.electronAPI.coursework.getCandidates(),
  })

/** 資料本体（評価項目・学級・タグを子として同梱） */
export const courseworkDetailQuery = (courseworkId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.coursework(courseworkId), "detail"] as const,
    queryFn: () => window.electronAPI.coursework.getById(courseworkId),
  })

export const courseworkStudentsQuery = (courseworkId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.coursework(courseworkId), "students"] as const,
    queryFn: () => window.electronAPI.coursework.getStudents(courseworkId),
  })

/** 資料に紐づく学級1件 */
export type CourseworkClassroomRow = Awaited<
  ReturnType<typeof window.electronAPI.coursework.getClassrooms>
>[number]

export const courseworkClassroomsQuery = (courseworkId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.coursework(courseworkId), "classrooms"] as const,
    queryFn: () => window.electronAPI.coursework.getClassrooms(courseworkId),
  })

export const courseworkAvailableClassroomsQuery = (
  courseworkId: string,
  activeOnly: boolean
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.coursework(courseworkId),
      "availableClassrooms",
      activeOnly,
    ] as const,
    queryFn: () =>
      window.electronAPI.coursework.getAvailableClassrooms(
        courseworkId,
        activeOnly
      ),
  })

export const courseworkAvailableStudentsQuery = (
  courseworkId: string,
  activeOnly: boolean
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.coursework(courseworkId),
      "availableStudents",
      activeOnly,
    ] as const,
    queryFn: () =>
      window.electronAPI.coursework.getAvailableStudents(
        courseworkId,
        activeOnly
      ),
  })

/**
 * 評価項目1つ分の点数。
 *
 * **資料のスコープの外に置く。** 点数は資料本体とは別の粒度（評価項目ごと）で
 * 読み書きし、名前を1文字直すたびに全項目の点数を取り直す必要は無い。
 */
export const courseworkScoresQuery = (courseworkItemId: string) =>
  queryOptions({
    queryKey: ["courseworkScores", courseworkItemId] as const,
    queryFn: () => window.electronAPI.coursework.getScores(courseworkItemId),
  })

// =====================================================================
// 書き込み
// =====================================================================

const courseworkScope = (courseworkId: string) =>
  scopeKeys.coursework(courseworkId)

export const createCourseworkMutation = () =>
  defineMutation({
    mutationFn: (input: {
      name: string
      description?: string | null
      date?: string | null
    }) => window.electronAPI.coursework.create(input),
    meta: {
      invalidates: [courseworkListQuery().queryKey],
      errorMessage: "試験外成績資料を作成できませんでした",
    },
  })

export const updateCourseworkMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (input: {
      name?: string
      description?: string | null
      date?: string | null
    }) => window.electronAPI.coursework.update(courseworkId, input),
    meta: {
      invalidates: [
        courseworkScope(courseworkId),
        courseworkListQuery().queryKey,
      ],
      errorMessage: "試験外成績資料を保存できませんでした",
    },
  })

export const deleteCourseworkMutation = () =>
  defineMutation({
    mutationFn: (courseworkId: string) =>
      window.electronAPI.coursework.delete(courseworkId),
    meta: {
      invalidates: [courseworkListQuery().queryKey],
      errorMessage: "試験外成績資料を削除できませんでした",
    },
  })

// --- 評価項目 ---

export const createCourseworkItemMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (input: {
      name: string
      maxScore: number
      inputMode?: string
      letterScales?: { label: string; score: number; order: number }[]
    }) => window.electronAPI.coursework.createItem({ courseworkId, ...input }),
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "評価項目を追加できませんでした",
    },
  })

export const updateCourseworkItemMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (input: {
      id: string
      name?: string
      maxScore?: number
      inputMode?: string
    }) => {
      const { id, ...data } = input
      return window.electronAPI.coursework.updateItem(id, data)
    },
    scope: { id: `coursework:${courseworkId}:items` },
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "評価項目を保存できませんでした",
    },
  })

export const deleteCourseworkItemMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (courseworkItemId: string) =>
      window.electronAPI.coursework.deleteItem(courseworkItemId),
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "評価項目を削除できませんでした",
    },
  })

export const reorderCourseworkItemsMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (orders: { id: string; order: number }[]) =>
      window.electronAPI.coursework.reorderItems(orders),
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "評価項目の並び順を保存できませんでした",
    },
  })

// --- 文字評価の刻み ---
//
// 「A=100, B=80, C=60」の1行ずつ。ラベルは項目内で一意（DB の
// `@@unique([courseworkItemId, label])`）なので、重複した状態では書かない。

export const createCourseworkLetterScaleMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (input: {
      courseworkItemId: string
      label: string
      score: number
      order: number
    }) => window.electronAPI.coursework.createLetterScale(input),
    scope: { id: `coursework:${courseworkId}:letterScales` },
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "評価の刻みを追加できませんでした",
    },
  })

export const updateCourseworkLetterScaleMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (input: { id: string; label?: string; score?: number }) =>
      window.electronAPI.coursework.updateLetterScale(input),
    scope: { id: `coursework:${courseworkId}:letterScales` },
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "評価の刻みを保存できませんでした",
    },
  })

export const deleteCourseworkLetterScaleMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (letterScaleId: string) =>
      window.electronAPI.coursework.deleteLetterScale(letterScaleId),
    scope: { id: `coursework:${courseworkId}:letterScales` },
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "評価の刻みを削除できませんでした",
    },
  })

export const reorderCourseworkLetterScalesMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (orders: { id: string; order: number }[]) =>
      window.electronAPI.coursework.reorderLetterScales(orders),
    scope: { id: `coursework:${courseworkId}:letterScales` },
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "評価の刻みの並び順を保存できませんでした",
    },
  })

// --- 点数 ---

/**
 * 入力した点数を書く。
 *
 * 1マスにつき1レコードなので、まとめて送るのは「同じ操作を対象分繰り返す」
 * だけの意味。貼り付けは複数の評価項目にまたがるので、取り直す先は評価項目
 * ごとのキーの**前方一致**にする（開いていない資料の点数は取り直されない）。
 */
export const upsertCourseworkScoresMutation = () =>
  defineMutation({
    mutationFn: (scores: CourseworkScoreUpsertInput[]) =>
      window.electronAPI.coursework.batchUpsertScores(scores),
    scope: { id: "courseworkScores" },
    meta: {
      invalidates: [["courseworkScores"]],
      errorMessage: "点数を保存できませんでした",
    },
  })

// --- 名簿 ---

export const addCourseworkStudentsMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (studentIds: string[]) =>
      window.electronAPI.coursework.addStudents(courseworkId, studentIds),
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "生徒を追加できませんでした",
    },
  })

export const addCourseworkStudentsFromClassroomMutation = (
  courseworkId: string
) =>
  defineMutation({
    mutationFn: (input: { classroomId: string; activeOnly?: boolean }) =>
      window.electronAPI.coursework.addStudentsFromClassroom(
        courseworkId,
        input.classroomId,
        input.activeOnly
      ),
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "学級を追加できませんでした",
    },
  })

export const removeCourseworkStudentsMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (studentIds: string[]) =>
      window.electronAPI.coursework.removeStudents(courseworkId, studentIds),
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "生徒を外せませんでした",
    },
  })

export const removeCourseworkClassroomMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (input: { classroomId: string; deleteStudents: boolean }) =>
      window.electronAPI.coursework.removeClassroom(
        courseworkId,
        input.classroomId,
        input.deleteStudents
      ),
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "学級を外せませんでした",
    },
  })

export const updateCourseworkStudentOrdersMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (studentOrders: { studentId: string; customOrder: number }[]) =>
      window.electronAPI.coursework.updateStudentOrders(
        courseworkId,
        studentOrders
      ),
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "生徒の並び順を保存できませんでした",
    },
  })

export const setCourseworkClassroomOrdersMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (orderedClassroomIds: string[]) =>
      window.electronAPI.coursework.setClassroomOrders(
        courseworkId,
        orderedClassroomIds
      ),
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "学級の並び順を保存できませんでした",
    },
  })

// --- タグ ---

export const setCourseworkTagsMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (tagIds: string[]) =>
      window.electronAPI.coursework.setTags(courseworkId, tagIds),
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "タグを保存できませんでした",
    },
  })

export const addCourseworkTagMutation = (courseworkId: string) =>
  defineMutation({
    mutationFn: (tagId: string) =>
      window.electronAPI.coursework.addTag(courseworkId, tagId),
    meta: {
      invalidates: [courseworkScope(courseworkId)],
      errorMessage: "タグを追加できませんでした",
    },
  })

/**
 * 選んだ資料へ同じタグをまとめて足す。
 *
 * 既存のタグを保ったまま1件ずつ足す（全置換すると、他端末が付けたタグを
 * 巻き添えにする）。知らせを1回にするため1つの書き込みにまとめている。
 */
export const addTagToCourseworksMutation = () =>
  defineMutation({
    mutationFn: async (input: { courseworkIds: string[]; tagId: string }) => {
      for (const courseworkId of input.courseworkIds) {
        await window.electronAPI.coursework.addTag(courseworkId, input.tagId)
      }
    },
    meta: {
      invalidates: [courseworkListQuery().queryKey],
      errorMessage: "タグを追加できませんでした",
    },
  })

// =====================================================================
// DB を書かない操作
// =====================================================================

export const exportCourseworkArchiveMutation = () =>
  defineMutation({
    mutationFn: (courseworkId: string) =>
      window.electronAPI.coursework.exportArchive(courseworkId),
    meta: {
      writesDatabase: false,
      errorMessage: "試験外成績資料を書き出せませんでした",
    },
  })

export const selectCourseworkImportFileMutation = () =>
  defineMutation({
    mutationFn: () => window.electronAPI.coursework.selectImportFile(),
    meta: {
      writesDatabase: false,
      errorMessage: "ファイルを選択できませんでした",
    },
  })

export const analyzeCourseworkArchiveMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.coursework.analyzeArchive>[0]
    ) => window.electronAPI.coursework.analyzeArchive(input),
    meta: {
      writesDatabase: false,
      errorMessage: "アーカイブを読み込めませんでした",
    },
  })

export const importCourseworkArchiveMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.coursework.importArchive>[0]
    ) => window.electronAPI.coursework.importArchive(input),
    meta: {
      invalidates: [courseworkListQuery().queryKey],
      errorMessage: "アーカイブを取り込めませんでした",
    },
  })

/** 学級を外したときに何が消えるかの下見。DB は変えない */
export const previewCourseworkClassroomRemovalMutation = (
  courseworkId: string
) =>
  defineMutation({
    mutationFn: (classroomId: string) =>
      window.electronAPI.coursework.classroomRemovalPreview(
        courseworkId,
        classroomId
      ),
    meta: {
      writesDatabase: false,
      errorMessage: "学級の削除内容を確認できませんでした",
    },
  })
