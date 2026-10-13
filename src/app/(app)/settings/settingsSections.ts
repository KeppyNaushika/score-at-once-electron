import {
  CalendarRange,
  HardDrive,
  Keyboard,
  type LucideIcon,
  Monitor,
  Palette,
  RotateCcwClock,
  Users,
} from "lucide-react"

/** 設定の項目。項目ごとに URL を持つ（`/settings/<slug>`）ので、知らせや手引きから直に開ける */
export interface SettingsSection {
  slug: string
  label: string
  icon: LucideIcon
  /** web 版でだけ出す（ブラウザの保存領域） */
  isWebOnly?: boolean
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { slug: "keyboard", label: "ショートカットキー", icon: Keyboard },
  { slug: "screen", label: "画面制御", icon: Monitor },
  { slug: "display", label: "表示設定", icon: Palette },
  { slug: "fiscal-year", label: "年度", icon: CalendarRange },
  { slug: "audit-log-retention", label: "操作履歴", icon: RotateCcwClock },
  { slug: "users", label: "ユーザー管理", icon: Users },
  {
    slug: "browser-storage",
    label: "ブラウザの保存領域",
    icon: HardDrive,
    isWebOnly: true,
  },
]

export function settingsSectionHref(settingsSection: SettingsSection): string {
  return `/settings/${settingsSection.slug}`
}
