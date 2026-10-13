"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"
import { useIsWebRuntime } from "@/hooks/useIsWebRuntime"

import { useThirdPartyLicenses } from "../hooks/useThirdPartyLicenses"
import type { ThirdPartyPackage } from "../types"

/** 名前かライセンスの種類に含まれれば当てはまる */
function matchesPackageQuery(
  thirdPartyPackage: ThirdPartyPackage,
  normalizedQuery: string
): boolean {
  return [thirdPartyPackage.name, thirdPartyPackage.license ?? ""].some(
    (searchableText) => searchableText.toLowerCase().includes(normalizedQuery)
  )
}

/**
 * 同梱するライブラリと、そのライセンスの一覧。行を開くと本文が出る。
 *
 * 一覧はビルドのたびに依存から作る（`scripts/thirdPartyLicenses.mjs`）。web 版では、
 * デスクトップ版の配布物にだけ入るもの（Electron）を出さない
 */
export function ThirdPartyLicenseList() {
  const licensesState = useThirdPartyLicenses()
  const isWebRuntime = useIsWebRuntime()
  const [query, setQuery] = useState("")

  if (licensesState.status === "loading") {
    return <p className="text-sm text-muted-foreground">読み込んでいます…</p>
  }
  if (licensesState.status === "missing") {
    return (
      <p className="text-sm text-muted-foreground">
        一覧はビルドのときに作られます。開発用サーバーでは `npm run
        setup-assets` で作ってください。
      </p>
    )
  }

  const { packages, licenseTexts } = licensesState.list
  const distributedPackages = packages.filter(
    (thirdPartyPackage) => !(isWebRuntime && thirdPartyPackage.desktopOnly)
  )
  const normalizedQuery = query.trim().toLowerCase()
  const matchedPackages = distributedPackages.filter((thirdPartyPackage) =>
    matchesPackageQuery(thirdPartyPackage, normalizedQuery)
  )

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="名前・ライセンスで絞り込む"
        aria-label="ライブラリを名前・ライセンスで絞り込む"
        className="max-w-sm"
      />
      <p className="text-xs text-muted-foreground">
        {`${distributedPackages.length} 件のうち ${matchedPackages.length} 件`}
      </p>
      <ul className="divide-y rounded-md border">
        {matchedPackages.map((thirdPartyPackage) => (
          <li key={`${thirdPartyPackage.name}@${thirdPartyPackage.version}`}>
            <details className="group">
              <summary className="flex cursor-pointer items-baseline gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {thirdPartyPackage.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {thirdPartyPackage.version}
                </span>
                <span className="w-48 shrink-0 truncate text-right text-xs">
                  {thirdPartyPackage.license ?? "記載なし"}
                </span>
              </summary>
              <pre className="max-h-80 overflow-auto bg-muted/30 px-3 py-2 text-xs whitespace-pre-wrap">
                {thirdPartyPackage.licenseTextId !== null
                  ? licenseTexts[thirdPartyPackage.licenseTextId]
                  : "このパッケージには、ライセンスの本文のファイルが含まれていません。種類はパッケージの記載によります。"}
              </pre>
            </details>
          </li>
        ))}
      </ul>
    </div>
  )
}
