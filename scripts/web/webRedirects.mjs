/**
 * web 版の本番の配信（Cloudflare Pages）で、動的ルートの実際の id の URL を殻へ書き換える
 * `_redirects` を作る。
 *
 * 書き換えの規則の出どころは `src/lib/routeShell.ts` だけ。ここは、そこにある
 * `routeShellRewriteRules()` を `_redirects` の書式にするだけで、規則を持たない
 * （`scripts/web/buildWeb.mjs` が規則を渡して `web-dist/_redirects` を書き出す）。
 * 手元の配信（`scripts/web/serveWeb.mjs`）は `toRouteShellPath` で同じ書き換えをし、両者が
 * 同じ結果になることは `__tests__/web/webRedirects.test.ts` が縛る。
 *
 * 書式（Cloudflare Pages）: 1行に `<source> <destination> <status>`。`200` は転送ではなく
 * 中身の差し替え（URL は変わらない）。`:name` は `/` を含まない1文字以上、`*` は何でも
 * （1つの規則に1つまで。差し替え先では `:splat`）。上から順に見て、最初に当たったものを使う。
 * 静的なファイルがあっても規則が先に効く。
 */

/** 中身を差し替える（URL は変えない）ステータス */
const REWRITE_STATUS = 200

/** `*` か `:name` を含む規則（Cloudflare Pages では「動的」と数える） */
const isDynamicSource = (source) => /[*]|:[A-Za-z]/.test(source)

/** Cloudflare Pages の上限 */
export const REDIRECTS_LIMITS = {
  staticRules: 2000,
  dynamicRules: 100,
  lineLength: 1000,
}

/**
 * `web-dist/_redirects` の中身。上限を超えたら（Cloudflare Pages が黙って無視するので）失敗させる
 *
 * @param {{ source: string, destination: string }[]} rewriteRules
 */
export const renderRedirectsFile = (rewriteRules) => {
  const splatOverflow = rewriteRules.find(
    (rule) => rule.source.split("*").length > 2
  )
  if (splatOverflow !== undefined) {
    throw new Error(
      `_redirects の規則に * が2つ以上あります: ${splatOverflow.source}`
    )
  }
  const dynamicCount = rewriteRules.filter((rule) =>
    isDynamicSource(rule.source)
  ).length
  const staticCount = rewriteRules.length - dynamicCount
  if (dynamicCount > REDIRECTS_LIMITS.dynamicRules) {
    throw new Error(
      `_redirects の動的な規則が ${REDIRECTS_LIMITS.dynamicRules} 本を超えました（${dynamicCount} 本）`
    )
  }
  if (staticCount > REDIRECTS_LIMITS.staticRules) {
    throw new Error(
      `_redirects の静的な規則が ${REDIRECTS_LIMITS.staticRules} 本を超えました（${staticCount} 本）`
    )
  }
  const lines = rewriteRules.map(
    (rule) => `${rule.source} ${rule.destination} ${REWRITE_STATUS}`
  )
  const tooLong = lines.find(
    (line) => line.length > REDIRECTS_LIMITS.lineLength
  )
  if (tooLong !== undefined) {
    throw new Error(
      `_redirects の行が ${REDIRECTS_LIMITS.lineLength} 文字を超えました: ${tooLong.slice(0, 80)}…`
    )
  }
  return `${lines.join("\n")}\n`
}
