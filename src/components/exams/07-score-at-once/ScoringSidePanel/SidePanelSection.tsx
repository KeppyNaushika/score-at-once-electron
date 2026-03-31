"use client"

import { ChevronDown, ChevronRight, LucideIcon } from "lucide-react"
import { ReactNode } from "react"

interface SidePanelSectionProps {
  icon: LucideIcon
  title: string
  badge?: string | number
  rightElement?: ReactNode
  children: ReactNode
  collapsible?: boolean
  isOpen?: boolean
  onToggle?: () => void
  className?: string
}

/**
 * サイドパネル内の統一されたセクションコンポーネント
 * セクション間はborder-bottomで区切り（Separator不要）
 */
export function SidePanelSection({
  icon: Icon,
  title,
  badge,
  rightElement,
  children,
  collapsible = false,
  isOpen = true,
  onToggle,
  className = "",
}: SidePanelSectionProps) {
  const open = collapsible ? isOpen : true

  return (
    <div
      className={`border-b border-gray-100 py-2 last:border-b-0 ${className}`}
    >
      {/* セクションヘッダー */}
      <div
        className={`flex items-center gap-1.5 ${open ? "mb-1.5" : ""} ${collapsible ? "cursor-pointer select-none" : ""}`}
        onClick={collapsible ? onToggle : undefined}
      >
        {collapsible &&
          (open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
          ))}
        <Icon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        <span className="text-xs font-medium text-gray-600">{title}</span>

        {badge && (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
            {badge}
          </span>
        )}

        {rightElement && (
          <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
            {rightElement}
          </div>
        )}
      </div>

      {open && <div>{children}</div>}
    </div>
  )
}
