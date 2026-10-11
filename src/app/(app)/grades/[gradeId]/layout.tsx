import type { ReactNode } from "react"

import { routeShellParams } from "@/lib/routeShell"

import GradeWorkflowLayout from "./GradeWorkflowLayout"

/**
 * 殻を1枚だけ作り、殻以外の値は描かない（実際の id の URL は書き換えで殻へ来る。
 * `src/lib/routeShell.ts`）。`generateStaticParams` はサーバー側のファイルにしか置けない
 * ので、中身（クライアント側）は別のファイルに置く
 */
export const generateStaticParams = () => routeShellParams("gradeId")
export const dynamicParams = false

export default function Layout({ children }: { children: ReactNode }) {
  return <GradeWorkflowLayout>{children}</GradeWorkflowLayout>
}
