/**
 * データ収集ロジックのユニットテスト
 *
 * テスト対象: types/examArchive.types.ts のアーカイブデータ構造
 * および electron-src/lib/export/exam-archive/dataCollector.ts の出力形式
 *
 * Note: collectExamData自体はPrisma依存のため統合テストで扱う。
 * ここではデータ構造の整合性・型安全性をテストする。
 */

import { describe, expect, it } from "vitest"

import {
  createArchiveClassesData,
  createArchiveExamData,
  createArchiveScoresData,
  createArchiveStudentsData,
  createArchiveSubtotalsData,
  createExtractedArchiveData,
  generateId,
} from "../../helpers/testDataFactory"

describe("アーカイブデータ構造", () => {
  describe("ArchiveStudentsData", () => {
    it("生徒データが正しい形式で生成される", () => {
      const data = createArchiveStudentsData([
        {
          studentNumber: "001",
          lastName: "山田",
          firstName: "太郎",
        },
      ])

      expect(data.students).toHaveLength(1)
      const student = data.students[0]
      expect(student.studentNumber).toBe("001")
      expect(student.lastName).toBe("山田")
      expect(student.firstName).toBe("太郎")
      expect(student.id).toBeTruthy()
      expect(student.createdAt).toBeTruthy()
      expect(student.updatedAt).toBeTruthy()
    })

    it("複数の生徒データを生成できる", () => {
      const data = createArchiveStudentsData([{}, {}, {}])
      expect(data.students).toHaveLength(3)

      // デフォルトのstudentNumberはユニーク
      const numbers = data.students.map((student) => student.studentNumber)
      expect(new Set(numbers).size).toBe(3)
    })

    it("空の配列を渡した場合、空の生徒リストを返す", () => {
      const data = createArchiveStudentsData([])
      expect(data.students).toHaveLength(0)
    })

    it("IDを指定できる", () => {
      const id = generateId()
      const data = createArchiveStudentsData([{ id }])
      expect(data.students[0].id).toBe(id)
    })
  })

  describe("ArchiveClassesData", () => {
    it("学級と所属データが正しい形式で生成される", () => {
      const classroomId = generateId()
      const studentId = generateId()
      const data = createArchiveClassesData(
        [{ id: classroomId, name: "1年A組" }],
        [{ studentId, classroomId, attendanceNumber: 1 }]
      )

      expect(data.classrooms).toHaveLength(1)
      expect(data.classrooms[0].name).toBe("1年A組")
      expect(data.memberships).toHaveLength(1)
      expect(data.memberships[0].studentId).toBe(studentId)
      expect(data.memberships[0].classroomId).toBe(classroomId)
      expect(data.memberships[0].attendanceNumber).toBe(1)
    })
  })

  describe("ArchiveExamData", () => {
    it("試験データがデフォルト設定で生成される", () => {
      const data = createArchiveExamData()

      expect(data.exam.id).toBeTruthy()
      expect(data.exam.examName).toBe("テスト試験")
      expect(data.examPages).toHaveLength(1)
      expect(data.cropRegions).toHaveLength(2) // 1ページ × 2リージョン
    })

    it("ページ数とリージョン数を指定できる", () => {
      const data = createArchiveExamData({
        pageCount: 3,
        cropRegionsPerPage: 5,
      })

      expect(data.examPages).toHaveLength(3)
      expect(data.cropRegions).toHaveLength(15) // 3 × 5
    })

    it("cropRegionのexamPageIdが正しいページを参照する", () => {
      const data = createArchiveExamData({
        pageCount: 2,
        cropRegionsPerPage: 2,
      })

      const pageIds = new Set(data.examPages.map((examPage) => examPage.id))
      for (const region of data.cropRegions) {
        expect(pageIds.has(region.examPageId)).toBe(true)
      }
    })

    it("v1.4.0以前のフィールドは空配列で初期化される", () => {
      const data = createArchiveExamData()

      expect(data.pageImages).toEqual([])
      expect(data.masterImages).toEqual([])
      expect(data.studentAnswerImages).toEqual([])
      expect(data.examStudents).toEqual([])
      expect(data.userExams).toEqual([])
      expect(data.examSubtotalGroups).toEqual([])
      expect(data.examClassrooms).toEqual([])
    })
  })

  describe("ArchiveScoresData", () => {
    it("採点データが正しい形式で生成される", () => {
      const cropRegionId = generateId()
      const examStudentId = generateId()
      const data = createArchiveScoresData([
        {
          cropRegionId,
          examStudentId,
          status: "correct",
          partialScore: "10",
        },
      ])

      expect(data.questionScores).toHaveLength(1)
      expect(data.questionScores[0].cropRegionId).toBe(cropRegionId)
      expect(data.questionScores[0].examStudentId).toBe(examStudentId)
      expect(data.questionScores[0].status).toBe("correct")
      expect(data.questionScores[0].partialScore).toBe("10")
      expect(data.drawingAnnotations).toEqual([])
    })

    it("partialScoreがnullの場合もサポートする", () => {
      const data = createArchiveScoresData([
        {
          cropRegionId: generateId(),
          examStudentId: generateId(),
          status: "unscored",
          partialScore: null,
        },
      ])

      expect(data.questionScores[0].partialScore).toBeNull()
    })
  })

  describe("ArchiveSubtotalsData", () => {
    it("小計グループと小計が正しくリンクされる", () => {
      const data = createArchiveSubtotalsData([
        {
          name: "前半",
          subtotals: [
            { name: "問1-3", order: 0 },
            { name: "問4-6", order: 1 },
          ],
        },
      ])

      expect(data.subtotalGroups).toHaveLength(1)
      expect(data.subtotalGroups[0].name).toBe("前半")
      expect(data.subtotals).toHaveLength(2)

      // subtotalGroupIdが正しく設定されている
      for (const subtotal of data.subtotals) {
        expect(subtotal.subtotalGroupId).toBe(data.subtotalGroups[0].id)
      }
    })
  })

  describe("ExtractedArchiveData", () => {
    it("デフォルト値で完全なアーカイブデータが生成される", () => {
      const data = createExtractedArchiveData()

      expect(data.manifest).toBeTruthy()
      expect(data.manifest.version).toBe("1.10.0")
      expect(data.examData).toBeTruthy()
      expect(data.studentsData).toBeTruthy()
      expect(data.classesData).toBeTruthy()
      expect(data.usersData).toBeTruthy()
      expect(data.subtotalsData).toBeTruthy()
      expect(data.scoresData).toBeTruthy()
      expect(data.tagsData).toBeTruthy()
      expect(data.tempDir).toBeTruthy()
    })

    it("個別のデータをオーバーライドできる", () => {
      const examData = createArchiveExamData({ examName: "カスタム試験" })
      const data = createExtractedArchiveData({ examData })

      expect(data.examData.exam.examName).toBe("カスタム試験")
    })
  })
})

describe("データ整合性チェック", () => {
  it("エクスポートデータのpartialScoreはstring|nullで表現される", () => {
    // Prisma上はDecimal型だが、JSONシリアライズ時はstringになる
    const scores = createArchiveScoresData([
      {
        cropRegionId: generateId(),
        examStudentId: generateId(),
        partialScore: "5.5",
      },
      {
        cropRegionId: generateId(),
        examStudentId: generateId(),
        partialScore: null,
      },
    ])

    expect(typeof scores.questionScores[0].partialScore).toBe("string")
    expect(scores.questionScores[1].partialScore).toBeNull()
  })

  it("日時フィールドはISO8601形式である", () => {
    const students = createArchiveStudentsData([{}])
    const dateStr = students.students[0].createdAt
    const parsed = new Date(dateStr)

    expect(parsed.toISOString()).toBe(dateStr)
  })
})
