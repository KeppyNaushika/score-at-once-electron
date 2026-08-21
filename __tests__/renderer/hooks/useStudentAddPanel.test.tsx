// @vitest-environment jsdom
/**
 * 生徒追加パネルの学級選択が、在籍スイッチの切り替えで「触れない状態」にならないこと。
 *
 * 境界は追加できる生徒が0人の学級を候補に返さない（`availableClassrooms.ts` の
 * `memberships: { some: ... }`）。スイッチをオフで選んだ学級はオンにすると候補から
 * 消えるが、選択の集合には id が残る。以前はそれが画面に出ないので**外せず、
 * 追加もされない**状態になっていた。
 *
 * ここで固定するのは「チェックが付いている学級は候補から消えても出し続ける・
 * 人数は0名・外した瞬間に消える・0名でも追加の対象に入る」の4点。
 */

import type { Student } from "@prisma/client"
import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useStudentAddPanel } from "@/components/common/student-add-panel/hooks/useStudentAddPanel"
import type { StudentAddPanelAdapter } from "@/components/common/student-add-panel/types"
import type {
  ClassroomWithMemberships,
  StudentWithMemberships,
} from "@/types/prismaExtensions"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const NOW = new Date("2026-08-21T00:00:00.000Z")

const CLASSROOM_STAYS = "classroom-stays"
const CLASSROOM_VANISHES = "classroom-vanishes"

