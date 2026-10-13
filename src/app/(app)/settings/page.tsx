"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import {
  SETTINGS_SECTIONS,
  settingsSectionHref,
} from "@/app/(app)/settings/settingsSections"
import { isMobileViewport, useIsMobile } from "@/hooks/useIsMobile"

/**
 * 設定を開いたとき。広い画面では最初の項目を開く（一覧は横に出ている）。
 * 狭い画面では一覧そのものがこの画面なので、移らない（一覧は `layout.tsx` が描く）
 */
export default function SettingsPage() {
  const router = useRouter()
  const isMobile = useIsMobile()

  useEffect(() => {
    // 窓の幅は描画の値でなく直に読む（ハイドレーションの最初の描画は狭い窓でも false）。
    // isMobile は、窓を広げたときに移り直すための依存
    if (!isMobileViewport()) {
      router.replace(settingsSectionHref(SETTINGS_SECTIONS[0]))
    }
  }, [isMobile, router])

  return null
}
