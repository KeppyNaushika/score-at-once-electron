/**
 * 試験変換hook
 */

import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/AuthContext"
import type { AnswerSheetDefinition } from "@/types/answerSheetBuilder.types"

export function useExamIntegration() {
  const [isConverting, setIsConverting] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  const convertToExam = useCallback(
    async (definition: AnswerSheetDefinition) => {
      const api = window.electronAPI?.answerSheetBuilder
      if (!api) {
        toast.error("Electron APIが利用できません")
        return
      }

      if (!user?.id) {
        toast.error("ログインが必要です")
        return
      }

      try {
        setIsConverting(true)

        const result = await api.convertToExam({
          definition,
          userId: user.id,
        })

        if (result.success && result.examId) {
          toast.success("試験に変換しました")
          router.push(`/exams/${result.examId}`)
        } else {
          toast.error(`変換エラー: ${result.error}`)
        }
      } catch (error) {
        toast.error(
          `変換エラー: ${error instanceof Error ? error.message : "不明なエラー"}`
        )
      } finally {
        setIsConverting(false)
      }
    },
    [user, router]
  )

  return { convertToExam, isConverting }
}
