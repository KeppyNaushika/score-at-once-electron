import { join } from "path"
import { format } from "url"

import { app, BrowserWindow, ipcMain, Menu, protocol } from "electron" // Import 'protocol'
import isDev from "electron-is-dev"
import prepareNext from "electron-next"
import menu from "./menu"

import {
  createClass,
  deleteClass,
  fetchClasses,
  updateClass,
} from "./lib/prisma/class"
import {
  uploadMasterImages,
  deleteMasterImage,
  updateMasterImagesOrder, // インポート追加
} from "./lib/prisma/masterImage"
import {
  createProject,
  deleteProject,
  fetchProjectById,
  fetchProjects,
  updateProject,
  type CreateProjectProps,
  saveProjectTemplate,
  fetchProjectTemplateById,
  fetchProjectTemplatesByProjectId,
  deleteProjectTemplate,
} from "./lib/prisma/project"
import { fetchStudents, importStudentsFromFile } from "./lib/prisma/student"
import { createTag, deleteTag, updateTag } from "./lib/prisma/tag"
import { fetchUsers, getCurrentUser } from "./lib/prisma/user"
import path from "path"
import { Prisma } from "@prisma/client"

app.on("ready", async () => {
  await prepareNext(".")

  // Register custom protocol to serve images from userData
  protocol.registerFileProtocol("appimg", (request, callback) => {
    // request.url will be like 'appimg://masterImages/project_id/image.png'
    // We need to strip 'appimg://' to get the relative path
    const relativePathInUserData = request.url.substring("appimg://".length)
    // It's good practice to decode the URI component in case of special characters
    const decodedRelativePath = decodeURI(relativePathInUserData)
    const absolutePath = path.join(app.getPath("userData"), decodedRelativePath)
    callback({ path: absolutePath })
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

  // Project Handlers
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
      projectPayload: Prisma.ProjectGetPayload<{ include: { tags: true } }>,
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

  // Tag Handlers
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

  // User Handlers
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

  // Class Handlers
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

  // Student Handlers
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

  // REMOVE OR REFACTOR OLD EXAM HANDLERS
  // ipcMain.handle("fetch-exams", async () => {
  //   try {
  //     return await fetchExams() // This would call the old exam logic
  //   } catch (err) {
  //     console.error("Error fetching exams:", err)
  //     throw err
  //   }
  // })
  // ipcMain.handle("fetch-exam-by-id", async (_event, examId: string) => { ... })
  // ipcMain.handle("create-exam", async (_event, examData: CreateExamArgs) => { ... })
  // ipcMain.handle("update-exam", async (_event, examData: UpdateExamArgs) => { ... })
  // ipcMain.handle("delete-exam", async (_event, examId: string) => { ... })

  // MasterImage Handlers
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
        // Return the path using the custom 'appimg' protocol
        // relativePath is already like "masterImages/PROJECT_ID/FILENAME.png"
        return `appimg://${relativePath}`
      } catch (err) {
        console.error("Error in IPC resolve-file-protocol-path:", err)
        throw err
      }
    },
  )

  // ExamTemplate Handlers
  ipcMain.handle(
    "save-project-template", // IPC名を変更
    async (
      _event,
      templateData: // 型を project.ts の saveProjectTemplate に合わせる
      | (Omit<Prisma.ExamTemplateCreateInput, "project" | "createdBy"> & {
            projectId: string
            createdById: string
          })
        | (Prisma.ExamTemplateUpdateInput & {
            id: string
            projectId?: string
            createdById?: string
          }),
    ) => {
      try {
        return await saveProjectTemplate(templateData)
      } catch (err) {
        console.error("Error saving project template:", err)
        throw err
      }
    },
  )
  ipcMain.handle(
    "fetch-project-template-by-id",
    async (_event, templateId: string) => {
      // IPC名を変更
      try {
        return await fetchProjectTemplateById(templateId)
      } catch (err) {
        console.error("Error fetching project template by ID:", err)
        throw err
      }
    },
  )
  ipcMain.handle(
    "fetch-project-templates-by-project-id",
    async (_event, projectId: string) => {
      // 新規追加
      try {
        return await fetchProjectTemplatesByProjectId(projectId)
      } catch (err) {
        console.error("Error fetching project templates by project ID:", err)
        throw err
      }
    },
  )
  ipcMain.handle(
    "delete-project-template",
    async (_event, templateId: string) => {
      // IPC名を変更
      try {
        return await deleteProjectTemplate(templateId)
      } catch (err) {
        console.error("Error deleting project template:", err)
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
