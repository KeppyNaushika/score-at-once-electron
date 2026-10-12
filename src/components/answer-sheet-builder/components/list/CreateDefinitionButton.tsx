"use client"

import { Plus } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

import { Button } from "@/components/ui/button"

interface CreateDefinitionButtonProps extends Pick<
  ComponentProps<typeof Button>,
  "variant" | "size" | "className"
> {
  /** `useCreateDefinition` の `createAndOpen`。一覧の作成ボタンはすべて同じものを受け取る */
  onCreate: () => void
  /** `useCreateDefinition` の `isCreating` */
  isCreating: boolean
  children: ReactNode
}

/** 解答用紙を新しく作り、そのまま作成ページ（エディタ）へ進むボタン */
export function CreateDefinitionButton({
  onCreate,
  isCreating,
  variant,
  size,
  className,
  children,
}: CreateDefinitionButtonProps) {
  return (
    <Button
      onClick={onCreate}
      variant={variant}
      size={size}
      className={className}
      disabled={isCreating}
    >
      <Plus className="mr-2 h-4 w-4" />
      {children}
    </Button>
  )
}
