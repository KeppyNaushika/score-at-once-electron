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
export type ExamStudentWithMemberships = Omit<
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
export type StudentClassroomMembershipWithStudentAndClassroom =
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
// =============================================================================

/**
 * IPCハンドラー fetch-exam-by-id が返す Exam 型（詳細ページ専用の広ロード）。
 *
 * getExamById（main SSOT）と同一の include を Prisma から自己完結で導出する
 * （prismaExtensions の他型と同じ GetPayload 様式。renderer は electron-src の
 * ランタイム型を root tsconfig で解決できないため payload 直参照はしない）。
 * IPC 側で付加する平坦化 cropRegions / 抽出 answerImages を graft する。
 */
export type ExamForDetail = Prisma.ExamGetPayload<{
  include: {
    userExams: { include: { user: true } }
    examPages: {
      include: {
        masterImages: true
        studentAnswerImages: { include: { student: true } }
        cropRegions: {
          // 進捗計算は questionScores のスカラー（status/studentId/partialScore）のみ読むため
          // student/user は join しない（over-fetch 排除）
          include: { questionScores: true }
        }
      }
    }
    examSubtotalGroups: {
      include: { subtotalGroup: { include: { subtotals: true } } }
    }
    examStudents: { include: { student: true } }
    examTags: {
      select: { tag: { select: { id: true; name: true; color: true } } }
    }
  }
}> & {
  /** IPCハンドラーで平坦化されるcropRegions（進捗計算用・スコアは軽量／partialScore は number にシリアライズ済み） */
  cropRegions?: (Omit<
    Prisma.CropRegionGetPayload<{ include: { questionScores: true } }>,
    "questionScores"
  > & {
    questionScores: (Omit<QuestionScore, "partialScore"> & {
      partialScore: number | null
    })[]
  })[]
  /** IPCハンドラーで抽出されるanswerImages */
  answerImages?: (Prisma.StudentAnswerImageGetPayload<{
    include: { student: true }
  }> & {
    pageNumber: number
  })[]
}

// =============================================================================
// StudentAnswerImage関連型
// =============================================================================

/**
 * 詳細情報を含むStudentAnswerImage型
 * 採点機能で使用する際はexamStudentsも含む
 */
export type StudentAnswerImageWithExamPageAndStudent =
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

/**
 * 保存済み答案（配置済み）を Prisma include のまま持つ実体型（06 entity-first）。
 * 列＝ExamPage 実体から供給されるため、答案は自身の examPage を再同梱しない
 * （examPageId で列に照合し、pageNumber は列の ExamPage から表示時に導出する）。
 * 孤立答案の氏名表示のため student は同梱する。
 */
export type PlacedAnswerImage = Prisma.StudentAnswerImageGetPayload<{
  include: { student: true }
}>

/**
 * 06 データセットの列となる ExamPage 実体（配置済み答案を子に持つ）。
 */
export type StudentAnswerDatasetExamPage = Prisma.ExamPageGetPayload<{
  include: { studentAnswerImages: { include: { student: true } } }
}>

/**
 * 06 生徒答案ページ専用の複合データセット（Exam 根の 1 include）。
 * 行＝examStudents（ExamStudentWithMemberships）／列＝examPages（実体）。
 * IPC 返り値の SSOT。status は ExamStudentWithMemberships と同様に narrowing する。
 */
export interface StudentAnswersDataset {
  examStudents: ExamStudentWithMemberships[]
  examPages: StudentAnswerDatasetExamPage[]
}

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
 * ユーザーと招待者を含むUserExam型。
 * メンバー一覧・オーナー取得（userExam.getMembers/getOwner）が返す実形状の SSOT。
 * main（`lib/prisma/userExam.ts`）と renderer 契約（`userExamApi.d.ts`）の双方が参照する。
 */
export type UserExamWithUserAndInviter = Prisma.UserExamGetPayload<{
  include: { user: true; inviter: true }
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
