import { ipcMain } from "electron"
import { Prisma } from "@prisma/client"
import {
  createCropRegion as dbCreateCropRegion,
  updateCropRegion as dbUpdateCropRegion,
  deleteCropRegion as dbDeleteCropRegion,
  getCropRegionsByProjectId as dbGetCropRegionsByProjectId,
  getQuestionAnswerRegionsByProjectId as dbGetQuestionAnswerRegionsByProjectId,
  getCropRegionById as dbGetCropRegionById,
  createManyCropRegions as dbCreateManyCropRegions,
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
  scoredByUserId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: score.id,
    cropRegionId: score.cropRegionId,
    studentId: score.studentId,
    partialScore: score.partialScore ? score.partialScore.toNumber() : null,
    status: score.status,
    scoredByUserId: score.scoredByUserId,
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
      scoredByUserId: string | null
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
  createSubtotal as dbCreateSubtotal,
  updateSubtotal as dbUpdateSubtotal,
  deleteSubtotal as dbDeleteSubtotal,
  getSubtotalsByGroupId as dbGetSubtotalsByGroupId,
  getSubtotalById as dbGetSubtotalById,
  createManySubtotals as dbCreateManySubtotals,
} from "../lib/prisma/subtotal"
import {
  createCropSubtotal as dbCreateCropSubtotal,
  deleteCropSubtotal as dbDeleteCropSubtotal,
  getSubtotalDefinitionsByCropRegionId as dbGetSubtotalDefsByCropRegionId,
  getCropSubtotalsBySubtotalId as dbGetCropSubtotalsBySubtotalId,
  createManyCropSubtotals as dbCreateManyCropSubtotals,
  getCropSubtotalsByCropRegionId as dbGetCropSubtotalsByCropRegionId,
  deleteCropSubtotalsByCropRegionId as dbDeleteCropSubtotalsByCropRegionId,
} from "../lib/prisma/cropSubtotal"

