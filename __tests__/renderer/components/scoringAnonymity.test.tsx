// @vitest-environment jsdom
/**
 * 「7. 採点」の匿名採点（docs/scoring-scope-and-permissions-design.md §3-5）。
 *
 * 1. **2つの層の論理和。** 試験の固定（オーナー以外に効く）か、自分で名前を隠す設定
 * 2. **オーナーには試験の固定が効かない**（採点の確定で名前が要る）
 * 3. **仮の名前と並びは受験者の id の順で振る。** 名簿の順・出席番号と関係なく、開き直しても変わらない
 * 4. **隠す欄は氏名欄と番号欄だけ**で、ページごとに引ける
 */

import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ScoringAnonymityProvider,
  useScoringAnonymity,
} from "@/components/exams/07-score-at-once/anonymity/ScoringAnonymityContext"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import { serializePreference } from "@/lib/userPreferences"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const EXAM_ID = "exam-1"
const TIMESTAMP = new Date("2026-10-01T00:00:00.000Z")

const ME = {
  id: "user-me",
  username: "me",
  name: "自分",
  role: "teacher",
  passcodeType: "none",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
}

const getExam = vi.fn()
const getMembers = vi.fn()
const getUserPreference = vi.fn()
const getCropRegionsByExamId = vi.fn()
const getStudentAnswerImagesByExamId = vi.fn()

/** 試験の行（固定の有無だけを変える） */
const examRow = (anonymousScoringEnforced: boolean) => ({
  id: EXAM_ID,
  examName: "期末",
  anonymousScoringEnforced,
})

/** 自分の参加の行 */
const myMembership = (role: string) => [
  {
    id: "user-exam-me",
    userId: ME.id,
    examId: EXAM_ID,
    role,
    canExportResults: true,
    user: ME,
    inviter: null,
  },
]

/** 名前の表示の保存値（null は未設定＝既定の表示） */
const storedShowStudentNames = (show: boolean | null) =>
  show === null ? null : serializePreference("showStudentNames", show)

/** id の綴りと名簿の順をわざと食い違わせる（zeta が先に並ぶ答案） */
const ANSWER_IMAGES = [
  { id: "image-1", examStudentId: "exam-student-zeta" },
  { id: "image-2", examStudentId: "exam-student-alpha" },
  { id: "image-3", examStudentId: "exam-student-mu" },
]

const CROP_REGIONS = [
  { id: "region-name", examPageId: "page-1", type: "STUDENT_NAME" },
  { id: "region-number", examPageId: "page-1", type: "STUDENT_ID" },
  { id: "region-question", examPageId: "page-1", type: "QUESTION_ANSWER" },
  { id: "region-name-2", examPageId: "page-2", type: "STUDENT_NAME" },
]

beforeEach(() => {
  vi.clearAllMocks()
  getCropRegionsByExamId.mockResolvedValue(CROP_REGIONS)
  getStudentAnswerImagesByExamId.mockResolvedValue(ANSWER_IMAGES)
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    writable: true,
    value: {
      getExam,
      getCropRegionsByExamId,
      getStudentAnswerImagesByExamId,
      userExam: { getMembers },
      settings: { getUserPreference },
    },
  })
})

function renderAnonymity({
  enforced,
  role,
  showStudentNames,
}: {
  enforced: boolean
  role: string
  showStudentNames: boolean | null
}) {
  getExam.mockResolvedValue(examRow(enforced))
  getMembers.mockResolvedValue(myMembership(role))
  getUserPreference.mockResolvedValue(storedShowStudentNames(showStudentNames))
  const QueryWrapper = createQueryWrapper()
  return renderHook(() => useScoringAnonymity(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryWrapper>
        <CurrentUserProvider user={ME}>
          <ScoringAnonymityProvider examId={EXAM_ID}>
            {children}
          </ScoringAnonymityProvider>
        </CurrentUserProvider>
      </QueryWrapper>
    ),
  })
}

describe("匿名採点の判定", () => {
  it("試験の固定は採点者に効き、自分では解除できない", async () => {
    const { result } = renderAnonymity({
      enforced: true,
      role: "EDITOR",
      showStudentNames: true,
    })

    await waitFor(() => expect(result.current.isAnonymous).toBe(true))
    expect(result.current.isEnforcedForMe).toBe(true)
  })

  it("オーナーには試験の固定が効かない", async () => {
    const { result } = renderAnonymity({
      enforced: true,
      role: "OWNER",
      showStudentNames: true,
    })

    await waitFor(() => expect(getMembers).toHaveBeenCalled())
    await waitFor(() => expect(getExam).toHaveBeenCalled())
    expect(result.current.isAnonymous).toBe(false)
    expect(result.current.isEnforcedForMe).toBe(false)
  })

  it("固定していなくても、自分で名前を隠していれば匿名", async () => {
    const { result } = renderAnonymity({
      enforced: false,
      role: "OWNER",
      showStudentNames: false,
    })

    await waitFor(() => expect(result.current.isAnonymous).toBe(true))
    expect(result.current.isEnforcedForMe).toBe(false)
  })

  it("固定も自分の設定も無ければ匿名でない", async () => {
    const { result } = renderAnonymity({
      enforced: false,
      role: "EDITOR",
      showStudentNames: null,
    })

    await waitFor(() => expect(getUserPreference).toHaveBeenCalled())
    expect(result.current.isAnonymous).toBe(false)
    expect(result.current.nameRegionsByExamPageId.size).toBe(0)
  })
})

describe("仮の名前・並び・隠す欄", () => {
  it("仮の名前と並びは受験者の id の順で振る", async () => {
    const { result } = renderAnonymity({
      enforced: true,
      role: "EDITOR",
      showStudentNames: true,
    })

    await waitFor(() =>
      expect(result.current.pseudonymOf("exam-student-alpha")).toBe("匿名 1")
    )
    expect(result.current.pseudonymOf("exam-student-mu")).toBe("匿名 2")
    expect(result.current.pseudonymOf("exam-student-zeta")).toBe("匿名 3")
    expect(result.current.anonymousOrderOf("exam-student-zeta")).toBe(3)
  })

  it("隠すのは氏名欄と番号欄だけで、ページごとに引ける", async () => {
    const { result } = renderAnonymity({
      enforced: true,
      role: "EDITOR",
      showStudentNames: true,
    })

    await waitFor(() =>
      expect(result.current.nameRegionsByExamPageId.size).toBe(2)
    )
    expect(
      result.current.nameRegionsByExamPageId
        .get("page-1")
        ?.map((cropRegion) => cropRegion.id)
    ).toEqual(["region-name", "region-number"])
    expect(
      result.current.nameRegionsByExamPageId
        .get("page-2")
        ?.map((cropRegion) => cropRegion.id)
    ).toEqual(["region-name-2"])
  })
})
