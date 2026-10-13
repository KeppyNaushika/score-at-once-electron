import { useEffect, useState } from "react"

import type { ThirdPartyLicenseList } from "../types"

/** ビルドのときに `scripts/thirdPartyLicenses.mjs` が書き出す一覧の置き場 */
const THIRD_PARTY_LICENSES_URL = "/third-party-licenses.json"

type ThirdPartyLicensesState =
  | { status: "loading" }
  | { status: "loaded"; list: ThirdPartyLicenseList }
  | { status: "missing" }

/**
 * 同梱するライブラリのライセンスの一覧を読む。
 *
 * DB の行ではなく配信している静的なファイルなので、`src/queries/` のキャッシュには載せない。
 * 読めないのは、一覧を作らずに開発用サーバーを立てたときだけ（`npm run setup-assets` で作る）
 */
export function useThirdPartyLicenses(): ThirdPartyLicensesState {
  const [state, setState] = useState<ThirdPartyLicensesState>({
    status: "loading",
  })

  useEffect(() => {
    let isCurrent = true
    const load = async () => {
      try {
        const response = await fetch(THIRD_PARTY_LICENSES_URL)
        if (!response.ok) throw new Error(String(response.status))
        const list: ThirdPartyLicenseList = await response.json()
        if (isCurrent) setState({ status: "loaded", list })
      } catch {
        if (isCurrent) setState({ status: "missing" })
      }
    }
    void load()
    return () => {
      isCurrent = false
    }
  }, [])

  return state
}