export function setupCropRegionHandlers(): void {
  // --- CropRegion Handlers ---
  ipcMain.handle(
    "create-crop-region",
    async (_event, data: Prisma.CropRegionUncheckedCreateInput) => {
      try {
        console.log("🔄 IPC: create-crop-region called with data:", data)
        const result = await dbCreateCropRegion(data)
        console.log("✅ IPC: create-crop-region result:", result)
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
        console.log("🔄 IPC: create-many-crop-regions called with data:", data)
        const result = await dbCreateManyCropRegions(data)
        console.log("✅ IPC: create-many-crop-regions result:", result)
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
        console.log(
          "🔄 IPC: update-crop-region called with id:",
          id,
          "data:",
          data
        )
        const result = await dbUpdateCropRegion(id, data)
        console.log("✅ IPC: update-crop-region result:", result)
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
        console.log(
          "🔄 IPC: update-crop-region-orders called with updates:",
          updates
        )
        const result = await dbUpdateCropRegionOrders(updates)
        console.log("✅ IPC: update-crop-region-orders result:", result)
        return result
      } catch (error) {
        console.error("❌ IPC: update-crop-region-orders error:", error)
        throw error
      }
    }
  )

  ipcMain.handle("delete-crop-region", async (_event, id: string) => {
    try {
      console.log("🔄 IPC: delete-crop-region called with id:", id)
      const result = await dbDeleteCropRegion(id)
      console.log("✅ IPC: delete-crop-region result:", result)
      return result
    } catch (error) {
      console.error("❌ IPC: delete-crop-region error:", error)
      throw error
    }
  })

  ipcMain.handle(
    "get-crop-regions-by-project-id",
    async (_event, projectId: string) => {
      try {
        console.log(
          "🔄 IPC: get-crop-regions-by-project-id called with projectId:",
          projectId
        )
        const result = await dbGetCropRegionsByProjectId(projectId)
        console.log(
          "✅ IPC: get-crop-regions-by-project-id result:",
          result?.length,
          "regions"
        )

        // questionScoresのDecimalをnumberに変換
        return result?.map(serializeCropRegion) || []
      } catch (error) {
        console.error("❌ IPC: get-crop-regions-by-project-id error:", error)
        throw error
      }
    }
  )

  ipcMain.handle(
    "get-question-answer-regions-by-project-id",
    async (_event, projectId: string) => {
      try {
        console.log(
          "🔄 IPC: get-question-answer-regions-by-project-id called with projectId:",
          projectId
        )
        const result = await dbGetQuestionAnswerRegionsByProjectId(projectId)
        console.log(
          "✅ IPC: get-question-answer-regions-by-project-id result:",
          result?.length,
          "regions"
        )

        // questionScoresのDecimalをnumberに変換
        return result?.map(serializeCropRegion) || []
      } catch (error) {
        console.error(
          "❌ IPC: get-question-answer-regions-by-project-id error:",
          error
        )
        throw error
      }
    }
  )

  ipcMain.handle("get-crop-region-by-id", async (_event, id: string) => {
    try {
      console.log("🔄 IPC: get-crop-region-by-id called with id:", id)
      const result = await dbGetCropRegionById(id)
      console.log("✅ IPC: get-crop-region-by-id result:", result)

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
        console.log("🔄 IPC: create-subtotal called with data:", data)
        const result = await dbCreateSubtotal(data)
        console.log("✅ IPC: create-subtotal result:", result)
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
        console.log("🔄 IPC: create-many-subtotals called with data:", data)
        const result = await dbCreateManySubtotals(data)
        console.log("✅ IPC: create-many-subtotals result:", result)
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
        console.log(
          "🔄 IPC: update-subtotal called with id:",
          id,
          "data:",
          data
        )
        const result = await dbUpdateSubtotal(id, data)
        console.log("✅ IPC: update-subtotal result:", result)
        return result
      } catch (error) {
        console.error("❌ IPC: update-subtotal error:", error)
        throw error
      }
    }
  )

  ipcMain.handle("delete-subtotal", async (_event, id: string) => {
    try {
      console.log("🔄 IPC: delete-subtotal called with id:", id)
      const result = await dbDeleteSubtotal(id)
      console.log("✅ IPC: delete-subtotal result:", result)
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
        console.log(
          "🔄 IPC: get-subtotals-by-group-id called with subtotalGroupId:",
          subtotalGroupId
        )
        const result = await dbGetSubtotalsByGroupId(subtotalGroupId)
        console.log(
          "✅ IPC: get-subtotals-by-group-id result:",
          result?.length,
          "subtotals"
        )
        return result
      } catch (error) {
        console.error("❌ IPC: get-subtotals-by-group-id error:", error)
        throw error
      }
    }
  )

  ipcMain.handle("get-subtotal-by-id", async (_event, id: string) => {
    try {
      console.log("🔄 IPC: get-subtotal-by-id called with id:", id)
      const result = await dbGetSubtotalById(id)
      console.log("✅ IPC: get-subtotal-by-id result:", result)
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
        console.log("🔄 IPC: create-crop-subtotal called with data:", data)
        const result = await dbCreateCropSubtotal(data)
        console.log("✅ IPC: create-crop-subtotal result:", result)
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
        console.log(
          "🔄 IPC: create-many-crop-subtotals called with data:",
          data
        )
        const result = await dbCreateManyCropSubtotals(data)
        console.log("✅ IPC: create-many-crop-subtotals result:", result)
        return result
      } catch (error) {
        console.error("❌ IPC: create-many-crop-subtotals error:", error)
        throw error
      }
    }
  )

  ipcMain.handle("delete-crop-subtotal", async (_event, id: string) => {
    try {
      console.log("🔄 IPC: delete-crop-subtotal called with id:", id)
      const result = await dbDeleteCropSubtotal(id)
      console.log("✅ IPC: delete-crop-subtotal result:", result)
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
        console.log(
          "🔄 IPC: delete-crop-subtotals-by-crop-region-id called with cropRegionId:",
          cropRegionId
        )
        const result = await dbDeleteCropSubtotalsByCropRegionId(cropRegionId)
        console.log(
          "✅ IPC: delete-crop-subtotals-by-crop-region-id result:",
          result
        )
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
        console.log(
          "🔄 IPC: get-crop-subtotals-by-crop-region-id called with cropRegionId:",
          cropRegionId
        )
        const result = await dbGetCropSubtotalsByCropRegionId(cropRegionId)
        console.log(
          "✅ IPC: get-crop-subtotals-by-crop-region-id result:",
          result?.length,
          "subtotals"
        )
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
        console.log(
          "🔄 IPC: get-assignments-by-question-crop-region-id called with cropRegionId:",
          cropRegionId
        )
        const assignments = await dbGetCropSubtotalsByCropRegionId(cropRegionId)
        console.log(
          "✅ IPC: get-assignments-by-question-crop-region-id result:",
          assignments?.length,
          "assignments"
        )

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
        console.log(
          "🔄 IPC: get-crop-subtotals-by-subtotal-id called with subtotalId:",
          subtotalId
        )
        const result = await dbGetCropSubtotalsBySubtotalId(subtotalId)
        console.log(
          "✅ IPC: get-crop-subtotals-by-subtotal-id result:",
          result?.length,
          "assignments"
        )
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
        console.log(
          "🔄 IPC: get-subtotal-definitions-by-crop-region-id called with cropRegionId:",
          cropRegionId
        )
        const result = await dbGetSubtotalDefsByCropRegionId(cropRegionId)
        console.log(
          "✅ IPC: get-subtotal-definitions-by-crop-region-id result:",
          result?.length,
          "definitions"
        )
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
