import "./registerMeta"

import { MutationCache, QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

/**
 * アプリで使う QueryClient を作る。
 *
 * **書き込みの後始末はここに1つだけ置く。** 各書き込みは `meta` で「何を取り直すか」と
 * 「失敗したら何と言うか」を宣言し、実装は持たない。各所に散っていた try/catch と
 * invalidate の書き忘れを、宣言（`defineMutation` が `meta` を必須にする）で止める形。
 *
 * 取得の既定:
 * - 再試行しない。IPC はネットワークを跨がないので、繰り返しても結果は変わらない
 * - **オンライン判定に従わない**（`networkMode: "always"`）。同じ理由で、取得も
 *   書き込みもネットワークを跨がない。アプリが読み書きするのは常にローカルの複製で、
 *   NAS の共有ファイルに触れるのは `sqlite-nas-sync` が行レベルのマージを回すときだけ
 *   （しかもその失敗は React Query を通らない）。既定の `"online"` のままだと、
 *   Wi-Fi を切った端末で `navigator.onLine` が false になり、**全クエリが
 *   `fetchStatus:"paused"` のまま「読み込み中」で固まり、採点も保存されない**
 * - 窓に戻るたびの再取得を止める。NAS同期で他の教員の変更は入るが、採点中に
 *   手元の表示が動くほうが害が大きい。拾いたい画面はその `useQuery` で有効にする
 */
export function createAppQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        networkMode: "always",
      },
      mutations: {
        networkMode: "always",
      },
    },
    mutationCache: new MutationCache({
      // 成功しても失敗しても DB から取り直す。失敗したときこそ、手元の表示を
      // DB に揃える必要がある（書けなかった値を保存済みとして見せない）。
      //
      // meta は `defineMutation` が必須にしているのでここへ来る書き込みは必ず持つが、
      // 型の上では optional なので、素の `useMutation` を書かれても落ちないようにする
      onSettled: (_data, _error, _variables, _context, mutation) => {
        // `invalidates` の省略は「取り直す先が無い」という申告（Excel 出力・
        // PDF 印刷・ファイル選択など）。何もしないのが正しい。
        const invalidates = mutation.meta?.invalidates
        if (!invalidates) return
        // 連打をまとめる。**同じ行き先へ書いているもの**が他にも走っている間は
        // 取り直さず、最後の1つだけが取り直す。これが無いと、10マス切り替えれば
        // 取り直しも10回走る（実測）。
        //
        // `mutationKey` は `defineMutation` が `meta.invalidates` から付ける。
        // `isMutating` は自分を含めて数えるので、1 なら自分だけ。
        //
        // **`exact` を外してはいけない。** 既定の照合は前方一致なので、広いキーの
        // 書き込みが「狭いキーの書き込みが代わりに取り直してくれる」と誤解する。
        // 狭い方は自分のキーしか取り直さないので、広い方の行き先が取り残される
        // （試験まるごとを取り直すはずの書き込みが、採点領域だけの書き込みを
        // 見て黙る、など）。
        const stillWriting = client.isMutating({
          mutationKey: mutation.options.mutationKey,
          exact: true,
        })
        if (stillWriting > 1) return
        for (const queryKey of invalidates) {
          void client.invalidateQueries({ queryKey })
        }
      },
      onError: (error, _variables, _context, mutation) => {
        toast.error(mutation.meta?.errorMessage ?? "保存できませんでした", {
          description: error instanceof Error ? error.message : undefined,
        })
      },
    }),
  })
  return client
}
