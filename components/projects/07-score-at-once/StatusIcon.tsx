"use client"

import { CheckCircle, Circle, Clock, AlertTriangle, X, Minus } from "lucide-react"

type ScoringStatus =
  | "ungraded"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "no_answer"
  | "proposed"
  | "final"

interface StatusIconProps {
  status: ScoringStatus
  className?: string
}

export function StatusIcon({ status, className = "h-4 w-4" }: StatusIconProps) {
  switch (status) {
    case "correct":
      return <CheckCircle className={`text-green-600 ${className}`} />
    case "incorrect":
      return <X className={`text-red-600 ${className}`} />
    case "partial":
      return <Circle className={`text-yellow-600 ${className}`} />
    case "pending":
      return <Clock className={`text-blue-600 ${className}`} />
    case "no_answer":
      return <Minus className={`text-gray-600 ${className}`} />
    case "ungraded":
    default:
      return <AlertTriangle className={`text-gray-400 ${className}`} />
  }
}

export function getStatusColor(status: ScoringStatus): string {
  switch (status) {
    case "correct":
      return "bg-green-100 text-green-800"
    case "incorrect":
      return "bg-red-100 text-red-800"
    case "partial":
      return "bg-yellow-100 text-yellow-800"
    case "pending":
      return "bg-blue-100 text-blue-800"
    case "no_answer":
      return "bg-gray-100 text-gray-800"
    case "ungraded":
    default:
      return "bg-gray-50 text-gray-600"
  }
}

export function getStatusLabel(status: ScoringStatus): string {
  switch (status) {
    case "correct":
      return "正答"
    case "incorrect":
      return "誤答"
    case "partial":
      return "部分点"
    case "pending":
      return "保留"
    case "no_answer":
      return "無答"
    case "ungraded":
    default:
      return "未採点"
  }
}