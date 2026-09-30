"use client"

import { AlertTriangle, CheckCircle, Info } from "lucide-react"
import React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ModalVariant = "default" | "destructive" | "success" | "warning" | "info"

interface BaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  variant?: ModalVariant
  children: React.ReactNode
  actions?: {
    primary?: {
      label: string
      onClick: () => void
      loading?: boolean
      disabled?: boolean
    }
    secondary?: {
      label: string
      onClick: () => void
    }
    cancel?: {
      label?: string
      onClick?: () => void
    }
  }
  size?: "sm" | "md" | "lg" | "xl"
}

const variantConfig = {
  default: {
    icon: Info,
    iconColor: "text-blue-500",
    primaryVariant: "default" as const,
  },
  destructive: {
    icon: AlertTriangle,
    iconColor: "text-red-500",
    primaryVariant: "destructive" as const,
  },
  success: {
    icon: CheckCircle,
    iconColor: "text-green-500",
    primaryVariant: "default" as const,
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-orange-500",
    primaryVariant: "default" as const,
  },
  info: {
    icon: Info,
    iconColor: "text-blue-500",
    primaryVariant: "default" as const,
  },
}

// DialogContent は sm 以上で sm:max-w-lg を持つので、同じ sm: で上書きする
const sizeClasses = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
}

const BaseModal = React.memo(
  ({
    open,
    onOpenChange,
    title,
    description,
    variant = "default",
    children,
    actions,
    size = "md",
  }: BaseModalProps) => {
    const config = variantConfig[variant]
    const Icon = config.icon

    const handleCancel = () => {
      if (actions?.cancel?.onClick) {
        actions.cancel.onClick()
      } else {
        onOpenChange(false)
      }
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={sizeClasses[size]}>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Icon className={`h-5 w-5 ${config.iconColor}`} />
              <span>{title}</span>
            </DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>

          <div className="py-4">{children}</div>

          {actions && (
            <DialogFooter>
              {actions.cancel && (
                <Button variant="outline" onClick={handleCancel}>
                  {actions.cancel.label || "キャンセル"}
                </Button>
              )}
              {actions.secondary && (
                <Button variant="outline" onClick={actions.secondary.onClick}>
                  {actions.secondary.label}
                </Button>
              )}
              {actions.primary && (
                <Button
                  variant={config.primaryVariant}
                  onClick={actions.primary.onClick}
                  disabled={actions.primary.disabled || actions.primary.loading}
                >
                  {actions.primary.loading
                    ? "処理中..."
                    : actions.primary.label}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    )
  }
)

BaseModal.displayName = "BaseModal"

export default BaseModal
