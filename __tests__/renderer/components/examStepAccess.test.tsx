// @vitest-environment jsdom
/**
 * 試験のロールごとに入れる段（docs/scoring-scope-and-permissions-design.md §3-3）。
 *
 * 1. **表のとおりに段を許す。** OWNER は全部、EDITOR は概要・07・（許可があれば）09、
 *    VIEWER は概要・09
 * 2. **入れない段は中身の代わりに理由と行き先を出す。** タブから外しても URL を直に
 *    開けるので、段そのものを止める
 * 3. **参加者でなければ絞らない。** 参加の行を持たない古いデータで締め出さない
 */

import "@testing-library/jest-dom/vitest"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ExamStepGuard } from "@/components/exams/shared/ExamStepGuard"
import { canEnterExamStep, type ExamRole } from "@/lib/shared/examRoles"
import { examWorkflowTabs } from "@/lib/workflowTabs"

const pathname = vi.hoisted(() => ({ current: "/exams/exam-1" }))
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

afterEach(() => {
  cleanup()
})

const ALL_STEP_IDS = examWorkflowTabs.map((tab) => tab.id)

const allowedStepIds = (role: ExamRole, canExportResults: boolean) =>
  ALL_STEP_IDS.filter((stepId) =>
    canEnterExamStep({ role, canExportResults }, stepId)
  )

describe("ロールごとに入れる段", () => {
  it("オーナーはすべての段に入れる", () => {
    expect(allowedStepIds("OWNER", false)).toEqual(ALL_STEP_IDS)
  })

  it("採点者は概要・採点・（許可があれば）結果出力", () => {
    expect(allowedStepIds("EDITOR", true)).toEqual([
      "detail",
      "07-score-at-once",
      "09-export",
    ])
    expect(allowedStepIds("EDITOR", false)).toEqual([
      "detail",
      "07-score-at-once",
    ])
  })

  it("閲覧者は概要と結果出力。結果出力の許可には左右されない", () => {
    expect(allowedStepIds("VIEWER", false)).toEqual(["detail", "09-export"])
  })
})

/** 入れる段のタブ（ロールから導く） */
const tabsFor = (role: ExamRole, canExportResults: boolean) =>
  examWorkflowTabs.filter((tab) =>
    canEnterExamStep({ role, canExportResults }, tab.id)
  )

describe("入れない段のガード", () => {
  it("採点者が準備の段を開くと、中身の代わりに理由と採点への行き先を出す", () => {
    pathname.current = "/exams/exam-1/03-region-info"
    render(
      <ExamStepGuard
        examId="exam-1"
        isPending={false}
        role="EDITOR"
        allowedTabs={tabsFor("EDITOR", true)}
      >
        <p>領域情報の中身</p>
      </ExamStepGuard>
    )

    expect(screen.queryByText("領域情報の中身")).not.toBeInTheDocument()
    expect(
      screen.getByText(/この試験のオーナーが使う段です/)
    ).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/exams/exam-1/07-score-at-once"
    )
  })

  it("閲覧者の行き先は結果出力", () => {
    pathname.current = "/exams/exam-1/07-score-at-once"
    render(
      <ExamStepGuard
        examId="exam-1"
        isPending={false}
        role="VIEWER"
        allowedTabs={tabsFor("VIEWER", false)}
      >
        <p>採点の中身</p>
      </ExamStepGuard>
    )

    expect(screen.queryByText("採点の中身")).not.toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/exams/exam-1/09-export"
    )
  })

  it("入れる段ならそのまま中身を出す", () => {
    pathname.current = "/exams/exam-1/07-score-at-once"
    render(
      <ExamStepGuard
        examId="exam-1"
        isPending={false}
        role="EDITOR"
        allowedTabs={tabsFor("EDITOR", false)}
      >
        <p>採点の中身</p>
      </ExamStepGuard>
    )

    expect(screen.getByText("採点の中身")).toBeInTheDocument()
  })

  it("参加者でなければ（ロールが無ければ）絞らない", () => {
    pathname.current = "/exams/exam-1/03-region-info"
    render(
      <ExamStepGuard
        examId="exam-1"
        isPending={false}
        role={null}
        allowedTabs={examWorkflowTabs}
      >
        <p>領域情報の中身</p>
      </ExamStepGuard>
    )

    expect(screen.getByText("領域情報の中身")).toBeInTheDocument()
  })

  it("参加者の取得が済むまでは中身を出さない（入れない段がちらつかない）", () => {
    pathname.current = "/exams/exam-1/03-region-info"
    render(
      <ExamStepGuard
        examId="exam-1"
        isPending
        role={null}
        allowedTabs={examWorkflowTabs}
      >
        <p>領域情報の中身</p>
      </ExamStepGuard>
    )

    expect(screen.queryByText("領域情報の中身")).not.toBeInTheDocument()
  })
})
