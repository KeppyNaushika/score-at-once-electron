/**
 * 到達しないことを型で言う。
 *
 * 網羅した `switch` の `default` で呼ぶ。取りこぼした枝があれば、その値は `never` に
 * ならないのでコンパイルが落ちる。**分岐を足したのに処理を書かなかった**ことを、
 * 実行するより前に知るための道具。
 *
 * 実行時にここへ来るのは、型を偽って渡されたときだけ。黙って通すと原因の分からない
 * 不具合になるので投げる。
 */
export function assertNever(value: never): never {
  throw new Error(`扱っていない値です: ${JSON.stringify(value)}`)
}
