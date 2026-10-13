/**
 * web 版の版（ビルドごとに変わる識別子）。画面の入口（`web/page/entry.ts`）と main の処理を
 * 動かす Worker（`web/worker/backend.ts`）が、それぞれ自分の束に埋め込まれた値を持つ。
 *
 * 画面と Worker は同じ版でなければならない（通信の型が版で変わりうる）。どちらも
 * 起動のたびに配信から読み直すが、開いている間に新しい版が配られると、開き直すまで
 * 古い版のまま動く。そこで:
 *
 * - Worker は準備が済んだ知らせ（`ready`）に自分の版を添え、画面は自分の版と比べる。
 *   食い違ったら（2つを読む間に配信が入れ替わった）、使わせずに再読み込みを頼む
 * - 開いている間は、書き出しの置いた版の知らせ（`WEB_BUILD_INFO_PATH`）を時々読み、
 *   違う版が配られていたら、再読み込みを勧める（勝手には再読み込みしない。作業中の入力が消える）
 *
 * 値は書き出し（`scripts/web/webBuildId.mjs`）が決め、esbuild の `define` で埋め込む。
 */

declare const __WEB_BUILD_ID__: string | undefined

/** 書き出しを通さずに読まれたとき（テストなど）の値 */
const UNBUILT_BUILD_ID = "unbuilt"

/** この束の版 */
export const WEB_BUILD_ID: string =
  typeof __WEB_BUILD_ID__ === "string" ? __WEB_BUILD_ID__ : UNBUILT_BUILD_ID

/**
 * 配信にある版の知らせ（`/__web/build.json`）の中身から、自分と違う版を取り出す。
 * 同じ版、または読めない中身なら null
 */
export function newerBuildIdOf(
  buildInfo: unknown,
  currentBuildId: string
): string | null {
  if (
    typeof buildInfo !== "object" ||
    buildInfo === null ||
    !("buildId" in buildInfo) ||
    typeof buildInfo.buildId !== "string" ||
    buildInfo.buildId === ""
  ) {
    return null
  }
  return buildInfo.buildId === currentBuildId ? null : buildInfo.buildId
}
