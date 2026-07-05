/**
 * Prisma拡張型定義
 *
 * このファイルはPrisma.XxxGetPayloadを使用した拡張型を集約します。
 * main (electron-src) と renderer (components, hooks) の両方から参照されます。
 *
 * @module types/prisma-extensions
 */

import type { GradeDataSource, Prisma, QuestionScore } from "@prisma/client"

import type { ExamStudentStatus } from "./examStudentStatus.types"
import type { ScoringStatus } from "./scoringStatus.types"

// =============================================================================
// Student関連型
// =============================================================================

/**
 * 学級所属情報を含む学級型
 */
export type ClassroomWithMemberships = Prisma.ClassroomGetPayload<{
  include: {
    memberships: {
      include: {
        student: true
      }
    }
  }
}>

/**
 * 受験日所属生徒（studentId のみ）を含む ExamClassroom 型。
 *
 * getClassroomMembersForExam が返す集計エンジンの基本型
 * （Excel学級平均行・個人成績表の学級比較）。memberships は受験日スナップショットで
 * where 絞り込み・出席番号→学籍番号順にソート済み。所属生徒IDは
 * `ec.classroom.memberships.map((m) => m.studentId)` で取得する。
 */
export type ExamClassroomWithMembers = Prisma.ExamClassroomGetPayload<{
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
 * 受験生徒（ExamStudent）の詳細型。
 * `getStudentsForExam`（examApi.d.ts）の戻り値要素と同一の SSOT。
 *
 * 実体は Exam×Student×Classroom の結合を生徒1人へ畳んだもので、基底は Student ではなく
 * **ExamStudent**。受験状態（status）・並び順（customOrder）は ExamStudent の実列、
 * 生徒識別・学級所属は `examStudent.student(.memberships.classroom)`、答案枚数は
 * `examStudent.student._count.studentAnswerImages` として Prisma スキーマに完全追随する。
 * 機能ごとに手書きで重複宣言せず、05/06/08・electron 出力すべてがこの型を参照する。
 *
 * status のみ ExamStudentStatus へ narrowing する（DB 上は string。Prisma+SQLite が enum を
 * 表現できないための一点拡張で、SerializedQuestionScore の Decimal→number や ScoringStatus と
 * 同じパターン）。それ以外に手書きの graft は持たない。
 */
export type ExamStudentWithDetails = Omit<
  Prisma.ExamStudentGetPayload<{
    include: {
      student: {
        include: {
          memberships: { include: { classroom: true } }
          _count: { select: { studentAnswerImages: true } }
        }
      }
    }
  }>,
  "status"
> & { status: ExamStudentStatus }

/**
 * 生徒と学級を含む学級所属型
 */
export type StudentClassroomMembershipWithDetails =
  Prisma.StudentClassroomMembershipGetPayload<{
    include: {
      student: true
      classroom: true
    }
  }>

// =============================================================================
// Answer関連型
// =============================================================================

// =============================================================================
// QuestionScore関連型
// =============================================================================

/**
 * IPC 境界を越えた QuestionScore の実体型（type injection）。
 *
 * scoringHandlers.ts の `serializeScore` は QuestionScore の全スカラー列を返しつつ、
 * `partialScore` を Decimal→number へ、`status`（DB 上は String）を SSOT の
 * ScoringStatus literal union へ絞り込む。生 Prisma `QuestionScore` を返り値型に
 * 使うと「型=Decimal / 実体=number」の乖離になるため、この型を IPC 返り値に用いる。
 * リレーション（user/student/cropRegion）は serialize 時に落ちるので含めない。
 */
export type SerializedQuestionScore = Omit<
  QuestionScore,
  "partialScore" | "status"
> & {
  partialScore: number | null
  status: ScoringStatus
}

/**
 * 採点者情報を含むQuestionScore型（比較用）
 */
export type QuestionScoreWithUser = Prisma.QuestionScoreGetPayload<{
  include: {
    user: true
  }
}>

// =============================================================================
// Exam関連型
// NOTE: IPCハンドラーが返す ExamWithDetails は common.types.ts で定義
// =============================================================================

// =============================================================================
// StudentAnswerImage関連型
// =============================================================================

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
