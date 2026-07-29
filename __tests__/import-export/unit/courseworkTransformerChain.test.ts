/**
 * coursework-archive のバージョン変換チェーン
 *
 * 1.0.0（資料1件の入れ子ツリー）→ 1.1.0（テーブルごとの平坦なセクション）の展開と、
 * 点数の参照が人（Student）から資料の対象者（CourseworkStudent）へ移ること、
 * 名簿に載っていない生徒の点数が破棄されることを固定する（#962 Phase B）。
 */

import { describe, expect, it } from "vitest"

import { transformCourseworkToLatest } from "../../../electron-src/lib/import/coursework-transformers"
import type { LegacyArchiveCourseworkRef } from "../../../electron-src/lib/import/coursework-transformers/legacyShape"
import type { CourseworkArchiveDataV1_0_0 } from "../../../electron-src/lib/import/coursework-transformers/types"
import {
  COURSEWORK_CURRENT_VERSION,
  type CourseworkArchiveData,
} from "../../../src/types/courseworkArchive.types"

/** 1.0.0 が実際に書き出していた形（version は名乗りどおりに書く） */
function buildLegacyArchive(
  courseworks: LegacyArchiveCourseworkRef[]
): CourseworkArchiveDataV1_0_0 {
  return {
    manifest: {
      version: "1.0.0",
      appVersion: "test",
      exportedAt: "2026-06-29T00:00:00.000Z",
      counts: {
        courseworks: courseworks.length,
        items: 0,
        scores: 0,
        students: 0,
        classrooms: 0,
      },
    },
    courseworks,
    studentsData: [],
    classesData: [],
    membershipsData: [],
    tagsData: [],
  }
}

/** 1.1.0（現行）の空アーカイブ */
function buildCurrentArchive(): CourseworkArchiveData {
  return {
    manifest: {
      version: COURSEWORK_CURRENT_VERSION,
      appVersion: "test",
      exportedAt: "2026-06-29T00:00:00.000Z",
      counts: {
        courseworks: 0,
        items: 0,
        scores: 0,
        students: 0,
        classrooms: 0,
      },
    },
    courseworks: [],
    courseworkClassrooms: [],
    courseworkTags: [],
    courseworkStudents: [],
    courseworkItems: [],
    courseworkLetterScales: [],
    courseworkScores: [],
    studentsData: [],
    classesData: [],
    membershipsData: [],
    tagsData: [],
  }
}

const LEGACY_COURSEWORK: LegacyArchiveCourseworkRef = {
  id: "cw-1",
  name: "第1回レポート",
  description: null,
  date: null,
  classrooms: [{ classroomId: "classroom-1", order: 0 }],
  tags: [{ tagId: "tag-1" }],
  students: [{ studentId: "student-kept", customOrder: 0 }],
  items: [
    {
      id: "item-1",
      name: "提出物",
      order: 0,
      maxScore: 100,
      inputMode: "letter",
      letterScales: [{ label: "A", score: 100, order: 0 }],
      scores: [
        {
          studentId: "student-kept",
          score: 85,
          letterValue: "A",
          adjustment: -5,
          adjustmentReason: "提出遅延",
          comment: "良い",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    },
  ],
}

describe("coursework-archive 1.0.0 → 1.1.0", () => {
  it("入れ子ツリーをテーブルごとの平坦なセクションへ展開する", () => {
    const result = transformCourseworkToLatest(
      buildLegacyArchive([LEGACY_COURSEWORK])
    )

    expect(result.originalVersion).toBe("1.0.0")
    expect(result.finalVersion).toBe(COURSEWORK_CURRENT_VERSION)

    expect(result.data.courseworks).toEqual([
      expect.objectContaining({ id: "cw-1", name: "第1回レポート" }),
    ])
    expect(result.data.courseworkClassrooms).toEqual([
      expect.objectContaining({
        courseworkId: "cw-1",
        classroomId: "classroom-1",
      }),
    ])
    expect(result.data.courseworkTags).toEqual([
      expect.objectContaining({ courseworkId: "cw-1", tagId: "tag-1" }),
    ])
    expect(result.data.courseworkItems).toEqual([
      expect.objectContaining({ id: "item-1", courseworkId: "cw-1" }),
    ])
    expect(result.data.courseworkLetterScales).toEqual([
      expect.objectContaining({ courseworkItemId: "item-1", label: "A" }),
    ])
  })

  it("点数の参照が人から資料の対象者へ付け替わる", () => {
    const result = transformCourseworkToLatest(
      buildLegacyArchive([LEGACY_COURSEWORK])
    )

    const courseworkStudent = result.data.courseworkStudents[0]
    expect(courseworkStudent.studentId).toBe("student-kept")

    expect(result.data.courseworkScores).toHaveLength(1)
    const score = result.data.courseworkScores[0]
    expect(score.courseworkStudentId).toBe(courseworkStudent.id)
    // Decimal は JSON.stringify と同じ文字列表現で持つ
    expect(score.score).toBe("85")
    expect(score.adjustment).toBe("-5")
    expect(score.updatedAt).toBe("2026-06-01T00:00:00.000Z")
  })

  it("名簿に載っていない生徒の点数は破棄し、件数を警告に載せる", () => {
    const withOrphan: LegacyArchiveCourseworkRef = {
      ...LEGACY_COURSEWORK,
      items: [
        {
          ...LEGACY_COURSEWORK.items[0],
          scores: [
            ...LEGACY_COURSEWORK.items[0].scores,
            {
              studentId: "student-orphan",
              score: 40,
              letterValue: null,
              adjustment: null,
              adjustmentReason: null,
              comment: null,
              updatedAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        },
      ],
    }

    const result = transformCourseworkToLatest(buildLegacyArchive([withOrphan]))

    expect(result.data.courseworkScores).toHaveLength(1)
    expect(result.data.courseworkScores[0].courseworkStudentId).toBe(
      result.data.courseworkStudents[0].id
    )
    expect(
      result.warnings.some((warning) => warning.includes("1 件を破棄"))
    ).toBe(true)
  })

  it("同じアーカイブを2度通しても同じ id になる（変換が冪等）", () => {
    const first = transformCourseworkToLatest(
      buildLegacyArchive([LEGACY_COURSEWORK])
    )
    const second = transformCourseworkToLatest(
      buildLegacyArchive([LEGACY_COURSEWORK])
    )
    expect(second.data.courseworkStudents).toEqual(
      first.data.courseworkStudents
    )
    expect(second.data.courseworkScores).toEqual(first.data.courseworkScores)
  })

  it("1.1.0 を名乗っていても中身が入れ子なら 1.0.0 として変換する", () => {
    const lying = buildLegacyArchive([LEGACY_COURSEWORK])
    lying.manifest.version = "1.1.0"

    const result = transformCourseworkToLatest(lying)

    expect(result.originalVersion).toBe("1.0.0")
    expect(result.data.courseworkScores).toHaveLength(1)
  })

  it("既に平坦なアーカイブは素通しする", () => {
    const flat = buildCurrentArchive()
    flat.courseworks = [
      {
        id: "cw-1",
        name: "第1回レポート",
        description: null,
        date: null,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ]

    const result = transformCourseworkToLatest(flat)

    expect(result.appliedTransformations).toEqual([])
    expect(result.data.courseworks).toEqual(flat.courseworks)
  })
})
