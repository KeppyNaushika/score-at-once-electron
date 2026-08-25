/**
 * 全画面スクリーンショット自動撮影
 *
 * 前提:
 *   1. npm run screenshot:setup で撮影用DBに種を蒔いてある
 *   2. electron-src がビルド済み（main/electron-src/index.js）
 *
 * 実行:
 *   npm run screenshot        # 種まき → 撮影
 *
 * レンダラーは 3000 番ではない（`helpers/rendererPort.ts`）。Next.js dev サーバーは
 * Playwright の `webServer` が立てる。
 *
 * 専用DB (__tests__/screenshots/data/database.db) を使用。既定の data/ には一切触れない。
 *
 * ストーリー:
 *   空の状態からUIを操作しながら段階的にデータを追加。
 *   操作 → 結果 が一致するよう撮影する。
 *
 * **撮れなかったものは最後に一覧で出して落とす。** 掴めなかった一枚を `console.warn`
 * だけで見送ると、出力を見る人には「その画面は無い」のか「撮り損ねた」のか区別が
 * つかない。`captureOptional()` が取りこぼしを数え、最後の一本が 0 でなければ失敗する。
 */

import { expect, test } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import type { ElectronApplication, Locator, Page } from "playwright"
import { _electron as electron } from "playwright"

import { DATABASE_PATH_PROBE } from "./helpers/databasePathProbe"
import {
  SCREENSHOT_BASE_URL,
  SCREENSHOT_RENDERER_PORT,
} from "./helpers/rendererPort"
import { SCREENSHOTS_DIR } from "./helpers/screenshotPaths"
import { runSeedCommand } from "./helpers/seedClient"
import { describeSyncAbort } from "./helpers/syncGuard"

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, "../..")
const MAIN_ELECTRON_DIR = path.join(PROJECT_ROOT, "main/electron-src")
const TEST_DATA_DIR = path.join(__dirname, "data")
const SCREENSHOT_DB = path.join(TEST_DATA_DIR, "database.db")
const IDS_FILE = path.join(TEST_DATA_DIR, "screenshot-ids.json")
const TEMPLATE_PATH = path.join(TEST_DATA_DIR, "asb-template.json")
const BASE_URL = SCREENSHOT_BASE_URL

/**
 * 画面の幅。
 *
 * **この数字が図に写るものを決めている。** 一覧の操作は幅が足りないと「…」へ畳まれ、
 * サイドパネルも狭いと隠れる。軽い気持ちで縮めると、図から操作が消える。
 */
const CAPTURE_WIDTH = 1440
const CAPTURE_HEIGHT = 900

function loadIds(): { userId: string; asbDefId: string } {
  if (!fs.existsSync(IDS_FILE)) {
    throw new Error(
      `${IDS_FILE} が見つかりません。先に npm run screenshot:setup を実行してください。`
    )
  }
  return JSON.parse(fs.readFileSync(IDS_FILE, "utf-8"))
}

/**
 * アプリが実際に開いた DB が撮影用のものであることを確かめる
 *
 * `SCORE_AT_ONCE_DATA_DIR` を渡していても、同期が有効なら `getDatabasePath()` は
 * それを無視して userData のローカル DB（＝実運用のデータベース）を返す。同期設定は
 * userData 側にあり撮影側からは確実には見えないので、推測せず**起動したアプリ自身に
 * 訊く**。こうしておけば同期に限らず、どんな理由でパスがずれても捕まる。
 *
 * メインプロセスに読ませる束は globalSetup が毎回作り直す（`helpers/databasePathProbe.ts`）。
 */
async function assertOpenedScreenshotDatabase(
  launchedApp: ElectronApplication
) {
  const openedDatabasePath: string = await launchedApp.evaluate(
    (_electronModule, probePath) => {
      // evaluate に渡した関数は CommonJS のスコープでは走らないので、`require` も
      // 動的 import も居ない（実測: ReferenceError / A dynamic import callback was
      // not specified）。メインプロセスの入口モジュール経由で読む
      const mainModule = process.mainModule
      if (!mainModule) {
        throw new Error("メインプロセスの入口モジュールが取れませんでした")
      }
      const probe: { getDatabasePath: () => string } =
        mainModule.require(probePath)
      return probe.getDatabasePath()
    },
    DATABASE_PATH_PROBE
  )

  if (path.resolve(openedDatabasePath) !== path.resolve(SCREENSHOT_DB)) {
    throw new Error(
      describeSyncAbort(
        `アプリが開いた DB: ${openedDatabasePath}\n` +
          `撮影用の DB:     ${SCREENSHOT_DB}\n` +
          `（同期以外の理由でパスがずれている場合もこの検査に掛かります）`
      )
    )
  }
}

// ---------------------------------------------------------------------------
// 撮れなかったものの記録
// ---------------------------------------------------------------------------

/** 撮れなかった一枚（画像の相対パスと、掴めなかった理由） */
interface MissedCapture {
  relativePath: string
  reason: string
}

const missedCaptures: MissedCapture[] = []

/**
 * 掴み損ねうる一枚を撮る
 *
 * ここで拾った失敗は最後の一本（「撮影の取りこぼし」）が一覧にして落とす。
 * 個々の撮影でいきなり落とすと、以降の画面が1枚も撮れずに終わって、直すための
 * 材料も手に入らない。
 *
 * @param relativePath - 出力の相対パス（取りこぼし一覧に出る名前）
 * @param capture - 掴んで撮るところまで
 */
