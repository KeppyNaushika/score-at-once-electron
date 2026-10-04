"use client"

import { useRouter } from "next/navigation"

import { ImportWizardModal } from "@/components/import/ImportWizardModal"
import { StudentImportWizardModal } from "@/components/student-import/StudentImportWizardModal"
import { UnifiedArchiveImportWizard } from "@/components/unified-archive/import/UnifiedArchiveImportWizard"

import { CourseworkImportDialog } from "./CourseworkImportDialog"
import { GradeImportDialog } from "./GradeImportDialog"
import type { ArchiveImportLauncher } from "./hooks/useArchiveImportLauncher"

/**
 * 「読み込み」で開いたファイルの取り込み画面。種類ごとに今の取り込み画面を、選んだ
 * ファイルから始める（`useArchiveImportLauncher` と対で各一覧に置く）。
 *
 * 取り込んだ後の振る舞いは、どの一覧から開いても種類で決まる（試験・成績算出は取り込んだ
 * ものの概要へ移る。一覧の表示は取り込みの書き込みが取り直す）。
 */
export function ArchiveImportScreens({
  launcher,
}: {
  launcher: ArchiveImportLauncher
}) {
  const router = useRouter()
  const { opened, close } = launcher
  if (opened === null) return null

  switch (opened.screen) {
    case "unified":
      return (
        <UnifiedArchiveImportWizard
          open
          onOpenChange={(nextOpen) => !nextOpen && close()}
          startWith={opened.startWith}
        />
      )
    case "exam":
      return (
        <ImportWizardModal
          isOpen
          onClose={close}
          onComplete={(examId) => router.push(`/exams/${examId}`)}
          startState={opened.startState}
        />
      )
    case "coursework":
      return (
        <CourseworkImportDialog
          archivePath={opened.archivePath}
          preview={opened.preview}
          onClose={close}
        />
      )
    case "grade":
      return (
        <GradeImportDialog
          archivePath={opened.archivePath}
          preview={opened.preview}
          onClose={close}
        />
      )
    case "students":
      return (
        <StudentImportWizardModal
          isOpen
          onClose={close}
          startState={opened.startState}
        />
      )
  }
}
