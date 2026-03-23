/**
 * テスト用試験ビルダー
 *
 * DBに完全な試験データを作成するヘルパー
 */

import type { CropRegion, PrismaClient } from "@prisma/client"
import { randomUUID } from "crypto"

interface FullTestExamOptions {
  /** ページ数 (default: 2) */
  pageCount?: number
  /** ページあたりの設問数 (default: 2) */
  cropRegionsPerPage?: number
  /** 生徒数 (default: 3) */
  studentCount?: number
  /** 学級名 (default: "テストクラス") */
  className?: string
  /** 試験名 (default: "テスト試験") */
  examName?: string
  /** v1.4.0+データを含めるか (default: false) */
  includeV140Data?: boolean
  /** スコアを生成するか (default: true) */
  includeScores?: boolean
  /** アノテーションを生成するか (default: false) */
  includeAnnotations?: boolean
  /** マスター画像レコードを作成するか (default: false) */
  includeMasterImages?: boolean
  /** 答案画像レコードを作成するか (default: false) */
  includeStudentAnswerImages?: boolean
}

export interface FullTestExam {
  user: { id: string; username: string; name: string }
  exam: { id: string; examName: string }
  userExam: { id: string }
  pages: Array<{ id: string; examId: string; pageNumber: number }>
  cropRegions: Array<{
    id: string
    examPageId: string
    label: string
    points: number
  }>
  students: Array<{
    id: string
    studentNumber: string
    lastName: string
    firstName: string
  }>
  class: { id: string; name: string }
  memberships: Array<{
    id: string
    studentId: string
    classId: string
    attendanceNumber: number | null
  }>
  examStudents: Array<{
    id: string
    examId: string
    studentId: string
  }>
  examClass: { id: string; examId: string; classId: string }
  subtotalGroup: { id: string; name: string }
  subtotals: Array<{
    id: string
    name: string
    subtotalGroupId: string
  }>
  examSubtotalGroup: { id: string }
  cropSubtotals: Array<{
    id: string
    cropRegionId: string
    subtotalId: string
  }>
  questionScores: Array<{
    id: string
    cropRegionId: string
    studentId: string
    userId: string
    status: string
    partialScore: number | null
  }>
  drawingAnnotations: Array<{
    id: string
    questionScoreId: string
    userId: string
  }>
  masterImages: Array<{
    id: string
    examPageId: string
    imagePath: string
  }>
  studentAnswerImages: Array<{
    id: string
    examPageId: string
    studentId: string
    imagePath: string
  }>
  // v1.4.0+
  examMarkingFormats: Array<{
    id: string
    examId: string
    markType: string
  }>
  examExportSettings: {
    id: string
    examId: string
    settingsJson: string
  } | null
  cropRegionMarkingOverrides: Array<{
    id: string
    cropRegionId: string
    markType: string
  }>
  tag: { id: string; name: string } | null
  tagSubtotalGroup: {
    id: string
    tagId: string
    subtotalGroupId: string
  } | null
}

/**
 * テスト用の完全な試験をDBに作成
 */
