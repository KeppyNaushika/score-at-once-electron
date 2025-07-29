import { ipcMain } from "electron"
import { Prisma } from "@prisma/client"
import {
  createCropRegion as dbCreateCropRegion,
  updateCropRegion as dbUpdateCropRegion,
  deleteCropRegion as dbDeleteCropRegion,
  getCropRegionsByProjectId as dbGetCropRegionsByProjectId,
  getCropRegionById as dbGetCropRegionById,
  createManyCropRegions as dbCreateManyCropRegions,
  updateCropRegionOrders as dbUpdateCropRegionOrders,
} from "../lib/prisma/cropRegion"
import {
  createSubtotalGroup as dbCreateSubtotalGroup,
  updateSubtotalGroup as dbUpdateSubtotalGroup,
  deleteSubtotalGroup as dbDeleteSubtotalGroup,
  getSubtotalGroupsByProjectId as dbGetSubtotalGroupsByProjectId,
  getSubtotalGroupById as dbGetSubtotalGroupById,
} from "../lib/prisma/subtotalGroup"
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
    },
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
    },
  )

  ipcMain.handle(
    "update-crop-region",
    async (_event, id: string, data: Prisma.CropRegionUpdateInput) => {
      try {
        console.log("🔄 IPC: update-crop-region called with id:", id, "data:", data)
        const result = await dbUpdateCropRegion(id, data)
        console.log("✅ IPC: update-crop-region result:", result)
        return result
      } catch (error) {
        console.error("❌ IPC: update-crop-region error:", error)
        throw error
      }
    },
  )

  ipcMain.handle(
    "update-crop-region-orders",
    async (_event, updates: Array<{ id: string; orderIndex: number }>) => {
      try {
        console.log("🔄 IPC: update-crop-region-orders called with updates:", updates)
        const result = await dbUpdateCropRegionOrders(updates)
        console.log("✅ IPC: update-crop-region-orders result:", result)
        return result
      } catch (error) {
        console.error("❌ IPC: update-crop-region-orders error:", error)
        throw error
      }
    },
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

  ipcMain.handle("get-crop-regions-by-project-id", async (_event, projectId: string) => {
    try {
      console.log("🔄 IPC: get-crop-regions-by-project-id called with projectId:", projectId)
      const result = await dbGetCropRegionsByProjectId(projectId)
      console.log("✅ IPC: get-crop-regions-by-project-id result:", result?.length, "regions")
      return result
    } catch (error) {
      console.error("❌ IPC: get-crop-regions-by-project-id error:", error)
      throw error
    }
  })

  ipcMain.handle("get-crop-region-by-id", async (_event, id: string) => {
    try {
      console.log("🔄 IPC: get-crop-region-by-id called with id:", id)
      const result = await dbGetCropRegionById(id)
      console.log("✅ IPC: get-crop-region-by-id result:", result)
      return result
    } catch (error) {
      console.error("❌ IPC: get-crop-region-by-id error:", error)
      throw error
    }
  })

  // --- SubtotalGroup Handlers ---
  ipcMain.handle(
    "create-subtotal-group",
    async (_event, data: Prisma.SubtotalGroupUncheckedCreateInput) => {
      try {
        console.log("🔄 IPC: create-subtotal-group called with data:", data)
        const result = await dbCreateSubtotalGroup(data)
        console.log("✅ IPC: create-subtotal-group result:", result)
        return result
      } catch (error) {
        console.error("❌ IPC: create-subtotal-group error:", error)
        throw error
      }
    },
  )

  ipcMain.handle(
    "update-subtotal-group",
    async (_event, id: string, data: Prisma.SubtotalGroupUpdateInput) => {
      try {
        console.log("🔄 IPC: update-subtotal-group called with id:", id, "data:", data)
        const result = await dbUpdateSubtotalGroup(id, data)
        console.log("✅ IPC: update-subtotal-group result:", result)
        return result
      } catch (error) {
        console.error("❌ IPC: update-subtotal-group error:", error)
        throw error
      }
    },
  )

  ipcMain.handle("delete-subtotal-group", async (_event, id: string) => {
    try {
      console.log("🔄 IPC: delete-subtotal-group called with id:", id)
      const result = await dbDeleteSubtotalGroup(id)
      console.log("✅ IPC: delete-subtotal-group result:", result)
      return result
    } catch (error) {
      console.error("❌ IPC: delete-subtotal-group error:", error)
      throw error
    }
  })

  ipcMain.handle("get-subtotal-groups-by-project-id", async (_event, projectId: string) => {
    try {
      console.log("🔄 IPC: get-subtotal-groups-by-project-id called with projectId:", projectId)
      const result = await dbGetSubtotalGroupsByProjectId(projectId)
      console.log("✅ IPC: get-subtotal-groups-by-project-id result:", result?.length, "groups")
      return result
    } catch (error) {
      console.error("❌ IPC: get-subtotal-groups-by-project-id error:", error)
      throw error
    }
  })

  ipcMain.handle("get-subtotal-group-by-id", async (_event, id: string) => {
    try {
      console.log("🔄 IPC: get-subtotal-group-by-id called with id:", id)
      const result = await dbGetSubtotalGroupById(id)
      console.log("✅ IPC: get-subtotal-group-by-id result:", result)
      return result
    } catch (error) {
      console.error("❌ IPC: get-subtotal-group-by-id error:", error)
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
    },
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
    },
  )

  ipcMain.handle(
    "update-subtotal",
    async (_event, id: string, data: Prisma.SubtotalUpdateInput) => {
      try {
        console.log("🔄 IPC: update-subtotal called with id:", id, "data:", data)
        const result = await dbUpdateSubtotal(id, data)
        console.log("✅ IPC: update-subtotal result:", result)
        return result
      } catch (error) {
        console.error("❌ IPC: update-subtotal error:", error)
        throw error
      }
    },
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

  ipcMain.handle("get-subtotals-by-group-id", async (_event, subtotalGroupId: string) => {
    try {
      console.log("🔄 IPC: get-subtotals-by-group-id called with subtotalGroupId:", subtotalGroupId)
      const result = await dbGetSubtotalsByGroupId(subtotalGroupId)
      console.log("✅ IPC: get-subtotals-by-group-id result:", result?.length, "subtotals")
      return result
    } catch (error) {
      console.error("❌ IPC: get-subtotals-by-group-id error:", error)
      throw error
    }
  })

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
    },
  )

  ipcMain.handle(
    "create-many-crop-subtotals",
    async (_event, data: Prisma.CropSubtotalUncheckedCreateInput[]) => {
      try {
        console.log("🔄 IPC: create-many-crop-subtotals called with data:", data)
        const result = await dbCreateManyCropSubtotals(data)
        console.log("✅ IPC: create-many-crop-subtotals result:", result)
        return result
      } catch (error) {
        console.error("❌ IPC: create-many-crop-subtotals error:", error)
        throw error
      }
    },
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

  ipcMain.handle("get-crop-subtotals-by-crop-region-id", async (_event, cropRegionId: string) => {
    try {
      console.log("🔄 IPC: get-crop-subtotals-by-crop-region-id called with cropRegionId:", cropRegionId)
      const result = await dbGetCropSubtotalsByCropRegionId(cropRegionId)
      console.log("✅ IPC: get-crop-subtotals-by-crop-region-id result:", result?.length, "subtotals")
      return result
    } catch (error) {
      console.error("❌ IPC: get-crop-subtotals-by-crop-region-id error:", error)
      throw error
    }
  })

  ipcMain.handle("get-crop-subtotals-by-subtotal-id", async (_event, subtotalId: string) => {
    try {
      console.log("🔄 IPC: get-crop-subtotals-by-subtotal-id called with subtotalId:", subtotalId)
      const result = await dbGetCropSubtotalsBySubtotalId(subtotalId)
      console.log("✅ IPC: get-crop-subtotals-by-subtotal-id result:", result?.length, "assignments")
      return result
    } catch (error) {
      console.error("❌ IPC: get-crop-subtotals-by-subtotal-id error:", error)
      throw error
    }
  })

  // 互換性のためのエイリアス
  ipcMain.handle("get-subtotal-definitions-by-crop-region-id", async (_event, cropRegionId: string) => {
    try {
      console.log("🔄 IPC: get-subtotal-definitions-by-crop-region-id called with cropRegionId:", cropRegionId)
      const result = await dbGetSubtotalDefsByCropRegionId(cropRegionId)
      console.log("✅ IPC: get-subtotal-definitions-by-crop-region-id result:", result?.length, "definitions")
      return result
    } catch (error) {
      console.error("❌ IPC: get-subtotal-definitions-by-crop-region-id error:", error)
      throw error
    }
  })
}