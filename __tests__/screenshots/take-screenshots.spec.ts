/**
 * 全画面スクリーンショット自動撮影
 *
 * 前提:
 *   1. npx tsx __tests__/screenshots/setup-data.ts を実行済み
 *   2. Next.js dev server が localhost:3000 で起動中
 *
 * 実行:
 *   npx playwright test --config=playwright.screenshot.config.ts
 *
 * 専用DB (__tests__/screenshots/data/database.db) を使用。データには一切触れない。
 *
 * ストーリー:
 *   空の状態からUIを操作しながら段階的にデータを追加。
 *   操作 → 結果 が一致するよう撮影する。
 */

import { test } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import type { ElectronApplication, Page } from "playwright"
import { _electron as electron } from "playwright"

import {
  disconnectPrisma,
  seedClasses,
  seedExamWithScoring,
  seedGradeProject,
  seedSimpleExam,
  seedStudents,
  seedSubtotalAndTag,
} from "./helpers/seed-in-test"

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
const SCREENSHOTS_DIR = path.resolve(__dirname, "output")
const PROJECT_ROOT = path.resolve(__dirname, "../..")
const TEST_DATA_DIR = path.join(__dirname, "data")
const SCREENSHOT_DB = path.join(TEST_DATA_DIR, "database.db")
const IDS_FILE = path.join(TEST_DATA_DIR, "screenshot-ids.json")
const TEMPLATE_PATH = path.join(TEST_DATA_DIR, "asb-template.json")
const BASE_URL = "http://localhost:3000"

function loadIds(): { userId: string; asbDefId: string } {
  if (!fs.existsSync(IDS_FILE)) {
    throw new Error(
      `${IDS_FILE} が見つかりません。先に npx tsx tests/screenshots/setup-data.ts を実行してください。`
    )
  }
  return JSON.parse(fs.readFileSync(IDS_FILE, "utf-8"))
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
  await page.screenshot({
    path: fullPath,
    fullPage: false,
    type: relativePath.endsWith(".jpeg") ? "jpeg" : "png",
    quality: relativePath.endsWith(".jpeg") ? 90 : undefined,
  })
  console.log(`  [OK] ${relativePath}`)
}

async function nav(page: Page, urlPath: string) {
  await page.goto(`${BASE_URL}${urlPath}`)
  await waitForReady(page)
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

test.beforeAll(async () => {
  IDS = loadIds()
  console.log("=== Screenshot Test ===")
  console.log(`ASB: ${IDS.asbDefId}\n`)

  if (!fs.existsSync(SCREENSHOT_DB)) {
    throw new Error(
      "専用DB が見つかりません。setup-data.ts を先に実行してください。"
    )
  }

  electronApp = await electron.launch({
    args: [path.join(PROJECT_ROOT, "main/electron-src/index.js")],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      NODE_ENV: "development",
      SCORE_AT_ONCE_DATA_DIR: TEST_DATA_DIR,
    },
    timeout: 60000,
  })

  page = await electronApp.firstWindow({ timeout: 60000 })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 })
  await page.waitForTimeout(3000)

  // ログイン
  await page.goto(`${BASE_URL}/login`)
  await waitForReady(page)
  try {
    await page.getByText("山田 太郎").first().click({ timeout: 10000 })
    await page.waitForTimeout(2000)
    console.log("Logged in\n")
  } catch {
    console.warn("Login warning: user card not found\n")
  }
})

