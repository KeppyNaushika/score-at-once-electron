"use client"

import { BrowserStorageSection } from "@/app/(app)/settings/components/BrowserStorageSection"
import { CautionNotice } from "@/components/common/CautionNotice"
import { useIsWebRuntime } from "@/hooks/useIsWebRuntime"

export default function BrowserStorageSettingsPage() {
  // デスクトップ版は一覧に出さないが、URL を直に開いたときは出さない理由を出す
  const isWebRuntime = useIsWebRuntime()

  return isWebRuntime ? (
    <BrowserStorageSection />
  ) : (
    <CautionNotice>
      ブラウザの保存領域は web
      版の設定です。デスクトップ版のデータはこのPCのフォルダにあります。
    </CautionNotice>
  )
}
