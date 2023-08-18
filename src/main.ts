import path from "path"
import { BrowserWindow, app } from "electron"

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    title: "一括採点",
    webPreferences: {
      preload: path.resolve(__dirname, "preload.js"),
    },
  })

  mainWindow.loadFile("dist/index.html")
  mainWindow.webContents.openDevTools
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
})

app.once("window-all-closed", () => app.quit())
