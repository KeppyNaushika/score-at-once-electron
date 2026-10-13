"use client"

import { SyncSettingsPanel } from "@/app/(app)/sync/components/SyncSettingsPanel"
import { BetaBadge } from "@/components/common/BetaBadge"
import { CautionNotice } from "@/components/common/CautionNotice"
import PageHeader from "@/components/layout/PageHeader"
import { useIsWebRuntime } from "@/hooks/useIsWebRuntime"

/** 「同期設定」（beta）の画面（ローカルモード・共有モードの切り替えと、共有フォルダとの同期） */
export default function SyncPage() {
  // web 版はサイドバーに出さないが、URL を直に開いたときは使えない理由を出す
  const isWebRuntime = useIsWebRuntime()

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="同期設定" subtitle={<BetaBadge />} />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="container mx-auto max-w-4xl p-6">
          {isWebRuntime ? (
            <CautionNotice>
              {"同期設定はデスクトップ版でだけ使えます。web 版は1人用で、" +
                "何台かのPCでデータを共有するのはデスクトップ版の役目です。"}
            </CautionNotice>
          ) : (
            <SyncSettingsPanel />
          )}
        </div>
      </div>
    </div>
  )
}
