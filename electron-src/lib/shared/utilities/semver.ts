/**
 * アーカイブバージョン文字列の比較ユーティリティ（簡易 semver）
 *
 * 各アーカイブの transformer / manifestValidator で共通利用する。
 */

/**
 * セマンティックバージョン文字列を比較する。
 * @returns v1 < v2 で負、v1 === v2 で 0、v1 > v2 で正
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number)
  const parts2 = v2.split(".").map(Number)
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 !== p2) return p1 - p2
  }
  return 0
}