test.afterAll(async () => {
  await disconnectPrisma()
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
    // (A) 空の生徒一覧を表示
    await nav(page, "/students")
    await ss(page, "ch1-setup/02-student-list.png")

    // (B) 表形式インポートダイアログ（セルにデータ入力）
    try {
      await page.getByRole("button", { name: "表形式インポート" }).click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(500)

      const firstInput = page
        .locator('[role="dialog"] table tbody input')
        .first()
      if (await firstInput.isVisible({ timeout: 2000 })) {
        await firstInput.click()
        await firstInput.fill("S001")
        await page.keyboard.press("Tab")
        await page.keyboard.insertText("佐藤")
        await page.keyboard.press("Tab")
        await page.keyboard.insertText("翔太")
        await page.keyboard.press("Tab")
        await page.keyboard.insertText("サトウ")
        await page.keyboard.press("Tab")
        await page.keyboard.insertText("ショウタ")
        await page.keyboard.press("Tab")
        await page.keyboard.insertText("2025")
      }
      await page.waitForTimeout(300)
      await ss(page, "ch1-setup/03-import-dialog.png")
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)
    } catch (e) {
      console.warn(
        "  [SKIP] Import dialog:",
        (e as Error).message?.slice(0, 80)
      )
    }

    // (C) 生徒追加ダイアログ
    try {
      await page.getByRole("button", { name: "生徒追加" }).click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(300)
      const fills: [string, string][] = [
        ["学籍番号", "S001"],
        ["姓", "佐藤"],
        ["名", "翔太"],
        ["セイ", "サトウ"],
        ["メイ", "ショウタ"],
      ]
      for (const [label, value] of fills) {
        try {
          const input = page.getByLabel(label).first()
          if (await input.isVisible({ timeout: 500 })) await input.fill(value)
        } catch {
          // skip
        }
      }
      await page.waitForTimeout(200)
      await ss(page, "ch1-setup/04-add-student-dialog.png")
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)
    } catch (e) {
      console.warn(
        "  [SKIP] Add student dialog:",
        (e as Error).message?.slice(0, 80)
      )
    }

    // (D) DB直接操作で40名追加 → 一覧リロード
    studentIds = await seedStudents()
    await nav(page, "/students")
    // 追加後の一覧（スクリーンショットは02で撮影済み、ここでは更新不要）
  })

  test("1-3 学級管理", async () => {
    // (A) 空の学級一覧
    await nav(page, "/classrooms")
    await ss(page, "ch1-setup/05-class-list.png")

    // (B) 学級追加ダイアログ（入力あり）
    try {
      await page.getByRole("button", { name: "学級追加" }).click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(300)
      const nameInput = page.getByLabel("学級名").first()
      if (await nameInput.isVisible({ timeout: 1000 })) {
        await nameInput.fill("2年A組")
      }
      try {
        const gradeInput = page.getByLabel("学年").first()
        if (await gradeInput.isVisible({ timeout: 500 })) {
          await gradeInput.fill("2")
        }
      } catch {
        /* skip */
      }
      await ss(page, "ch1-setup/06-add-class-dialog.png")
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)
    } catch (e) {
      console.warn(
        "  [SKIP] Add class dialog:",
        (e as Error).message?.slice(0, 80)
      )
    }

    // (C) DB直接操作で2クラス作成
    const classroomResult = await seedClasses(studentIds)
    classAId = classroomResult.classAId
    classBId = classroomResult.classBId

    // (D) 作成後の学級一覧
    await nav(page, "/classrooms")
    await ss(page, "ch1-setup/07-class-list-updated.png")

    // (E) UIで2年C組を追加（空のクラス）
    let newClassCreated = false
    try {
      await page.getByRole("button", { name: "学級追加" }).click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(300)
      const nameInput = page.getByLabel("学級名").first()
      if (await nameInput.isVisible({ timeout: 1000 })) {
        await nameInput.fill("2年C組")
      }
      try {
        const gradeInput = page.getByLabel("学年").first()
        if (await gradeInput.isVisible({ timeout: 500 })) {
          await gradeInput.fill("2")
        }
      } catch {
        /* skip */
      }
      const saveBtn = page
        .locator('[role="dialog"]')
        .getByRole("button", { name: "保存" })
      if (await saveBtn.isVisible({ timeout: 500 })) {
        await saveBtn.click()
        await page.waitForTimeout(1500)
        newClassCreated = true
      }
    } catch (e) {
      console.warn(
        "  [SKIP] Create 2年C組:",
        (e as Error).message?.slice(0, 80)
      )
      try {
        await page.keyboard.press("Escape")
      } catch {
        /* */
      }
    }

    // (F) 空のクラス詳細
    if (newClassCreated) {
      try {
        await nav(page, "/classrooms")
        const newClassLink = page.getByText("2年C組").first()
        if (await newClassLink.isVisible({ timeout: 2000 })) {
          await newClassLink.click()
          await waitForReady(page)
          await ss(page, "ch1-setup/08-class-empty.png")
        }
      } catch (e) {
        console.warn(
          "  [SKIP] New class detail:",
          (e as Error).message?.slice(0, 80)
        )
      }
    }

    // (G) 2年A組の詳細（生徒が20名いる）
    await nav(page, `/classrooms/${classAId}`)
    await ss(page, "ch1-setup/09-class-with-students.png")
  })

  test("1-4 小計グループ管理", async () => {
    // (A) 空の小計グループ一覧
    await nav(page, "/subtotal-groups")
    await ss(page, "ch1-setup/10-subtotal-groups.png")

    // (B) 新規作成ダイアログ（グループ名 + 項目を入力した状態）
    try {
      await page
        .getByRole("button", { name: "最初のグループを作成" })
        .first()
        .click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(300)

      const nameInput = page.getByLabel("グループ名").first()
      if (await nameInput.isVisible({ timeout: 1000 })) {
        await nameInput.fill("観点別評価")
      }

      const itemNames = [
        "知識・技能",
        "思考・判断・表現",
        "主体的に学習に取り組む態度",
      ]
      for (let i = 0; i < itemNames.length; i++) {
        try {
          const addItemBtn = page
            .locator('[role="dialog"]')
            .getByRole("button")
            .filter({ hasText: /項目を追加/ })
            .first()
          if (await addItemBtn.isVisible({ timeout: 500 })) {
            await addItemBtn.click()
            await page.waitForTimeout(200)
          }
          const itemInputs = page.locator(
            '[role="dialog"] input[placeholder="小計項目名"]'
          )
          const lastInput = itemInputs.nth(i)
          if (await lastInput.isVisible({ timeout: 500 })) {
            await lastInput.fill(itemNames[i])
          }
        } catch {
          /* skip */
        }
      }

      await page.waitForTimeout(300)
      await ss(page, "ch1-setup/11-add-subtotal-group-dialog.png")
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)
    } catch (e) {
      console.warn(
        "  [SKIP] Add subtotal dialog:",
        (e as Error).message?.slice(0, 80)
      )
    }

    // (C) DB直接操作で小計グループ + 教科を追加
    const subtotalResult = await seedSubtotalAndTag()
    subtotalGroupId = subtotalResult.subtotalGroupId
    subtotalIds = subtotalResult.subtotalIds

    // (D) 作成後の一覧
    await nav(page, "/subtotal-groups")
    await ss(page, "ch1-setup/12-subtotal-group-created.png")
  })
})

