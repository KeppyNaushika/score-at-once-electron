/**
 * Prisma拡張型定義
 *
 * このファイルはPrisma.XxxGetPayloadを使用した拡張型を集約します。
 * main (electron-src) と renderer (components, hooks) の両方から参照されます。
 *
 * @module types/prisma-extensions
 */

import type { Exam, Prisma, QuestionScore } from "@prisma/client"

import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"

import type { ExamStudentStatus } from "./examStudentStatus.types"
import type { ScoringStatus } from "./scoringStatus.types"

/**
 * `serializePrisma` を通した後の形を型に反映する。
 *
 * 変換は Decimal → number の1つだけで、これはシリアライザの実装
 * （serializePrisma.ts）と1対1に対応する。行をそのまま IPC へ渡す経路が増えると、
 * 「型は Decimal / 実体は number」という乖離が Pick や手書きの再宣言で散らばるため、
 * 変換の型もここに1つだけ置く。
 *
 * `Date` は変換しない。structured clone がそのまま渡すので、IPC を越えても `Date` の
 * ままである（以前は旧 `JSON.stringify` 挙動を踏襲して string へ倒していた）。
 *
 * バイナリ（`ArrayBuffer` / `Uint8Array` / `Buffer` 等）も変換しない。これを下の
 * マップ型へ落とすと添字ごとのプロパティに展開されてしまうため、明示的に素通しする。
 */
export type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? Date
    : T extends ArrayBuffer | ArrayBufferView
      ? T
      : T extends Array<infer Element>
        ? Serialized<Element>[]
        : T extends object
          ? { [Key in keyof T]: Serialized<T[Key]> }
          : T

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
 * 生徒識別・学級所属は `examStudent.student(.memberships.classroom)`、答案は
 * `examStudent.studentAnswerImages` として Prisma スキーマに完全追随する
 * （答案は ExamStudent の子なので、試験での絞り込みは不要。枚数は renderer が `.length`）。
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
        }
      }
      studentAnswerImages: true
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

// =============================================================================
// Exam関連型
// =============================================================================

/** 試験スカラー + examPages（masterImages 含む）。採点画面が1クエリで取得する形。 */
export type ExamWithPages = Exam & { examPages: ExamPageWithContent[] }

/** 試験の作成引数（renderer のフォームが組み立てる形） */
export interface CreateExamArgs {
  examName: string
  description?: string | null
  examDate?: Date | null
}

export type StudentAnswerImageWithExamPageAndStudent =
  Prisma.StudentAnswerImageGetPayload<{
    include: {
      examPage: true
      examStudent: {
        include: {
          student: true
        }
      }
    }
  }>

/**
 * 保存済み答案（配置済み）を Prisma include のまま持つ実体型（06 entity-first）。
 * 列＝ExamPage 実体から供給されるため、答案は自身の examPage を再同梱しない
 * （examPageId で列に照合し、pageNumber は列の ExamPage から表示時に導出する）。
 * 氏名表示のため受験者（と生徒）は同梱する。
 */
export type PlacedAnswerImage = Prisma.StudentAnswerImageGetPayload<{
  include: { examStudent: { include: { student: true } } }
}>

/**
 * 06 データセットの列となる ExamPage 実体（配置済み答案を子に持つ）。
 */
export type StudentAnswerDatasetExamPage = Prisma.ExamPageGetPayload<{
  include: {
    studentAnswerImages: {
      include: { examStudent: { include: { student: true } } }
    }
  }
}>

/**
 * 06 データセットの行となる ExamStudent 実体。
 *
 * 答案は列側（`StudentAnswerDatasetExamPage.studentAnswerImages`）が持つ。
 * StudentAnswerImage は ExamStudent と ExamPage の両方の子なので、行にも同梱すると
 * 同じ集合が1つの応答に二重に載る。行はこの画面では答案を読まない。
 */
export type StudentAnswerDatasetExamStudent = Omit<
  Prisma.ExamStudentGetPayload<{
    include: {
      student: {
        include: { memberships: { include: { classroom: true } } }
      }
    }
  }>,
  "status"
> & { status: ExamStudentStatus }

/**
 * 06 生徒答案ページ専用の複合データセット（Exam 根の 1 include）。
 * 行＝examStudents（実体）／列＝examPages（実体）。
 * IPC 返り値の SSOT。status は ExamStudentWithMemberships と同様に narrowing する。
 */
export interface StudentAnswersDataset {
  examStudents: StudentAnswerDatasetExamStudent[]
  examPages: StudentAnswerDatasetExamPage[]
}

// =============================================================================
// UserExam/ExamSubtotalGroup関連型
// =============================================================================

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

/**
 * 試験の出力設定一式（重ね描きのスタイル・可視性・個人成績表の設定/節/グラフ）。
 * 5テーブルすべてが Exam にぶら下がるので1クエリで引く。
 * 型（GetPayload）と実クエリの双方がこの const を参照する。
 */
export const examWithExportSettingsInclude = {
  answerOverlayStyles: true,
  answerOverlayVisibilities: true,
  individualReportSettings: true,
  individualReportTableSections: true,
  individualReportGraphSettings: true,
  individualReportStatisticVisibilities: true,
} satisfies Prisma.ExamInclude
