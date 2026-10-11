/**
 * 試験変換hook
 *
 * renderer側でlayout計算→ページのPNG化→main側にデータを渡す。
 */

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { convertAnswerSheetToExamMutation } from "@/queries/answerSheetBuilder"
import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"

import { rasterizeAnswerSheetPages } from "../utils/rasterizeAnswerSheetPages"
import { computeMultiPageLayoutFromDefinition } from "./layout/computeMultiPageLayout"

/** 試験の模範解答・答案の雛形の画像の解像度 */
const EXAM_IMAGE_DPI = 300

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

        const answerSheetPngPages = await rasterizeAnswerSheetPages(
          definition,
          multiPageLayout,
          "answer-sheet",
          EXAM_IMAGE_DPI
        )
        const modelAnswerPngPages = await rasterizeAnswerSheetPages(
          definition,
          multiPageLayout,
          "model-answer",
          EXAM_IMAGE_DPI
        )

        const examId = await convertToExamMutate({
          definition,
          userId: currentUser.id,
          multiPageLayout,
          answerSheetPngPages,
          modelAnswerPngPages,
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
