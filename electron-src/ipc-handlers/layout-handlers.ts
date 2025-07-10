import { ipcMain } from "electron"
import { Prisma } from "@prisma/client"
import {
  createLayoutRegion as dbCreateLayoutRegion,
  updateLayoutRegion as dbUpdateLayoutRegion,
  deleteLayoutRegion as dbDeleteLayoutRegion,
  getLayoutRegionsByProjectId as dbGetLayoutRegionsByProjectId,
  getLayoutRegionById as dbGetLayoutRegionById,
  createManyLayoutRegions as dbCreateManyLayoutRegions,
  updateLayoutRegionOrders as dbUpdateLayoutRegionOrders,
} from "@/lib/prisma/layoutRegion"
import {
  createQuestionGroup as dbCreateQuestionGroup,
  updateQuestionGroup as dbUpdateQuestionGroup,
  deleteQuestionGroup as dbDeleteQuestionGroup,
  getQuestionGroupsByProjectId as dbGetQuestionGroupsByProjectId,
  getQuestionGroupById as dbGetQuestionGroupById,
} from "@/lib/prisma/questionGroup"
import {
  createQuestionGroupItem as dbCreateQuestionGroupItem,
  updateQuestionGroupItem as dbUpdateQuestionGroupItem,
  deleteQuestionGroupItem as dbDeleteQuestionGroupItem,
  getQuestionGroupItemsByGroupId as dbGetQuestionGroupItemsByGroupId,
  getQuestionGroupItemById as dbGetQuestionGroupItemById,
  createManyQuestionGroupItems as dbCreateManyQuestionGroupItems,
} from "@/lib/prisma/questionGroupItem"
import {
  createSubtotalDefinition as dbCreateSubtotalDefinition,
  deleteSubtotalDefinition as dbDeleteSubtotalDefinition,
  getSubtotalDefinitionsByLayoutRegionId as dbGetSubtotalDefsByLayoutRegionId,
  getSubtotalDefinitionsByQuestionGroupItemId as dbGetSubtotalDefsByQGItemId,
  createManySubtotalDefinitions as dbCreateManySubtotalDefinitions,
  deleteSubtotalDefinitionsByLayoutRegionId as dbDeleteSubDefsByLayoutRegionId,
} from "@/lib/prisma/subtotalDefinition"
import {
  createQuestionSubtotalAssignment as dbCreateQuestionSubtotalAssignment,
  deleteQuestionSubtotalAssignment as dbDeleteQuestionSubtotalAssignment,
  getAssignmentsByQuestionLayoutRegionId as dbGetAssignsByQuestionLayoutRegionId,
  getAssignmentsByQuestionGroupItemId as dbGetAssignsByQGItemId,
  createManyQuestionSubtotalAssignments as dbCreateManyQuestionSubtotalAssignments,
  deleteAssignmentsByQuestionLayoutRegionId as dbDeleteAssignsByQuestionLayoutRegionId,
  deleteAssignmentsByQuestionGroupItemId as dbDeleteAssignsByQGItemId,
} from "@/lib/prisma/questionSubtotalAssignment"

