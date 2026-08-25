/**
 * 撮影が読み書きする場所
 *
 * 出力の場所は `globalSetup`（実行の頭で空にする）と spec（撮って置く）の両方が
 * 要る。どちらかに書くともう一方が写しを持つことになり、片方を動かしたときに
 * **消す場所と置く場所がずれて古い絵が残る**ので、1か所から取る。
 */

import * as path from "path"

/** 撮った画像の置き場。実行の頭で丸ごと作り直す */
export const SCREENSHOTS_DIR = path.resolve(__dirname, "../output")
