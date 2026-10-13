"use client"

import { ChevronLeft } from "lucide-react"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { SettingsSectionList } from "@/app/(app)/settings/components/SettingsSectionList"
import { GuardedLink } from "@/components/common/GuardedLink"
import PageHeader from "@/components/layout/PageHeader"
import { useIsMobile } from "@/hooks/useIsMobile"

/**
 * 設定の枠。項目はそれぞれ別のページ（`/settings/<slug>`）。
 *
 * - 広い画面: 左に項目の一覧、右に開いている項目の中身を並べる
 * - 狭い画面（本体のサイドバーが引き出しになる幅）: 一覧と中身を別の画面にする。
 *   `/settings` は一覧だけ、項目のページは中身だけを出し、上に一覧へ戻る導線を置く。
 *   一覧を横に残すと、中身に残る幅が細くなりすぎる
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const isSectionList = pathname === "/settings"

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="設定" />
      {isMobile ? (
        <div className="min-h-0 flex-1 overflow-auto">
          {isSectionList ? (
            <nav aria-label="設定の項目">
              <SettingsSectionList isFullScreen />
            </nav>
          ) : (
            <div className="p-4">
              <GuardedLink
                href="/settings"
                className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
                設定
              </GuardedLink>
              {children}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="設定の項目"
            className="w-52 shrink-0 overflow-y-auto border-r p-3"
          >
            <SettingsSectionList isFullScreen={false} />
          </nav>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="container mx-auto max-w-4xl p-6">{children}</div>
          </div>
        </div>
      )}
    </div>
  )
}
