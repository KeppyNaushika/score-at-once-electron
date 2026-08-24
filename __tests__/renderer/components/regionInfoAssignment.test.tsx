// @vitest-environment jsdom
/**
 * 「3. 領域情報」の採点担当（設問 × 採点者の対応表）の検査。
 *
 * 見るのは3つ。
 *
 * 1. **参加者が1人ならタブ帯そのものを描かない。** 担当という概念が要らないので、
 *    薄く出すのではなく無い（他の人を招いた瞬間に現れる）
 * 2. **マスの書き込み先は (cropRegionId, userId) のペアで決まる。** 行番号・列番号
 *    からは引かない。このリポジトリは一度「行・列と中身の対応だけが添字に残り、
 *    DB の書き込み先を添字で決めていた」で壊しているので、**並び順と id の順序を
 *    わざと食い違わせて**固定する
 * 3. **所有者でなければ読めるだけ。** 誰が担当かは全員が知りたいが、直せるのは
 *    試験の所有者だけ
 */

import "@testing-library/jest-dom/vitest"

import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import RegionInfoPage from "@/app/(app)/exams/[examId]/03-region-info/page"
import { GraderAssignmentTable } from "@/components/exams/03-region-info/components/GraderAssignmentTable"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { CropRegionRow } from "@/queries/cropRegion"
import type { ExamMemberRow } from "@/queries/userExam"

import { createQueryWrapper } from "../../helpers/queryWrapper"

/*
 * 共通のレンダラ用セットアップ（`__tests__/renderer/setup.ts`）は読み込まない。
 * あちらの `next/navigation` モックは `useParams()` が空を返すので、段のページが
 * 試験を引けない。`vi.mock` は後から登録したほうが勝ち、共通セットアップは
 * （テスト本体の hoist された `vi.mock` より後に）import で実行されるため、
 * こちらで上書きできない。よって必要なぶんだけ自分で用意する。
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({ examId: "exam-1" }),
  usePathname: () => "/exams/exam-1/03-region-info",
  useSearchParams: () => new URLSearchParams(),
}))

// 書き込みの失敗トーストは `MutationCache` が出す。jsdom へ本物を持ち込まない
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

// Radix が要るが jsdom は持たない。幅は変えない（幅を伴う検査はここにない）
global.ResizeObserver = class implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

afterEach(() => {
  cleanup()
})

const EXAM_ID = "exam-1"

const EXAM_PAGE_ID = "exam-page-1"
const TIMESTAMP = new Date("2026-08-01T00:00:00.000Z")

/** 利用者1件（DB から返る形。`passcode` は取得の時点で落ちているので持たない） */
function user(id: string, name: string): ExamMemberRow["user"] {
  return {
    id,
    username: name,
    name,
    role: "teacher",
    passcodeType: "none",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }
}

const OWNER = user("user-owner", "所有者")
const GRADER_A = user("user-a", "佐藤")
const GRADER_B = user("user-b", "鈴木")

/** 参加者1件（`user` を同梱した UserExam の行） */
function examMember(member: ExamMemberRow["user"]): ExamMemberRow {
  return {
    id: `user-exam-${member.id}`,
    userId: member.id,
    examId: EXAM_ID,
    role: member.id === OWNER.id ? "OWNER" : "GRADER",
    invitedAt: TIMESTAMP,
    invitedBy: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    user: member,
    inviter: null,
  }
}

