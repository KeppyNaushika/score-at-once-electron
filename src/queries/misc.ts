import { queryOptions } from "@tanstack/react-query"

/**
 * 画像・ファイルパスまわりの取得。
 *
 * 対応する preload は `electron-src/preload-apis/miscApi.ts`。
 */

/**
 * 保存されている相対パスを、レンダラが `<img src>` に置ける URL へ直す。
 *
 * パスごとに1つのキーを持つ。同じ画像を複数の画面が出しても往復は1回で済み、
 * 一覧ぶんまとめて要るときは `useQueries` で並べる。
 */
export const fileProtocolPathQuery = (relativePath: string) =>
  queryOptions({
    queryKey: ["fileProtocolPath", relativePath] as const,
    queryFn: () => window.electronAPI.resolveFileProtocolPath(relativePath),
  })
