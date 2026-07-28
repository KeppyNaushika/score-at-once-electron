"use client"

import { FileCheck } from "lucide-react"

import { Button } from "@/components/ui/button"

interface CaptureReturnVersionButtonProps {
  /** 記録対象（現在の選択） */
  selectedExamStudentIds: string[]
  /** 返却版記録の実行中フラグ */
  capturing: boolean
  /** 指定生徒を返却版として記録する */
  capture: (examStudentIds: string[]) => Promise<boolean>
  /** ボタンのラベル（件数を含めるかは呼び出し側が決める） */
  label: string
  /** サイズ（既定 sm） */
  size?: React.ComponentProps<typeof Button>["size"]
  /** 追加クラス（固定幅など） */
  className?: string
}

/**
 * 「返却版として記録」ボタン。
 * 左カード（ReturnDiffPanel）と右カード（ExportOptionsCard）で共通利用し、
 * ラベルとサイズ・幅のみを呼び出し側で差し替える。処理・無効化条件は一箇所に集約。
 */
export function CaptureReturnVersionButton({
  selectedExamStudentIds,
  capturing,
  capture,
  label,
  size = "sm",
  className,
}: CaptureReturnVersionButtonProps) {
  return (
    <Button
      variant="outline"
      size={size}
      className={className}
      onClick={() => capture(selectedExamStudentIds)}
      disabled={capturing || selectedExamStudentIds.length === 0}
    >
      <FileCheck className="mr-1 h-4 w-4" />
      {label}
    </Button>
  )
}
