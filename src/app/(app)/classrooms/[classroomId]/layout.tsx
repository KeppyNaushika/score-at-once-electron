import type { ReactNode } from "react"

import { routeShellParams } from "@/lib/routeShell"

/**
 * 殻を1枚だけ作り、殻以外の値は描かない（実際の id の URL は書き換えで殻へ来る。
 * `src/lib/routeShell.ts`）。`generateStaticParams` はサーバー側のファイルにしか置けない
 * ので、この段の page がクライアント側のため、ここに置く。中身は素通し
 */
export const generateStaticParams = () => routeShellParams("classroomId")
export const dynamicParams = false

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
