/**
 * Prisma拡張型定義
 *
 * このファイルはPrisma.XxxGetPayloadを使用した拡張型を集約します。
 * main (electron-src) と renderer (components, hooks) の両方から参照されます。
 *
 * @module types/prisma-extensions
 */

import type { Prisma } from "@prisma/client"

// =============================================================================
// Student関連型
// =============================================================================

/**
 * 学級所属情報を含む学級型
 */
export type ClassWithMemberships = Prisma.ClassGetPayload<{
  include: {
    memberships: {
      include: {
        student: true
      }
      where: {
        endDate: null
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
        class: true
      }
      where: {
        endDate: null
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
      class: true
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
        projectStudents: {
          select: {
            customOrder: true
          }
        }
      }
    }
    projectPage: {
      include: {
        project: true
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
// Project関連型
// NOTE: IPCハンドラーが返す ProjectWithDetails は common.types.ts で定義
// =============================================================================

/**
 * 全リレーションを含むProject型（Prismaクエリ用）
 * IPCハンドラーが返す型は common.types.ts の ProjectWithDetails を使用
 */
export type ProjectPayloadWithAllRelations = Prisma.ProjectGetPayload<{
  include: {
    userProjects: { include: { user: true } }
    projectPages: {
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
    projectSubtotalGroups: {
      include: { subtotalGroup: { include: { subtotals: true } } }
    }
    projectStudents: { include: { student: true } }
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
    projectPage: { include: { project: true } }
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
    projectSubtotalGroups: { include: { project: true } }
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
    cropRegion: { include: { projectPage: true } }
    subtotal: { include: { subtotalGroup: true } }
  }
}>

// =============================================================================
// ProjectPage/MasterImage/StudentAnswerImage関連型
// =============================================================================

/**
 * 詳細情報を含むProjectPage型
 */
export type ProjectPageWithDetails = Prisma.ProjectPageGetPayload<{
  include: {
    project: true
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
    projectPage: { include: { project: true } }
  }
}>

/**
 * 詳細情報を含むStudentAnswerImage型
 */
export type StudentAnswerImageWithDetails =
  Prisma.StudentAnswerImageGetPayload<{
    include: {
      projectPage: { include: { project: true } }
      student: true
    }
  }>

/**
 * @deprecated Use MasterImageWithDetails or StudentAnswerImageWithDetails instead
 */
export type PageImageWithDetails = StudentAnswerImageWithDetails

// =============================================================================
// UserProject/ProjectSubtotalGroup関連型
// =============================================================================

/**
 * ユーザーとプロジェクトを含むUserProject型
 */
export type UserProjectWithDetails = Prisma.UserProjectGetPayload<{
  include: { user: true; project: true }
}>

/**
 * プロジェクトを含むUserProject型
 */
export type UserProjectWithProject = Prisma.UserProjectGetPayload<{
  include: { project: true }
}>

/**
 * ユーザーを含むUserProject型
 */
export type UserProjectWithUser = Prisma.UserProjectGetPayload<{
  include: { user: true }
}>

/**
 * SubtotalGroupを含むProjectSubtotalGroup型
 */
export type ProjectSubtotalGroupWithSubtotalGroup =
  Prisma.ProjectSubtotalGroupGetPayload<{
    include: { subtotalGroup: { include: { subtotals: true } } }
  }>

/**
 * Projectを含むProjectSubtotalGroup型
 */
export type ProjectSubtotalGroupWithProject =
  Prisma.ProjectSubtotalGroupGetPayload<{
    include: { project: true }
  }>

// =============================================================================
// 後方互換エイリアス
// =============================================================================

/** @deprecated Use ClassWithMemberships instead */
export type ClassWithStudents = ClassWithMemberships

/** @deprecated Use StudentWithMemberships instead */
export type StudentWithClass = StudentWithMemberships

/** @deprecated Use SubtotalGroupWithItems instead */
export type QuestionGroupWithItems = SubtotalGroupWithItems

/** @deprecated Use SubtotalWithDetails instead */
export type QuestionGroupItemWithDetails = SubtotalWithDetails

/** @deprecated Use CropSubtotalWithRelations instead */
export type SubtotalDefinitionWithRelations = CropSubtotalWithRelations

/** @deprecated Use CropSubtotalWithRelations instead */
export type QuestionSubtotalAssignmentWithRelations = CropSubtotalWithRelations

/** @deprecated Use ProjectPageWithDetails instead */
export type MasterAnswerPayload = ProjectPageWithDetails