async function captureOptional(
  relativePath: string,
  capture: () => Promise<void>
): Promise<void> {
  try {
    await capture()
  } catch (e) {
    const reason = (e as Error).message?.split("\n")[0]?.slice(0, 160) ?? ""
    missedCaptures.push({ relativePath, reason })
    console.warn(`  [MISS] ${relativePath}: ${reason}`)
  }
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

async function waitForReady(page: Page) {
  await page.waitForLoadState("networkidle")
  try {
    await page.waitForSelector(".animate-spin", {
      state: "hidden",
      timeout: 5000,
    })
  } catch {
    // なければOK
  }
  await page.waitForTimeout(800)
}

async function ss(page: Page, relativePath: string) {
  const fullPath = path.join(SCREENSHOTS_DIR, relativePath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  await page.screenshot({ path: fullPath, fullPage: false, type: "png" })
  console.log(`  [OK] ${relativePath}`)
}

async function nav(page: Page, urlPath: string) {
  await page.goto(`${BASE_URL}${urlPath}`)
  await waitForReady(page)
}

/** 一覧の列見出しの popover（並べ替え＋絞り込み）を開く */
async function openColumnFilter(page: Page, columnLabel: string) {
  await page
    .getByRole("columnheader", { name: columnLabel })
    .getByRole("button")
    .first()
    .click()
  await expect(page.getByRole("button", { name: "昇順" })).toBeVisible()
  await page.waitForTimeout(300)
}

/**
 * 07 に入ったときの「採点操作モードを選択」を閉じる
 *
 * この modal は `scoringOperationModeRemembered` が立つまで**入るたびに**出る。
 * 選択を記憶させてから閉じるので、2回目以降の 07 は素の画面になる。
 */
async function chooseScoringMode(page: Page) {
  // 「キーボード」という名のボタンは他に2つある（ヘッダーのショートカット一覧と、
  // 側パネルの操作モード切り替え）。この modal の中に限って掴む
  const modeModal = page.getByRole("dialog")
  await modeModal.getByLabel("この選択を記憶する").click()
  await modeModal.getByRole("button", { name: "キーボード" }).click()
  await expect(page.getByText("採点操作モードを選択")).toBeHidden()
  await page.waitForTimeout(500)
}

/**
 * 07 の一覧表示で全ての答案を出す
 *
 * 表示の絞り込みは初期値が「未採点だけ」で、種データは全て採点済みなので、
 * **何もしないと答案が1枚も並ばない**（実際、前の spec は絞り込みのボタンを
 * 1つも押せておらず、空のグリッドを撮っていた）。
 *
 * 絞り込みのボタンは「採点」節の同名ボタンと文言が重なるので、名前ではなく
 * 割り当てられたキー（Alt＋採点キー）で切り替える。押した結果を目で確かめないと
 * 同じ失敗を繰り返すので、並んだマスの数を数えてから戻る。マスは
 * `data-answer-id` を持っており、この画面で唯一の安定した目印になる
 * （模範解答も1マス数えるので、2つ以上あれば答案が並んでいる）。
 */
async function showAllScoredAnswers(page: Page) {
  for (const filterKey of ["e", "f", "j", "o", "p", "t"]) {
    await page.keyboard.press(`Alt+${filterKey}`)
    await page.waitForTimeout(150)
  }
  const answerCells = page.locator("[data-answer-id]")
  await expect
    .poll(() => answerCells.count(), { timeout: 15_000 })
    .toBeGreaterThan(1)
  await page.waitForTimeout(800)
}

/** 押せる状態になってから押す（描き直しの途中を掴まない） */
async function clickWhenReady(target: Locator) {
  await expect(target).toBeVisible({ timeout: 15_000 })
  await target.click()
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

let electronApp: ElectronApplication
let page: Page
let IDS: ReturnType<typeof loadIds>

// テスト間でIDを共有するための状態
let studentIds: string[] = []
let classAId = ""
let classBId = ""
let subtotalGroupId = ""
let subtotalIds: string[] = []
let examId = ""
let simpleExamId = ""
let gradeId = ""
let courseworkId = ""
/** ASB が書き出した解答用紙の PNG（試験のマスター画像の元になる） */
let asbMasterPngPath = ""

/**
 * 撮影する画面の大きさを決める
 *
 * **`page.setViewportSize()` は使わない。** あれは CDP の
 * `Emulation.setDeviceMetricsOverride` を **`deviceScaleFactor: 1` で**送るので、
 * Retina の画面で撮っても画像は必ず1倍で焼き上がる（実測: 1440×900）。Electron では
 * その 1 を差し替える口が無く（ブラウザコンテキスト生成時の設定で、
 * `electronApp.context()` へは渡せない）、**別のCDPセッションから上書きしても
 * 効かない**ことも実測で確かめた。
 *
 * 代わりにウインドウの中身の大きさを Electron 側で決める。上書きが一切無くなるので、
 * 画素の倍率は画面のもの（この開発機の Retina なら2倍）がそのまま乗る。
 * **CSS ピクセル数はここで決めた通りに固定される**ので、何が写るかは倍率に依らない。
 *
 * 引き換えに、ウインドウがこの大きさになれない画面（小さいディスプレイ）では
 * レイアウトが変わってしまう。黙って別の絵を撮らないよう、実際の大きさを確かめる。
 */
async function setCaptureViewport(width: number, height: number) {
  const browserWindow = await electronApp.browserWindow(page)
  await browserWindow.evaluate(
    (electronWindow, size) => {
      electronWindow.setContentSize(size.width, size.height)
    },
    { width, height }
  )
  await page.waitForTimeout(500)

  const actualSize = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  if (actualSize.width !== width || actualSize.height !== height) {
    throw new Error(
      `ウインドウを ${width}×${height} にできませんでした` +
        `（実際: ${actualSize.width}×${actualSize.height}）。` +
        `この大きさが図に写るものを決めているので、狭い画面では撮らない。`
    )
  }
}

test.beforeAll(async () => {
  IDS = loadIds()
  console.log("=== Screenshot Test ===")
  console.log(`ASB: ${IDS.asbDefId}\n`)

  if (!fs.existsSync(SCREENSHOT_DB)) {
    throw new Error(
      "専用DB が見つかりません。先に npm run screenshot:setup を実行してください。"
    )
  }
  // 前回の setup が途中で落ちると 0 バイトの DB と古い ID が残る。撮影の土台なので
  // 「空の DB でログイン画面ばかり撮れた」で終わらせず、ここで落とす
  runSeedCommand("assertSeedLoaded", [IDS.userId])

  electronApp = await electron.launch({
    args: [path.join(MAIN_ELECTRON_DIR, "index.js")],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      NODE_ENV: "development",
      SCORE_AT_ONCE_DATA_DIR: TEST_DATA_DIR,
      // 開発用サーバーの 3000 番ではなく、撮影用に立てたサーバーを読ませる
      SCORE_AT_ONCE_RENDERER_PORT: String(SCREENSHOT_RENDERER_PORT),
    },
    timeout: 60000,
  })

  await assertOpenedScreenshotDatabase(electronApp)

  page = await electronApp.firstWindow({ timeout: 60000 })
  await setCaptureViewport(CAPTURE_WIDTH, CAPTURE_HEIGHT)
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 })
  await page.waitForTimeout(3000)

  // ログイン。失敗したまま進むと以降の画面が全部ログイン画面になり、
  // 「撮れていないのに緑」で終わるので握り潰さない
  await page.goto(`${BASE_URL}/login`)
  await waitForReady(page)
  await page.getByText("山田 太郎").first().click({ timeout: 10000 })
  await page.waitForURL(`${BASE_URL}/exams`, { timeout: 30000 })
  await waitForReady(page)
  console.log("Logged in\n")
})

