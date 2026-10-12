/**
 * Worker の中で main のコードに見せる仮想パスの置き場。
 *
 * `/opfs/<rest>` は OPFS のルート直下の `<rest>`（実ファイルの階層）。画像を返す
 * Service Worker（`web/serviceWorker/serviceWorker.ts`）も同じ対応で OPFS を直に読む。
 */

/** 仮想パスのうち OPFS に置く範囲の頭 */
export const OPFS_VIRTUAL_ROOT = "/opfs"

/** データの根（DB・答案と模範解答の画像・出力）。`computeLocalRoots` に渡す */
export const WEB_DATA_DIRECTORY = `${OPFS_VIRTUAL_ROOT}/data`

/** `app.getPath("userData")`。auth.json・AI の事業者設定を置く */
export const WEB_USER_DATA_DIRECTORY = `${OPFS_VIRTUAL_ROOT}/userData`

/** `app.getPath("temp")` と `os.tmpdir()` */
export const WEB_TEMP_DIRECTORY = `${OPFS_VIRTUAL_ROOT}/temp`

/**
 * 保存ダイアログが返す保存先の頭。OPFS には置かず、ここへ書き終えたファイルは
 * 画面へダウンロードとして渡して捨てる（`downloadArea.ts`）
 */
export const WEB_DOWNLOAD_AREA = "/web-downloads"

/**
 * 保存先へ渡す大きなファイルを、画面がダウンロードし終えるまで置いておく OPFS のディレクトリ
 * （ルート直下。`downloadArea.ts`）
 */
export const DOWNLOAD_STAGING_DIRECTORY = ".download-staging"

/**
 * sqlite-wasm の opfs-sahpool VFS が使う OPFS のディレクトリ（ルート直下）。
 * VFS がファイル名を独自に対応付けて持つので、fs からは触らない。仮想パスでは
 * `/opfs/.sqlite-sahpool` に当たるが、main のコードがそこを指すことはない
 */
export const SAHPOOL_DIRECTORY = ".sqlite-sahpool"
