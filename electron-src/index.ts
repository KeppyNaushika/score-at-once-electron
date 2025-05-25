import { join } from "path"
import { format } from "url"

import { app, BrowserWindow, ipcMain, Menu, net, protocol } from "electron"
import isDev from "electron-is-dev"
import prepareNext from "electron-next"
import menu from "./menu"

import { Prisma } from "@prisma/client"
import path from "path"
import {
  createClass,
  deleteClass,
  fetchClasses,
  updateClass,
} from "./lib/prisma/class"
import {
  deleteMasterImage,
  uploadMasterImages,
  updateMasterImagesOrder,
} from "./lib/prisma/masterImage"

import {
  createProject as dbCreateProject,
  deleteProject as dbDeleteProject,
  getProjectById as dbFetchProjectById,
  getProjects as dbFetchProjects,
  updateProject as dbUpdateProject,
} from "./lib/prisma/project"

// New imports for subtotaling and layout regions
import {
  createLayoutRegion as dbCreateLayoutRegion,
  updateLayoutRegion as dbUpdateLayoutRegion,
  deleteLayoutRegion as dbDeleteLayoutRegion,
  getLayoutRegionsByProjectId as dbGetLayoutRegionsByProjectId,
  getLayoutRegionById as dbGetLayoutRegionById,
  createManyLayoutRegions as dbCreateManyLayoutRegions,
} from "./lib/prisma/layoutRegion"
import {
  createQuestionGroup as dbCreateQuestionGroup,
  updateQuestionGroup as dbUpdateQuestionGroup,
  deleteQuestionGroup as dbDeleteQuestionGroup,
  getQuestionGroupsByProjectId as dbGetQuestionGroupsByProjectId,
  getQuestionGroupById as dbGetQuestionGroupById,
} from "./lib/prisma/questionGroup"
import {
  createQuestionGroupItem as dbCreateQuestionGroupItem,
  updateQuestionGroupItem as dbUpdateQuestionGroupItem,
  deleteQuestionGroupItem as dbDeleteQuestionGroupItem,
  getQuestionGroupItemsByGroupId as dbGetQuestionGroupItemsByGroupId,
  getQuestionGroupItemById as dbGetQuestionGroupItemById,
  createManyQuestionGroupItems as dbCreateManyQuestionGroupItems,
} from "./lib/prisma/questionGroupItem"
import {
  createSubtotalDefinition as dbCreateSubtotalDefinition,
  deleteSubtotalDefinition as dbDeleteSubtotalDefinition,
  getSubtotalDefinitionsByLayoutRegionId as dbGetSubtotalDefsByLayoutRegionId,
  getSubtotalDefinitionsByQuestionGroupItemId as dbGetSubtotalDefsByQGItemId,
  createManySubtotalDefinitions as dbCreateManySubtotalDefinitions,
  deleteSubtotalDefinitionsByLayoutRegionId as dbDeleteSubDefsByLayoutRegionId,
} from "./lib/prisma/subtotalDefinition"
import {
  createQuestionSubtotalAssignment as dbCreateQuestionSubtotalAssignment,
  deleteQuestionSubtotalAssignment as dbDeleteQuestionSubtotalAssignment,
  getAssignmentsByQuestionLayoutRegionId as dbGetAssignsByQuestionLayoutRegionId,
  getAssignmentsByQuestionGroupItemId as dbGetAssignsByQGItemId,
  createManyQuestionSubtotalAssignments as dbCreateManyQuestionSubtotalAssignments,
  deleteAssignmentsByQuestionLayoutRegionId as dbDeleteAssignsByQuestionLayoutRegionId,
  deleteAssignmentsByQuestionGroupItemId as dbDeleteAssignsByQGItemId,
} from "./lib/prisma/questionSubtotalAssignment"

import { fetchStudents, importStudentsFromFile } from "./lib/prisma/student"
import { createTag, deleteTag, updateTag } from "./lib/prisma/tag"
import { fetchUsers, getCurrentUser } from "./lib/prisma/user"

