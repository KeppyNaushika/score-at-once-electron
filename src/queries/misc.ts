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

/**
 * 画像を Base64 のデータURLで読む。
 *
 * 呼び出し元（答案グリッドのセル）はフックの外なので、そのまま関数として出す。
 */
export const readImageData = (imagePath: string) =>
  window.electronAPI.getImageData(imagePath)

/**
 * そのパスにファイルがあるか。
 *
 * 呼び出し元は `<img>` の読み込み（Promise の中）なので、フックにできない。
 * DB を触らないぶん取り直す先も無いので、そのまま関数として出す。
 */
export const checkFileExists = (relativePath: string) =>
  window.electronAPI.checkFileExists(relativePath)