test.afterAll(async () => {
  if (electronApp) await electronApp.close()
})

// ===========================
// 第1章: 初期設定
// ===========================

test.describe.serial("第1章: 初期設定", () => {
  test("1-1 ログイン画面", async () => {
    await nav(page, "/login")
    await ss(page, "ch1-setup/01-login.png")
  })

  test("1-2 生徒管理", async () => {
    // (A) 空の生徒一覧
    await nav(page, "/students")
    await ss(page, "ch1-setup/02-student-list-empty.png")

    // (B) 表計算からの貼り付けで一括追加するダイアログ（セルにデータ入力）
    await captureOptional(
      "ch1-setup/03-student-spreadsheet-import.png",
      async () => {
        await clickWhenReady(
          page.getByRole("button", { name: "Excel 貼付一括追加" })
        )
        const importDialog = page.getByRole("dialog", {
          name: "生徒データのインポート",
        })
        await expect(importDialog).toBeVisible()

        // 入力欄に id も aria-label も無いので、行と列の位置で掴む
        const firstRowInputs = importDialog
          .locator("tbody tr")
          .first()
          .locator("input")
        const firstRowValues = [
          "S001",
          "佐藤",
          "翔太",
          "サトウ",
          "ショウタ",
          "2025",
        ]
        for (const [columnIndex, cellValue] of firstRowValues.entries()) {
          await firstRowInputs.nth(columnIndex).fill(cellValue)
        }
        await page.waitForTimeout(300)
        await ss(page, "ch1-setup/03-student-spreadsheet-import.png")
        await page.keyboard.press("Escape")
        await page.waitForTimeout(300)
      }
    )

    // (C) 生徒追加ダイアログ
    await captureOptional("ch1-setup/04-add-student-dialog.png", async () => {
      await clickWhenReady(page.getByRole("button", { name: "生徒追加" }))
      await expect(
        page.getByRole("dialog", { name: "新しい生徒を追加" })
      ).toBeVisible()
      const studentFields: [string, string][] = [
        ["学籍番号", "S001"],
        ["姓", "佐藤"],
        ["名", "翔太"],
        ["姓カナ", "サトウ"],
        ["名カナ", "ショウタ"],
      ]
      for (const [fieldLabel, fieldValue] of studentFields) {
        await page.getByLabel(fieldLabel, { exact: true }).fill(fieldValue)
      }
      await page.waitForTimeout(200)
      await ss(page, "ch1-setup/04-add-student-dialog.png")
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)
    })

    // (D) DB直接操作で40名追加 → 一覧を撮り直す
    studentIds = runSeedCommand("seedStudents", [])
    await nav(page, "/students")
    await ss(page, "ch1-setup/05-student-list.png")
  })

  test("1-3 学級管理", async () => {
    // (A) 空の学級一覧
    await nav(page, "/classrooms")
    await ss(page, "ch1-setup/06-classroom-list-empty.png")

    // (B) 学級追加ダイアログ（入力あり）
    await captureOptional("ch1-setup/07-add-classroom-dialog.png", async () => {
      await clickWhenReady(page.getByRole("button", { name: "学級追加" }))
      await expect(page.getByRole("dialog")).toBeVisible()
      await page.getByLabel("学級名").first().fill("2年A組")
      await page.getByLabel("学年").first().fill("2")
      await ss(page, "ch1-setup/07-add-classroom-dialog.png")
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)
    })

    // (C) DB直接操作で2クラス作成
    const classroomResult = runSeedCommand("seedClasses", [studentIds])
    classAId = classroomResult.classAId
    classBId = classroomResult.classBId

    // (D) 作成後の学級一覧
    await nav(page, "/classrooms")
    await ss(page, "ch1-setup/08-classroom-list.png")

    // (E) UIで2年C組を追加（生徒の居ない学級）。UI 経由なので監査ログにも残る
    await captureOptional("ch1-setup/09-classroom-empty.png", async () => {
      await clickWhenReady(page.getByRole("button", { name: "学級追加" }))
      const classroomDialog = page.getByRole("dialog")
      await expect(classroomDialog).toBeVisible()
      await page.getByLabel("学級名").first().fill("2年C組")
      await page.getByLabel("学年").first().fill("2")
      await clickWhenReady(
        classroomDialog.getByRole("button", { name: "保存" })
      )
      await expect(classroomDialog).toBeHidden({ timeout: 15_000 })

      await nav(page, "/classrooms")
      await clickWhenReady(page.getByText("2年C組").first())
      await waitForReady(page)
      await ss(page, "ch1-setup/09-classroom-empty.png")
    })

    // (F) 2年A組の詳細（生徒が20名いる）
    await nav(page, `/classrooms/${classAId}`)
    await ss(page, "ch1-setup/10-classroom-with-students.png")
  })

  test("1-4 小計グループ管理", async () => {
    // (A) 空の小計グループ一覧
    await nav(page, "/subtotal-groups")
    await ss(page, "ch1-setup/11-subtotal-groups-empty.png")

    // (B) 新規作成ダイアログ（グループ名 + 項目を入力した状態）
    await captureOptional(
      "ch1-setup/12-add-subtotal-group-dialog.png",
      async () => {
        await clickWhenReady(
          page.getByRole("button", { name: "最初のグループを作成" }).first()
        )
        const subtotalDialog = page.getByRole("dialog")
        await expect(subtotalDialog).toBeVisible()
        await page.getByLabel("グループ名").first().fill("観点別評価")

        const subtotalNames = [
          "知識・技能",
          "思考・判断・表現",
          "主体的に学習に取り組む態度",
        ]
        for (const [nameIndex, subtotalName] of subtotalNames.entries()) {
          await clickWhenReady(
            subtotalDialog
              .getByRole("button")
              .filter({ hasText: /項目を追加/ })
              .first()
          )
          await subtotalDialog
            .locator('input[placeholder="小計項目名"]')
            .nth(nameIndex)
            .fill(subtotalName)
        }

        await page.waitForTimeout(300)
        await ss(page, "ch1-setup/12-add-subtotal-group-dialog.png")
        await page.keyboard.press("Escape")
        await page.waitForTimeout(300)
      }
    )

    // (C) DB直接操作で小計グループ + タグを追加
    const subtotalResult = runSeedCommand("seedSubtotalAndTag", [])
    subtotalGroupId = subtotalResult.subtotalGroupId
    subtotalIds = subtotalResult.subtotalIds

    // (D) 作成後の一覧
    await nav(page, "/subtotal-groups")
    await ss(page, "ch1-setup/13-subtotal-groups.png")
  })

  test("1-5 タグ管理", async () => {
    await nav(page, "/tags")
    await ss(page, "ch1-setup/14-tags.png")
  })
})