app.on("ready", async () => {
  await prepareNext(".")

  protocol.handle("appimg", async (request) => {
    try {
      const relativePathInUserData = request.url.substring("appimg://".length)
      const decodedRelativePath = decodeURI(relativePathInUserData)
      const absolutePath = path.join(
        app.getPath("userData"),
        decodedRelativePath,
      )

      const fileURL = format({
        pathname: absolutePath,
        protocol: "file:",
        slashes: true,
      })
      return net.fetch(fileURL)
    } catch (error) {
      console.error(
        `Failed to handle 'appimg' protocol request ${request.url}:`,
        error,
      )

      return new Response("File not found", { status: 404 })
    }
  })

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const url = isDev
    ? "http://localhost:8000/"
    : format({
        pathname: join(__dirname, "../out/index.html"),
        protocol: "file:",
        slashes: true,
      })
  Menu.setApplicationMenu(menu(app, mainWindow, "home"))

  ipcMain.on("set-shortcut", (_event, page: string) => {
    Menu.setApplicationMenu(menu(app, mainWindow, page))
  })
  ipcMain.on("score-panel", (_event, arg: string) => {
    mainWindow.webContents.send("score-panel", arg)
  })

  ipcMain.handle("fetch-projects", async () => {
    try {
      return await dbFetchProjects()
    } catch (err) {
      console.error("Error fetching projects:", err)
      throw err
    }
  })

  ipcMain.handle("fetch-project-by-id", async (_event, projectId: string) => {
    try {
      return await dbFetchProjectById(projectId)
    } catch (err) {
      console.error("Error fetching project by ID:", err)
      throw err
    }
  })

  ipcMain.handle(
    "create-project",
    // The type for projectData should come from electron.d.ts or be Prisma.ProjectCreateInput
    // For now, assuming it aligns with what dbCreateProject expects after Omit.
    async (
      _event,
      projectData: Omit<Prisma.ProjectCreateInput, "createdBy">,
      userId: string,
    ) => {
      try {
        if (!userId) throw new Error("User ID is required to create a project.")
        // dbCreateProject now expects 2 arguments based on its definition in project.ts
        return await dbCreateProject(projectData, userId)
      } catch (err) {
        console.error("Error creating project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-project",
    async (_event, projectId: string, data: Prisma.ProjectUpdateInput) => {
      try {
        // dbUpdateProject now expects 2 arguments based on its definition in project.ts
        return await dbUpdateProject(projectId, data)
      } catch (err) {
        console.error("Error updating project:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-project", async (_event, projectId: string) => {
    try {
      return await dbDeleteProject(projectId)
    } catch (err) {
      console.error("Error deleting project:", err)
      throw err
    }
  })

  ipcMain.handle("create-tag", async (_event, tagText: string) => {
    try {
      return await createTag(tagText)
    } catch (err) {
      console.error("Error creating tag:", err)
      throw err
    }
  })

  ipcMain.handle(
    "update-tag",
    async (_event, tagId: string, newText: string) => {
      try {
        return await updateTag(tagId, newText)
      } catch (err) {
        console.error("Error updating tag:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-tag", async (_event, tagId: string) => {
    try {
      return await deleteTag(tagId)
    } catch (err) {
      console.error("Error deleting tag:", err)
      throw err
    }
  })

  ipcMain.handle("fetch-users", async () => {
    try {
      return await fetchUsers()
    } catch (err) {
      console.error("Error fetching users:", err)
      throw err
    }
  })
  ipcMain.handle("get-current-user", async () => {
    try {
      return await getCurrentUser()
    } catch (err) {
      console.error("Error getting current user:", err)
      throw err
    }
  })

  ipcMain.handle("fetch-classes", async () => {
    try {
      return await fetchClasses()
    } catch (err) {
      console.error("Error fetching classes:", err)
      throw err
    }
  })
  ipcMain.handle(
    "create-class",
    async (_event, classData: Prisma.ClassCreateWithoutTeachersInput) => {
      try {
        return await createClass(classData)
      } catch (err) {
        console.error("Error creating class:", err)
        throw err
      }
    },
  )
  ipcMain.handle(
    "update-class",
    async (_event, classData: Prisma.ClassUpdateInput & { id: string }) => {
      try {
        return await updateClass(classData)
      } catch (err) {
        console.error("Error updating class:", err)
        throw err
      }
    },
  )
  ipcMain.handle("delete-class", async (_event, classId: string) => {
    try {
      return await deleteClass(classId)
    } catch (err) {
      console.error("Error deleting class:", err)
      throw err
    }
  })

  ipcMain.handle("fetch-students", async () => {
    try {
      return await fetchStudents()
    } catch (err) {
      console.error("Error fetching students:", err)
      throw err
    }
  })
  ipcMain.handle(
    "import-students-from-file",
    async (
      _event,
      filePath: string,
      existingClasses: { id: string; name: string }[],
    ) => {
      try {
        return await importStudentsFromFile(filePath, existingClasses)
      } catch (err) {
        console.error("Error importing students from file:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "upload-master-images",
    async (
      _event,
      projectId: string,
      filesData: {
        name: string
        type: string
        buffer: ArrayBuffer
        path?: string
      }[],
    ) => {
      try {
        return await uploadMasterImages(projectId, filesData)
      } catch (err) {
        console.error("Error in IPC upload-master-images:", err)
        throw err
      }
    },
  )
  ipcMain.handle("delete-master-image", async (_event, imageId: string) => {
    try {
      return await deleteMasterImage(imageId)
    } catch (err) {
      console.error("Error in IPC delete-master-image:", err)
      throw err
    }
  })
  ipcMain.handle(
    "update-master-images-order",
    async (_event, imageOrders: { id: string; pageNumber: number }[]) => {
      try {
        return await updateMasterImagesOrder(imageOrders)
      } catch (err) {
        console.error("Error in IPC update-master-images-order:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "resolve-file-protocol-path",
    async (_event, relativePath: string) => {
      try {
        return `appimg://${relativePath}`
      } catch (err) {
        console.error("Error in IPC resolve-file-protocol-path:", err)
        throw err
      }
    },
  )

  // REMOVE OBSOLETE ProjectLayout HANDLERS
  // ipcMain.handle("save-project-layout", ...)
  // ipcMain.handle("fetch-project-layout-by-id", ...)
  // ipcMain.handle("fetch-project-layout-by-project-id", ...)
  // ipcMain.handle("delete-project-layout", ...)
  // ipcMain.handle("duplicate-project-layout", ...)

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
        return await dbGetLayoutRegionsByProjectId(projectId)
      } catch (err) {
        console.error("Error fetching layout regions by project ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle("get-layout-region-by-id", async (_event, id: string) => {
    try {
      return await dbGetLayoutRegionById(id)
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

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }
  mainWindow.loadURL(url)
})

app.on("window-all-closed", app.quit)
