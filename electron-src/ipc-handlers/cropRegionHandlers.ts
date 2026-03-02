import { Prisma } from "@prisma/client"
import { ipcMain } from "electron"

import {
  createCropRegion as dbCreateCropRegion,
  createManyCropRegions as dbCreateManyCropRegions,
  deleteCropRegion as dbDeleteCropRegion,
  getCropRegionById as dbGetCropRegionById,
  getCropRegionsByExamId as dbGetCropRegionsByExamId,
  getQuestionAnswerRegionsByExamId as dbGetQuestionAnswerRegionsByExamId,
  updateCropRegion as dbUpdateCropRegion,
  updateCropRegionOrders as dbUpdateCropRegionOrders,
} from "../lib/prisma/cropRegion"

/**
 * QuestionScoreをIPC用にシリアライズ（DecimalをnumberにDateはそのまま）
 */
function serializeQuestionScore(score: {
  id: string
  cropRegionId: string
  studentId: string | null
  partialScore: { toNumber(): number } | null
  status: string
  userId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: score.id,
    cropRegionId: score.cropRegionId,
    studentId: score.studentId,
    partialScore: score.partialScore ? score.partialScore.toNumber() : null,
    status: score.status,
    userId: score.userId,
    createdAt: score.createdAt,
    updatedAt: score.updatedAt,
  }
}

/**
 * CropRegionをIPC用にシリアライズ（questionScoresのDecimalを変換）
 */
function serializeCropRegion<
  T extends {
    questionScores?: Array<{
      id: string
      cropRegionId: string
      studentId: string | null
      partialScore: { toNumber(): number } | null
      status: string
      userId: string | null
      createdAt: Date
      updatedAt: Date
    }>
  },
>(region: T) {
  return {
    ...region,
    questionScores: region.questionScores?.map(serializeQuestionScore) || [],
  }
}

import {
  createCropSubtotal as dbCreateCropSubtotal,
  createManyCropSubtotals as dbCreateManyCropSubtotals,
  deleteCropSubtotal as dbDeleteCropSubtotal,
  deleteCropSubtotalsByCropRegionId as dbDeleteCropSubtotalsByCropRegionId,
  getCropSubtotalsByCropRegionId as dbGetCropSubtotalsByCropRegionId,
  getCropSubtotalsBySubtotalId as dbGetCropSubtotalsBySubtotalId,
  getSubtotalDefinitionsByCropRegionId as dbGetSubtotalDefsByCropRegionId,
} from "../lib/prisma/cropSubtotal"
import {
  createManySubtotals as dbCreateManySubtotals,
  createSubtotal as dbCreateSubtotal,
  deleteSubtotal as dbDeleteSubtotal,
  getSubtotalById as dbGetSubtotalById,
  getSubtotalsByGroupId as dbGetSubtotalsByGroupId,
  updateSubtotal as dbUpdateSubtotal,
} from "../lib/prisma/subtotal"

