/**
 * 試験外成績資料（Coursework）の共有型定義
 *
 * Coursework は Exam / SubtotalGroup と同階層のトップレベル実体。
 * 評価項目（CourseworkItem）単位で成績算出（GradeDataSource）から参照される。
 *
 * 型はすべて Prisma モデル（`@prisma/client`）から派生する（型規則: Prisma型を最優先）。
 * IPC 境界では electron-src/lib/prisma/coursework.ts の serialize() が
 * Decimal を number へ変換するため、Decimal フィールドのみ number へ上書きする。
 * 実施日（date）は grade.types.ts の referenceDate に揃えて string | null とする。
 */

import type { CourseworkLetterScale, Prisma } from "@prisma/client"

/** 評価項目の入力モード（"numeric" | "letter"） */
export type InputMode = "numeric" | "letter"

/**
 * 文字評価→点数の変換表エントリ（評価項目単位）。
 * IPC で Decimal(score) は number にシリアライズされる。
 */
export type CourseworkLetterScaleData = Omit<
  CourseworkLetterScale,
  "score" | "createdAt" | "updatedAt"
> & {
  score: number
}

/**
 * 資料の対象者×評価項目の点数（対象者・生徒情報付き）。
 *
 * 点数の主語は「その資料の対象者」（CourseworkStudent）であり、人（Student）ではない。
 * 名簿から外された生徒の点数は存在しえない（#962）。
 */
export type CourseworkScoreWithCourseworkStudent = Omit<
  Prisma.CourseworkScoreGetPayload<{
    include: {
      courseworkStudent: {
        include: {
          student: {
            select: {
              id: true
              studentNumber: true
              lastName: true
              firstName: true
            }
          }
        }
      }
    }
  }>,
  "score" | "adjustment" | "createdAt" | "updatedAt"
> & {
  score: number | null
  /** 加点・減点（期限超過等） */
  adjustment: number | null
}

/**
 * 点数のセル単位更新の入力（IPC 境界の唯一の定義）。
 *
 * renderer → preload → handler → DB 層の4層が同じ形を書いていたため、
 * 1層だけ直しても余剰プロパティ検査が効かず typecheck が通ってしまう
 * （実行時にだけ点数が保存されない）。定義はここ1箇所に集約する。
 */
export interface CourseworkScoreUpsertInput {
  courseworkItemId: string
  courseworkStudentId: string
  score?: number | null
  letterValue?: string | null
  adjustment?: number | null
  adjustmentReason?: string | null
  comment?: string | null
}

/** 評価項目（リレーション付き） */
export type CourseworkItemWithLetterScales = Omit<
  Prisma.CourseworkItemGetPayload<{ include: { letterScales: true } }>,
  "maxScore" | "inputMode" | "letterScales"
> & {
  maxScore: number
  inputMode: InputMode
  /** 文字評価→点数の変換表（letterモード時に使用） */
  letterScales: CourseworkLetterScaleData[]
}

/** 試験外成績資料（リレーション付き） */
export type CourseworkWithRelations = Omit<
  Prisma.CourseworkGetPayload<{
    include: {
      classrooms: { include: { classroom: true } }
      tags: { include: { tag: true } }
      items: { include: { letterScales: true } }
      students: true
    }
  }>,
  "date" | "items"
> & {
  date: string | null
  items: CourseworkItemWithLetterScales[]
}

/** 名簿1行（生徒・所属付き） */
export type CourseworkStudentWithMemberships =
  Prisma.CourseworkStudentGetPayload<{
    include: {
      student: {
        include: {
          memberships: {
            include: { classroom: true }
          }
        }
      }
    }
  }>

/**
 * 一覧表示用（フィルタ用に tags/classrooms、件数表示用に items/students を同梱）。
 *
 * `getCourseworks` は serializePrisma を通すので、Decimal は number・Date は文字列で届く。
 * 評価項目は CourseworkWithRelations と同じく置き換える（生の payload を埋めると
 * `maxScore` が Prisma.Decimal を名乗ったまま実体が number になる）。
 */
export type CourseworkSummary = Omit<
  Prisma.CourseworkGetPayload<{
    include: {
      items: true
      students: true
      tags: { include: { tag: true } }
      classrooms: { include: { classroom: true } }
    }
  }>,
  "date" | "items"
> & {
  date: string | null
  items: CourseworkItemWithLetterScales[]
}