// ===========================
// 第2章: 試験準備
// ===========================

test.describe.serial("第2章: 試験準備", () => {
  test("2-1 解答用紙ビルダー", async () => {
    // 一覧
    await nav(page, "/answer-sheet-builder")
    await ss(page, "ch2-exam-prep/01-asb-list.png")

    // 概要（名前・使用日・タグと、段の進み具合）
    await nav(page, `/answer-sheet-builder/${IDS.asbDefId}`)
    await ss(page, "ch2-exam-prep/02-asb-overview.png")

    // 編集画面。タブは**編集画面にしかない**（概要ページには無い）
    await nav(page, `/answer-sheet-builder/${IDS.asbDefId}/01-edit`)
    await page.waitForTimeout(2000)
    await ss(page, "ch2-exam-prep/03-asb-edit-questions.png")

    const editorTabs: [string, string][] = [
      ["用紙設定", "ch2-exam-prep/04-asb-edit-paper.png"],
      ["罫線", "ch2-exam-prep/05-asb-edit-lines.png"],
      ["ヘッダー", "ch2-exam-prep/06-asb-edit-header.png"],
      ["OMR", "ch2-exam-prep/07-asb-edit-omr.png"],
    ]
    for (const [tabName, relativePath] of editorTabs) {
      await captureOptional(relativePath, async () => {
        await clickWhenReady(page.getByRole("tab", { name: tabName }))
        await page.waitForTimeout(600)
        await ss(page, relativePath)
      })
    }
  })

  test("2-2 解答用紙の書き出し（マスター画像を作る）", async () => {
    await nav(page, `/answer-sheet-builder/${IDS.asbDefId}/02-export`)

    // 保存先ダイアログはネイティブなので、撮影用の置き場を返すよう差し替える
    const tempMasterDir = path.join(TEST_DATA_DIR, "temp-master")
    fs.rmSync(tempMasterDir, { recursive: true, force: true })
    fs.mkdirSync(tempMasterDir, { recursive: true })
    const tempMasterPath = path.join(tempMasterDir, "master-page-1.png")

    await captureOptional("ch2-exam-prep/08-asb-export.png", async () => {
      await electronApp.evaluate(({ ipcMain }, outputPath) => {
        ipcMain.removeHandler("asb:select-save-path")
        ipcMain.handle("asb:select-save-path", async () => {
          return { success: true, canceled: false, filePath: outputPath }
        })
      }, tempMasterPath)

      // DPI 欄はラベルと結ばれていないので、この画面で唯一の数値入力として掴む
      await page.getByRole("spinbutton").fill("200")
      await page.waitForTimeout(300)
      await ss(page, "ch2-exam-prep/08-asb-export.png")

      await clickWhenReady(page.getByRole("button", { name: "PNG出力" }))
      // ラスタライズは重い。秒数ではなく「出来た」と言われるまで待つ
      await expect(page.getByText(/PNGを出力しました/).first()).toBeVisible({
        timeout: 120_000,
      })
    })

    // 出来上がったファイルを控える。ページ数や「模範解答を別ファイルにする」設定で
    // 名前が変わる（複数ページなら `-1` `-2`、模範解答は `_模範解答`）ので、
    // 名前を決め打ちせず**実際に出来たもの**から解答用紙の1枚目を拾う
    const exportedPngs = fs.existsSync(tempMasterDir)
      ? fs
          .readdirSync(tempMasterDir)
          .filter(
            (fileName) =>
              fileName.endsWith(".png") && !fileName.includes("模範解答")
          )
          .sort()
      : []
    if (exportedPngs.length === 0) {
      // ここが空だと以降の答案が「白紙に浮いた手書き」になる。黙って進めない
      missedCaptures.push({
        relativePath: "（ASB の PNG 書き出し）",
        reason: `${tempMasterDir} に解答用紙の PNG が出来ませんでした`,
      })
    } else {
      asbMasterPngPath = path.join(tempMasterDir, exportedPngs[0])
      console.log(`  [OK] ASB PNG 書き出し → ${exportedPngs[0]}`)
    }
  })

  test("2-3 試験作成", async () => {
    // (A) 空の試験一覧
    await nav(page, "/exams")
    await ss(page, "ch2-exam-prep/09-exam-list-empty.png")

    // (B) 新規作成（段階66 でダイアログは無くなった。押すと既定値の1件が
    //     できて概要ページへ移り、名前・試験日・説明・タグをその場で入れる）
    await captureOptional(
      "ch2-exam-prep/10-new-exam-overview.png",
      async () => {
        await clickWhenReady(page.getByRole("button", { name: "新規試験作成" }))
        await page.waitForURL(/\/exams\/[0-9a-f-]{36}$/, { timeout: 15_000 })

        await page.getByLabel("試験名").fill("第２回定期テスト 中２数学")
        await page.getByLabel("試験日").fill("2025-10-15")
        await page.getByLabel("説明").fill("一次関数・連立方程式の範囲")
        await page.waitForTimeout(500)
        await ss(page, "ch2-exam-prep/10-new-exam-overview.png")
      }
    )

    // (C) タグは popover の中で編集する（段階64 で場所が変わった）
    await captureOptional("ch2-exam-prep/11-exam-tag-editor.png", async () => {
      await clickWhenReady(page.getByLabel("タグを編集"))
      const tagInput = page.getByPlaceholder("タグを追加...")
      await expect(tagInput).toBeVisible()
      await tagInput.fill("数学")
      await page.waitForTimeout(500)
      await ss(page, "ch2-exam-prep/11-exam-tag-editor.png")
      await page.keyboard.press("Enter")
      await page.waitForTimeout(800)
      await page.keyboard.press("Escape")
    })

    // (D) DB直接操作で試験 + 採点領域 + 答案 + 採点結果を追加
    examId = runSeedCommand("seedExamWithScoring", [
      IDS.userId,
      studentIds,
      classAId,
      classBId,
      subtotalGroupId,
      subtotalIds,
      TEMPLATE_PATH,
    ])

    // ASBで書き出したマスター画像を試験ディレクトリへ移し、答案画像を作り直す。
    // これをしないと答案は白紙に手書きが浮いただけの絵になり、罫線も枠も写らない
    if (asbMasterPngPath && fs.existsSync(asbMasterPngPath)) {
      const masterDir = path.join(
        TEST_DATA_DIR,
        "exams",
        examId,
        "master-images"
      )
      fs.mkdirSync(masterDir, { recursive: true })
      fs.copyFileSync(
        asbMasterPngPath,
        path.join(masterDir, "master-page-1.png")
      )
      runSeedCommand("regenerateAnswerImages", [
        examId,
        studentIds,
        TEMPLATE_PATH,
        masterDir,
      ])
      console.log("  [OK] ASB PNG → マスター画像 + 答案画像を再生成")
    }

    // (E) 2人目の採点者を入れる。協調採点の画面（3の採点担当・8の裁定）は
    //     参加者が1人だと構造的に写らない
    const secondGrader = runSeedCommand("seedSecondGrader", [
      examId,
      IDS.userId,
      TEMPLATE_PATH,
    ])
    console.log(`  [SEED] 食い違い ${secondGrader.conflictCellCount} マス`)

    // (F) 試験詳細
    await nav(page, `/exams/${examId}`)
    await ss(page, "ch2-exam-prep/12-exam-detail.png")
  })

  test("2-4 模範解答アップロード（ASBから変換済み）", async () => {
    await nav(page, `/exams/${examId}/01-upload`)
    await ss(page, "ch2-exam-prep/13-master-upload.png")
  })

  test("2-5 採点領域作成（ASBから自動生成済み）", async () => {
    await nav(page, `/exams/${examId}/02-template`)
    await page.waitForTimeout(1500)

    // ヘルプポップアップを閉じる
    await captureOptional("（02-template のヘルプを閉じる）", async () => {
      await clickWhenReady(page.getByLabel("ヘルプを閉じる").first())
      await page.waitForTimeout(300)
    })

    // 用紙全体が入るまでズームアウトする（既定は原寸で、枠が数個しか写らない）
    await captureOptional("（02-template のズームアウト）", async () => {
      const imageContainer = page.locator(".cursor-crosshair").first()
      await expect(imageContainer).toBeVisible({ timeout: 10_000 })
      await imageContainer.evaluate((element: HTMLElement) => {
        element.setAttribute("tabindex", "-1")
        element.focus()
      })
      await page.waitForTimeout(200)
      for (let i = 0; i < 8; i++) {
        await page.keyboard.down("Control")
        await page.keyboard.press("Minus")
        await page.keyboard.up("Control")
        await page.waitForTimeout(100)
      }
      await page.waitForTimeout(500)
    })

    await ss(page, "ch2-exam-prep/14-scoring-regions.png")
  })

  test("2-6 領域情報", async () => {
    await nav(page, `/exams/${examId}/03-region-info`)
    await ss(page, "ch2-exam-prep/15-region-info.png")

    // 表は常時インライン編集で、ダブルクリックで編集に入る仕組みは無い。
    // ラベル欄に触れると行が選ばれ、左ペインの該当枠が色づく
    await captureOptional(
      "ch2-exam-prep/16-region-info-editing.png",
      async () => {
        const labelInput = page.locator('input[data-field="label"]').first()
        await expect(labelInput).toBeVisible({ timeout: 10_000 })
        await labelInput.click()
        await page.waitForTimeout(600)
        await ss(page, "ch2-exam-prep/16-region-info-editing.png")
      }
    )

    // 採点担当の対応表。参加者が2人以上のときだけ現れるタブ
    await captureOptional(
      "ch2-exam-prep/17-grader-assignment.png",
      async () => {
        await clickWhenReady(page.getByRole("tab", { name: "採点担当" }))
        await expect(page.getByText("設問ごとの採点担当")).toBeVisible()
        await page.waitForTimeout(800)
        await ss(page, "ch2-exam-prep/17-grader-assignment.png")
      }
    )
  })

  test("2-7 小計点設定（試験ごとの設問-小計マッピング）", async () => {
    await nav(page, `/exams/${examId}/04-question-group`)
    await page.waitForTimeout(1000)
    await ss(page, "ch2-exam-prep/18-subtotal-matrix.png")
  })

  test("2-8 受験生徒", async () => {
    await nav(page, `/exams/${examId}/05-students`)
    await ss(page, "ch2-exam-prep/19-exam-students.png")
  })

  test("2-9 通常アップロード経路（ASBを使わない試験作成）", async () => {
    // 第2の試験を作成（通常のアップロード経路を示す）
    simpleExamId = runSeedCommand("seedSimpleExam", [IDS.userId, classAId])

    // 試験一覧（2つの試験が並ぶ）
    await nav(page, "/exams")
    await ss(page, "ch2-exam-prep/20-exam-list.png")

    // 絞り込みと並べ替えは列見出しの popover に入っている（段階64）
    await captureOptional(
      "ch2-exam-prep/21-exam-list-column-filter.png",
      async () => {
        await openColumnFilter(page, "名前")
        await ss(page, "ch2-exam-prep/21-exam-list-column-filter.png")
        await page.keyboard.press("Escape")
        await page.waitForTimeout(300)
      }
    )

    // 通常試験の模範解答アップロードページ（空の状態 = ドラッグ&ドロップUI）
    await nav(page, `/exams/${simpleExamId}/01-upload`)
    await ss(page, "ch2-exam-prep/22-regular-upload-empty.png")

    // 通常試験の採点領域ページ（空の状態）
    await nav(page, `/exams/${simpleExamId}/02-template`)
    await page.waitForTimeout(1000)
    await ss(page, "ch2-exam-prep/23-regular-template-empty.png")
  })
})

