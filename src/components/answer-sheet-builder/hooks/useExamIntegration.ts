/**
 * 試験変換hook
 *
 * renderer側でlayout計算→HTML生成→main側にデータを渡す。
 */

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { convertAnswerSheetToExamMutation } from "@/queries/answerSheetBuilder"
import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"

import { generateAnswerSheetPageHtmls } from "../utils/generatePrintHtml"
import { computeMultiPageLayoutFromDefinition } from "./layout/computeMultiPageLayout"

/** 解答用紙を試験データに変換して登録するフック */
export function useExamIntegration() {
  const [isConverting, setIsConverting] = useState(false)
  const router = useRouter()
  const currentUser = useCurrentUser()
  const { mutateAsync: convertToExamMutate } = useMutation(
    convertAnswerSheetToExamMutation(currentUser.id)
  )

  const convertToExam = useCallback(
    async (definition: AnswerSheetDefinition) => {
      try {
        setIsConverting(true)

        const multiPageLayout = computeMultiPageLayoutFromDefinition(definition)

        const answerSheetHtmlPages = await generateAnswerSheetPageHtmls(
          definition,
          multiPageLayout,
          "answer-sheet"
        )
        const modelAnswerHtmlPages = await generateAnswerSheetPageHtmls(
          definition,
          multiPageLayout,
          "model-answer"
        )

        const examId = await convertToExamMutate({
          definition,
          userId: currentUser.id,
          multiPageLayout,
          answerSheetHtmlPages,
          modelAnswerHtmlPages,
        })

        toast.success("試験に変換しました")
        router.push(`/exams/${examId}`)
      } catch {
        // 失敗の通知は MutationCache が出す
      } finally {
        setIsConverting(false)
      }
    },
    [currentUser.id, router, convertToExamMutate]
  )

  return { convertToExam, isConverting }
}
