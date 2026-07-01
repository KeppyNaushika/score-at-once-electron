/**
 * Prisma拡張型定義
 *
 * このファイルはPrisma.XxxGetPayloadを使用した拡張型を集約します。
 * main (electron-src) と renderer (components, hooks) の両方から参照されます。
 *
 * @module types/prisma-extensions
 */

import type { GradeDataSource, Prisma } from "@prisma/client"

// =============================================================================
// Student関連型
// =============================================================================

/**
 * 学級所属情報を含む学級型
 */
export type ClassWithMemberships = Prisma.ClassroomGetPayload<{
  include: {
    memberships: {
      include: {
        student: true
      }
    }
  }
}>

/**
 * 受験日所属生徒（studentId のみ）を含む ExamClass 型。
 *
 * getClassMembersForExam が返す集計エンジンの基本型
 * （Excel学級平均行・個人成績表の学級比較）。memberships は受験日スナップショットで
 * where 絞り込み・出席番号→学籍番号順にソート済み。所属生徒IDは
 * `ec.classroom.memberships.map((m) => m.studentId)` で取得する。
 */
export type ExamClassWithMembers = Prisma.ExamClassGetPayload<{
  include: {
    classroom: {
      include: {
        memberships: {
          select: { studentId: true }
        }
      }
    }
  }
}>

/**
 * 学級所属情報を含む生徒型
 */
export type StudentWithMemberships = Prisma.StudentGetPayload<{
  include: {
    memberships: {
      include: {
        classroom: true
      }
      orderBy: {
        startDate: "desc"
      }
    }
  }
}>

/**
 * 生徒と学級を含む学級所属型
 */
export type StudentClassMembershipWithDetails =
  Prisma.StudentClassMembershipGetPayload<{
    include: {
      student: true
      classroom: true
    }
  }>

// =============================================================================
// Answer関連型
// =============================================================================

/**
 * 詳細情報を含む答案型（新構造：StudentAnswerImageベース）
 */
export type StudentAnswerWithDetails = Prisma.StudentAnswerImageGetPayload<{
  include: {
    student: {
      include: {
        examStudents: {
          select: {
            customOrder: true
          }
        }
      }
    }
    examPage: {
      include: {
        exam: true
      }
    }
  }
}>

// =============================================================================
// QuestionScore関連型
// =============================================================================

/**
 * 採点者情報を含むQuestionScore型（比較用）
 */
export type QuestionScoreWithUser = Prisma.QuestionScoreGetPayload<{
  include: {
    user: true
  }
}>

/**
 * 完全なリレーションを含むQuestionScore型（作成・更新用）
 */
export type QuestionScoreWithRelations = Prisma.QuestionScoreGetPayload<{
  include: {
    student: true
    cropRegion: true
    user: true
  }
}>

// =============================================================================
// Exam関連型
// NOTE: IPCハンドラーが返す ExamWithDetails は common.types.ts で定義
// =============================================================================

/**
 * 全リレーションを含むExam型（Prismaクエリ用）
 * IPCハンドラーが返す型は common.types.ts の ExamWithDetails を使用
 */
export type ExamPayloadWithAllRelations = Prisma.ExamGetPayload<{
  include: {
    userExams: { include: { user: true } }
    examPages: {
      include: {
        masterImages: true
        studentAnswerImages: { include: { student: true } }
        cropRegions: {
          include: {
            cropSubtotals: { include: { subtotal: true } }
            questionScores: { include: { student: true; user: true } }
          }
        }
      }
      orderBy: { pageNumber: "asc" }
    }
    examSubtotalGroups: {
      include: { subtotalGroup: { include: { subtotals: true } } }
    }
    examStudents: { include: { student: true } }
  }
}>

// =============================================================================
// CropRegion関連型
// =============================================================================

/**
 * 詳細情報を含むCropRegion型
 */