/** 設問1件（DB から返る形をそのまま作る） */
function questionRegion(id: string, label: string): CropRegionRow {
  return {
    id,
    examPageId: EXAM_PAGE_ID,
    label,
    type: "QUESTION_ANSWER",
    x: 0.1,
    y: 0.1,
    width: 0.5,
    height: 0.1,
    points: 10,
    orderIndex: 0,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    examPage: {
      id: EXAM_PAGE_ID,
      examId: EXAM_ID,
      pageNumber: 1,
      imagePath: "pages/1.png",
      pageSize: "A4",
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
    cropSubtotals: [],
  }
}

/**
 * **表示の並びと id の綴りをわざと食い違わせる。**
 * 添字で書き込み先を決める実装だと、ここで別の設問・別の採点者へ書く。
 */
const REGION_ROWS = [
  questionRegion("region-c", "大問1"),
  questionRegion("region-a", "大問2"),
  questionRegion("region-b", "大問3"),
]
const GRADER_COLUMNS = [GRADER_B, GRADER_A]

const assignCropRegion = vi.fn(async () => null)
const unassignCropRegion = vi.fn(async () => null)
const getExamPagesByExamId = vi.fn(async () => [])
const getCropRegionsByExamId = vi.fn(async () => REGION_ROWS)
const getCropRegionAssignments = vi.fn(async () => ({
  assignments: [],
  canManage: true,
  memberCount: 1,
}))
const getMembers = vi.fn(async () => [examMember(OWNER)])

beforeEach(() => {
  vi.clearAllMocks()
  getExamPagesByExamId.mockResolvedValue([])
  getCropRegionsByExamId.mockResolvedValue(REGION_ROWS)
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    writable: true,
    // 見るのは「どの組で書いたか」と「タブが出るか」だけなので、境界は
    // 呼ばれたことを覚えるだけにする
    value: {
      assignCropRegion,
      unassignCropRegion,
      getExamPagesByExamId,
      getCropRegionsByExamId,
      getCropRegionAssignments,
      resolveFileProtocolPath: vi.fn(async () => ""),
      omrConfig: { getByExam: vi.fn(async () => []) },
      userExam: { getMembers },
    },
  })
})

/**
 * 段のページをまるごと描く。**タブ帯の有無はページが決める**ので、
 * 表だけを描いても確かめられない。
 */
async function renderRegionInfoPage({
  members,
}: {
  members: ExamMemberRow["user"][]
}) {
  getCropRegionAssignments.mockResolvedValue({
    assignments: [],
    canManage: true,
    memberCount: members.length,
  })
  getMembers.mockResolvedValue(members.map(examMember))

  render(
    <CurrentUserProvider user={OWNER}>
      <RegionInfoPage />
    </CurrentUserProvider>,
    { wrapper: createQueryWrapper() }
  )

  // 取得が終わるまで「読み込み中」が出ている
  await screen.findByRole("columnheader", { name: "ラベル" })
  // タブ帯の有無は担当の取得で決まる。**無いことを見るテストがある**ので、
  // 「まだ取れていないから無い」と区別できるところまで進めてから返す
  await waitFor(() => expect(getCropRegionAssignments).toHaveBeenCalled())
  await act(async () => {})
}

/** 対応表を所有者として描く（マスは外から与える） */
function renderTable({
  assignedUserIdsByCropRegionId = new Map<string, Set<string>>(),
  canManage = true,
}: {
  assignedUserIdsByCropRegionId?: ReadonlyMap<string, ReadonlySet<string>>
  canManage?: boolean
} = {}) {
  return render(
    <CurrentUserProvider user={OWNER}>
      <GraderAssignmentTable
        examId={EXAM_ID}
        questionRegions={REGION_ROWS}
        graders={GRADER_COLUMNS}
        assignedUserIdsByCropRegionId={assignedUserIdsByCropRegionId}
        canManage={canManage}
      />
    </CurrentUserProvider>,
    { wrapper: createQueryWrapper() }
  )
}

/** その設問の行の、その採点者の列にあるマス */
function cellOf(questionLabel: string, graderName: string): HTMLElement {
  const row = screen.getByText(questionLabel).closest("tr")
  if (!row) throw new Error(`設問の行が無い: ${questionLabel}`)
  const columnIndex = GRADER_COLUMNS.findIndex(
    (grader) => grader.name === graderName
  )
  if (columnIndex === -1) throw new Error(`採点者の列が無い: ${graderName}`)
  // 先頭は設問名の固定列なので、採点者の列はその次から並ぶ
  const cells = row.querySelectorAll("td")
  const checkbox = cells[columnIndex + 1]?.querySelector('[role="checkbox"]')
  if (!(checkbox instanceof HTMLElement)) {
    throw new Error(`マスが無い: ${questionLabel} × ${graderName}`)
  }
  return checkbox
}

