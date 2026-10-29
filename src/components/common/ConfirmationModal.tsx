"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"

import {
  type ConfirmationIcon,
  ConfirmationTitleRow,
  type ConfirmationVariant,
} from "./ConfirmationTitleRow"

interface ConfirmationItem {
  id: string
  display: string
  badges?: Array<{
    label: string
    variant?: "default" | "secondary" | "destructive" | "outline"
  }>
}

interface ConfirmationWarning {
  type: "destructive" | "warning" | "info"
  message: string
}

interface ConfirmationModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** 問いかけ（title）だけで足りるときは省く */
  description?: string
  confirmText: string
  cancelText?: string
  variant?: ConfirmationVariant
  items?: ConfirmationItem[]
  warnings?: ConfirmationWarning[]
  onConfirm: () => void | Promise<void>
  loading?: boolean
  /** 押させない（削除できない理由を warnings で見せているときなど） */
  confirmDisabled?: boolean
  /** 省くと variant ごとの既定（削除＝ゴミ箱・注意＝三角・問いかけ＝i） */
  icon?: ConfirmationIcon
}

const confirmButtonVariants = {
  destructive: "destructive",
  warning: "default",
  default: "default",
} as const

export default function ConfirmationModal({
  open,
  onClose,
  title,
  description,
  confirmText,
  cancelText = "キャンセル",
  variant = "default",
  items,
  warnings,
  onConfirm,
  loading = false,
  confirmDisabled = false,
  icon,
}: ConfirmationModalProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        // 処理中は Esc でも閉じない。閉じると進み具合も失敗も見えなくなる
        if (!isOpen && !loading) onClose()
      }}
    >
      <AlertDialogContent
        className="sm:max-w-125"
        // 説明文を置かないときは、説明の無いことを支援技術へ明示する
        {...(description === undefined && { "aria-describedby": undefined })}
      >
        <AlertDialogHeader>
          <ConfirmationTitleRow variant={variant} icon={icon}>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </ConfirmationTitleRow>
          {description !== undefined && (
            <AlertDialogDescription className="whitespace-pre-line">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* 警告メッセージ */}
          {warnings && warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((warning) => (
                <div
                  // 同じ種類・同じ文の注意を2度出すことは無いので、中身で同定する
                  key={`${warning.type}:${warning.message}`}
                  className={`rounded-md p-3 text-sm whitespace-pre-line ${
                    warning.type === "destructive"
                      ? "border border-red-200 bg-red-50 text-red-800"
                      : warning.type === "warning"
                        ? "border border-orange-200 bg-orange-50 text-orange-800"
                        : "border border-blue-200 bg-blue-50 text-blue-800"
                  }`}
                >
                  {warning.message}
                </div>
              ))}
            </div>
          )}

          {/* アイテムリスト */}
          {items && items.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                対象項目 ({items.length}件):
              </div>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border bg-gray-50 p-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded border bg-white p-2 text-sm"
                  >
                    <span className="font-medium">{item.display}</span>
                    {item.badges && (
                      <div className="flex space-x-1">
                        {item.badges.map((badge) => (
                          <Badge
                            // 1つの項目に同じ札は付けないので、札の文言で同定する
                            key={badge.label}
                            variant={badge.variant || "secondary"}
                            className="text-xs"
                          >
                            {badge.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({
              variant: confirmButtonVariants[variant],
            })}
            onClick={(event) => {
              // 閉じるのは呼び出し側が処理を終えてから（処理中は「処理中...」を見せる）
              event.preventDefault()
              void onConfirm()
            }}
            disabled={loading || confirmDisabled}
          >
            {loading ? "処理中..." : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
