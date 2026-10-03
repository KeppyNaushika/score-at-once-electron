/**
 * 成績算出の値の調整（上書き・観点間の制約・除外・確定）の IPC ハンドラー
 */

import type {
  GradeCellTarget,
  GradeConstraintInput,
  GradeItemExclusionInput,
} from "../../src/types/grade.types"
import {
  createGradeConstraint,
  deleteGradeConstraint,
  getGradeConstraints,
  updateGradeConstraint,
} from "../lib/prisma/gradeConstraint"
import {
  freezeGradeScores,
  unfreezeGradeScores,
} from "../lib/prisma/gradeFrozenScore"
import {
  getGradeItemExclusions,
  setGradeItemExclusion,
} from "../lib/prisma/gradeItemExclusion"
import {
  deleteGradeOverride,
  upsertGradeOverride,
} from "../lib/prisma/gradeOverride"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 上書き・観点間の制約・除外・確定の IPC チャンネル */
export const gradeAdjustmentHandlers = {
  // =====================================================================
  // GradeOverride
  // =====================================================================

  "grade:upsertGradeOverride": async (
    override: GradeCellTarget & { overrideLabel: string }
  ) => {
    return upsertGradeOverride(override)
  },

  "grade:deleteGradeOverride": async (target: GradeCellTarget) => {
    return deleteGradeOverride(target)
  },

  // =====================================================================
  // GradeConstraint（観点間の制約ルール）
  // =====================================================================

  "grade:getGradeConstraints": async (gradeId: string) => {
    return getGradeConstraints(gradeId)
  },

  "grade:createGradeConstraint": async (constraintInput: {
    gradeId: string
    constraint: GradeConstraintInput
  }) => {
    return createGradeConstraint(constraintInput)
  },

  "grade:updateGradeConstraint": async (constraintChanges: {
    id: string
    constraint: Partial<GradeConstraintInput>
  }) => {
    return updateGradeConstraint(constraintChanges)
  },

  "grade:deleteGradeConstraint": async (id: string) => {
    return deleteGradeConstraint(id)
  },

  // =====================================================================
  // GradeItemExclusion
  // =====================================================================

  "grade:getGradeItemExclusions": async (gradeId: string) => {
    return getGradeItemExclusions(gradeId)
  },

  "grade:setGradeItemExclusion": async (input: GradeItemExclusionInput) => {
    return setGradeItemExclusion(input)
  },

  // =====================================================================
  // 成績値の確定（凍結）
  // =====================================================================

  // targets 未指定は Grade 全体の一括確定・一括解除。
  "grade:freezeGradeScores": async (freezeRequest: {
    gradeId: string
    targets?: GradeCellTarget[]
    frozenByUserId?: string | null
  }) => {
    return freezeGradeScores(freezeRequest)
  },

  "grade:unfreezeGradeScores": async (unfreezeRequest: {
    gradeId: string
    targets?: GradeCellTarget[]
    userId?: string | null
  }) => {
    return unfreezeGradeScores(unfreezeRequest)
  },
} satisfies HandlerMap
