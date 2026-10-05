/**
 * 「AI採点」の画面の中で共有する型。
 *
 * main から届く行の形は、IPC の戻り値から推論で取る。手で書き写さない。
 */

import type { listAiGradingRunsByUser } from "@/electron-src/lib/prisma/aiGradingRun"
import type { Serialized } from "@/types/prismaExtensions"

/** すべての試験の、自分の実行1件（試行と、プロンプト→設問→ページ→試験付き） */
export type MyAiGradingRunRow = Serialized<
  Awaited<ReturnType<typeof listAiGradingRunsByUser>>
>[number]
