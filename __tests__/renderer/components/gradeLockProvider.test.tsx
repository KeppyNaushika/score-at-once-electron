// @vitest-environment jsdom
/**
 * 成績算出で使われている試験を、試験ごとロックする（`GradeLockProvider` と
 * `GradeLockBar`。試験・資料の layout に置く組）の検査。
 *
 * 1. **ロック中は、成績算出が読むテーブルへの書き込みが main で断られる。** どのタブ
 *    からでも同じで、画面上部に帯が出る。成績算出に関係ない書き込み（統計対象の
 *    学級など）は止まらない
 * 2. **解除は試験単位。** 帯から確認して「編集する」を押すと、その試験の中にいる間は
 *    タブを移っても解除されたまま
 * 3. **試験を出ると（layout が外れると）再びロックされる。** 別の試験へ直接移っても
 *    解除を持ち越さない
 * 4. **使われているかは試験の詳細に同梱したデータソースから導く。** 詳細を読み込む
 *    までは分からないので、その間もロックしておく
 *
 * main 側は本物のロック（`electron-src/lib/prisma/gradeWriteLock.ts`）を使う。偽の
 * IPC は、書き込み先のテーブルを本物の関所に通し、断られたら IPC の境界と同じ
 * 取り決めの文言で例外を返す。
 */

import "../setup"

import { useMutation } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GradeLockBar } from "@/components/common/grade-lock/GradeLockBar"
import { GradeLockProvider } from "@/components/common/grade-lock/GradeLockProvider"
import {
  assertGradeWriteAllowed,
  holdGradeWriteLock,
  releaseGradeWriteLock,
  releaseGradeWriteLockOf,
} from "@/electron-src/lib/prisma/gradeWriteLock"
import { GRADE_WRITE_LOCKED_MESSAGE } from "@/lib/shared/gradeWriteLock"
import { updateCropRegionMutation } from "@/queries/cropRegion"
import { updateExamMutation } from "@/queries/exam"
import { updateExamClassroomMutation } from "@/queries/examClassroom"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const USED_EXAM_ID = "exam-used"
const OTHER_USED_EXAM_ID = "exam-used-2"

/** 試験の詳細（`get-exam`）が同梱する、試験を使っているデータソース1件 */
const DATA_SOURCE = {
  id: "data-source-1",
  type: "exam_total",
  name: "中間",
  order: 0,
  subtotalId: null,
  gradeItem: {
    id: "grade-item-1",
    name: "知識・技能",
    order: 0,
    grade: { id: "grade-1", name: "1学期成績" },
    frozenScores: [],
  },
}

/** 試験の詳細。使われていればデータソースを同梱する */
const examDetail = (
  examId: string,
  gradeDataSources: (typeof DATA_SOURCE)[]
) => ({ id: examId, examName: "中間", gradeDataSources, examPages: [] })

/** 偽の main で、ロックを握った画面の id */
const RENDERER_ID = 1

/** 偽の main が DB まで通した書き込みの、書き込み先テーブル */
let committedTables: string[] = []

/**
 * 偽の main のチャンネル。`table` への書き込みを本物の関所に通し、断られたら
 * IPC の境界（`registerChannel`）と同じ取り決めの文言で例外を返す
 */
const writesTo = (table: string) =>
  vi.fn(async () => {
    try {
      assertGradeWriteAllowed(`UPDATE \`main\`.\`${table}\` SET`)
    } catch {
      throw new Error(GRADE_WRITE_LOCKED_MESSAGE)
    }
    committedTables.push(table)
    return null
  })

const updateCropRegion = writesTo("CropRegion")
const updateExam = writesTo("Exam")
const updateExamClassroom = writesTo("ExamClassroom")

beforeEach(() => {
  committedTables = []
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    writable: true,
    value: {
      updateCropRegion,
      updateExam,
      examClassroom: { update: updateExamClassroom },
      getExam: vi.fn(async (examId: string) =>
        examDetail(examId, [DATA_SOURCE])
      ),
      gradeLock: {
        hold: vi.fn(async (token: string) =>
          holdGradeWriteLock(token, RENDERER_ID)
        ),
        release: vi.fn(async (token: string) => releaseGradeWriteLock(token)),
      },
    },
  })
})

