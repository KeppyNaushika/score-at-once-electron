/**
 * 解答用紙作成（ASB）の e2e
 *
 * 「新規インストールで『新規作成』が無反応」というバグを実アプリで再現・検証する。
 * 根本原因は2つ:
 *   1. DB初期化がファイル有無判定の競合でクラッシュ（bootstrapSchema で解消）
 *   2. AsbDefinition の原稿用紙罫線4列が migration 取りこぼしで欠落し
 *      saveDefinition が ColumnNotFound で失敗（20260725000000 migration で復元）
 * 空のデータディレクトリ（＝新規インストール）で「新規作成」がエディタへ遷移することを確認する。
 */
import { expect, test } from "@playwright/test"
import * as fs from "fs"

import { launchApp, type LaunchedApp, loginAsAdmin } from "./helpers/launchApp"

let launched: LaunchedApp

test.afterEach(async () => {
  if (launched) await launched.close()
})

test("新規インストールで解答用紙の新規作成がエディタへ遷移する", async () => {
  launched = await launchApp()
  const { page, dataDir } = launched

  // DB初期化が成功し database.db が作成されている（クラッシュしていない）
  await expect
    .poll(() => fs.existsSync(`${dataDir}/database.db`), { timeout: 30_000 })
    .toBe(true)

  await loginAsAdmin(page)

  await page.goto("http://localhost:3000/answer-sheet-builder", {
    waitUntil: "domcontentloaded",
  })

  // 「新規作成」→ 作成に成功するとエディタ（/01-edit）へ遷移する
  await page.getByRole("button", { name: "新規作成" }).click()

  await expect(page).toHaveURL(/\/answer-sheet-builder\/[^/]+\/01-edit/, {
    timeout: 15_000,
  })
})
