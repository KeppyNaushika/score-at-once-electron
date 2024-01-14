import { BrowserWindow, Menu, MenuItemConstructorOptions } from "electron"

const menu = (app: Electron.App, mainWindow: BrowserWindow, page: string) => {
  const mainMenus: MenuItemConstructorOptions[] = [
    {
      label: "一括採点",
      submenu: [
        {
          label: "Quit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Control+Q",
          click() {
            app.quit()
          },
        },
        // {
        //   label: "Reload",
        //   accelerator: "Command+R",
        //   click: function () {
        //     app.relaunch()
        //     app.quit()
        //   },
        // },
        {
          label: "Toggle Full Screen",
          accelerator: "Ctrl+Command+F",
          click: function () {
            mainWindow.setFullScreen(!mainWindow.isFullScreen())
          },
        },
        {
          label: "Toggle Developer Tools",
          accelerator: "Alt+Command+I",
          click: function () {
            mainWindow.webContents.toggleDevTools()
          },
        },
      ],
    },
    {
      label: "編集",
      submenu: [
        { label: "元に戻す", accelerator: "CmdOrCtrl+Z", role: "undo" },
        { label: "やり直し", accelerator: "Shift+CmdOrCtrl+Z", role: "redo" },
        { type: "separator" },
        { label: "切り取り", accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "コピー", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "貼り付け", accelerator: "CmdOrCtrl+V", role: "paste" },
        {
          label: "全選択",
          accelerator: "CmdOrCtrl+A",
          role: "selectAll",
        },
        { type: "separator" },
        {
          label: "再読込",
          accelerator: "CmdOrCtrl+R",
          role: "reload",
        },
        { type: "separator" },
        {
          label: "拡大",
          accelerator: "CmdOrCtrl+=",
          role: "zoomIn",
        },
        {
          label: "縮小",
          accelerator: "CmdOrCtrl+-",
          role: "zoomOut",
        },
        {
          label: "元の拡大率",
          accelerator: "CmdOrCtrl+0",
          role: "resetZoom",
        },
      ],
    },
  ]
  const scoreMenu = {
    label: "採点パネル",
    submenu: [
      {
        label: "採点パネルの表示/非表示",
        click: () => {},
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
          {
            label: "無解答にする",
            accelerator: "P",
            click: () => mainWindow.webContents.send("score-panel", "noanswer"),
          },
        ],
      },
      {
        label: "表示",
        submenu: [
          {
            label: "未採点を表示",
            accelerator: "Alt+Q",
            click: () =>
              mainWindow.webContents.send(
                "score-panel",
                "toggle-show-unscored",
              ),
          },
          {
            label: "正答を表示",
            accelerator: "Alt+E",
            click: () =>
              mainWindow.webContents.send("score-panel", "toggle-show-correct"),
          },
          {
            label: "部分点を表示",
            accelerator: "Alt+F",
            click: () =>
              mainWindow.webContents.send("score-panel", "toggle-show-partial"),
          },
          {
            label: "保留を表示",
            accelerator: "Alt+J",
            click: () =>
              mainWindow.webContents.send("score-panel", "toggle-show-pending"),
          },
          {
            label: "誤答を表示",
            accelerator: "Alt+O",
            click: () =>
              mainWindow.webContents.send(
                "score-panel",
                "toggle-show-incorrect",
              ),
          },
          {
            label: "無解答を表示",
            accelerator: "Alt+P",
            click: () =>
              mainWindow.webContents.send(
                "score-panel",
                "toggle-show-incorrect",
              ),
          },
        ],
      },
      {
        label: "答案再読み込み",
        accelerator: "R",
        click: () => mainWindow.webContents.send("score-panel", "reload"),
      },
      {
        label: "コメント",
        accelerator: "R",
        click: () => mainWindow.webContents.send("score-panel", "comment"),
      },
      {
        label: "解答者名の表示/非表示",
        accelerator: "R",
        click: () => mainWindow.webContents.send("score-panel", "name"),
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
            accelerator: "Alt+A",
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
    return Menu.buildFromTemplate([...mainMenus, scoreMenu])
  }
  return Menu.buildFromTemplate([...mainMenus])
}
export default menu