afterEach(() => {
  releaseGradeWriteLockOf(RENDERER_ID)
  Reflect.deleteProperty(window, "electronAPI")
  vi.clearAllMocks()
})

/** 「3. 領域情報」相当のタブ。配点を書く */
function RegionInfoTab({ examId }: { examId: string }) {
  const updateRegion = useMutation(updateCropRegionMutation(examId))
  return (
    <button
      type="button"
      onClick={() =>
        updateRegion.mutate({ id: "region-1", data: { points: 5 } })
      }
    >
      配点を保存
    </button>
  )
}

/** 概要タブ相当。試験名を書く（Exam は成績算出が読む表なので、点数に効かない列でも止まる） */
function OverviewTab({ examId }: { examId: string }) {
  const updateExamInfo = useMutation(updateExamMutation(examId, "user-1"))
  return (
    <button
      type="button"
      onClick={() => updateExamInfo.mutate({ examName: "期末" })}
    >
      試験名を保存
    </button>
  )
}

/** 結果出力タブ相当。統計対象の学級を書く（成績算出が読まない表なので止まらない） */
function StatisticsTab({ examId }: { examId: string }) {
  const updateClassroom = useMutation(updateExamClassroomMutation(examId))
  return (
    <button
      type="button"
      onClick={() =>
        updateClassroom.mutate({
          id: "exam-classroom-1",
          teacherStatistics: true,
        })
      }
    >
      統計の学級を保存
    </button>
  )
}

/** 試験の layout と同じ組み方（試験ごとに作り直す） */
function ExamLayout({
  examId,
  children,
}: {
  examId: string
  children: ReactNode
}) {
  return (
    <GradeLockProvider key={examId} target={{ kind: "exam", examId }}>
      <GradeLockBar />
      {children}
    </GradeLockProvider>
  )
}

async function unlockFromBar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "ロックを解除" }))
  // どの成績算出のどの項目で使われているかを見せる
  expect(screen.getByText("1学期成績")).toBeInTheDocument()
  expect(screen.getByRole("row", { name: /知識・技能/ })).toHaveTextContent(
    "中間"
  )
  await user.click(screen.getByRole("button", { name: "編集する" }))
}

