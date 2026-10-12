import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

import { useInFlightGuard } from "@/hooks/useInFlightGuard"
import {
  answerSheetBuilderWorkflowSteps,
  workflowStepHref,
} from "@/lib/shared/workflowSteps"
import { createAnswerSheetDefinitionMutation } from "@/queries/answerSheetBuilder"

/**
 * 解答用紙を新しく作り、そのまま作成ページ（エディタ）へ進む。
 *
 * 一覧にはヘッダーと空のときの2か所に作成ボタンが同時に出るので、作成中の判定は
 * ボタンごとでなくこのフック1つで持ち、どちらを押しても二重に作らない
 */
export function useCreateDefinition(userId: string) {
  const router = useRouter()
  const { mutateAsync: createDefinition } = useMutation(
    createAnswerSheetDefinitionMutation()
  )
  // 既定値の読み込み（動的 import）も作成中に含めるので、mutation の isPending では足りない。
  // 描画に届く前の連打はガードで止め、押せなくする表示は state で持つ
  const { tryAcquire: tryStartCreate, release: finishCreate } =
    useInFlightGuard()
  const [isCreating, setIsCreating] = useState(false)

  const createAndOpen = useCallback(async () => {
    if (!tryStartCreate()) return
    setIsCreating(true)
    try {
      const newId = crypto.randomUUID()
      const { createDefaultDefinition } = await import("../constants")
      const definition = createDefaultDefinition()
      definition.id = newId

      await createDefinition({ definition, userId })
      // 作成直後は編集したいので作成ページへ直行
      router.push(
        workflowStepHref(
          `/answer-sheet-builder/${newId}`,
          answerSheetBuilderWorkflowSteps,
          "01-edit"
        )
      )
    } catch {
      // 失敗の通知は MutationCache が出す
    } finally {
      finishCreate()
      setIsCreating(false)
    }
  }, [userId, router, createDefinition, tryStartCreate, finishCreate])

  return { createAndOpen, isCreating }
}