export function setupLayoutHandlers(): void {
  // --- LayoutRegion Handlers ---
  ipcMain.handle(
    "create-layout-region",
    async (_event, data: Prisma.LayoutRegionUncheckedCreateInput) => {
      try {
        return await dbCreateLayoutRegion(data)
      } catch (err) {
        console.error("Error creating layout region:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-layout-region",
    async (_event, id: string, data: Prisma.LayoutRegionUpdateInput) => {
      try {
        return await dbUpdateLayoutRegion(id, data)
      } catch (err) {
        console.error("Error updating layout region:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-layout-region", async (_event, id: string) => {
    try {
      return await dbDeleteLayoutRegion(id)
    } catch (err) {
      console.error("Error deleting layout region:", err)
      throw err
    }
  })

  ipcMain.handle(
    "get-layout-regions-by-project-id",
    async (_event, projectId: string) => {
      try {
        const layoutRegions = await dbGetLayoutRegionsByProjectId(projectId)
        return layoutRegions.map((region) => ({
          ...region,
          createdAt: region.createdAt.toISOString(),
          updatedAt: region.updatedAt.toISOString(),
          subtotalDefinitions:
            region.subtotalDefinitions?.map((def) => ({
              ...def,
              createdAt: def.createdAt.toISOString(),
              updatedAt: def.updatedAt.toISOString(),
              questionGroupItem: def.questionGroupItem
                ? {
                    ...def.questionGroupItem,
                    createdAt: def.questionGroupItem.createdAt.toISOString(),
                    updatedAt: def.questionGroupItem.updatedAt.toISOString(),
                  }
                : null,
            })) || [],
          questionSubtotalAssignments:
            region.questionSubtotalAssignments?.map((assignment) => ({
              ...assignment,
              createdAt: assignment.createdAt.toISOString(),
              updatedAt: assignment.updatedAt.toISOString(),
              questionGroupItem: assignment.questionGroupItem
                ? {
                    ...assignment.questionGroupItem,
                    createdAt:
                      assignment.questionGroupItem.createdAt.toISOString(),
                    updatedAt:
                      assignment.questionGroupItem.updatedAt.toISOString(),
                  }
                : null,
            })) || [],
          questionScores:
            region.questionScores?.map((score) => ({
              ...score,
              partialScore: score.partialScore
                ? score.partialScore.toString()
                : null,
              createdAt: score.createdAt.toISOString(),
              updatedAt: score.updatedAt.toISOString(),
            })) || [],
        }))
      } catch (err) {
        console.error("Error fetching layout regions by project ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle("get-layout-region-by-id", async (_event, id: string) => {
    try {
      const region = await dbGetLayoutRegionById(id)
      if (!region) return null
      return {
        ...region,
        createdAt: region.createdAt.toISOString(),
        updatedAt: region.updatedAt.toISOString(),
        subtotalDefinitions:
          region.subtotalDefinitions?.map((def) => ({
            ...def,
            createdAt: def.createdAt.toISOString(),
            updatedAt: def.updatedAt.toISOString(),
            questionGroupItem: def.questionGroupItem
              ? {
                  ...def.questionGroupItem,
                  createdAt: def.questionGroupItem.createdAt.toISOString(),
                  updatedAt: def.questionGroupItem.updatedAt.toISOString(),
                }
              : null,
          })) || [],
        questionSubtotalAssignments:
          region.questionSubtotalAssignments?.map((assignment) => ({
            ...assignment,
            createdAt: assignment.createdAt.toISOString(),
            updatedAt: assignment.updatedAt.toISOString(),
            questionGroupItem: assignment.questionGroupItem
              ? {
                  ...assignment.questionGroupItem,
                  createdAt:
                    assignment.questionGroupItem.createdAt.toISOString(),
                  updatedAt:
                    assignment.questionGroupItem.updatedAt.toISOString(),
                }
              : null,
          })) || [],
        questionScores:
          region.questionScores?.map((score) => ({
            ...score,
            partialScore: score.partialScore
              ? score.partialScore.toString()
              : null,
            createdAt: score.createdAt.toISOString(),
            updatedAt: score.updatedAt.toISOString(),
          })) || [],
      }
    } catch (err) {
      console.error("Error fetching layout region by ID:", err)
      throw err
    }
  })

  ipcMain.handle(
    "create-many-layout-regions",
    async (_event, data: Prisma.LayoutRegionCreateManyInput[]) => {
      try {
        return await dbCreateManyLayoutRegions(data)
      } catch (err) {
        console.error("Error creating many layout regions:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-layout-region-orders",
    async (_event, updates: Array<{ id: string; orderIndex: number }>) => {
      try {
        return await dbUpdateLayoutRegionOrders(updates)
      } catch (err) {
        console.error("Error updating layout region orders:", err)
        throw err
      }
    },
  )

  // --- QuestionGroup Handlers ---
  ipcMain.handle(
    "create-question-group",
    async (_event, data: Prisma.QuestionGroupUncheckedCreateInput) => {
      try {
        return await dbCreateQuestionGroup(data)
      } catch (err) {
        console.error("Error creating question group:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-question-group",
    async (_event, id: string, data: Prisma.QuestionGroupUpdateInput) => {
      try {
        return await dbUpdateQuestionGroup(id, data)
      } catch (err) {
        console.error("Error updating question group:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-question-group", async (_event, id: string) => {
    try {
      return await dbDeleteQuestionGroup(id)
    } catch (err) {
      console.error("Error deleting question group:", err)
      throw err
    }
  })

  ipcMain.handle(
    "get-question-groups-by-project-id",
    async (_event, projectId: string) => {
      try {
        return await dbGetQuestionGroupsByProjectId(projectId)
      } catch (err) {
        console.error("Error fetching question groups by project ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle("get-question-group-by-id", async (_event, id: string) => {
    try {
      return await dbGetQuestionGroupById(id)
    } catch (err) {
      console.error("Error fetching question group by ID:", err)
      throw err
    }
  })

  // --- QuestionGroupItem Handlers ---
  ipcMain.handle(
    "create-question-group-item",
    async (_event, data: Prisma.QuestionGroupItemUncheckedCreateInput) => {
      try {
        return await dbCreateQuestionGroupItem(data)
      } catch (err) {
        console.error("Error creating question group item:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-question-group-item",
    async (_event, id: string, data: Prisma.QuestionGroupItemUpdateInput) => {
      try {
        return await dbUpdateQuestionGroupItem(id, data)
      } catch (err) {
        console.error("Error updating question group item:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-question-group-item", async (_event, id: string) => {
    try {
      return await dbDeleteQuestionGroupItem(id)
    } catch (err) {
      console.error("Error deleting question group item:", err)
      throw err
    }
  })

  ipcMain.handle(
    "get-question-group-items-by-group-id",
    async (_event, questionGroupId: string) => {
      try {
        return await dbGetQuestionGroupItemsByGroupId(questionGroupId)
      } catch (err) {
        console.error("Error fetching question group items by group ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-question-group-item-by-id",
    async (_event, id: string) => {
      try {
        return await dbGetQuestionGroupItemById(id)
      } catch (err) {
        console.error("Error fetching question group item by ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "create-many-question-group-items",
    async (_event, items: Prisma.QuestionGroupItemUncheckedCreateInput[]) => {
      try {
        return await dbCreateManyQuestionGroupItems(items)
      } catch (err) {
        console.error("Error creating many question group items:", err)
        throw err
      }
    },
  )

  // --- SubtotalDefinition Handlers ---
  ipcMain.handle(
    "create-subtotal-definition",
    async (_event, data: Prisma.SubtotalDefinitionUncheckedCreateInput) => {
      try {
        return await dbCreateSubtotalDefinition(data)
      } catch (err) {
        console.error("Error creating subtotal definition:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "create-many-subtotal-definitions",
    async (
      _event,
      definitions: Prisma.SubtotalDefinitionUncheckedCreateInput[],
    ) => {
      try {
        return await dbCreateManySubtotalDefinitions(definitions)
      } catch (err) {
        console.error("Error creating many subtotal definitions:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-subtotal-definition", async (_event, id: string) => {
    try {
      return await dbDeleteSubtotalDefinition(id)
    } catch (err) {
      console.error("Error deleting subtotal definition:", err)
      throw err
    }
  })

  ipcMain.handle(
    "delete-subtotal-definitions-by-layout-region-id",
    async (_event, layoutRegionId: string) => {
      try {
        return await dbDeleteSubDefsByLayoutRegionId(layoutRegionId)
      } catch (err) {
        console.error(
          "Error deleting subtotal definitions by layout region ID:",
          err,
        )
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-subtotal-definitions-by-layout-region-id",
    async (_event, layoutRegionId: string) => {
      try {
        return await dbGetSubtotalDefsByLayoutRegionId(layoutRegionId)
      } catch (err) {
        console.error(
          "Error fetching subtotal definitions by layout region ID:",
          err,
        )
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-subtotal-definitions-by-question-group-item-id",
    async (_event, questionGroupItemId: string) => {
      try {
        return await dbGetSubtotalDefsByQGItemId(questionGroupItemId)
      } catch (err) {
        console.error(
          "Error fetching subtotal definitions by question group item ID:",
          err,
        )
        throw err
      }
    },
  )

  // --- QuestionSubtotalAssignment Handlers ---
  ipcMain.handle(
    "create-question-subtotal-assignment",
    async (
      _event,
      data: Prisma.QuestionSubtotalAssignmentUncheckedCreateInput,
    ) => {
      try {
        return await dbCreateQuestionSubtotalAssignment(data)
      } catch (err) {
        console.error("Error creating question subtotal assignment:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "create-many-question-subtotal-assignments",
    async (
      _event,
      assignments: Prisma.QuestionSubtotalAssignmentUncheckedCreateInput[],
    ) => {
      try {
        return await dbCreateManyQuestionSubtotalAssignments(assignments)
      } catch (err) {
        console.error("Error creating many question subtotal assignments:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "delete-question-subtotal-assignment",
    async (_event, id: string) => {
      try {
        return await dbDeleteQuestionSubtotalAssignment(id)
      } catch (err) {
        console.error("Error deleting question subtotal assignment:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "delete-assignments-by-question-layout-region-id",
    async (_event, questionLayoutRegionId: string) => {
      try {
        return await dbDeleteAssignsByQuestionLayoutRegionId(
          questionLayoutRegionId,
        )
      } catch (err) {
        console.error(
          "Error deleting assignments by question layout region ID:",
          err,
        )
        throw err
      }
    },
  )

  ipcMain.handle(
    "delete-assignments-by-question-group-item-id",
    async (_event, questionGroupItemId: string) => {
      try {
        return await dbDeleteAssignsByQGItemId(questionGroupItemId)
      } catch (err) {
        console.error(
          "Error deleting assignments by question group item ID:",
          err,
        )
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-assignments-by-question-layout-region-id",
    async (_event, questionLayoutRegionId: string) => {
      try {
        return await dbGetAssignsByQuestionLayoutRegionId(
          questionLayoutRegionId,
        )
      } catch (err) {
        console.error(
          "Error fetching assignments by question layout region ID:",
          err,
        )
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-assignments-by-question-group-item-id",
    async (_event, questionGroupItemId: string) => {
      try {
        return await dbGetAssignsByQGItemId(questionGroupItemId)
      } catch (err) {
        console.error(
          "Error fetching assignments by question group item ID:",
          err,
        )
        throw err
      }
    },
  )
}
