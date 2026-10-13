/**
 * 出力の結果を利用者に伝える文言のうち、デスクトップ版と web 版で言い方の変わるもの。
 *
 * - **保存先:** web 版の保存ダイアログは仮想パス（`/web-downloads/<uuid>/<ファイル名>`、
 *   `web/worker/downloadArea.ts`）を返し、そこへ書いたものはブラウザのダウンロードになる。
 *   仮想パスは利用者にとって意味が無いので、ファイル名だけを見せる
 * - **印刷ダイアログ:** web 版の PDF 出力は印刷ダイアログに任せる（`web/page/htmlPrinter.ts`）。
 *   ダイアログは閉じた時点で返り、「PDF に保存」したのか、やめたのかをブラウザは教えない
 *   （`afterprint` も両方で来る）。だから「出力しました」と断定しない
 *
 * web 版かどうかは引数で受ける。イベントの中では `isWebRuntime()`、描画の中では
 * `useIsWebRuntime()` の値を渡す（描画中に `isWebRuntime()` を読むとハイドレーションが食い違う）。
 */

/** パスの最後の名前（区切りは `/` と `\` のどちらも） */
export const fileNameOfPath = (filePath: string): string =>
  filePath.split(/[/\\]/).at(-1) || filePath

/** 保存したファイルの在りか。デスクトップ版はパスそのもの、web 版はファイル名だけ */
export const savedFileLocationText = (
  filePath: string,
  isWeb: boolean
): string => (isWeb ? fileNameOfPath(filePath) : filePath)

/** web 版で、印刷ダイアログが閉じたときの知らせ（保存したとは断定しない） */
export const PRINT_DIALOG_CLOSED_MESSAGE = "印刷ダイアログを閉じました"

/** `PRINT_DIALOG_CLOSED_MESSAGE` に添える説明 */
export const PRINT_DIALOG_CLOSED_DESCRIPTION =
  "PDF に保存した場合は、保存先を確かめてください"

/**
 * web 版で、ページ別の書き出しを1つにまとめる zip の名前。main が書き（ページ別のファイルを
 * 1つずつダウンロードにすると、Chrome が複数のダウンロードの許可を求める）、画面が知らせに使う
 */
export const SPLIT_PDF_ZIP_FILE_NAME = "pdf-pages.zip"
export const PNG_PAGES_ZIP_FILE_NAME = "png-pages.zip"