describe("設問 × 採点者の対応表", () => {
  it("マスを入れると、その設問とその採点者の組で書き込みが走る", async () => {
    const userAction = userEvent.setup()
    renderTable()

    // 表示は2行目・2列目だが、書き込み先は綴りの一致で決まる
    await userAction.click(cellOf("大問2", "佐藤"))

    expect(assignCropRegion).toHaveBeenCalledTimes(1)
    expect(assignCropRegion).toHaveBeenCalledWith(
      "region-a",
      "user-a",
      OWNER.id
    )
    expect(unassignCropRegion).not.toHaveBeenCalled()
  })

  it("入っているマスを外すと、その組で解除が走る", async () => {
    const userAction = userEvent.setup()
    renderTable({
      assignedUserIdsByCropRegionId: new Map([
        ["region-b", new Set([GRADER_B.id])],
      ]),
    })

    expect(cellOf("大問3", "鈴木")).toBeChecked()
    await userAction.click(cellOf("大問3", "鈴木"))

    expect(unassignCropRegion).toHaveBeenCalledTimes(1)
    expect(unassignCropRegion).toHaveBeenCalledWith(
      "region-b",
      "user-b",
      OWNER.id
    )
    expect(assignCropRegion).not.toHaveBeenCalled()
  })

  it("担当0人＝全員という決まりを対応表の中で一度だけ言う", () => {
    renderTable()

    expect(
      screen.getByText(/チェックが1つも無い設問は、全員が採点できます/)
    ).toBeInTheDocument()
  })

  it("所有者でなければ読めるだけで、直せない", async () => {
    const userAction = userEvent.setup()
    renderTable({
      assignedUserIdsByCropRegionId: new Map([
        ["region-a", new Set([GRADER_A.id])],
      ]),
      canManage: false,
    })

    // 誰が担当かは読める
    expect(cellOf("大問2", "佐藤")).toBeChecked()
    expect(cellOf("大問1", "佐藤")).toBeDisabled()

    await userAction.click(cellOf("大問1", "佐藤"))
    expect(assignCropRegion).not.toHaveBeenCalled()
    expect(unassignCropRegion).not.toHaveBeenCalled()
  })
})

describe("採点担当タブの出し分け", () => {
  it("参加者が1人ならタブ帯を描かない", async () => {
    await renderRegionInfoPage({ members: [OWNER] })

    expect(
      screen.queryByRole("tab", { name: "採点担当" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("tab", { name: "領域情報" })
    ).not.toBeInTheDocument()
    // 担当という概念が要らないので、列の候補も引きに行かない
    expect(getMembers).not.toHaveBeenCalled()
    // タブが無くても表はそのまま出る
    expect(
      screen.getByRole("columnheader", { name: "配点" })
    ).toBeInTheDocument()
  })

  it("参加者が2人以上ならタブ帯を描き、既定では領域情報を開く", async () => {
    await renderRegionInfoPage({ members: [OWNER, GRADER_A] })

    expect(
      await screen.findByRole("tab", { name: "領域情報" })
    ).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("tab", { name: "採点担当" })).toHaveAttribute(
      "data-state",
      "inactive"
    )
  })

  it("採点担当タブを開くと、設問 × 採点者の対応表が出る", async () => {
    const userAction = userEvent.setup()
    await renderRegionInfoPage({ members: [OWNER, GRADER_A] })

    await userAction.click(await screen.findByRole("tab", { name: "採点担当" }))

    expect(
      await screen.findByRole("columnheader", { name: /佐藤/ })
    ).toBeInTheDocument()
  })
})
