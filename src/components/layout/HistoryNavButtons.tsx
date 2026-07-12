"use client"

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Calculator,
  ClipboardList,
  FileEdit,
  FileStack,
  LogIn,
  type LucideIcon,
  PencilSparkles,
  School,
  Settings,
  Tag,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  type NavigationMenuEntry,
  useNavigationHistory,
} from "@/hooks/useNavigationHistory"
import { cn } from "@/lib/utils"

// AppShell（Navigation.tsx）のセクションアイコンと対応させる
const SECTION_ICONS: Record<string, LucideIcon> = {
  exams: PencilSparkles,
  "answer-sheet-builder": FileEdit,
  coursework: ClipboardList,
  grades: BarChart3,
  "pdf-tools": FileStack,
  students: Users,
  classrooms: School,
  "subtotal-groups": Calculator,
  tags: Tag,
  settings: Settings,
  login: LogIn,
}

interface HistoryNavButtonProps {
  direction: "back" | "forward"
  disabled: boolean
  entries: NavigationMenuEntry[]
  onNavigate: () => void
  onSelectIndex: (index: number) => void
}

function HistoryNavButton({
  direction,
  disabled,
  entries,
  onNavigate,
  onSelectIndex,
}: HistoryNavButtonProps) {
  const activeIndex = entries.find((entry) => entry.isActive)?.index ?? -1
  // 戻る＝現在より過去（index小）、進む＝現在より未来（index大）。いずれも現在地に近い順。
  const menuEntries =
    direction === "back"
      ? entries.filter((entry) => entry.index < activeIndex)
      : entries.filter((entry) => entry.index > activeIndex).reverse()

  const label = direction === "back" ? "戻る" : "進む"
  const Icon = direction === "back" ? ArrowLeft : ArrowRight

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={disabled}
          aria-label={label}
          title={`${label}（右クリックで履歴）`}
          onClick={onNavigate}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </ContextMenuTrigger>
      {menuEntries.length > 0 && (
        <ContextMenuContent className="max-h-80 w-96 max-w-[90vw] overflow-auto">
          {menuEntries.map((entry) => {
            const SectionIcon = SECTION_ICONS[entry.section]
            return (
              <ContextMenuItem
                key={entry.index}
                onSelect={() => onSelectIndex(entry.index)}
              >
                {SectionIcon && <SectionIcon />}
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
              </ContextMenuItem>
            )
          })}
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}

/** ヘッダーに置くブラウザ的な「戻る/進む」ボタン。左クリックで1手移動、右クリックで履歴一覧。 */
export function HistoryNavButtons({ className }: { className?: string }) {
  const { canGoBack, canGoForward, entries, goBack, goForward, goToIndex } =
    useNavigationHistory()

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <HistoryNavButton
        direction="back"
        disabled={!canGoBack}
        entries={entries}
        onNavigate={goBack}
        onSelectIndex={goToIndex}
      />
      <HistoryNavButton
        direction="forward"
        disabled={!canGoForward}
        entries={entries}
        onNavigate={goForward}
        onSelectIndex={goToIndex}
      />
    </div>
  )
}