describe("成績算出で使われている試験のロック", () => {
  it("ロック中は、どのタブからでも成績算出が読む表への書き込みが断られ、通知だけ出る", async () => {
    const user = userEvent.setup()
    const wrapper = createQueryWrapper()
    const { rerender } = render(
      <ExamLayout examId={USED_EXAM_ID}>
        <RegionInfoTab examId={USED_EXAM_ID} />
      </ExamLayout>,
      { wrapper }
    )
    await screen.findByRole("button", { name: "ロックを解除" })

    await user.click(screen.getByRole("button", { name: "配点を保存" }))
    await waitFor(() => expect(toast.info).toHaveBeenCalled())
    expect(committedTables).toEqual([])

    // 別のタブへ移っても同じ
    rerender(
      <ExamLayout examId={USED_EXAM_ID}>
        <OverviewTab examId={USED_EXAM_ID} />
      </ExamLayout>
    )
    await user.click(screen.getByRole("button", { name: "試験名を保存" }))
    await waitFor(() => expect(toast.info).toHaveBeenCalledTimes(2))
    expect(committedTables).toEqual([])
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("ロック中でも、成績算出に関係ない書き込みは止まらない", async () => {
    const user = userEvent.setup()
    render(
      <ExamLayout examId={USED_EXAM_ID}>
        <StatisticsTab examId={USED_EXAM_ID} />
      </ExamLayout>,
      { wrapper: createQueryWrapper() }
    )
    await screen.findByRole("button", { name: "ロックを解除" })

    await user.click(screen.getByRole("button", { name: "統計の学級を保存" }))

    await waitFor(() => expect(committedTables).toEqual(["ExamClassroom"]))
    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("解除は、その試験の中にいる間はタブを移っても続く", async () => {
    const user = userEvent.setup()
    const wrapper = createQueryWrapper()
    const { rerender } = render(
      <ExamLayout examId={USED_EXAM_ID}>
        <RegionInfoTab examId={USED_EXAM_ID} />
      </ExamLayout>,
      { wrapper }
    )
    await unlockFromBar(user)

    await user.click(screen.getByRole("button", { name: "配点を保存" }))
    await waitFor(() => expect(committedTables).toEqual(["CropRegion"]))

    rerender(
      <ExamLayout examId={USED_EXAM_ID}>
        <OverviewTab examId={USED_EXAM_ID} />
      </ExamLayout>
    )
    expect(
      screen.queryByRole("button", { name: "ロックを解除" })
    ).not.toBeInTheDocument()
    expect(screen.getByText(/ロックを解除しています/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "試験名を保存" }))
    await waitFor(() => expect(committedTables).toEqual(["CropRegion", "Exam"]))
  })

  it("試験を出ると、再びロックされる", async () => {
    const user = userEvent.setup()
    const wrapper = createQueryWrapper()
    const { unmount } = render(
      <ExamLayout examId={USED_EXAM_ID}>
        <RegionInfoTab examId={USED_EXAM_ID} />
      </ExamLayout>,
      { wrapper }
    )
    await unlockFromBar(user)

    // 試験の一覧などへ出る（layout ごと外れる）→ 開き直す
    unmount()
    render(
      <ExamLayout examId={USED_EXAM_ID}>
        <RegionInfoTab examId={USED_EXAM_ID} />
      </ExamLayout>,
      { wrapper }
    )

    await screen.findByRole("button", { name: "ロックを解除" })
    await user.click(screen.getByRole("button", { name: "配点を保存" }))
    await waitFor(() => expect(toast.info).toHaveBeenCalled())
    expect(committedTables).toEqual([])
  })

  it("別の試験へ直接移っても、解除を持ち越さない", async () => {
    const user = userEvent.setup()
    const wrapper = createQueryWrapper()
    const { rerender } = render(
      <ExamLayout examId={USED_EXAM_ID}>
        <RegionInfoTab examId={USED_EXAM_ID} />
      </ExamLayout>,
      { wrapper }
    )
    await unlockFromBar(user)

    rerender(
      <ExamLayout examId={OTHER_USED_EXAM_ID}>
        <RegionInfoTab examId={OTHER_USED_EXAM_ID} />
      </ExamLayout>
    )

    await screen.findByRole("button", { name: "ロックを解除" })
    await user.click(screen.getByRole("button", { name: "配点を保存" }))
    await waitFor(() => expect(toast.info).toHaveBeenCalled())
    expect(committedTables).toEqual([])
  })

  it("成績算出で使われていなければ、帯を出さずに書ける", async () => {
    const user = userEvent.setup()
    const getExam = vi.fn(async (examId: string) => examDetail(examId, []))
    Object.assign(window.electronAPI, { getExam })
    render(
      <ExamLayout examId="exam-unused">
        <RegionInfoTab examId="exam-unused" />
      </ExamLayout>,
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => expect(getExam).toHaveBeenCalled())
    // 詳細が届くまではロックしているので、届いてから押す
    await waitFor(async () => {
      await user.click(screen.getByRole("button", { name: "配点を保存" }))
      expect(committedTables).toEqual(["CropRegion"])
    })
    expect(
      screen.queryByRole("button", { name: "ロックを解除" })
    ).not.toBeInTheDocument()
  })

  it("詳細を読み込むまでは、使われているか分からないのでロックしておく", async () => {
    const user = userEvent.setup()
    // 詳細が届かないまま（読み込み中）にする
    Object.assign(window.electronAPI, {
      getExam: vi.fn(() => new Promise(() => {})),
    })
    render(
      <ExamLayout examId="exam-loading">
        <RegionInfoTab examId="exam-loading" />
      </ExamLayout>,
      { wrapper: createQueryWrapper() }
    )

    await user.click(screen.getByRole("button", { name: "配点を保存" }))
    await waitFor(() => expect(toast.info).toHaveBeenCalled())
    expect(committedTables).toEqual([])
    // 使われていると分かったわけではないので、帯は出さない
    expect(
      screen.queryByRole("button", { name: "ロックを解除" })
    ).not.toBeInTheDocument()
  })
})
