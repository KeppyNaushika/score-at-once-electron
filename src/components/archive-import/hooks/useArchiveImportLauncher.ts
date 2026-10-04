import { useMutation } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { openExamImportFile } from "@/hooks/import/useImportWizard"
import { openStudentImportFile } from "@/hooks/student-import/useStudentImportWizard"
import { importAnswerSheetDefinitionMutation } from "@/queries/answerSheetBuilder"
import { analyzeCourseworkArchive } from "@/queries/coursework"
import { analyzeGradeArchive } from "@/queries/grade"
import {
  openUnifiedArchive,
  selectAnyArchiveImportFile,
} from "@/queries/unifiedArchive"
import type { ArchiveImportFileKind } from "@/types/archiveImportFile.types"

import type { OpenedArchiveImport } from "../types"

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** 画面を持つ種類（.asb は画面を挟まずにそのまま取り込む） */
type ScreenFileKind = Exclude<ArchiveImportFileKind, "asb">

/**
 * 選んだファイルを、種類に対応する取り込み画面の始まりまで読む（docs/unified-archive-design.md
 * §7.6）。読めなければ例外
 */
const openArchiveImportFile = async (
  archivePath: string,
  kind: ScreenFileKind
): Promise<OpenedArchiveImport> => {
  switch (kind) {
    case "sao":
      return {
        screen: "unified",
        startWith: await openUnifiedArchive(archivePath),
      }
    case "score":
    case "hsz":
    case "dat":
      return {
        screen: "exam",
        startState: await openExamImportFile({
          path: archivePath,
          sourceFormat: kind,
        }),
      }
    case "coursework":
      return {
        screen: "coursework",
        archivePath,
        preview: await analyzeCourseworkArchive(archivePath),
      }
    case "grade":
      return {
        screen: "grade",
        archivePath,
        preview: await analyzeGradeArchive(archivePath),
      }
    case "students":
      return {
        screen: "students",
        startState: await openStudentImportFile(archivePath),
      }
  }
}

/**
 * 一覧の「読み込み」。ファイルを1つ選ばせ、拡張子で取り込み画面へ振り分ける。
 *
 * 統合アーカイブ（.sao）なら統合版のウィザード、旧形式（.score・.coursework・.grade・
 * .asb・.students）と外部の形式（.hsz・.dat）なら、それぞれの今の取り込み画面を開く。
 * どの一覧から押しても全ての形式を受け付ける。
 *
 * 選んだファイルは押した操作の続きで読み、読めたら画面を開く（画面はファイル選択の段を
 * 飛ばして始まる）。読めなかったら画面は開かずにトーストで知らせる。.asb は確かめる画面を
 * 持たないので、そのまま取り込む（旧の「.asb 読み込み」と同じ）。
 */
export function useArchiveImportLauncher() {
  const currentUser = useCurrentUser()
  const { mutateAsync: importAnswerSheetDefinition } = useMutation(
    importAnswerSheetDefinitionMutation()
  )
  const [isOpening, setIsOpening] = useState(false)
  const [opened, setOpened] = useState<OpenedArchiveImport | null>(null)

  const importAsbFile = useCallback(
    async (filePath: string) => {
      try {
        const { warnings } = await importAnswerSheetDefinition({
          filePath,
          userId: currentUser.id,
        })
        toast.success("解答用紙を読み込みました")
        for (const warning of warnings) {
          toast.warning(warning)
        }
      } catch {
        // 失敗の通知は MutationCache が出す
      }
    },
    [currentUser.id, importAnswerSheetDefinition]
  )

  // 一覧のツールバーの並び（useMemo）から参照されるので、参照を安定させる
  const start = useCallback(async () => {
    let selected: Awaited<ReturnType<typeof selectAnyArchiveImportFile>>
    try {
      selected = await selectAnyArchiveImportFile()
    } catch (selectError) {
      toast.error("ファイルを選べませんでした", {
        description: errorMessageOf(selectError),
      })
      return
    }
    if (selected === null) return

    const { path: filePath, kind } = selected
    if (kind === null) {
      toast.error("このファイルは読み込めません", {
        description:
          "読み込めるのは .sao・.score・.coursework・.grade・.asb・.students・.hsz・.dat です。",
      })
      return
    }

    setIsOpening(true)
    try {
      if (kind === "asb") {
        await importAsbFile(filePath)
        return
      }
      setOpened(await openArchiveImportFile(filePath, kind))
    } catch (openError) {
      toast.error("ファイルを読み込めませんでした", {
        description: errorMessageOf(openError),
      })
    } finally {
      setIsOpening(false)
    }
  }, [importAsbFile])

  const close = useCallback(() => setOpened(null), [])

  return {
    /** 「読み込み」を押したとき */
    start,
    isOpening,
    /** 開いている取り込み画面（null の間は何も開いていない） */
    opened,
    /** 取り込み画面を閉じたとき */
    close,
  }
}

export type ArchiveImportLauncher = ReturnType<typeof useArchiveImportLauncher>
