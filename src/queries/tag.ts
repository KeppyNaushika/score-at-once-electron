import { queryOptions } from "@tanstack/react-query"

import { answerSheetDefinitionListQuery } from "./answerSheetBuilder"
import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * タグ（Tag）とその紐付けの読み書き。
 *
 * タグ本体は横断で共有される1つの集合。紐付け（試験・資料・解答用紙・小計点
 * グループ）は相手側の実体に属するので、無効化の行き先も相手側のスコープになる。
 *
 * **紐付けを変えたらタグ一覧も取り直す。** 一覧（`tagGetAll`）は紐付けを同梱して
 * いて、タグ管理画面がそれを「利用先」として出す。相手側だけ取り直すと、そちらの
 * 表示は直るのにタグ管理画面の数字が古いまま残る。
 *
 * 対応する preload は `electron-src/preload-apis/tagApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

export const tagListQuery = () =>
  queryOptions({
    queryKey: ["tags"] as const,
    queryFn: () => window.electronAPI.tagGetAll(),
  })

/** その試験に付いているタグ */
export const examTagsQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "tags"] as const,
    queryFn: () => window.electronAPI.examTagGetByExamId(examId),
  })

/** そのタグが付いている小計点グループ（一覧で開いたときだけ引く） */
export const tagSubtotalGroupsQuery = (tagId: string) =>
  queryOptions({
    queryKey: ["tags", tagId, "subtotalGroups"] as const,
    queryFn: () => window.electronAPI.tagSubtotalGroupGetByTagId(tagId),
  })

/** その解答用紙に付いているタグ */
export const answerSheetDefinitionTagsQuery = (definitionId: string) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.answerSheetDefinition(definitionId),
      "tags",
    ] as const,
    queryFn: () =>
      window.electronAPI.asbDefinitionTagGetByDefinitionId(definitionId),
  })

// =====================================================================
// 書き込み
// =====================================================================

export const createTagMutation = () =>
  defineMutation({
    mutationFn: (input: { name: string; color?: string }) =>
      window.electronAPI.tagCreate(input),
    meta: {
      invalidates: [tagListQuery().queryKey],
      errorMessage: "タグを作成できませんでした",
    },
  })

export const updateTagMutation = () =>
  defineMutation({
    mutationFn: (input: {
      id: string
      data: Parameters<typeof window.electronAPI.tagUpdate>[1]
    }) => window.electronAPI.tagUpdate(input.id, input.data),
    meta: {
      invalidates: [tagListQuery().queryKey],
      errorMessage: "タグを保存できませんでした",
    },
  })

export const deleteTagMutation = () =>
  defineMutation({
    mutationFn: (tagId: string) => window.electronAPI.tagDelete(tagId),
    meta: {
      invalidates: [tagListQuery().queryKey],
      errorMessage: "タグを削除できませんでした",
    },
  })

export const reorderTagsMutation = () =>
  defineMutation({
    mutationFn: (tagIds: string[]) => window.electronAPI.tagReorder(tagIds),
    meta: {
      invalidates: [tagListQuery().queryKey],
      errorMessage: "タグの並び順を保存できませんでした",
    },
  })

/**
 * 名前でタグを引き、無ければ作る。
 *
 * 一括タグ付けの前段で使う。作られる可能性があるのでタグ一覧を取り直す。
 */
export const findOrCreateTagMutation = () =>
  defineMutation({
    mutationFn: (name: string) => window.electronAPI.tagFindOrCreate(name),
    meta: {
      invalidates: [tagListQuery().queryKey],
      errorMessage: "タグを用意できませんでした",
    },
  })

/** 試験に付けるタグを置き換える */
export const setExamTagsMutation = (examId: string) =>
  defineMutation({
    mutationFn: (tagIds: string[]) =>
      window.electronAPI.examTagSetExamTags(examId, tagIds),
    meta: {
      invalidates: [examTagsQuery(examId).queryKey, tagListQuery().queryKey],
      errorMessage: "タグを保存できませんでした",
    },
  })

/**
 * 作ったばかりの試験へタグを付ける。
 *
 * 作成のあとに続く操作なので、試験 id は呼び出し時にしか分からない。
 * 取り直す先も同じ理由で「試験に紐づくもの全部」の前方一致になる。
 */
export const setExamTagsForNewExamMutation = () =>
  defineMutation({
    mutationFn: (input: { examId: string; tagIds: string[] }) =>
      window.electronAPI.examTagSetExamTags(input.examId, input.tagIds),
    meta: {
      invalidates: [["exam"], tagListQuery().queryKey],
      errorMessage: "タグを保存できませんでした",
    },
  })

/**
 * 選んだ試験へ同じタグをまとめて足す。
 *
 * 既存のタグを保ったまま1件ずつ足す（全置換は他端末が付けたタグを巻き添えに
 * する）。既に紐づいている試験は unique 制約で失敗するので、そこは飛ばす。
 * 知らせを1回にするため1つの書き込みにまとめている。
 */
export const addTagToExamsMutation = () =>
  defineMutation({
    mutationFn: async (input: { examIds: string[]; tagId: string }) => {
      for (const examId of input.examIds) {
        try {
          await window.electronAPI.examTagCreate({
            examId,
            tagId: input.tagId,
          })
        } catch {
          // 既に紐づいている場合は unique 制約で失敗するが、結果は同じなので飛ばす。
          //
          // **担当でないものをここへ渡さないこと。** タグ付けも担当の確認を通るように
          // なった（docs/branch-review-findings.md #10）ので、渡すとこの catch が
          // 「弾かれた」も一緒に握り潰し、利用者に伝わらないまま一部だけ付く。
          // 呼ぶ側（AnswerSheetDefinitionList）が担当分に絞り、外した件数を伝える。
        }
      }
    },
    meta: {
      invalidates: [["exam"], tagListQuery().queryKey],
      errorMessage: "タグを追加できませんでした",
    },
  })

/** 解答用紙に付けるタグを置き換える */
export const setAnswerSheetDefinitionTagsMutation = (definitionId: string) =>
  defineMutation({
    mutationFn: (tagIds: string[]) =>
      window.electronAPI.asbDefinitionTagSetDefinitionTags(
        definitionId,
        tagIds
      ),
    meta: {
      // 一覧の行にもタグが出る（`listDefinitions` が同梱する）ので一緒に取り直す。
      // タグ一覧は紐付けを利用先として同梱するので、そちらも古くなる
      invalidates: [
        answerSheetDefinitionTagsQuery(definitionId).queryKey,
        answerSheetDefinitionListQuery().queryKey,
        tagListQuery().queryKey,
      ],
      errorMessage: "タグを保存できませんでした",
    },
  })

/**
 * 選んだ解答用紙へ同じタグをまとめて足す。
 *
 * `addTagToExamsMutation` と同じ形。既存のタグを保ったまま1件ずつ足し、既に
 * 紐づいているものは飛ばす。行き先は解答用紙のまとまり全体（一覧の行にもタグが
 * 出るうえ、対象は複数件なので絞る意味が無い）。
 */
export const addTagToAnswerSheetDefinitionsMutation = () =>
  defineMutation({
    mutationFn: async (input: { definitionIds: string[]; tagId: string }) => {
      for (const definitionId of input.definitionIds) {
        try {
          await window.electronAPI.asbDefinitionTagCreate({
            asbDefinitionId: definitionId,
            tagId: input.tagId,
          })
        } catch {
          // 既に紐づいている場合は unique 制約で失敗するが、結果は同じなので飛ばす
        }
      }
    },
    meta: {
      invalidates: [["answerSheetDefinition"], tagListQuery().queryKey],
      errorMessage: "タグを追加できませんでした",
    },
  })

/** 小計点グループに付けるタグを置き換える */
export const setSubtotalGroupTagsMutation = () =>
  defineMutation({
    mutationFn: (input: { subtotalGroupId: string; tagIds: string[] }) =>
      window.electronAPI.tagSubtotalGroupSetTags(
        input.subtotalGroupId,
        input.tagIds
      ),
    meta: {
      invalidates: [["subtotalGroup"], tagListQuery().queryKey],
      errorMessage: "タグを保存できませんでした",
    },
  })