export type CropRegionWithDetails = Prisma.CropRegionGetPayload<{
  include: {
    examPage: { include: { exam: true } }
    cropSubtotals: {
      include: { subtotal: { include: { subtotalGroup: true } } }
    }
    questionScores: { include: { student: true; user: true } }
  }
}>

// =============================================================================
// SubtotalGroup/Subtotal関連型
// =============================================================================

/**
 * 小計項目を含むSubtotalGroup型
 */
export type SubtotalGroupWithItems = Prisma.SubtotalGroupGetPayload<{
  include: {
    subtotals: { orderBy: { order: "asc" } }
    examSubtotalGroups: { include: { exam: true } }
  }
}>

/**
 * 詳細情報を含むSubtotal型
 */
export type SubtotalWithDetails = Prisma.SubtotalGetPayload<{
  include: {
    subtotalGroup: true
    cropSubtotals: { include: { cropRegion: true } }
  }
}>

// =============================================================================
// CropSubtotal関連型
// =============================================================================

/**
 * 完全なリレーションを含むCropSubtotal型
 */
export type CropSubtotalWithRelations = Prisma.CropSubtotalGetPayload<{
  include: {
    cropRegion: { include: { examPage: true } }
    subtotal: { include: { subtotalGroup: true } }
  }
}>

// =============================================================================
// ExamPage/MasterImage/StudentAnswerImage関連型
// =============================================================================

/**
 * 詳細情報を含むExamPage型
 */
export type ExamPageWithDetails = Prisma.ExamPageGetPayload<{
  include: {
    exam: true
    cropRegions: true
    masterImages: true
    studentAnswerImages: { include: { student: true } }
  }
}>

/**
 * 詳細情報を含むMasterImage型
 */
export type MasterImageWithDetails = Prisma.MasterImageGetPayload<{
  include: {
    examPage: { include: { exam: true } }
  }
}>

/**
 * 詳細情報を含むStudentAnswerImage型
 * 採点機能で使用する際はexamStudentsも含む
 */
export type StudentAnswerImageWithDetails =
  Prisma.StudentAnswerImageGetPayload<{
    include: {
      examPage: true
      student: {
        include: {
          examStudents: true
        }
      }
    }
  }>

// =============================================================================
// UserExam/ExamSubtotalGroup関連型
// =============================================================================

/**
 * ユーザーと試験を含むUserExam型
 */
export type UserExamWithDetails = Prisma.UserExamGetPayload<{
  include: { user: true; exam: true }
}>

/**
 * 試験を含むUserExam型
 */
export type UserExamWithExam = Prisma.UserExamGetPayload<{
  include: { exam: true }
}>

/**
 * ユーザーを含むUserExam型
 */
export type UserExamWithUser = Prisma.UserExamGetPayload<{
  include: { user: true }
}>

/**
 * SubtotalGroupを含むExamSubtotalGroup型
 */
export type ExamSubtotalGroupWithSubtotalGroup =
  Prisma.ExamSubtotalGroupGetPayload<{
    include: { subtotalGroup: { include: { subtotals: true } } }
  }>

/**
 * Examを含むExamSubtotalGroup型
 */
export type ExamSubtotalGroupWithExam = Prisma.ExamSubtotalGroupGetPayload<{
  include: { exam: true }
}>

// =============================================================================
// GradeDataSource関連型
// =============================================================================

/**
 * 満点をライブ算出（computeLiveMaxScore）するために必要な、
 * データソースの識別フィールドだけを抜き出した型。
 *
 * 満点は常にこれらの種別・IDから元データ（設問配点 / 評価項目満点）を引いて
 * 算出するため、満点値そのものは入力に含めない。
 */
export type GradeDataSourceMaxScoreRef = Pick<GradeDataSource, "type"> &
  Partial<
    Pick<
      GradeDataSource,
      | "examId"
      | "subtotalId"
      | "cropRegionId"
      | "courseworkItemId"
      | "courseworkId"
    >
  >
