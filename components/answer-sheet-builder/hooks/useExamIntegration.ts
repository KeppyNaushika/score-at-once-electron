/**
 * 試験変換hook
 *
 * renderer側でlayout計算→SVG生成→main側にデータを渡す。
 */

import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/AuthContext"
import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"

import {
  renderMultiPageSvgStrings,
  resolveImageDataUris,
} from "../utils/renderSvgStrings"
import { computeMultiPageLayoutFromDefinition } from "./layout/computeMultiPageLayout"

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

        const multiPageLayout = computeMultiPageLayoutFromDefinition(definition)
        const allCells = multiPageLayout.pages.flatMap((p) => p.cells)
        const imageDataUris = await resolveImageDataUris(allCells)

        const answerSheetSvgStrings = renderMultiPageSvgStrings(
          multiPageLayout,
          "answer-sheet",
          imageDataUris
        )
        const modelAnswerSvgStrings = renderMultiPageSvgStrings(
          multiPageLayout,
          "model-answer",
          imageDataUris
        )

        const result = await api.convertToExam({
          definition,
          userId: user.id,
          multiPageLayout,
          answerSheetSvgStrings,
          modelAnswerSvgStrings,
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
