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
 *
 * 後半は「個別で追加」タブ。こちらは絞り込み（検索語・学級プルダウン）で画面から
 * 消えるが、**追加と件数は絞り込み前の選択から作られる**ので、見ていない生徒が入り、
 * しかも件数には出ていた。選択したものが全部画面のどこかに出ていること
 * （＝件数と追加の対象が、見えているものと一致すること）を固定する。
 */

import type { Classroom, Student } from "@prisma/client"
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

function buildClassroomRow(id: string, name: string): Classroom {
  return {
    id,
    name,
    classroomCode: null,
    grade: 1,
    description: null,
    isVisible: true,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function buildClassroom(
  id: string,
  name: string,
  students: Student[]
): ClassroomWithMemberships {
  return {
    ...buildClassroomRow(id, name),
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

const CLASSROOM_A = buildClassroomRow("classroom-a", "1年A組")
const CLASSROOM_B = buildClassroomRow("classroom-b", "1年B組")
const STUDENT_TANAKA = buildStudent("student-tanaka", "田中")
const STUDENT_SATO = buildStudent("student-sato", "佐藤")

function buildStudentInClassroom(
  student: Student,
  classroom: Classroom
): StudentWithMemberships {
  return {
    ...student,
    memberships: [
      {
        id: `membership-${classroom.id}-${student.id}`,
        studentId: student.id,
        classroomId: classroom.id,
        startDate: NOW,
        endDate: null,
        attendanceNumber: 1,
        notes: null,
        createdAt: NOW,
        updatedAt: NOW,
        classroom,
      },
    ],
  }
}

/** 学級違いの生徒2人を返すアダプタ（検索語でも学級でも片方だけに絞れる） */
function createStudentTabAdapter() {
  const addStudents = vi
    .fn<StudentAddPanelAdapter["addStudents"]>()
    .mockResolvedValue(undefined)
  const adapter: StudentAddPanelAdapter = {
    scopeId: "exam-students",
    fetchAvailableClassrooms: () =>
      Promise.resolve([
        buildClassroom(CLASSROOM_A.id, CLASSROOM_A.name, [STUDENT_TANAKA]),
        buildClassroom(CLASSROOM_B.id, CLASSROOM_B.name, [STUDENT_SATO]),
      ]),
    fetchAvailableStudents: () =>
      Promise.resolve([
        buildStudentInClassroom(STUDENT_TANAKA, CLASSROOM_A),
        buildStudentInClassroom(STUDENT_SATO, CLASSROOM_B),
      ]),
    addClassrooms: () => Promise.resolve(),
    addStudents,
  }
  return { adapter, addStudents }
}

/**
 * 画面のどこかに出ている生徒（上段＝絞り込みに一致・下段＝絞り込みから外れた選択済み）。
 *
 * 選択したものがここに揃っているか、が「見ていないものが入る」を防ぐ条件そのもの。
 */
function visibleStudentIds(result: PanelResult) {
  return [
    ...result.current.filteredStudents,
    ...result.current.selectedStudentsOutsideFilter,
  ].map((student) => student.id)
}

function selectedStudentsOutsideFilterIds(result: PanelResult) {
  return result.current.selectedStudentsOutsideFilter.map(
    (student) => student.id
  )
}

async function renderStudentTab(adapter: StudentAddPanelAdapter) {
  const { result } = renderStudentAddPanel(adapter)
  await waitFor(() => expect(result.current.filteredStudents).toHaveLength(2))
  return result
}

describe("useStudentAddPanel の生徒選択と絞り込み", () => {
  it("検索語から外れた選択済みの生徒を下段に出す", async () => {
    const { adapter } = createStudentTabAdapter()
    const result = await renderStudentTab(adapter)

    act(() => {
      result.current.handleStudentSelection(STUDENT_TANAKA.id, true)
    })
    act(() => {
      result.current.setSearchTerm("佐藤")
    })

    // 上段は絞り込みに一致した佐藤だけ。田中は下段へ回り、画面から消えない
    expect(
      result.current.filteredStudents.map((student) => student.id)
    ).toEqual([STUDENT_SATO.id])
    expect(selectedStudentsOutsideFilterIds(result)).toEqual([
      STUDENT_TANAKA.id,
    ])
    expect(result.current.selectedStudentCount).toBe(1)
    expect(visibleStudentIds(result)).toContain(STUDENT_TANAKA.id)
  })

  it("学級のプルダウンも検索語と同じに扱う", async () => {
    const { adapter } = createStudentTabAdapter()
    const result = await renderStudentTab(adapter)

    act(() => {
      result.current.handleStudentSelection(STUDENT_TANAKA.id, true)
    })
    act(() => {
      result.current.setFilterClassroomId(CLASSROOM_B.id)
    })

    expect(
      result.current.filteredStudents.map((student) => student.id)
    ).toEqual([STUDENT_SATO.id])
    expect(selectedStudentsOutsideFilterIds(result)).toEqual([
      STUDENT_TANAKA.id,
    ])
  })

  it("絞り込みが空なら下段は空で、一覧は1つのまま", async () => {
    const { adapter } = createStudentTabAdapter()
    const result = await renderStudentTab(adapter)

    act(() => {
      result.current.handleStudentSelection(STUDENT_TANAKA.id, true)
      result.current.handleStudentSelection(STUDENT_SATO.id, true)
    })

    expect(result.current.filteredStudents).toHaveLength(2)
    expect(result.current.selectedStudentsOutsideFilter).toHaveLength(0)
  })

  it("下段でチェックを外すと消え、件数も減る", async () => {
    const { adapter } = createStudentTabAdapter()
    const result = await renderStudentTab(adapter)

    act(() => {
      result.current.handleStudentSelection(STUDENT_TANAKA.id, true)
    })
    act(() => {
      result.current.setSearchTerm("佐藤")
    })
    act(() => {
      result.current.handleStudentSelection(STUDENT_SATO.id, true)
    })
    expect(result.current.selectedStudentCount).toBe(2)

    act(() => {
      result.current.handleStudentSelection(STUDENT_TANAKA.id, false)
    })

    expect(result.current.selectedStudentsOutsideFilter).toHaveLength(0)
    expect(result.current.selectedStudentCount).toBe(1)
    expect(visibleStudentIds(result)).toEqual([STUDENT_SATO.id])
  })

  it("追加するのは、そのとき画面に出ている選択そのもの", async () => {
    const { adapter, addStudents } = createStudentTabAdapter()
    const result = await renderStudentTab(adapter)

    act(() => {
      result.current.handleStudentSelection(STUDENT_TANAKA.id, true)
    })
    act(() => {
      result.current.setSearchTerm("佐藤")
    })
    act(() => {
      result.current.handleStudentSelection(STUDENT_SATO.id, true)
    })

    // 押す前に、件数に出ている2人が両方とも画面のどこかに出ている
    expect(result.current.selectedStudentCount).toBe(2)
    expect(visibleStudentIds(result)).toEqual(
      expect.arrayContaining([STUDENT_TANAKA.id, STUDENT_SATO.id])
    )

    await act(async () => {
      await result.current.handleAddStudents()
    })

    expect(addStudents).toHaveBeenCalledWith([
      STUDENT_TANAKA.id,
      STUDENT_SATO.id,
    ])
    expect(result.current.selectedStudentCount).toBe(0)
  })
})
