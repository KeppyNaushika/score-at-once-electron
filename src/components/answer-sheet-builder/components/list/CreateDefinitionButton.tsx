"use client"

import { useMutation } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ComponentProps, type ReactNode, useCallback } from "react"

import { Button } from "@/components/ui/button"
import {
  answerSheetBuilderWorkflowSteps,
  workflowStepHref,
} from "@/lib/shared/workflowSteps"
import { createAnswerSheetDefinitionMutation } from "@/queries/answerSheetBuilder"

interface CreateDefinitionButtonProps extends Pick<
  ComponentProps<typeof Button>,
  "variant" | "size" | "className"
> {
  userId: string
  children: ReactNode
}

/** 解答用紙を新しく作り、そのまま作成ページ（エディタ）へ進むボタン */
export function CreateDefinitionButton({
  userId,
  variant,
  size,
  className,
  children,
}: CreateDefinitionButtonProps) {
  const router = useRouter()
  const { mutateAsync: createDefinition } = useMutation(
    createAnswerSheetDefinitionMutation()
  )

  const handleCreate = useCallback(async () => {
    try {
      const newId = crypto.randomUUID()
      const { createDefaultDefinition } = await import("../../constants")
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
    }
  }, [userId, router, createDefinition])

  return (
    <Button
      onClick={handleCreate}
      variant={variant}
      size={size}
      className={className}
    >
      <Plus className="mr-2 h-4 w-4" />
      {children}
    </Button>
  )
}
