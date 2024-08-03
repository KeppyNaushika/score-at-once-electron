// Native
import { join } from "path"
import { format } from "url"

// Packages
import { BrowserWindow, app, ipcMain, Menu } from "electron"
import isDev from "electron-is-dev"
import prepareNext from "electron-next"
import menu from "./menu"
import { createProject, deleteProject, fetchProjects } from "./prisma"

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
      return await fetchProjects()
    } catch (err) {}
  })
  ipcMain.handle("create-project", async (_event, examName, examDate) => {
    try {
      return createProject(examName, examDate)
    } catch (err) {}
  })
  ipcMain.handle("delete-project", async (_event, project) => {
    try {
      return deleteProject(project)
    } catch (err) {}
  })

  mainWindow.webContents.openDevTools()
  mainWindow.loadURL(url)
})

app.on("window-all-closed", app.quit)
