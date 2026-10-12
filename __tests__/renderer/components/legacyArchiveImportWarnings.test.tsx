// @vitest-environment jsdom
/**
 * 旧形式（.coursework / .grade）の取り込みで、照合の結果の警告を取り込む前に見せる（#1484）。
 *
 * - .coursework: 版の確認の警告（validation.warnings）と変換の警告が preview.warnings に入る。
 *   取り込んだ後のトーストには版の確認の警告が入らないので、ここで見せないと一度も出ない
 * - .grade: 以前から同じ一覧を見せている（見出しは変えない）
 * - 同じ文の警告が重なっても、どちらも出す
 */

import "../setup"

import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import { CourseworkImportDialog } from "@/components/archive-import/CourseworkImportDialog"
import { GradeImportDialog } from "@/components/archive-import/GradeImportDialog"
import { createAppQueryClient } from "@/queries/queryClient"
import type { CourseworkArchiveImportPreview } from "@/types/courseworkArchive.types"
import type { GradeArchiveImportPreview } from "@/types/gradeArchive.types"

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createAppQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

const courseworkManifest: CourseworkArchiveImportPreview["manifest"] = {
  version: "1.0.0",
  appVersion: "0.0.0",
  exportedAt: "2026-01-01T00:00:00.000Z",
  counts: {
    courseworks: 0,
    items: 0,
    scores: 0,
    students: 0,
    classrooms: 0,
  },
}

function courseworkPreview(warnings: string[]): CourseworkArchiveImportPreview {
  return { manifest: courseworkManifest, matches: [], warnings }
}

describe(".coursework の取り込み", () => {
  it("版の確認の警告を、取り込む前に見せる", () => {
    render(
      <CourseworkImportDialog
        archivePath="/tmp/a.coursework"
        preview={courseworkPreview([
          "アーカイブ（v1.0.0）を現行（v1.1.0）へ変換して取り込みます。",
        ])}
        onClose={() => {}}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.getByText("取り込む前に確認してください")).toBeInTheDocument()
    expect(
      screen.getByText(
        "アーカイブ（v1.0.0）を現行（v1.1.0）へ変換して取り込みます。"
      )
    ).toBeInTheDocument()
  })

  it("同じ文の警告が重なっても、どちらも出す", () => {
    render(
      <CourseworkImportDialog
        archivePath="/tmp/a.coursework"
        preview={courseworkPreview(["同じ警告", "同じ警告"])}
        onClose={() => {}}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.getAllByText("同じ警告")).toHaveLength(2)
  })

  it("警告が無ければ一覧を出さない", () => {
    render(
      <CourseworkImportDialog
        archivePath="/tmp/a.coursework"
        preview={courseworkPreview([])}
        onClose={() => {}}
      />,
      { wrapper: Wrapper }
    )
    expect(
      screen.queryByText("取り込む前に確認してください")
    ).not.toBeInTheDocument()
  })
})

describe(".grade の取り込み", () => {
  it("変換で失われるデータの警告を、取り込む前に見せる", () => {
    const preview: GradeArchiveImportPreview = {
      manifest: {
        version: "1.0.0",
        appVersion: "0.0.0",
        exportedAt: "2026-01-01T00:00:00.000Z",
        gradeId: "grade-1",
        gradeName: "成績",
        counts: {
          gradeItems: 0,
          dataSources: 0,
          manualScores: 0,
          boundaries: 0,
          classrooms: 0,
          students: 0,
        },
      },
      classroomMatches: [],
      classroomCreateCount: 0,
      examMatches: [],
      studentMatchCount: 0,
      studentCreateCount: 0,
      studentSkipCount: 0,
      courseworkMatches: [],
      warnings: ["失われる警告"],
    }
    render(
      <GradeImportDialog
        archivePath="/tmp/a.grade"
        preview={preview}
        onClose={() => {}}
      />,
      { wrapper: Wrapper }
    )
    expect(
      screen.getByText("取り込み時に失われるデータがあります")
    ).toBeInTheDocument()
    expect(screen.getByText("失われる警告")).toBeInTheDocument()
  })
})
