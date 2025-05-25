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
  updateMasterImagesOrder,
  uploadMasterImages,
} from "./lib/prisma/masterImage"
import {
  createProject,
  deleteProject,
  deleteProjectLayout,
  duplicateProjectLayout,
  fetchProjectById,
  fetchProjectLayoutById,
  fetchProjectLayoutByProjectId,
  fetchProjects,
  saveProjectLayout,
  updateProject,
  type CreateProjectProps,
  type SaveProjectLayoutInput,
} from "./lib/prisma/project"
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
      return await fetchProjects()
    } catch (err) {
      console.error("Error fetching projects:", err)
      throw err
    }
  })

  ipcMain.handle("fetch-project-by-id", async (_event, projectId: string) => {
    try {
      return await fetchProjectById(projectId)
    } catch (err) {
      console.error("Error fetching project by ID:", err)
      throw err
    }
  })

  ipcMain.handle(
    "create-project",
    async (_event, props: CreateProjectProps) => {
      try {
        return await createProject(props)
      } catch (err) {
        console.error("Error creating project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-project",
    async (
      _event,
      projectPayload: Prisma.ProjectGetPayload<{
        include: { tags: true }
      }>,
    ) => {
      try {
        return await updateProject(projectPayload)
      } catch (err) {
        console.error("Error updating project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "delete-project",
    async (
      _event,
      project: Prisma.ProjectGetPayload<{ include: { tags: true } }>,
    ) => {
      try {
        return await deleteProject(project.projectId)
      } catch (err) {
        console.error("Error deleting project:", err)
        throw err
      }
    },
  )

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

  ipcMain.handle(
    "save-project-layout",
    async (_event, layoutData: SaveProjectLayoutInput) => {
      try {
        return await saveProjectLayout(layoutData)
      } catch (err) {
        console.error("Error saving project layout:", err)
        throw err
      }
    },
  )
  ipcMain.handle(
    "fetch-project-layout-by-id",
    async (_event, layoutId: string) => {
      try {
        return await fetchProjectLayoutById(layoutId)
      } catch (err) {
        console.error("Error fetching project layout by ID:", err)
        throw err
      }
    },
  )
  ipcMain.handle(
    "fetch-project-layout-by-project-id",
    async (_event, projectId: string) => {
      try {
        return await fetchProjectLayoutByProjectId(projectId)
      } catch (err) {
        console.error("Error fetching project layout by project ID:", err)
        throw err
      }
    },
  )
  ipcMain.handle("delete-project-layout", async (_event, layoutId: string) => {
    try {
      return await deleteProjectLayout(layoutId)
    } catch (err) {
      console.error("Error deleting project layout:", err)
      throw err
    }
  })
  ipcMain.handle(
    "duplicate-project-layout",
    async (
      _event,
      sourceProjectId: string,
      targetProjectId: string,
      createdById: string,
    ) => {
      try {
        return await duplicateProjectLayout(
          sourceProjectId,
          targetProjectId,
          createdById,
        )
      } catch (err) {
        console.error("Error duplicating project layout:", err)
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
