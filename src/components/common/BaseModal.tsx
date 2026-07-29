"use client"

import { AlertTriangle, CheckCircle, Info, X } from "lucide-react"
import React from "react"

import { Button } from "@/components/ui/button"
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"

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
  showCloseButton?: boolean
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

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
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
    showCloseButton = true,
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
      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent className={sizeClasses[size]}>
          <ModalHeader>
            <div className="flex items-center justify-between">
              <ModalTitle className="flex items-center space-x-2">
                <Icon className={`h-5 w-5 ${config.iconColor}`} />
                <span>{title}</span>
              </ModalTitle>
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {description && <ModalDescription>{description}</ModalDescription>}
          </ModalHeader>

          <div className="py-4">{children}</div>

          {actions && (
            <ModalFooter>
              <div className="flex justify-end space-x-2">
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
                    disabled={
                      actions.primary.disabled || actions.primary.loading
                    }
                  >
                    {actions.primary.loading
                      ? "処理中..."
                      : actions.primary.label}
                  </Button>
                )}
              </div>
            </ModalFooter>
          )}
        </ModalContent>
      </Modal>
    )
  }
)

BaseModal.displayName = "BaseModal"

export default BaseModal
