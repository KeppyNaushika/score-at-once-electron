/**
 * テスト用試験ビルダー
 *
 * DBに完全な試験データを作成するヘルパー
 */

import type { CropRegion, PrismaClient } from "@prisma/client"
import * as crypto from "crypto"

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
  /** ページに模範解答画像のパスを入れるか (default: false)。false なら空パス */
  includeMasterImages?: boolean
  /** 答案画像レコードを作成するか (default: false) */
  includeStudentAnswerImages?: boolean
}

export interface FullTestExam {
  user: { id: string; username: string; name: string }
  exam: { id: string; examName: string }
  userExam: { id: string }
  pages: Array<{
    id: string
    examId: string
    pageNumber: number
    imagePath: string | null
    pageSize: string
  }>
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
  classroom: { id: string; name: string }
  memberships: Array<{
    id: string
    studentId: string
    classroomId: string
    attendanceNumber: number | null
  }>
  examStudents: Array<{
    id: string
    examId: string
    studentId: string
  }>
  examClassroom: { id: string; examId: string; classroomId: string }
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
    examStudentId: string
    userId: string
    status: string
    partialScore: number | null
  }>
  drawingAnnotations: Array<{
    id: string
    questionScoreId: string
  }>
  studentAnswerImages: Array<{
    id: string
    examPageId: string
    examStudentId: string
    imagePath: string
  }>
  // v1.4.0+
  examExportSettings: {
    id: string
    examId: string
    overlayKind: string
  } | null
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
      id: crypto.randomUUID(),
      username: `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: "テストユーザー",
      role: "teacher",
    },
  })

  // 2. 試験作成
  const exam = await prisma.exam.create({
    data: {
      id: crypto.randomUUID(),
      examName,
      examDate: new Date("2025-07-01"),
    },
  })

  // 3. UserExam作成
  const userExam = await prisma.userExam.create({
    data: {
      id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
        examId: exam.id,
        pageNumber: i + 1,
        imagePath: includeMasterImages
          ? `exams/${exam.id}/master-images/page${i + 1}.png`
          : "",
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
          id: crypto.randomUUID(),
          examPageId: page.id,
          label: `問${cropRegions.length + 1}`,
          type: "QUESTION_ANSWER",
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
  const classroom = await prisma.classroom.create({
    data: {
      id: crypto.randomUUID(),
      name: `${className}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    },
  })

  // 7. 生徒作成
  const students = []
  const memberships = []
  const examStudents = []
  /** studentId → その試験の ExamStudent（採点データの親） */
  const examStudentByStudentId = new Map<string, { id: string }>()
  for (let i = 0; i < studentCount; i++) {
    const student = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        studentNumber: `S${String(i + 1).padStart(3, "0")}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        lastName: `姓${i + 1}`,
        firstName: `名${i + 1}`,
        lastNameKana: `セイ${i + 1}`,
        firstNameKana: `メイ${i + 1}`,
        enrollmentYear: 2024,
      },
    })
    students.push(student)

    // メンバーシップ。
    // 在籍判定は受験日（examDate）基準なので、既定の startDate（作成時刻）のままだと
    // 試験日時点では誰も在籍していないことになる。試験日より前から在籍させる。
    const membership = await prisma.studentClassroomMembership.create({
      data: {
        id: crypto.randomUUID(),
        studentId: student.id,
        classroomId: classroom.id,
        attendanceNumber: i + 1,
        startDate: new Date("2025-04-01"),
      },
    })
    memberships.push(membership)

    // ExamStudent
    const examStudent = await prisma.examStudent.create({
      data: {
        id: crypto.randomUUID(),
        examId: exam.id,
        studentId: student.id,
        status: "PARTICIPATING",
      },
    })
    examStudents.push(examStudent)
    examStudentByStudentId.set(student.id, examStudent)
  }

  // 8. ExamClassroom作成
  const examClassroom = await prisma.examClassroom.create({
    data: {
      id: crypto.randomUUID(),
      examId: exam.id,
      classroomId: classroom.id,
      administered: true,
      teacherStatistics: true,
      studentReport: true,
      order: 0,
    },
  })

  // 9. SubtotalGroup + Subtotal作成
  const subtotalGroup = await prisma.subtotalGroup.create({
    data: {
      id: crypto.randomUUID(),
      name: `小計G_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    },
  })

  const subtotals = []
  const subtotalNames = ["前半", "後半"]
  for (let i = 0; i < subtotalNames.length; i++) {
    const subtotal = await prisma.subtotal.create({
      data: {
        id: crypto.randomUUID(),
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
      examId: exam.id,
      subtotalGroupId: subtotalGroup.id,
    },
  })

  // 11. CropSubtotal作成（各regionを交互にsubtotalに割り当て）
  const cropSubtotals = []
  for (let i = 0; i < cropRegions.length; i++) {
    const subtotalIdx = i % subtotals.length
    const cropSubtotal = await prisma.cropSubtotal.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId: cropRegions[i].id,
        subtotalId: subtotals[subtotalIdx].id,
        assignmentType: "QUESTION_ASSIGNMENT",
      },
    })
    cropSubtotals.push(cropSubtotal)
  }

  // 12. QuestionScore作成
  const questionScores = []
  if (includeScores) {
    for (const region of cropRegions) {
      for (const student of students) {
        const questionScore = await prisma.questionScore.create({
          data: {
            id: crypto.randomUUID(),
            cropRegionId: region.id,
            examStudentId: examStudentByStudentId.get(student.id)!.id,
            userId: user.id,
            status: "correct",
            partialScore: region.points,
          },
        })
        questionScores.push({
          id: questionScore.id,
          cropRegionId: questionScore.cropRegionId,
          examStudentId: questionScore.examStudentId,
          userId: questionScore.userId,
          status: questionScore.status,
          partialScore: questionScore.partialScore
            ? Number(questionScore.partialScore)
            : null,
        })
      }
    }
  }

  // 13. DrawingAnnotation作成
  const drawingAnnotations = []
  if (includeAnnotations && questionScores.length > 0) {
    // 最初のスコアにだけアノテーションを追加。
    // type は描ける種別にする（未知の種別は読み取りの境界で除外されるため、
    // 共有フィクスチャに置くと注釈を使う全テストから消える）。
    // 未知の種別そのものを検証したいテストは、そのテスト内で行を作ること。
    const drawingAnnotation = await prisma.drawingAnnotation.create({
      data: {
        id: crypto.randomUUID(),
        questionScoreId: questionScores[0].id,
        type: "line",
        x: 10,
        y: 10,
      },
    })
    drawingAnnotations.push(drawingAnnotation)
  }

  // 15. 答案画像レコード
  const studentAnswerImages = []
  if (includeStudentAnswerImages) {
    for (const page of pages) {
      for (const student of students) {
        const studentAnswerImage = await prisma.studentAnswerImage.create({
          data: {
            id: crypto.randomUUID(),
            examPageId: page.id,
            examStudentId: examStudentByStudentId.get(student.id)!.id,
            imagePath: `exams/${exam.id}/answer-sheets/${student.studentNumber}_page${page.pageNumber}.png`,
          },
        })
        studentAnswerImages.push(studentAnswerImage)
      }
    }
  }

  // 16. v1.4.0+ データ
  let examExportSettings = null
  let tag = null
  let tagSubtotalGroup = null

  if (includeV140Data) {
    // 出力設定（正規化済み）: 代表として重ね描きのスタイルを1件入れる
    examExportSettings = await prisma.examAnswerOverlayStyle.create({
      data: {
        examId: exam.id,
        overlayKind: "mark",
        position: "middle-center",
        anchor: "middle-center",
        offsetX: 0,
        offsetY: 0,
        size: 50,
        color: "#ef4444",
        opacity: 100,
      },
    })

    // Tag + TagSubtotalGroup
    tag = await prisma.tag.create({
      data: {
        id: crypto.randomUUID(),
        name: `数学_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      },
    })

    tagSubtotalGroup = await prisma.tagSubtotalGroup.create({
      data: {
        id: crypto.randomUUID(),
        tagId: tag.id,
        subtotalGroupId: subtotalGroup.id,
      },
    })
  }

  return {
    user: { id: user.id, username: user.username, name: user.name },
    exam: { id: exam.id, examName: exam.examName },
    userExam: { id: userExam.id },
    pages: pages.map((page) => ({
      id: page.id,
      examId: page.examId,
      pageNumber: page.pageNumber,
      imagePath: page.imagePath,
      pageSize: page.pageSize,
    })),
    cropRegions: cropRegions.map((cropRegion) => ({
      id: cropRegion.id,
      examPageId: cropRegion.examPageId,
      label: cropRegion.label,
      points: cropRegion.points ?? 0,
    })),
    students: students.map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      lastName: student.lastName,
      firstName: student.firstName,
    })),
    classroom: { id: classroom.id, name: classroom.name },
    memberships: memberships.map((membership) => ({
      id: membership.id,
      studentId: membership.studentId,
      classroomId: membership.classroomId,
      attendanceNumber: membership.attendanceNumber,
    })),
    examStudents: examStudents.map((examStudent) => ({
      id: examStudent.id,
      examId: examStudent.examId,
      studentId: examStudent.studentId,
    })),
    examClassroom: {
      id: examClassroom.id,
      examId: examClassroom.examId,
      classroomId: examClassroom.classroomId,
    },
    subtotalGroup: { id: subtotalGroup.id, name: subtotalGroup.name },
    subtotals: subtotals.map((subtotal) => ({
      id: subtotal.id,
      name: subtotal.name,
      subtotalGroupId: subtotal.subtotalGroupId,
    })),
    examSubtotalGroup: { id: examSubtotalGroup.id },
    cropSubtotals: cropSubtotals.map((cropSubtotal) => ({
      id: cropSubtotal.id,
      cropRegionId: cropSubtotal.cropRegionId,
      subtotalId: cropSubtotal.subtotalId,
    })),
    questionScores,
    drawingAnnotations: drawingAnnotations.map((drawingAnnotation) => ({
      id: drawingAnnotation.id,
      questionScoreId: drawingAnnotation.questionScoreId,
    })),
    studentAnswerImages: studentAnswerImages.map((studentAnswerImage) => ({
      id: studentAnswerImage.id,
      examPageId: studentAnswerImage.examPageId,
      examStudentId: studentAnswerImage.examStudentId,
      imagePath: studentAnswerImage.imagePath,
    })),
    examExportSettings: examExportSettings
      ? {
          id: examExportSettings.id,
          examId: examExportSettings.examId,
          overlayKind: examExportSettings.overlayKind,
        }
      : null,
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
