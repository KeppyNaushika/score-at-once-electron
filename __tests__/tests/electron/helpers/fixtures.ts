/**
 * e2e が使う下ごしらえ（試験・模範解答・資料）。
 *
 * 全て画面から作る。DB へ直接書くと、画面が実際に通る経路を確かめられない。
 */
import { expect, type Page } from "@playwright/test"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { E2E_BASE_URL } from "./rendererPort"

const ROOT = path.resolve(__dirname, "../../../..")

/**
 * 試験を1件作り、その id を返す。
 *
 * **作成ダイアログは無い**（段階66）。「新規試験作成」を押すと既定値の1件が
 * その場で作られ、概要ページへ直行する。名前はそこで付ける（1打鍵ごとに書くので
 * 「保存」は押さない）。
 */
export async function createExam(page: Page, name: string): Promise<string> {
  await page.goto(`${E2E_BASE_URL}/exams`, { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "新規試験作成" }).click()

  await expect(page).toHaveURL(/\/exams\/[0-9a-f-]{36}$/, { timeout: 15_000 })
  const examId = /\/exams\/([0-9a-f-]{36})/.exec(page.url())?.[1]
  if (!examId)
    throw new Error(`試験の id を URL から取れなかった: ${page.url()}`)

  await page.getByLabel("試験名").fill(name)
  // 書けたことは、ヘッダーの題（同じ試験を別のクエリで取り直したもの）で待つ
  await expect(page.getByRole("heading", { name })).toBeVisible({
    timeout: 15_000,
  })
  return examId
}

/** 模範解答を1枚アップロードする（PDF変換を避けたいので画像を使う） */
export async function uploadMasterPage(
  page: Page,
  examId: string
): Promise<void> {
  await page.goto(`${E2E_BASE_URL}/exams/${examId}/01-upload`, {
    waitUntil: "domcontentloaded",
  })

  const source = path.join(ROOT, "public/icons/icon_256x256.png")
  const fallback = path.join(ROOT, "public/icons/icon.iconset/icon_256x256.png")
  const imagePath = fs.existsSync(source) ? source : fallback
  const uploaded = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "score-at-once-fixture-")),
    "master.png"
  )
  fs.copyFileSync(imagePath, uploaded)

  await page.locator('input[type="file"]').first().setInputFiles(uploaded)

  // 取り込みが終わるとページが1枚出る。
  //
  // かつては「次へ」が出たことを合図にしていたが、**「次へ」はヘッダーが常に
  // 出す**ようになったので合図にならない（取り込み前から見えている）。
  // 枚数の見出しで数える。
  await expect(page.getByText("模範解答 (1ページ)")).toBeVisible({
    timeout: 60_000,
  })
}

/** 試験外成績資料を1件作り、その id を返す */
export async function createCoursework(
  page: Page,
  name: string
): Promise<string> {
  await page.goto(`${E2E_BASE_URL}/coursework`, {
    waitUntil: "domcontentloaded",
  })
  await page.getByRole("button", { name: "新規作成" }).click()

  // 作成ダイアログは無い。既定値の1件ができて概要ページへ移り、名前はそこで付ける
  await expect(page).toHaveURL(/\/coursework\/[0-9a-f-]{36}$/, {
    timeout: 15_000,
  })
  const courseworkId = /\/coursework\/([0-9a-f-]{36})/.exec(page.url())?.[1]
  if (!courseworkId) {
    throw new Error(`資料の id を URL から取れなかった: ${page.url()}`)
  }

  await page.getByLabel("資料名").fill(name)
  await expect(page.getByRole("heading", { name })).toBeVisible({
    timeout: 15_000,
  })
  return courseworkId
}
