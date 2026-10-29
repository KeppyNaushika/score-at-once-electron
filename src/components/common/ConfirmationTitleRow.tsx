import {
  CircleQuestionMark,
  FileX,
  Info,
  Lock,
  Trash,
  TriangleAlert,
  Users,
} from "lucide-react"
import type { ReactNode } from "react"

/**
 * 確認ダイアログの重さ。destructive = 消えて戻らない、warning = 結果が変わる・
 * 注意が要る、default = 問いかけるだけ
 */
export type ConfirmationVariant = "destructive" | "warning" | "default"

export type ConfirmationIcon =
  "trash" | "alert" | "file" | "users" | "info" | "help" | "lock"

const icons = {
  trash: Trash,
  alert: TriangleAlert,
  file: FileX,
  users: Users,
  info: Info,
  help: CircleQuestionMark,
  lock: Lock,
}

const variantIconColors = {
  destructive: "text-red-600",
  warning: "text-orange-600",
  default: "text-blue-600",
}

const defaultIcons = {
  destructive: "trash",
  warning: "alert",
  default: "info",
} as const satisfies Record<ConfirmationVariant, ConfirmationIcon>

/**
 * 確認ダイアログの見出しの行（灰色の丸にアイコン＋見出し）。全ての確認ダイアログで
 * この形にそろえる。見出し（`AlertDialogTitle` / `DialogTitle`）は呼び出し側が渡す
 */
export function ConfirmationTitleRow({
  variant,
  icon = defaultIcons[variant],
  children,
}: {
  variant: ConfirmationVariant
  icon?: ConfirmationIcon
  children: ReactNode
}) {
  const IconComponent = icons[icon]
  return (
    <div className="flex items-center gap-3 text-left">
      <div
        className={`shrink-0 rounded-full bg-gray-100 p-2 ${variantIconColors[variant]}`}
      >
        <IconComponent className="h-6 w-6" />
      </div>
      {children}
    </div>
  )
}
