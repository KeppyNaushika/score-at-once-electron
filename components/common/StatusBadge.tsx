"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatusType = 
  | "active" 
  | "inactive" 
  | "pending" 
  | "success" 
  | "error" 
  | "warning"
  | "participating"
  | "expected"
  | "absent"
  | "scored"
  | "unscored"
  | "correct"
  | "incorrect"
  | "partial"

interface StatusBadgeProps {
  status: StatusType
  label?: string
  size?: "sm" | "md"
  className?: string
}

const statusConfig: Record<StatusType, {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
  className?: string
}> = {
  active: {
    label: "有効",
    variant: "default",
    className: "bg-green-100 text-green-800 border-green-300"
  },
  inactive: {
    label: "無効",
    variant: "secondary",
    className: "bg-gray-100 text-gray-800 border-gray-300"
  },
  pending: {
    label: "保留",
    variant: "outline",
    className: "bg-yellow-50 text-yellow-800 border-yellow-300"
  },
  success: {
    label: "成功",
    variant: "default",
    className: "bg-green-100 text-green-800 border-green-300"
  },
  error: {
    label: "エラー",
    variant: "destructive",
    className: "bg-red-100 text-red-800 border-red-300"
  },
  warning: {
    label: "警告",
    variant: "outline",
    className: "bg-orange-50 text-orange-800 border-orange-300"
  },
  participating: {
    label: "受験",
    variant: "default",
    className: "bg-blue-100 text-blue-800 border-blue-300"
  },
  expected: {
    label: "見込",
    variant: "outline",
    className: "bg-orange-50 text-orange-800 border-orange-300"
  },
  absent: {
    label: "欠席",
    variant: "secondary",
    className: "bg-gray-100 text-gray-800 border-gray-300"
  },
  scored: {
    label: "採点済み",
    variant: "default",
    className: "bg-green-100 text-green-800 border-green-300"
  },
  unscored: {
    label: "未採点",
    variant: "outline",
    className: "bg-gray-50 text-gray-800 border-gray-300"
  },
  correct: {
    label: "正答",
    variant: "default",
    className: "bg-green-100 text-green-800 border-green-300"
  },
  incorrect: {
    label: "誤答",
    variant: "destructive",
    className: "bg-red-100 text-red-800 border-red-300"
  },
  partial: {
    label: "部分点",
    variant: "outline",
    className: "bg-yellow-50 text-yellow-800 border-yellow-300"
  }
}

export default function StatusBadge({
  status,
  label,
  size = "md",
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status]
  
  return (
    <Badge
      variant={config.variant}
      className={cn(
        config.className,
        size === "sm" && "text-xs px-2 py-0.5",
        size === "md" && "text-sm px-2.5 py-1",
        className
      )}
    >
      {label || config.label}
    </Badge>
  )
}