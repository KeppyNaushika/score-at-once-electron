// Native
import { join } from "path"
import { format } from "url"

// Packages
import { BrowserWindow, app, ipcMain, type IpcMainEvent, Menu } from "electron"
import isDev from "electron-is-dev"
import prepareNext from "electron-next"
import menu from "./menu"
import {
  createProject,
  deleteProject,
  fetchProjects,
  selectProject,
} from "./prisma"
import { Project } from "@prisma/client"

// Prepare the renderer once the app is ready
app.on("ready", async () => {
  await prepareNext("./renderer")

  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
    },
  })

  const url = isDev
    ? "http://localhost:8000/"
    : format({
        pathname: join(__dirname, "../renderer/out/index.html"),
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
      const projects = await fetchProjects()
      console.log(projects)
      return projects
    } catch (err) {
      return null
    }
  })
  ipcMain.handle("create-project", async (_event, examName, examDate) => {
    try {
      createProject(examName, examDate)
    } catch (err) {}
  })
  ipcMain.handle("select-project", async (_event, project: Project) => {
    try {
      selectProject(project)
    } catch (err) {}
  })
  ipcMain.handle("delete-project", async (_event, project) => {
    try {
      deleteProject(project)
    } catch (err) {}
  })

  mainWindow.webContents.openDevTools()
  mainWindow.loadURL(url)
})

// Quit the app once all windows are closed
app.on("window-all-closed", app.quit)

// listen the channel `message` and resend the received message to the renderer process
ipcMain.on("message", (event: IpcMainEvent, _message: any) => {
  setTimeout(() => {
    event.sender.send("message", "hi from electron")
  }, 500)
})