// ===========================
// 第3章: 採点と出力
// ===========================

test.describe.serial("第3章: 採点と出力", () => {
  test("3-1 答案アップロード", async () => {
    await nav(page, `/exams/${examId}/06-student-answers`)
    await ss(page, "ch3-scoring/01-student-answers.png")
  })

  test("3-2 一括採点（一覧表示）", async () => {
    await nav(page, `/exams/${examId}/07-score-at-once`)
    await page.waitForTimeout(2000)

    // 入るたびに出る選択画面。これ自体も撮っておく
    await captureOptional("ch3-scoring/02-scoring-mode-modal.png", async () => {
      await expect(page.getByText("採点操作モードを選択")).toBeVisible({
        timeout: 15_000,
      })
      await ss(page, "ch3-scoring/02-scoring-mode-modal.png")
      await chooseScoringMode(page)
    })

    await captureOptional("ch3-scoring/03-scoring-grid.png", async () => {
      await showAllScoredAnswers(page)
      await ss(page, "ch3-scoring/03-scoring-grid.png")
    })
  })

  test("3-3 一括採点（個別表示）", async () => {
    await captureOptional("ch3-scoring/04-scoring-individual.png", async () => {
      await clickWhenReady(page.getByRole("button", { name: "個別表示" }))
      await page.waitForTimeout(2000)
      await ss(page, "ch3-scoring/04-scoring-individual.png")
    })
  })

  test("3-4 一括採点（キーボード操作の道具立て）", async () => {
    await captureOptional(
      "ch3-scoring/05-scoring-keyboard-help.png",
      async () => {
        // 一覧表示へ戻す（個別表示のままだと採点の道具立てが出ない）
        await clickWhenReady(page.getByRole("button", { name: "一覧表示" }))
        await page.waitForTimeout(1000)
        // ショートカット一覧を開くのはヘッダーの「キーボード」。側パネルにある
        // 同名のボタンは操作モードの切り替えなので、DOM で先に来るヘッダー側を採る
        await clickWhenReady(
          page.getByRole("button", { name: "キーボード", exact: true }).first()
        )
        await expect(
          page.getByRole("dialog", { name: "キーボードショートカット" })
        ).toBeVisible()
        await page.waitForTimeout(500)
        await ss(page, "ch3-scoring/05-scoring-keyboard-help.png")
        await page.keyboard.press("Escape")
        await page.waitForTimeout(300)
      }
    )
  })

  test("3-5 採点確定（食い違いの裁定）", async () => {
    await nav(page, `/exams/${examId}/08-finalize`)
    await page.waitForTimeout(1500)
    await ss(page, "ch3-scoring/06-finalize.png")

    // 設問を開いて裁定対象の生徒を選ぶと、右ペインに裁定フォームが出る
    await captureOptional("ch3-scoring/07-finalize-decision.png", async () => {
      await clickWhenReady(page.getByTitle("裁定対象を表示").first())
      await page.waitForTimeout(600)
      await clickWhenReady(
        page.locator("button").filter({ hasText: "食い違い" }).first()
      )
      await expect(page.getByText("出そろった結果")).toBeVisible({
        timeout: 15_000,
      })
      await page.waitForTimeout(600)
      await ss(page, "ch3-scoring/07-finalize-decision.png")
    })

    // 1件だけ実際に裁定する。確定は監査ログにも判定と得点の差分つきで残るので、
    // 監査ログの絵（4-7）が「試験を編集しました」だけにならない
    await captureOptional("（08 で1件を確定する）", async () => {
      await clickWhenReady(
        page.getByRole("button", { name: "この内容で確定する" })
      )
      await expect(page.getByText("確定済み 1件")).toBeVisible({
        timeout: 15_000,
      })
    })
  })

  test("3-6 結果出力", async () => {
    await nav(page, `/exams/${examId}/09-export`)
    await page.waitForTimeout(1500)
    // 画像の名前を「08」＋「-export」と綴らないこと。段の改名（結果の段は 09 へ
    // 移った）の取り残しを走査する規約テスト（`workflowStepDefinitions.test.ts` の
    // 「改名の取り残し」）が、その綴りをリポジトリ全体で禁じている
    await ss(page, "ch3-scoring/08-result-export.png")

    // 左のカード: 統計対象学級 / 生徒選択 / プレビュー
    const selectionTabs: [string, string][] = [
      ["統計対象学級", "ch3-scoring/09-export-class-stats.png"],
      ["生徒選択", "ch3-scoring/10-export-student-selection.png"],
    ]
    for (const [tabName, relativePath] of selectionTabs) {
      await captureOptional(relativePath, async () => {
        await clickWhenReady(page.getByRole("tab", { name: tabName }))
        await page.waitForTimeout(800)
        await ss(page, relativePath)
      })
    }

    // 右のカードで選んだ書き出しの種類が、左の「プレビュー」に何を出すかを決める。
    // 先に Excel を選ばないと、プレビューは答案PDFのままで表が出ない
    await captureOptional(
      "ch3-scoring/11-export-excel-options.png",
      async () => {
        await clickWhenReady(page.getByRole("tab", { name: "採点データExcel" }))
        await page.waitForTimeout(800)
        await ss(page, "ch3-scoring/11-export-excel-options.png")
      }
    )

    // プレビューの中にもう一段タブがある（点数一覧・正誤一覧・問題分析・S-P表・得点分布）
    await captureOptional(
      "ch3-scoring/12-export-preview-scores.png",
      async () => {
        await clickWhenReady(page.getByRole("tab", { name: "プレビュー" }))
        await expect(page.getByRole("tab", { name: "点数一覧" })).toBeVisible({
          timeout: 60_000,
        })
        await page.waitForTimeout(1000)
        await ss(page, "ch3-scoring/12-export-preview-scores.png")
      }
    )
    const previewTabs: [string, string][] = [
      ["正誤一覧", "ch3-scoring/13-export-preview-correctness.png"],
      ["問題分析", "ch3-scoring/14-export-preview-item-analysis.png"],
      ["S-P表", "ch3-scoring/15-export-preview-sp-table.png"],
      ["得点分布", "ch3-scoring/16-export-preview-distribution.png"],
    ]
    for (const [tabName, relativePath] of previewTabs) {
      await captureOptional(relativePath, async () => {
        await clickWhenReady(page.getByRole("tab", { name: tabName }))
        await page.waitForTimeout(800)
        await ss(page, relativePath)
      })
    }

    // 個人成績表の設定（箱ひげ図など、通知書に載せるものを選ぶ）
    await captureOptional(
      "ch3-scoring/17-export-individual-report.png",
      async () => {
        await clickWhenReady(page.getByRole("tab", { name: "個人成績表PDF" }))
        await page.waitForTimeout(800)
        await ss(page, "ch3-scoring/17-export-individual-report.png")
      }
    )
  })
})

