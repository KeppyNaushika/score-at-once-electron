import {
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
  Minus,
  X,
} from "lucide-react"

export type ScoringStatus =
  | "unscored"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "no_answer"
  | "proposed"
  | "final"

// 採点状態のアイコンと色を定義
export const SCORE_STATUS_CONFIG = {
  unscored: {
    icon: Circle,
    borderColor: "border-gray-400",
    bgColor: "bg-gray-50",
    selectedBgColor: "bg-gray-100",
    textColor: "text-gray-600",
    key: "q",
  },
  correct: {
    icon: CheckCircle,
    borderColor: "border-green-500",
    bgColor: "bg-green-50",
    selectedBgColor: "bg-green-100",
    textColor: "text-green-700",
    key: "e",
  },
  partial: {
    icon: AlertTriangle,
    borderColor: "border-yellow-500",
    bgColor: "bg-yellow-50",
    selectedBgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
    key: "f",
  },
  pending: {
    icon: Clock,
    borderColor: "border-blue-500",
    bgColor: "bg-blue-50",
    selectedBgColor: "bg-blue-100",
    textColor: "text-blue-700",
    key: "j",
  },
  incorrect: {
    icon: X,
    borderColor: "border-red-500",
    bgColor: "bg-red-50",
    selectedBgColor: "bg-red-100",
    textColor: "text-red-700",
    key: "o",
  },
  no_answer: {
    icon: Minus,
    borderColor: "border-purple-500",
    bgColor: "bg-purple-50",
    selectedBgColor: "bg-purple-100",
    textColor: "text-purple-600",
    key: "p",
  },
  proposed: {
    icon: AlertTriangle,
    borderColor: "border-orange-500",
    bgColor: "bg-orange-50",
    selectedBgColor: "bg-orange-100",
    textColor: "text-orange-700",
    key: "",
  },
  final: {
    icon: CheckCircle,
    borderColor: "border-green-600",
    bgColor: "bg-green-100",
    selectedBgColor: "bg-green-200",
    textColor: "text-green-800",
    key: "",
  },
  master: {
    icon: CheckCircle,
    borderColor: "border-blue-600",
    bgColor: "bg-blue-50",
    selectedBgColor: "bg-blue-100",
    textColor: "text-blue-800",
    key: "",
  },
} as const