// ===========================
// 第2章: 試験準備
// ===========================

test.describe.serial("第2章: 試験準備", () => {
  test("2-1 解答用紙ビルダー", async () => {
    // テンプレート一覧
    await nav(page, "/answer-sheet-builder")
    await ss(page, "ch2-exam-prep/01-asb-list.png")

    // エディタ: 問題構成タブ
    await nav(page, `/answer-sheet-builder/${IDS.asbDefId}`)
    await waitForReady(page)
    await page.waitForTimeout(2000)
    await ss(page, "ch2-exam-prep/02-asb-editor.png")

    // === ASBのPNG書き出し機能でマスター画像を生成 ===
    // 注: examIdはまだ無い。一時ディレクトリに保存し、試験作成後にコピー。
    const tempMasterDir = path.join(TEST_DATA_DIR, "temp-master")
    fs.mkdirSync(tempMasterDir, { recursive: true })
    const tempMasterPath = path.join(tempMasterDir, "master-page-1.png")

    try {
      await electronApp.evaluate(({ ipcMain }, outputPath) => {
        ipcMain.removeHandler("asb:select-save-path")
        ipcMain.handle("asb:select-save-path", async () => {
          return { success: true, filePath: outputPath }
        })
      }, tempMasterPath)

      await page.getByRole("button", { name: "出力" }).first().click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(300)

      const dpiInput = page.locator('[role="dialog"] input[type="number"]')
      if (await dpiInput.isVisible({ timeout: 1000 })) {
        await dpiInput.fill("200")
      }

      await ss(page, "ch2-exam-prep/03-asb-export-dialog.png")

      const pngBtn = page
        .locator('[role="dialog"]')
        .getByText("PNG出力")
        .first()
      await pngBtn.click()
      await page.waitForTimeout(5000)

      if (fs.existsSync(tempMasterPath)) {
        console.log("  [OK] ASB PNG書き出し → temp-master/ に保存")
      } else {
        console.warn("  [WARN] PNG書き出し後にファイルが見つかりません")
      }
    } catch (e) {
      console.warn(
        "  [WARN] ASB PNG書き出し失敗:",
        (e as Error).message?.slice(0, 100)
      )
    }

    // 用紙設定タブ
    try {
      const paperTab = page
        .getByRole("tab")
        .filter({ hasText: /用紙設定/ })
        .first()
      if (await paperTab.isVisible({ timeout: 1000 })) {
        await paperTab.click()
        await page.waitForTimeout(500)
        await ss(page, "ch2-exam-prep/03-asb-paper-settings.png")
      }
    } catch {
      console.warn("  [SKIP] Paper settings tab")
    }

    // ヘッダータブ
    try {
      const headerTab = page
        .getByRole("tab")
        .filter({ hasText: /ヘッダー/ })
        .first()
      if (await headerTab.isVisible({ timeout: 1000 })) {
        await headerTab.click()
        await page.waitForTimeout(500)
        await ss(page, "ch2-exam-prep/04-asb-header.png")
      }
    } catch {
      console.warn("  [SKIP] Header tab")
    }

    // 罫線タブ
    try {
      const borderTab = page
        .getByRole("tab")
        .filter({ hasText: /罫線/ })
        .first()
      if (await borderTab.isVisible({ timeout: 1000 })) {
        await borderTab.click()
        await page.waitForTimeout(500)
        await ss(page, "ch2-exam-prep/05-asb-borders.png")
      }
    } catch {
      console.warn("  [SKIP] Border tab")
    }

    // OMRタブ
    try {
      const omrTab = page.getByRole("tab").filter({ hasText: /OMR/ }).first()
      if (await omrTab.isVisible({ timeout: 1000 })) {
        await omrTab.click()
        await page.waitForTimeout(500)
        await ss(page, "ch2-exam-prep/06-asb-omr.png")
      }
    } catch {
      console.warn("  [SKIP] OMR tab")
    }
  })

  test("2-2 試験作成", async () => {
    // (A) 空の試験一覧
    await nav(page, "/exams")
    await ss(page, "ch2-exam-prep/07-exam-list.png")

    // (B) 新規試験作成ダイアログ（入力あり → 閉じる）
    try {
      await page.getByRole("button", { name: "新規試験作成" }).click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(300)

      const examNameInput = page.getByLabel("試験名").first()
      if (await examNameInput.isVisible({ timeout: 1000 })) {
        await examNameInput.fill("第２回定期テスト 中２数学")
      }

      try {
        const dateInput = page.getByLabel("試験日").first()
        if (await dateInput.isVisible({ timeout: 500 })) {
          await dateInput.fill("2025-10-15")
        }
      } catch {
        /* skip */
      }

      try {
        const descInput = page.getByLabel("説明").first()
        if (await descInput.isVisible({ timeout: 500 })) {
          await descInput.fill("一次関数・連立方程式の範囲")
        }
      } catch {
        /* skip */
      }

      try {
        const subjectInput = page.getByPlaceholder("科目を入力").first()
        if (await subjectInput.isVisible({ timeout: 500 })) {
          await subjectInput.fill("数学")
          await page.keyboard.press("Enter")
          await page.waitForTimeout(200)
        }
      } catch {
        /* skip */
      }

      await page.waitForTimeout(300)
      await ss(page, "ch2-exam-prep/08-new-exam-dialog.png")
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)
    } catch (e) {
      console.warn(
        "  [SKIP] New exam dialog:",
        (e as Error).message?.slice(0, 80)
      )
    }

    // (C) DB直接操作で試験 + 採点領域 + 答案 + 採点結果を追加
    examId = await seedExamWithScoring(
      IDS.userId,
      studentIds,
      classAId,
      classBId,
      subtotalGroupId,
      subtotalIds,
      TEMPLATE_PATH
    )

    // ASBで書き出したマスター画像を試験ディレクトリにコピー & 答案画像を再生成
    const tempMasterPath = path.join(
      TEST_DATA_DIR,
      "temp-master",
      "master-page-1.png"
    )
    if (fs.existsSync(tempMasterPath)) {
      const masterDir = path.join(
        TEST_DATA_DIR,
        "exams",
        examId,
        "master-images"
      )
      fs.mkdirSync(masterDir, { recursive: true })
      const destMasterPath = path.join(masterDir, "master-page-1.png")
      fs.copyFileSync(tempMasterPath, destMasterPath)

      // ASBマスター画像ベースで答案画像を再生成（手書き付き）
      const { regenerateAnswerImages } = await import("./helpers/seed-in-test")
      await regenerateAnswerImages(examId, studentIds, TEMPLATE_PATH, masterDir)
      console.log("  [OK] ASB PNG → マスター画像 + 答案画像を再生成")
    }

    // (D) 試験詳細
    await nav(page, `/exams/${examId}`)
    await ss(page, "ch2-exam-prep/09-exam-detail.png")
  })

  test("2-3 模範解答アップロード（ASBから変換済み）", async () => {
    // ASBから変換した試験 → 模範解答は自動セット済み
    await nav(page, `/exams/${examId}/01-upload`)
    await ss(page, "ch2-exam-prep/10-master-upload.png")
  })

  test("2-4 採点領域作成（ASBから自動生成済み）", async () => {
    await nav(page, `/exams/${examId}/02-template`)
    await page.waitForTimeout(1500)

    // ヘルプポップアップを閉じる
    try {
      const closeHelp = page.getByLabel("ヘルプを閉じる").first()
      if (await closeHelp.isVisible({ timeout: 1000 })) {
        await closeHelp.click()
        await page.waitForTimeout(300)
      }
    } catch {
      /* skip */
    }

    // imageContainerRef divにtabindexを付与してフォーカス → Ctrl+-でズームアウト
    try {
      const imgContainer = page.locator(".cursor-crosshair").first()
      if (await imgContainer.isVisible({ timeout: 1000 })) {
        await imgContainer.evaluate((el: HTMLElement) => {
          el.setAttribute("tabindex", "-1")
          el.focus()
        })
        await page.waitForTimeout(200)
        for (let i = 0; i < 8; i++) {
          await page.keyboard.down("Control")
          await page.keyboard.press("Minus")
          await page.keyboard.up("Control")
          await page.waitForTimeout(100)
        }
        await page.waitForTimeout(500)
      }
    } catch (e) {
      console.warn("  [WARN] Zoom out:", (e as Error).message?.slice(0, 80))
    }

    await ss(page, "ch2-exam-prep/11-scoring-regions.png")
  })

  test("2-5 領域情報", async () => {
    await nav(page, `/exams/${examId}/03-region-info`)
    await ss(page, "ch2-exam-prep/12-region-info.png")

    try {
      const firstLabelCell = page
        .locator("table tbody tr")
        .first()
        .locator("td")
        .nth(1)
      if (await firstLabelCell.isVisible()) {
        await firstLabelCell.dblclick()
        await page.waitForTimeout(300)
        await ss(page, "ch2-exam-prep/13-region-editing.png")
        await page.keyboard.press("Escape")
      }
    } catch {
      console.warn("  [SKIP] Label editing")
    }
  })

  test("2-6 小計点設定（試験ごとの設問-小計マッピング）", async () => {
    // グローバル小計グループの項目と、各設問の対応を設定する画面
    await nav(page, `/exams/${examId}/04-question-group`)
    await waitForReady(page)
    await page.waitForTimeout(1000)
    await ss(page, "ch2-exam-prep/14-subtotal-matrix.png")
  })

  test("2-7 受験生徒", async () => {
    await nav(page, `/exams/${examId}/05-students`)
    await waitForReady(page)
    await ss(page, "ch2-exam-prep/15-exam-students.png")
  })

  test("2-8 通常アップロード経路（ASBを使わない試験作成）", async () => {
    // 第2の試験を作成（通常のアップロード経路を示す）
    simpleExamId = await seedSimpleExam(IDS.userId, classAId)

    // 試験一覧（2つの試験が並ぶ）
    await nav(page, "/exams")
    await ss(page, "ch2-exam-prep/16-exam-list-two.png")

    // 通常試験の模範解答アップロードページ（空の状態 = ドラッグ&ドロップUI）
    await nav(page, `/exams/${simpleExamId}/01-upload`)
    await waitForReady(page)
    await ss(page, "ch2-exam-prep/17-regular-upload-empty.png")

    // 通常試験の採点領域ページ（空の状態）
    await nav(page, `/exams/${simpleExamId}/02-template`)
    await waitForReady(page)
    await page.waitForTimeout(1000)
    await ss(page, "ch2-exam-prep/18-regular-template-empty.png")
  })
})