// ===========================
// 第4章: 成績算出・試験外成績資料・その他
// ===========================

test.describe.serial("第4章: 成績算出・その他", () => {
  test("4-0 成績・資料データ追加", async () => {
    gradeId = runSeedCommand("seedGradeProject", [
      examId,
      studentIds,
      classAId,
      classBId,
      subtotalIds,
      TEMPLATE_PATH,
    ])
    courseworkId = runSeedCommand("seedCoursework", [
      studentIds,
      classAId,
      classBId,
    ])
  })

  test("4-1 成績算出", async () => {
    await nav(page, "/grades")
    await ss(page, "ch4-grades/01-grade-list.png")

    // 概要（旧 01-setup。フォルダごと畳まれて概要ページになった）
    await nav(page, `/grades/${gradeId}`)
    await ss(page, "ch4-grades/02-grade-overview.png")

    const gradeSteps: [string, string][] = [
      ["02-students", "ch4-grades/03-grade-students.png"],
      ["03-data-sources", "ch4-grades/04-grade-data-sources.png"],
      ["04-manual-scores", "ch4-grades/05-grade-manual-scores.png"],
      ["05-boundaries", "ch4-grades/06-grade-boundaries.png"],
    ]
    for (const [stepFolder, relativePath] of gradeSteps) {
      await nav(page, `/grades/${gradeId}/${stepFolder}`)
      await ss(page, relativePath)
    }
  })

  test("4-2 成績算出 - 結果", async () => {
    await nav(page, `/grades/${gradeId}/06-results`)
    await page.waitForTimeout(2000)
    await ss(page, "ch4-grades/07-grade-results.png")

    // 分布のタブは**成績項目の名前**（箱ひげ・問題分析はここには無い）
    await captureOptional("ch4-grades/08-grade-distribution.png", async () => {
      await clickWhenReady(page.getByRole("tab", { name: "思考・判断・表現" }))
      await page.waitForTimeout(800)
      await ss(page, "ch4-grades/08-grade-distribution.png")
    })
  })

  test("4-3 成績算出 - 出力", async () => {
    await nav(page, `/grades/${gradeId}/07-export`)
    await page.waitForTimeout(1000)
    await ss(page, "ch4-grades/09-grade-export-selection.png")

    await captureOptional(
      "ch4-grades/10-grade-export-preview.png",
      async () => {
        await clickWhenReady(page.getByRole("tab", { name: "プレビュー" }))
        await page.waitForTimeout(1500)
        await ss(page, "ch4-grades/10-grade-export-preview.png")
      }
    )
  })

  test("4-4 試験外成績資料", async () => {
    await nav(page, "/coursework")
    await ss(page, "ch4-grades/11-coursework-list.png")

    await nav(page, `/coursework/${courseworkId}`)
    await ss(page, "ch4-grades/12-coursework-overview.png")

    const courseworkSteps: [string, string][] = [
      ["02-students", "ch4-grades/13-coursework-students.png"],
      ["03-items", "ch4-grades/14-coursework-items.png"],
      ["04-scores", "ch4-grades/15-coursework-scores.png"],
      ["05-results", "ch4-grades/16-coursework-results.png"],
    ]
    for (const [stepFolder, relativePath] of courseworkSteps) {
      await nav(page, `/coursework/${courseworkId}/${stepFolder}`)
      await page.waitForTimeout(600)
      await ss(page, relativePath)
    }
  })

  test("4-5 PDF加工", async () => {
    await nav(page, "/pdf-tools")
    await ss(page, "ch4-grades/17-pdf-tools.png")
  })

  test("4-6 設定", async () => {
    await nav(page, "/settings")
    await ss(page, "ch4-grades/18-settings-keyboard.png")

    const settingsTabs: [string, string][] = [
      ["画面制御", "ch4-grades/19-settings-screen.png"],
      ["表示設定", "ch4-grades/20-settings-display.png"],
      ["年度", "ch4-grades/21-settings-fiscal-year.png"],
      ["ユーザー管理", "ch4-grades/22-settings-user.png"],
      ["同期設定", "ch4-grades/23-settings-sync.png"],
    ]
    for (const [tabName, relativePath] of settingsTabs) {
      await captureOptional(relativePath, async () => {
        await clickWhenReady(page.getByRole("tab", { name: tabName }))
        await page.waitForTimeout(600)
        await ss(page, relativePath)
      })
    }
  })

  test("4-7 監査ログ", async () => {
    // ここまでの UI 操作（試験の作成・名前や日付の書き換え・学級追加・タグ付け・
    // 領域情報の編集）が記録されている。種を直に入れて水増しはしない
    await nav(page, "/audit-logs")
    await page.waitForTimeout(1000)
    await ss(page, "ch4-grades/24-audit-logs.png")
  })

  test("4-8 生徒の詳細", async () => {
    await nav(page, `/students/${studentIds[0]}`)
    await page.waitForTimeout(1500)
    await ss(page, "ch4-grades/25-student-detail.png")

    await captureOptional(
      "ch4-grades/26-student-detail-membership.png",
      async () => {
        await clickWhenReady(page.getByRole("tab", { name: "学級所属" }))
        await page.waitForTimeout(800)
        await ss(page, "ch4-grades/26-student-detail-membership.png")
      }
    )
  })
})