export async function createFullTestExam(
  prisma: PrismaClient,
  options: FullTestExamOptions = {}
): Promise<FullTestExam> {
  const {
    pageCount = 2,
    cropRegionsPerPage = 2,
    studentCount = 3,
    className = "テストクラス",
    examName = "テスト試験",
    includeV140Data = false,
    includeScores = true,
    includeAnnotations = false,
    includeMasterImages = false,
    includeStudentAnswerImages = false,
  } = options

  // 1. ユーザー作成
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: "テストユーザー",
      role: "teacher",
    },
  })

  // 2. 試験作成
  const exam = await prisma.exam.create({
    data: {
      id: randomUUID(),
      examName,
      examDate: new Date("2025-07-01"),
    },
  })

  // 3. UserExam作成
  const userExam = await prisma.userExam.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      examId: exam.id,
      role: "OWNER",
    },
  })

  // 4. ページ作成
  const pages = []
  for (let i = 0; i < pageCount; i++) {
    const page = await prisma.examPage.create({
      data: {
        id: randomUUID(),
        examId: exam.id,
        pageNumber: i + 1,
      },
    })
    pages.push(page)
  }

  // 5. CropRegion作成
  const cropRegions: CropRegion[] = []
  for (const page of pages) {
    for (let j = 0; j < cropRegionsPerPage; j++) {
      const region = await prisma.cropRegion.create({
        data: {
          id: randomUUID(),
          examPageId: page.id,
          label: `問${cropRegions.length + 1}`,
          type: "QUESTION",
          x: 0,
          y: j * 100,
          width: 200,
          height: 80,
          points: 10,
          orderIndex: cropRegions.length,
        },
      })
      cropRegions.push(region)
    }
  }

  // 6. 学級作成
  const cls = await prisma.class.create({
    data: {
      id: randomUUID(),
      name: `${className}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    },
  })

  // 7. 生徒作成
  const students = []
  const memberships = []
  const examStudents = []
  for (let i = 0; i < studentCount; i++) {
    const student = await prisma.student.create({
      data: {
        id: randomUUID(),
        studentNumber: `S${String(i + 1).padStart(3, "0")}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        lastName: `姓${i + 1}`,
        firstName: `名${i + 1}`,
        lastNameKana: `セイ${i + 1}`,
        firstNameKana: `メイ${i + 1}`,
        enrollmentYear: 2024,
      },
    })
    students.push(student)

    // メンバーシップ
    const membership = await prisma.studentClassMembership.create({
      data: {
        id: randomUUID(),
        studentId: student.id,
        classId: cls.id,
        attendanceNumber: i + 1,
      },
    })
    memberships.push(membership)

    // ExamStudent
    const ps = await prisma.examStudent.create({
      data: {
        id: randomUUID(),
        examId: exam.id,
        studentId: student.id,
        status: "PARTICIPATING",
      },
    })
    examStudents.push(ps)
  }

  // 8. ExamClass作成
  const examClass = await prisma.examClass.create({
    data: {
      id: randomUUID(),
      examId: exam.id,
      classId: cls.id,
      administered: true,
      statistics: true,
      order: 0,
    },
  })

  // 9. SubtotalGroup + Subtotal作成
  const subtotalGroup = await prisma.subtotalGroup.create({
    data: {
      id: randomUUID(),
      name: `小計G_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    },
  })

  const subtotals = []
  const subtotalNames = ["前半", "後半"]
  for (let i = 0; i < subtotalNames.length; i++) {
    const subtotal = await prisma.subtotal.create({
      data: {
        id: randomUUID(),
        name: subtotalNames[i],
        subtotalGroupId: subtotalGroup.id,
        order: i,
      },
    })
    subtotals.push(subtotal)
  }

  // 10. ExamSubtotalGroup作成
  const examSubtotalGroup = await prisma.examSubtotalGroup.create({
    data: {
      id: randomUUID(),
      examId: exam.id,
      subtotalGroupId: subtotalGroup.id,
    },
  })

  // 11. CropSubtotal作成（各regionを交互にsubtotalに割り当て）
  const cropSubtotals = []
  for (let i = 0; i < cropRegions.length; i++) {
    const subtotalIdx = i % subtotals.length
    const cs = await prisma.cropSubtotal.create({
      data: {
        id: randomUUID(),
        cropRegionId: cropRegions[i].id,
        subtotalId: subtotals[subtotalIdx].id,
        assignmentType: "auto",
      },
    })
    cropSubtotals.push(cs)
  }

  // 12. QuestionScore作成
  const questionScores = []
  if (includeScores) {
    for (const region of cropRegions) {
      for (const student of students) {
        const qs = await prisma.questionScore.create({
          data: {
            id: randomUUID(),
            cropRegionId: region.id,
            studentId: student.id,
            userId: user.id,
            status: "correct",
            partialScore: region.points,
          },
        })
        questionScores.push({
          id: qs.id,
          cropRegionId: qs.cropRegionId,
          studentId: qs.studentId,
          userId: qs.userId,
          status: qs.status,
          partialScore: qs.partialScore ? Number(qs.partialScore) : null,
        })
      }
    }
  }

  // 13. DrawingAnnotation作成
  const drawingAnnotations = []
  if (includeAnnotations && questionScores.length > 0) {
    // 最初のスコアにだけアノテーションを追加
    const da = await prisma.drawingAnnotation.create({
      data: {
        id: randomUUID(),
        questionScoreId: questionScores[0].id,
        type: "circle",
        x: 10,
        y: 10,
        userId: user.id,
      },
    })
    drawingAnnotations.push(da)
  }

  // 14. マスター画像レコード
  const masterImages = []
  if (includeMasterImages) {
    for (const page of pages) {
      const mi = await prisma.masterImage.create({
        data: {
          id: randomUUID(),
          examPageId: page.id,
          imagePath: `exams/${exam.id}/master-images/page${page.pageNumber}.png`,
        },
      })
      masterImages.push(mi)
    }
  }

  // 15. 答案画像レコード
  const studentAnswerImages = []
  if (includeStudentAnswerImages) {
    for (const page of pages) {
      for (const student of students) {
        const sai = await prisma.studentAnswerImage.create({
          data: {
            id: randomUUID(),
            examPageId: page.id,
            studentId: student.id,
            imagePath: `exams/${exam.id}/answer-sheets/${student.studentNumber}_page${page.pageNumber}.png`,
          },
        })
        studentAnswerImages.push(sai)
      }
    }
  }

  // 16. v1.4.0+ データ
  const examMarkingFormats = []
  let examExportSettings = null
  const cropRegionMarkingOverrides = []
  let tag = null
  let tagSubtotalGroup = null

  if (includeV140Data) {
    // ExamMarkingFormat
    for (const markType of ["correct", "incorrect"]) {
      const pmf = await prisma.examMarkingFormat.create({
        data: {
          id: randomUUID(),
          examId: exam.id,
          markType,
          symbol: markType === "correct" ? "○" : "×",
          color: markType === "correct" ? "#00ff00" : "#ff0000",
        },
      })
      examMarkingFormats.push(pmf)
    }

    // ExamExportSettings
    examExportSettings = await prisma.examExportSettings.create({
      data: {
        id: randomUUID(),
        examId: exam.id,
        settingsJson: JSON.stringify({ includeImages: true }),
      },
    })

    // CropRegionMarkingOverride（最初のregionに）
    if (cropRegions.length > 0) {
      const crmo = await prisma.cropRegionMarkingOverride.create({
        data: {
          id: randomUUID(),
          cropRegionId: cropRegions[0].id,
          markType: "correct",
          symbol: "◎",
          color: "#0000ff",
          visible: true,
        },
      })
      cropRegionMarkingOverrides.push(crmo)
    }

    // Tag + TagSubtotalGroup
    tag = await prisma.tag.create({
      data: {
        id: randomUUID(),
        name: `数学_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      },
    })

    tagSubtotalGroup = await prisma.tagSubtotalGroup.create({
      data: {
        id: randomUUID(),
        tagId: tag.id,
        subtotalGroupId: subtotalGroup.id,
      },
    })
  }

  return {
    user: { id: user.id, username: user.username, name: user.name },
    exam: { id: exam.id, examName: exam.examName },
    userExam: { id: userExam.id },
    pages: pages.map((p) => ({
      id: p.id,
      examId: p.examId,
      pageNumber: p.pageNumber,
    })),
    cropRegions: cropRegions.map((r) => ({
      id: r.id,
      examPageId: r.examPageId,
      label: r.label,
      points: r.points ?? 0,
    })),
    students: students.map((s) => ({
      id: s.id,
      studentNumber: s.studentNumber,
      lastName: s.lastName,
      firstName: s.firstName,
    })),
    class: { id: cls.id, name: cls.name },
    memberships: memberships.map((m) => ({
      id: m.id,
      studentId: m.studentId,
      classId: m.classId,
      attendanceNumber: m.attendanceNumber,
    })),
    examStudents: examStudents.map((ps) => ({
      id: ps.id,
      examId: ps.examId,
      studentId: ps.studentId,
    })),
    examClass: {
      id: examClass.id,
      examId: examClass.examId,
      classId: examClass.classId,
    },
    subtotalGroup: { id: subtotalGroup.id, name: subtotalGroup.name },
    subtotals: subtotals.map((s) => ({
      id: s.id,
      name: s.name,
      subtotalGroupId: s.subtotalGroupId,
    })),
    examSubtotalGroup: { id: examSubtotalGroup.id },
    cropSubtotals: cropSubtotals.map((cs) => ({
      id: cs.id,
      cropRegionId: cs.cropRegionId,
      subtotalId: cs.subtotalId,
    })),
    questionScores,
    drawingAnnotations: drawingAnnotations.map((da) => ({
      id: da.id,
      questionScoreId: da.questionScoreId,
      userId: da.userId,
    })),
    masterImages: masterImages.map((mi) => ({
      id: mi.id,
      examPageId: mi.examPageId,
      imagePath: mi.imagePath,
    })),
    studentAnswerImages: studentAnswerImages.map((sai) => ({
      id: sai.id,
      examPageId: sai.examPageId,
      studentId: sai.studentId,
      imagePath: sai.imagePath,
    })),
    examMarkingFormats: examMarkingFormats.map((pmf) => ({
      id: pmf.id,
      examId: pmf.examId,
      markType: pmf.markType,
    })),
    examExportSettings: examExportSettings
      ? {
          id: examExportSettings.id,
          examId: examExportSettings.examId,
          settingsJson: examExportSettings.settingsJson,
        }
      : null,
    cropRegionMarkingOverrides: cropRegionMarkingOverrides.map((crmo) => ({
      id: crmo.id,
      cropRegionId: crmo.cropRegionId,
      markType: crmo.markType,
    })),
    tag: tag ? { id: tag.id, name: tag.name } : null,
    tagSubtotalGroup: tagSubtotalGroup
      ? {
          id: tagSubtotalGroup.id,
          tagId: tagSubtotalGroup.tagId,
          subtotalGroupId: tagSubtotalGroup.subtotalGroupId,
        }
      : null,
  }
}
