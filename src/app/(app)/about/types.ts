/**
 * 同梱するライブラリのライセンスの一覧（`public/third-party-licenses.json`）の形。
 * 作るのは `scripts/thirdPartyLicenses.mjs`
 */

/** 同梱するライブラリ1つ */
export interface ThirdPartyPackage {
  name: string
  version: string
  /** package.json の `license`（SPDX の式）。書かれていなければ null */
  license: string | null
  /** 本文（`licenseTexts` の鍵）。パッケージに本文のファイルが無ければ null */
  licenseTextId: string | null
  /** デスクトップ版の配布物にだけ入る（Electron） */
  desktopOnly: boolean
}

export interface ThirdPartyLicenseList {
  packages: ThirdPartyPackage[]
  /** 本文。同じ本文は1つにまとめてある */
  licenseTexts: Record<string, string>
}
