// Native
import { join } from "path"
import { format } from "url"

// Packages
import { BrowserWindow, app, ipcMain, Menu } from "electron"
import isDev from "electron-is-dev"
import prepareNext from "electron-next"
import menu from "./menu"
import {
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
  fetchProjectById, // fetchProjectById をインポート
  createTag, // createTag をインポート
  updateTag, // updateTag をインポート
  deleteTag, // deleteTag をインポート
  type CreateProjectProps, // CreateProjectProps をインポート
} from "./prisma"
import { Prisma } from "@prisma/client" // Prisma をインポート

// Prepare the renderer once the app is ready
app.on("ready", async () => {
  await prepareNext(".")

  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { preload: join(__dirname, "preload.js") },
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

  ipcMain.handle("delete-project", async (_event, projectId: string) => {
    try {
      return await deleteProject(projectId)
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

  mainWindow.webContents.openDevTools()
  mainWindow.loadURL(url)
})

app.on("window-all-closed", app.quit)