// ===========================
// ヒーロー画像（1920x1080ワイドショット）
// ===========================

test.describe.serial("ヒーロー画像", () => {
  test("hero images", async () => {
    // **ここだけは `setViewportSize()` を使う。** 1920 はこの開発機の画面より広く、
    // ウインドウを実際にその大きさにはできない。描くだけなら CDP の上書きで作れる
    // ので、幅を採って倍率を諦める（この5枚は1倍で焼き上がる）。上書きは以降ずっと
    // 効くので、**章を全部撮り終えた最後に置くこと**。
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(500)

    // 一括採点ワイドショット
    await nav(page, `/exams/${examId}/07-score-at-once`)
    await page.waitForTimeout(2500)
    await captureOptional("hero/01-scoring-wide.png", async () => {
      await showAllScoredAnswers(page)
      await ss(page, "hero/01-scoring-wide.png")
    })

    // 解答用紙エディタ
    await nav(page, `/answer-sheet-builder/${IDS.asbDefId}/01-edit`)
    await page.waitForTimeout(1500)
    await ss(page, "hero/02-answer-sheet-builder.png")

    // 成績結果
    await nav(page, `/grades/${gradeId}/06-results`)
    await page.waitForTimeout(1500)
    await ss(page, "hero/03-grade-results.png")

    // 試験一覧
    await nav(page, "/exams")
    await ss(page, "hero/04-exam-list.png")

    // 生徒一覧
    await nav(page, "/students")
    await ss(page, "hero/05-student-list.png")
  })
})

// ===========================
// 取りこぼしの一覧
// ===========================

test.describe.serial("撮影の取りこぼし", () => {
  test("撮れなかった画面が無いこと", async () => {
    if (missedCaptures.length === 0) {
      console.log("\n=== 取りこぼし なし ===")
      return
    }
    const missedList = missedCaptures
      .map((missed) => `  - ${missed.relativePath}\n      ${missed.reason}`)
      .join("\n")
    throw new Error(
      `撮れなかったものが ${missedCaptures.length} 件あります:\n${missedList}\n\n` +
        `UI が変わって掴めなくなったのか、機能そのものが無くなったのかを見てから、` +
        `spec を直すか対象から外してください。`
    )
  })
})
