"use client"

import { ChevronRight } from "lucide-react"
import { usePathname } from "next/navigation"

import {
  SETTINGS_SECTIONS,
  settingsSectionHref,
} from "@/app/(app)/settings/settingsSections"
import { GuardedLink } from "@/components/common/GuardedLink"
import { useIsWebRuntime } from "@/hooks/useIsWebRuntime"
import { cn } from "@/lib/utils"

interface SettingsSectionListProps {
  /**
   * 狭い画面で、一覧だけを画面いっぱいに出す形（押すと項目の画面へ移る）。
   * 行を高くして指で押しやすくし、移った先があることを右端の矢印で示す
   */
  isFullScreen: boolean
}

/** 設定の項目の一覧 */
export function SettingsSectionList({
  isFullScreen,
}: SettingsSectionListProps) {
  const pathname = usePathname()
  const isWebRuntime = useIsWebRuntime()

  return (
    <ul className={isFullScreen ? "divide-y" : "space-y-1"}>
      {SETTINGS_SECTIONS.filter(
        (settingsSection) => isWebRuntime || !settingsSection.isWebOnly
      ).map((settingsSection) => {
        const href = settingsSectionHref(settingsSection)
        const isActive = pathname === href
        return (
          <li key={settingsSection.slug}>
            <GuardedLink
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 text-sm transition-colors",
                isFullScreen
                  ? "px-4 py-3.5 hover:bg-accent/50"
                  : cn(
                      "rounded-md px-3 py-2",
                      isActive
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )
              )}
            >
              <settingsSection.icon className="size-4 shrink-0" />
              <span className="flex-1">{settingsSection.label}</span>
              {isFullScreen && (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
            </GuardedLink>
          </li>
        )
      })}
    </ul>
  )
}
