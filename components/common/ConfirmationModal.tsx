"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Trash2, FileX, Users, Info, HelpCircle } from "lucide-react"

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
  description: string
  confirmText: string
  cancelText?: string
  variant?: "destructive" | "default" | "warning"
  items?: ConfirmationItem[]
  warnings?: ConfirmationWarning[]
  onConfirm: () => void | Promise<void>
  loading?: boolean
  icon?: "trash" | "alert" | "file" | "users" | "info" | "help"
}

const icons = {
  trash: Trash2,
  alert: AlertTriangle,
  file: FileX,
  users: Users,
  info: Info,
  help: HelpCircle,
}

const variantStyles = {
  destructive: {
    icon: "text-red-600",
    button: "destructive" as const,
  },
  warning: {
    icon: "text-orange-600",
    button: "default" as const,
  },
  default: {
    icon: "text-blue-600",
    button: "default" as const,
  },
}

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
  icon = "alert",
}: ConfirmationModalProps) {
  const IconComponent = icons[icon]
  const styles = variantStyles[variant]

  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full bg-gray-100 ${styles.icon}`}>
              <IconComponent className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                {title}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-gray-600 mt-3">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 警告メッセージ */}
          {warnings && warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((warning, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-md text-sm ${
                    warning.type === "destructive"
                      ? "bg-red-50 text-red-800 border border-red-200"
                      : warning.type === "warning"
                      ? "bg-orange-50 text-orange-800 border border-orange-200"
                      : "bg-blue-50 text-blue-800 border border-blue-200"
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
              <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2 bg-gray-50">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-white rounded border text-sm"
                  >
                    <span className="font-medium">{item.display}</span>
                    {item.badges && (
                      <div className="flex space-x-1">
                        {item.badges.map((badge, index) => (
                          <Badge
                            key={index}
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

        <DialogFooter className="flex space-x-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={styles.button}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "処理中..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}