export function setupCropRegionHandlers(): void {
  // --- CropRegion Handlers ---
  ipcMain.handle(
    "create-crop-region",
    async (_event, data: Prisma.CropRegionUncheckedCreateInput) => {
      try {
        const result = await dbCreateCropRegion(data)
        return result
      } catch (error) {
        console.error("❌ IPC: create-crop-region error:", error)
        throw error
      }
    }
  )

  ipcMain.handle(
    "create-many-crop-regions",
    async (_event, data: Prisma.CropRegionCreateManyInput[]) => {
      try {
        const result = await dbCreateManyCropRegions(data)
        return result
      } catch (error) {
        console.error("❌ IPC: create-many-crop-regions error:", error)
        throw error
      }
    }
  )

  ipcMain.handle(
    "update-crop-region",
    async (_event, id: string, data: Prisma.CropRegionUpdateInput) => {
      try {
        const result = await dbUpdateCropRegion(id, data)
        return result
      } catch (error) {
        console.error("❌ IPC: update-crop-region error:", error)
        throw error
      }
    }
  )

  ipcMain.handle(
    "update-crop-region-orders",
    async (_event, updates: Array<{ id: string; orderIndex: number }>) => {
      try {
        const result = await dbUpdateCropRegionOrders(updates)
        return result
      } catch (error) {
        console.error("❌ IPC: update-crop-region-orders error:", error)
        throw error
      }
    }
  )

  ipcMain.handle("delete-crop-region", async (_event, id: string) => {
    try {
      const result = await dbDeleteCropRegion(id)
      return result
    } catch (error) {
      console.error("❌ IPC: delete-crop-region error:", error)
      throw error
    }
  })

  ipcMain.handle(
    "get-crop-regions-by-exam-id",
    async (_event, examId: string) => {
      try {
        const result = await dbGetCropRegionsByExamId(examId)
        // questionScoresのDecimalをnumberに変換
        return result?.map(serializeCropRegion) || []
      } catch (error) {
        console.error("❌ IPC: get-crop-regions-by-exam-id error:", error)
        throw error
      }
    }
  )

  ipcMain.handle(
    "get-question-answer-regions-by-exam-id",
    async (_event, examId: string) => {
      try {
        const result = await dbGetQuestionAnswerRegionsByExamId(examId)
        // questionScoresのDecimalをnumberに変換
        return result?.map(serializeCropRegion) || []
      } catch (error) {
        console.error(
          "❌ IPC: get-question-answer-regions-by-exam-id error:",
          error
        )
        throw error
      }
    }
  )

  ipcMain.handle("get-crop-region-by-id", async (_event, id: string) => {
    try {
      const result = await dbGetCropRegionById(id)
      // questionScoresのDecimalをnumberに変換
      return result ? serializeCropRegion(result) : null
    } catch (error) {
      console.error("❌ IPC: get-crop-region-by-id error:", error)
      throw error
    }
  })

  // --- Subtotal Handlers ---
  ipcMain.handle(
    "create-subtotal",
    async (_event, data: Prisma.SubtotalUncheckedCreateInput) => {
      try {
        const result = await dbCreateSubtotal(data)
        return result
      } catch (error) {
        console.error("❌ IPC: create-subtotal error:", error)
        throw error
      }
    }
  )

  ipcMain.handle(
    "create-many-subtotals",
    async (_event, data: Prisma.SubtotalUncheckedCreateInput[]) => {
      try {
        const result = await dbCreateManySubtotals(data)
        return result
      } catch (error) {
        console.error("❌ IPC: create-many-subtotals error:", error)
        throw error
      }
    }
  )

  ipcMain.handle(
    "update-subtotal",
    async (_event, id: string, data: Prisma.SubtotalUpdateInput) => {
      try {
        const result = await dbUpdateSubtotal(id, data)
        return result
      } catch (error) {
        console.error("❌ IPC: update-subtotal error:", error)
        throw error
      }
    }
  )

  ipcMain.handle("delete-subtotal", async (_event, id: string) => {
    try {
      const result = await dbDeleteSubtotal(id)
      return result
    } catch (error) {
      console.error("❌ IPC: delete-subtotal error:", error)
      throw error
    }
  })

  ipcMain.handle(
    "get-subtotals-by-group-id",
    async (_event, subtotalGroupId: string) => {
      try {
        const result = await dbGetSubtotalsByGroupId(subtotalGroupId)
        return result
      } catch (error) {
        console.error("❌ IPC: get-subtotals-by-group-id error:", error)
        throw error
      }
    }
  )

  ipcMain.handle("get-subtotal-by-id", async (_event, id: string) => {
    try {
      const result = await dbGetSubtotalById(id)
      return result
    } catch (error) {
      console.error("❌ IPC: get-subtotal-by-id error:", error)
      throw error
    }
  })

  // --- CropSubtotal Handlers ---
  ipcMain.handle(
    "create-crop-subtotal",
    async (_event, data: Prisma.CropSubtotalUncheckedCreateInput) => {
      try {
        const result = await dbCreateCropSubtotal(data)
        return result
      } catch (error) {
        console.error("❌ IPC: create-crop-subtotal error:", error)
        throw error
      }
    }
  )

  ipcMain.handle(
    "create-many-crop-subtotals",
    async (_event, data: Prisma.CropSubtotalUncheckedCreateInput[]) => {
      try {
        const result = await dbCreateManyCropSubtotals(data)
        return result
      } catch (error) {
        console.error("❌ IPC: create-many-crop-subtotals error:", error)
        throw error
      }
    }
  )

  ipcMain.handle("delete-crop-subtotal", async (_event, id: string) => {
    try {
      const result = await dbDeleteCropSubtotal(id)
      return result
    } catch (error) {
      console.error("❌ IPC: delete-crop-subtotal error:", error)
      throw error
    }
  })

  ipcMain.handle(
    "delete-crop-subtotals-by-crop-region-id",
    async (_event, cropRegionId: string) => {
      try {
        const result = await dbDeleteCropSubtotalsByCropRegionId(cropRegionId)
        return result
      } catch (error) {
        console.error(
          "❌ IPC: delete-crop-subtotals-by-crop-region-id error:",
          error
        )
        throw error
      }
    }
  )

  ipcMain.handle(
    "get-crop-subtotals-by-crop-region-id",
    async (_event, cropRegionId: string) => {
      try {
        const result = await dbGetCropSubtotalsByCropRegionId(cropRegionId)
        return result
      } catch (error) {
        console.error(
          "❌ IPC: get-crop-subtotals-by-crop-region-id error:",
          error
        )
        throw error
      }
    }
  )

  // 互換性のあるレスポンス形式での取得（QuestionAssignmentMatrix専用）
  ipcMain.handle(
    "get-assignments-by-question-crop-region-id",
    async (_event, cropRegionId: string) => {
      try {
        const assignments = await dbGetCropSubtotalsByCropRegionId(cropRegionId)
        return {
          success: true,
          assignments: assignments || [],
        }
      } catch (error) {
        console.error(
          "❌ IPC: get-assignments-by-question-crop-region-id error:",
          error
        )
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          assignments: [],
        }
      }
    }
  )

  ipcMain.handle(
    "get-crop-subtotals-by-subtotal-id",
    async (_event, subtotalId: string) => {
      try {
        const result = await dbGetCropSubtotalsBySubtotalId(subtotalId)
        return result
      } catch (error) {
        console.error("❌ IPC: get-crop-subtotals-by-subtotal-id error:", error)
        throw error
      }
    }
  )

  // 互換性のためのエイリアス
  ipcMain.handle(
    "get-subtotal-definitions-by-crop-region-id",
    async (_event, cropRegionId: string) => {
      try {
        const result = await dbGetSubtotalDefsByCropRegionId(cropRegionId)
        return result
      } catch (error) {
        console.error(
          "❌ IPC: get-subtotal-definitions-by-crop-region-id error:",
          error
        )
        throw error
      }
    }
  )
}
