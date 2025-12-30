"use client"

import { ReactNode } from "react"
import { LucideIcon } from "lucide-react"

interface SidePanelSectionProps {
  // セクションヘッダー
  icon: LucideIcon
  title: string
  badge?: string | number
  rightElement?: ReactNode

  // セクション内容
  children: ReactNode

  // スタイル設定
  className?: string
}

/**
 * サイドパネル内の統一されたセクションコンポーネント
 * icon, title, contentの共通構造を提供
 */
export function SidePanelSection({
  icon: Icon,
  title,
  badge,
  rightElement,
  children,
  className = "",
}: SidePanelSectionProps) {
  return (
    <div className={`py-3 ${className}`}>
      {/* セクションヘッダー（統一スタイル） */}
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">{title}</span>

        {/* バッジ表示 */}
        {badge && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {badge}
          </span>
        )}

        {/* 右端要素（ボタン等） */}
        {rightElement && <div className="ml-auto">{rightElement}</div>}
      </div>

      {/* セクション内容 */}
      <div>{children}</div>
    </div>
  )
}
