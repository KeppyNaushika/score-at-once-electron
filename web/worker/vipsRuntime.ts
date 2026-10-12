/**
 * web 版の画像処理エンジン（wasm-vips）を、最初に使うときに1度だけ起動する。
 *
 * wasm-vips の本体（`vips-es6.js`）は束ねずに、Worker の隣へ写したものを URL で読む
 * （`scripts/web/buildWorker.mjs`）。本体は pthread 用の Worker を自分の URL から起動し、
 * `vips.wasm` も自分の隣から取るので、束ねると両方の場所を見失う。
 * SharedArrayBuffer を使うので、配信側で COOP/COEP（cross-origin isolation）が要る。
 */
import type Vips from "wasm-vips"

/** 起動した wasm-vips（`Vips()` の解決値） */
export type VipsModule = typeof Vips

/** wasm-vips の本体の置き場（Worker の位置からの相対） */
const VIPS_MODULE_FILE = "./vips-es6.js"

let vipsLoading: Promise<VipsModule> | null = null

async function startVips(): Promise<VipsModule> {
  const moduleUrl = new URL(VIPS_MODULE_FILE, import.meta.url).href
  const vipsModule: { default: typeof Vips } = await import(moduleUrl)
  // HEIF・JPEG XL の追加の wasm は読まない（デスクトップ版で扱うのは PNG・JPEG。
  // 起動のたびに約 6MB を取りに行くのを避ける）
  return vipsModule.default({ dynamicLibraries: [] })
}

/** 起動済みの wasm-vips。起動に失敗したら、次に呼んだときにやり直す */
export function loadVips(): Promise<VipsModule> {
  if (vipsLoading === null) {
    vipsLoading = startVips().catch((error: unknown) => {
      vipsLoading = null
      throw error
    })
  }
  return vipsLoading
}
