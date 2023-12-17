import { BrowserWindow, Menu } from "electron"

const menu = (app: Electron.App, mainWindow: BrowserWindow, page: string) => {
  const fileMenu = {
    label: "一括採点",
    submenu: [
      {
        label: "Quit",
        accelerator: process.platform === "darwin" ? "Cmd+Q" : "Control+Q",
        click() {
          app.quit()
        },
      },
    ],
  }
  const scoreMenu = {
    label: "採点パネル",
    submenu: [
      {
        label: "表示/非表示",
        click: () => {},
      },
      {
        label: "答案再読み込み",
        accelerator: "R",
        click: () => mainWindow.webContents.send("score-panel", "reload"),
      },
      {
        label: "採点",
        submenu: [
          {
            label: "未採点にする",
            accelerator: "Q",
            click: () => mainWindow.webContents.send("score-panel", "unscored"),
          },
          {
            label: "正答にする",
            accelerator: "E",
            click: () => mainWindow.webContents.send("score-panel", "correct"),
          },
          {
            label: "部分点にする",
            accelerator: "F",
            click: () => mainWindow.webContents.send("score-panel", "partial"),
          },
          {
            label: "保留にする",
            accelerator: "J",
            click: () => mainWindow.webContents.send("score-panel", "pending"),
          },
          {
            label: "誤答にする",
            accelerator: "O",
            click: () =>
              mainWindow.webContents.send("score-panel", "incorrect"),
          },
        ],
      },
      {
        label: "表示",
        submenu: [
          {
            label: "未採点を表示",
            accelerator: "Ctrl+Q",
            click: () =>
              mainWindow.webContents.send(
                "score-panel",
                "toggle-show-unscored",
              ),
          },
          {
            label: "正答を表示",
            accelerator: "Ctrl+E",
            click: () =>
              mainWindow.webContents.send("score-panel", "toggle-show-correct"),
          },
          {
            label: "部分点を表示",
            accelerator: "Ctrl+F",
            click: () =>
              mainWindow.webContents.send("score-panel", "toggle-show-partial"),
          },
          {
            label: "保留を表示",
            accelerator: "Ctrl+J",
            click: () =>
              mainWindow.webContents.send("score-panel", "toggle-show-pending"),
          },
          {
            label: "誤答を表示",
            accelerator: "Ctrl+O",
            click: () =>
              mainWindow.webContents.send(
                "score-panel",
                "toggle-show-incorrect",
              ),
          },
        ],
      },
      {
        label: "移動",
        submenu: [
          {
            label: "左",
            accelerator: "A",
            click: () => mainWindow.webContents.send("score-panel", "left"),
          },
          {
            label: "右",
            accelerator: "D",
            click: () => mainWindow.webContents.send("score-panel", "right"),
          },
          {
            label: "上",
            accelerator: "W",
            click: () => mainWindow.webContents.send("score-panel", "up"),
          },
          {
            label: "下",
            accelerator: "S",
            click: () => mainWindow.webContents.send("score-panel", "down"),
          },
        ],
      },
      {
        label: "選択",
        submenu: [
          {
            label: "全選択",
            accelerator: "CmdOrCtrl+A",
            click: () =>
              mainWindow.webContents.send("score-panel", "select-all"),
          },
        ],
      },
      {
        label: "部分点",
        submenu: [
          ...[...Array(10).keys()].map((v) => {
            const menu = {
              label: `部分点に ${v} を右追加`,
              accelerator: v.toString(),
              click: () =>
                mainWindow.webContents.send(
                  "score-panel",
                  `partial-point-${v}`,
                ),
            }
            return menu
          }),
          {
            label: "部分点を左削除",
            accelerator: "Backspace",
            click: () =>
              mainWindow.webContents.send(
                "score-panel",
                "partial-point-backspace",
              ),
          },
        ],
      },
      {
        label: "設問",
        submenu: [
          {
            label: "前",
            accelerator: "Ctrl+A",
            click: () => {},
          },
          {
            label: "次",
            accelerator: "Ctrl+D",
            click: () => {},
          },
        ],
      },
    ],
  }
  if (page === "score") {
    return Menu.buildFromTemplate([fileMenu, scoreMenu])
  }
  return Menu.buildFromTemplate([fileMenu])
}
export default menu
