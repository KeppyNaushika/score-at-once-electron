import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"

/**
 * ブラウザ的な戻る/進むの履歴。
 *
 * 対応する preload は `electron-src/preload-apis/navigationApi.ts`。
 *
 * DB ではなく**窓が持つセッション履歴**なので、遷移のたびに古くなる。読むときに
 * その場で引く用途で、購読はしない（`staleTime`・`gcTime` を 0 にして残さない）。
 */
export const navigationStateQuery = () =>
  queryOptions({
    queryKey: ["navigation", "state"] as const,
    queryFn: () => window.electronAPI.navigation.getState(),
    staleTime: 0,
    gcTime: 0,
  })

/** 履歴の n 番目へ移る。移るだけで DB は変わらない */
export const goToHistoryIndexMutation = () =>
  defineMutation({
    mutationFn: (index: number) =>
      window.electronAPI.navigation.goToIndex(index),
    meta: {
      writesDatabase: false,
      errorMessage: "履歴を移動できませんでした",
    },
  })
