/**
 * web 版では未対応の Node 専用の依存（`buildWorker.mjs` の差し替え表）の中身。
 *
 * 読み込むだけでは落ちず、呼んだ（`new` を含む）時点で、どのモジュールのどの口かが分かる
 * 例外を投げる。
 */

/** 呼ぶと例外を投げる関数（`new` でも同じ）。差し替えたモジュールの default・名前付きの口に置く */
export function unsupportedExport(
  moduleName: string,
  exportName = "default"
): () => never {
  const label =
    exportName === "default" ? moduleName : `${moduleName}.${exportName}`
  return function unsupportedModuleExport(): never {
    throw new Error(`[web] ${label} は web 版では未対応`)
  }
}