// ===========================
// 第3章: 試験ワークフロー（採点・出力）
// ===========================

test.describe.serial("第3章: 試験ワークフロー", () => {
  test("3-1 答案アップロード", async () => {
    await nav(page, `/exams/${examId}/06-student-answers`)
    await waitForReady(page)
    await ss(page, "ch3-scoring/01-answer-sheets.png")
  })

  test("3-2 一括採点（一覧表示）", async () => {
    await nav(page, `/exams/${examId}/07-score-at-once`)
    await waitForReady(page)
    await page.waitForTimeout(2000)

    // フィルターを全てONにして全答案を表示
    try {
      const filterSection = page
        .locator("text=フィルター")
        .first()
        .locator("..")
        .locator("..")
      const filterGrid = filterSection.locator(".grid")
      const filterButtons = filterGrid.getByRole("button")
      const count = await filterButtons.count()
      for (let i = 1; i < count; i++) {
        await filterButtons.nth(i).click()
        await page.waitForTimeout(150)
      }
      await page.waitForTimeout(500)
    } catch (e) {
      console.warn(
        "  [WARN] Filter toggle:",
        (e as Error).message?.slice(0, 80)
      )
    }
    await ss(page, "ch3-scoring/02-scoring-grid.png")
  })

  test("3-3 一括採点（個別表示）", async () => {
    try {
      const individualBtn = page
        .getByRole("button")
        .filter({ hasText: /個別表示/ })
        .first()
      if (await individualBtn.isVisible({ timeout: 1000 })) {
        await individualBtn.click()
        await page.waitForTimeout(1500)
        await ss(page, "ch3-scoring/03-individual-view.png")
      }
    } catch {
      console.warn("  [SKIP] Individual view")
    }
  })

  test("3-4 一括採点（キーボードモード）", async () => {
    try {
      const kbBtn = page
        .getByRole("button")
        .filter({ hasText: /キーボード/ })
        .first()
      if (await kbBtn.isVisible({ timeout: 1000 })) {
        await kbBtn.click()
        await page.waitForTimeout(1500)
        await ss(page, "ch3-scoring/04-keyboard-mode.png")
      }
    } catch {
      console.warn("  [SKIP] Keyboard mode")
    }
  })

  test("3-5 結果", async () => {
    await nav(page, `/exams/${examId}/09-export`)
    await waitForReady(page)
    await ss(page, "ch3-scoring/05-results.png")
  })
})

