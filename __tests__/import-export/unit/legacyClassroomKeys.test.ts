import { describe, expect, it } from "vitest"

import { normalizeLegacyClassroomKeys } from "../../../electron-src/lib/import/shared/legacyClassroomKeys"

describe("normalizeLegacyClassroomKeys（旧アーカイブ学級キーの後方互換）", () => {
  it("classId → classroomId に変換する", () => {
    const old = { memberships: [{ studentId: "s1", classId: "c1" }] }
    expect(normalizeLegacyClassroomKeys(old)).toEqual({
      memberships: [{ studentId: "s1", classroomId: "c1" }],
    })
  })

  it("classes → classrooms（配列キー）に変換する", () => {
    const old = { classes: [{ id: "c1", name: "3-A" }] }
    expect(normalizeLegacyClassroomKeys(old)).toEqual({
      classrooms: [{ id: "c1", name: "3-A" }],
    })
  })

  it("className → classroomName に変換する", () => {
    const old = { studentRefs: [{ studentNumber: "S001", className: "3-A" }] }
    expect(normalizeLegacyClassroomKeys(old)).toEqual({
      studentRefs: [{ studentNumber: "S001", classroomName: "3-A" }],
    })
  })

  it("ネストした examClasses / counts も再帰的に変換する", () => {
    const old = {
      counts: { classes: 2 },
      examData: { examClasses: [{ examId: "e1", classId: "c1" }] },
      classesData: {
        classes: [{ id: "c1" }],
        memberships: [{ classId: "c1", studentId: "s1" }],
      },
    }
    expect(normalizeLegacyClassroomKeys(old)).toEqual({
      counts: { classrooms: 2 },
      examData: { examClasses: [{ examId: "e1", classroomId: "c1" }] },
      classesData: {
        classrooms: [{ id: "c1" }],
        memberships: [{ classroomId: "c1", studentId: "s1" }],
      },
    })
  })

  it("classCode など無関係な類似キーは変換しない", () => {
    const value = { classCode: "A", classroomId: "c1" }
    expect(normalizeLegacyClassroomKeys(value)).toEqual(value)
  })

  it("新旧キーが両方ある場合は新キーを優先し旧キーを捨てる", () => {
    const mixed = { classroomId: "new", classId: "old" }
    expect(normalizeLegacyClassroomKeys(mixed)).toEqual({ classroomId: "new" })
  })

  it("既に新形式のデータは変更しない（冪等）", () => {
    const modern = {
      classrooms: [{ id: "c1", name: "3-A" }],
      memberships: [{ classroomId: "c1", studentId: "s1" }],
    }
    expect(normalizeLegacyClassroomKeys(modern)).toEqual(modern)
  })
})