function buildStudent(id: string, lastName: string): Student {
  return {
    id,
    studentNumber: `no-${id}`,
    lastName,
    firstName: "太郎",
    lastNameKana: "せい",
    firstNameKana: "たろう",
    enrollmentYear: 2026,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function buildClassroom(
  id: string,
  name: string,
  students: Student[]
): ClassroomWithMemberships {
  const classroom = {
    id,
    name,
    classroomCode: null,
    grade: 1,
    description: null,
    isVisible: true,
    createdAt: NOW,
    updatedAt: NOW,
  }
  return {
    ...classroom,
    memberships: students.map((student, index) => ({
      id: `membership-${id}-${student.id}`,
      studentId: student.id,
      classroomId: id,
      startDate: NOW,
      endDate: null,
      attendanceNumber: index + 1,
      notes: null,
      createdAt: NOW,
      updatedAt: NOW,
      student,
    })),
  }
}

const STUDENT_IN_BOTH = buildStudent("student-in-both", "在籍")
const STUDENT_LEFT = buildStudent("student-left", "過年度")

/** 個別タブ側は今回の対象外。空にすると理由の判定が走るので1人返しておく */
const AVAILABLE_STUDENTS: StudentWithMemberships[] = [
  { ...STUDENT_IN_BOTH, memberships: [] },
]

/**
 * 在籍スイッチをオンにすると片方の学級が候補から消えるアダプタ。
 *
 * - `CLASSROOM_STAYS`: 在籍中の生徒がいるので両方の状態で候補に出る
 * - `CLASSROOM_VANISHES`: 過年度の生徒しかいないので activeOnly では返らない
 */
function createAdapter() {
  const addClassrooms = vi
    .fn<StudentAddPanelAdapter["addClassrooms"]>()
    .mockResolvedValue(undefined)
  const adapter: StudentAddPanelAdapter = {
    scopeId: "exam-1",
    fetchAvailableClassrooms: (activeOnly: boolean) =>
      Promise.resolve(
        activeOnly
          ? [buildClassroom(CLASSROOM_STAYS, "1年A組", [STUDENT_IN_BOTH])]
          : [
              buildClassroom(CLASSROOM_STAYS, "1年A組", [STUDENT_IN_BOTH]),
              buildClassroom(CLASSROOM_VANISHES, "1年B組", [STUDENT_LEFT]),
            ]
      ),
    fetchAvailableStudents: () => Promise.resolve(AVAILABLE_STUDENTS),
    addClassrooms,
    addStudents: () => Promise.resolve(),
  }
  return { adapter, addClassrooms }
}

type PanelResult = { current: ReturnType<typeof useStudentAddPanel> }

function findVanished(result: PanelResult) {
  return result.current.classrooms.find(
    (candidate) => candidate.classroom.id === CLASSROOM_VANISHES
  )
}

/**
 * 在籍スイッチの取り直しが着地するまで待つ。
 *
 * 「消えた学級が0名で残っている」だけを待つと早すぎる。切り替えた直後は取り直しが
 * 走っていて境界の候補が一時的に空になり、**残した選択だけが見えている**あいだにも
 * その条件は満たされてしまう。**残る学級が戻ってきたところまで**待つ。
 */
async function waitForRefetchedWithoutVanished(result: PanelResult) {
  await waitFor(() => {
    expect(
      result.current.classrooms.map((candidate) => candidate.classroom.id)
    ).toContain(CLASSROOM_STAYS)
    expect(findVanished(result)?.addableStudents).toHaveLength(0)
  })
}

function renderStudentAddPanel(adapter: StudentAddPanelAdapter) {
  return renderHook(
    () =>
      useStudentAddPanel({
        adapter,
        onAdded: () => {},
        // 「現在在籍していない生徒も表示する」状態から始める
        classroomActiveOnlyDefault: false,
        studentActiveOnlyDefault: false,
      }),
    { wrapper: createQueryWrapper() }
  )
}

describe("useStudentAddPanel の学級選択と在籍スイッチ", () => {
  it("候補から消えた選択済みの学級を、0名として出し続ける", async () => {
    const { adapter } = createAdapter()
    const { result } = renderStudentAddPanel(adapter)

    await waitFor(() => expect(result.current.classrooms).toHaveLength(2))

    act(() => {
      result.current.handleClassroomSelection(CLASSROOM_VANISHES, true)
    })
    act(() => {
      result.current.setClassroomActiveOnly(true)
    })

    // 境界が返すのは1件だけになるが、選んだ学級は消えない
    // （0名なのは、選んだ時点の人数1名を持ち回っていないということ）
    await waitForRefetchedWithoutVanished(result)
    expect(
      result.current.classrooms.map((candidate) => candidate.classroom.id)
    ).toContain(CLASSROOM_STAYS)
    expect(findVanished(result)?.isSelected).toBe(true)
    expect(findVanished(result)?.classroom.name).toBe("1年B組")
  })

  it("追加順の並びにも残す", async () => {
    const { adapter } = createAdapter()
    const { result } = renderStudentAddPanel(adapter)

    await waitFor(() => expect(result.current.classrooms).toHaveLength(2))
    act(() => {
      result.current.handleClassroomSelection(CLASSROOM_VANISHES, true)
    })
    act(() => {
      result.current.setClassroomActiveOnly(true)
    })

    await waitForRefetchedWithoutVanished(result)
    expect(
      result.current.selectedClassrooms.map(
        (candidate) => candidate.classroom.id
      )
    ).toEqual([CLASSROOM_VANISHES])
    expect(result.current.selectedClassroomCount).toBe(1)
  })

  it("チェックを外した瞬間に消える", async () => {
    const { adapter } = createAdapter()
    const { result } = renderStudentAddPanel(adapter)

    await waitFor(() => expect(result.current.classrooms).toHaveLength(2))
    act(() => {
      result.current.handleClassroomSelection(CLASSROOM_VANISHES, true)
    })
    act(() => {
      result.current.setClassroomActiveOnly(true)
    })
    await waitForRefetchedWithoutVanished(result)

    act(() => {
      result.current.handleClassroomSelection(CLASSROOM_VANISHES, false)
    })

    expect(
      result.current.classrooms.map((candidate) => candidate.classroom.id)
    ).toEqual([CLASSROOM_STAYS])
    expect(result.current.selectedClassrooms).toHaveLength(0)
  })

  it("0名の学級も、チェックが残っていれば追加する", async () => {
    const { adapter, addClassrooms } = createAdapter()
    const { result } = renderStudentAddPanel(adapter)

    await waitFor(() => expect(result.current.classrooms).toHaveLength(2))
    act(() => {
      result.current.handleClassroomSelection(CLASSROOM_STAYS, true)
      result.current.handleClassroomSelection(CLASSROOM_VANISHES, true)
    })
    act(() => {
      result.current.setClassroomActiveOnly(true)
    })
    await waitForRefetchedWithoutVanished(result)
    expect(result.current.selectedClassrooms).toHaveLength(2)

    await act(async () => {
      await result.current.handleAddClassrooms()
    })

    expect(addClassrooms).toHaveBeenCalledWith(
      [CLASSROOM_STAYS, CLASSROOM_VANISHES],
      true
    )
    // 追加が済んだら控えも落とす
    expect(result.current.selectedClassrooms).toHaveLength(0)
  })
})