// ===========================
// 第4章: 成績算出・その他
// ===========================

test.describe.serial("第4章: 成績算出・その他", () => {
  test("4-0 成績データ追加", async () => {
    // DB直接操作で成績算出プロジェクトを追加
    gradeId = await seedGradeProject(
      examId,
      studentIds,
      classAId,
      classBId,
      subtotalIds,
      TEMPLATE_PATH
    )
  })

  test("4-1 成績算出 - 一覧", async () => {
    await nav(page, "/grades")
    await ss(page, "ch4-grades/01-grade-list.png")
  })

  test("4-2 成績算出 - 基本設定", async () => {
    await nav(page, `/grades/${gradeId}/01-setup`)
    await ss(page, "ch4-grades/02-setup.png")
  })

  test("4-3 成績算出 - 対象生徒", async () => {
    await nav(page, `/grades/${gradeId}/02-students`)
    await ss(page, "ch4-grades/03-students.png")
  })

  test("4-4 成績算出 - データソース", async () => {
    await nav(page, `/grades/${gradeId}/03-data-sources`)
    await ss(page, "ch4-grades/04-data-sources.png")
  })

  test("4-5 成績算出 - 外部成績", async () => {
    await nav(page, `/grades/${gradeId}/04-manual-scores`)
    await ss(page, "ch4-grades/05-manual-scores.png")
  })

  test("4-6 成績算出 - 成績境界", async () => {
    await nav(page, `/grades/${gradeId}/05-boundaries`)
    await ss(page, "ch4-grades/06-boundaries.png")
  })

  test("4-7 成績算出 - 結果", async () => {
    await nav(page, `/grades/${gradeId}/06-results`)
    await page.waitForTimeout(1500)
    await ss(page, "ch4-grades/07-results.png")

    try {
      const boxPlotTab = page
        .getByRole("tab")
        .filter({ hasText: /箱ひげ/ })
        .first()
      if (await boxPlotTab.isVisible({ timeout: 1000 })) {
        await boxPlotTab.click()
        await page.waitForTimeout(800)
        await ss(page, "ch4-grades/08-box-plot.png")
      }
    } catch {
      console.warn("  [SKIP] Box plot")
    }

    try {
      const analysisTab = page
        .getByRole("tab")
        .filter({ hasText: /問題分析|分析/ })
        .first()
      if (await analysisTab.isVisible({ timeout: 1000 })) {
        await analysisTab.click()
        await page.waitForTimeout(800)
        await ss(page, "ch4-grades/09-question-analysis.png")
      }
    } catch {
      console.warn("  [SKIP] Question analysis")
    }
  })

  test("4-8 成績算出 - 出力", async () => {
    await nav(page, `/grades/${gradeId}/07-export`)
    await ss(page, "ch4-grades/10-export.png")
  })

  test("4-9 PDF加工", async () => {
    await nav(page, "/pdf-tools")
    await waitForReady(page)
    await ss(page, "ch4-grades/11-pdf-tools.png")
  })

  test("4-10 設定", async () => {
    await nav(page, "/settings")
    await waitForReady(page)
    await ss(page, "ch4-grades/12-settings.png")

    const tabNames = ["表示", "ユーザー", "データ"]
    for (let i = 0; i < tabNames.length; i++) {
      try {
        const tab = page
          .getByRole("tab")
          .filter({ hasText: new RegExp(tabNames[i]) })
          .first()
        if (await tab.isVisible({ timeout: 500 })) {
          await tab.click()
          await page.waitForTimeout(500)
          await ss(page, `ch4-grades/13-settings-${tabNames[i]}.png`)
        }
      } catch {
        /* skip */
      }
    }
  })
})

// ===========================
// ヒーロー画像（1920x1080ワイドショット）
// ===========================

test.describe.serial("ヒーロー画像", () => {
  test("hero images", async () => {
    await page.setViewportSize({ width: 1920, height: 1080 })

    // 一括採点ワイドショット
    await nav(page, `/exams/${examId}/07-score-at-once`)
    await page.waitForTimeout(2500)
    // フィルターを全ONにして答案を表示
    try {
      const filterSection = page
        .locator("text=フィルター")
        .first()
        .locator("..")
        .locator("..")
      const filterGrid = filterSection.locator(".grid")
      const filterButtons = filterGrid.getByRole("button")
      const count = await filterButtons.count()
      for (let i = 1; i < count; i++) {
        await filterButtons.nth(i).click()
        await page.waitForTimeout(150)
      }
      await page.waitForTimeout(500)
    } catch {
      /* skip */
    }
    await ss(page, "hero/01-scoring-wide.png")

    // 解答用紙エディタ
    await nav(page, `/answer-sheet-builder/${IDS.asbDefId}`)
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

    await page.setViewportSize({ width: 1440, height: 900 })
  })
})
