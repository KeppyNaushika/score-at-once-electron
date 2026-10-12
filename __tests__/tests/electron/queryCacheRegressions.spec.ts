/**
 * 画面を移って戻ったときの回帰の e2e
 *
 * データ取得を TanStack Query へ移した段階4〜8 で入れた不具合は、どれも
 * 「画面を移って戻る」ことでしか出ない。型検査もユニットテストも捕まえない:
 *
 * - キーの衝突は、片方の画面を開いた後でもう片方を開いて初めて起きる
 * - 取得結果を編集用 state へ写す処理は1回きりなので、キャッシュに古い値が
 *   残っている状態で再マウントしたときだけ古い値が入る
 *
 * ここは「実際に踏まないと分からない」ことだけを置く。ロジックの検証は
 * vitest 側（__tests__/renderer, __tests__/exam ほか）に置くこと。
 */
import { expect, type Page, test } from "@playwright/test"
import * as fs from "fs"

import {
  createCoursework,
  createExam,
  uploadMasterPage,
} from "./helpers/fixtures"
import { launchApp, type LaunchedApp, loginAsAdmin } from "./helpers/launchApp"
import { E2E_BASE_URL } from "./helpers/rendererPort"

let launched: LaunchedApp

/**
 * 段のタブ（`WorkflowTabHeader`）を押して画面内で移る。
 *
 * **`page.goto` で移ってはいけない。** 文書ごと読み直すと `QueryClient` も作り直され
 * （永続化は無い）、キャッシュが空になる。キーの衝突も古いキャッシュの持ち込みも、
 * キャッシュが残ったまま移ったときにしか起きないので、goto では何も再現しない
 */
async function clickWorkflowTab(page: Page, label: string): Promise<void> {
  await page
    .getByRole("navigation", { name: "ワークフローの段" })
    .getByRole("link", { name: label, exact: true })
    .click()
}

/** 文書に目印を付ける。読み直されると消える */
const SAME_DOCUMENT_MARK = "__e2eSameDocument"

async function markDocument(page: Page): Promise<void> {
  await page.evaluate((mark) => {
    Reflect.set(window, mark, true)
  }, SAME_DOCUMENT_MARK)
}

/**
 * `markDocument` から後、文書が読み直されていない（＝キャッシュが残ったまま移った）
 * ことを確かめる。タブが通常のリンクに変わるなどして読み直しになると、この e2e は
 * 何も再現しないまま通ってしまうので、それを止める
 */
async function expectSameDocument(page: Page): Promise<void> {
  expect(
    await page.evaluate((mark) => Reflect.get(window, mark), SAME_DOCUMENT_MARK)
  ).toBe(true)
}

test.afterEach(async () => {
  if (launched) await launched.close()
})

test("未ログインなら、どの画面もログイン画面へ送られる", async () => {
  // 採点は利用者ごとに結果を分けて保存する。誰が採点しているか分からないまま
  // 書かせない（以前は "default-user-id" という存在しない利用者で書いていた）。
  // 関門はかつてページごとに置いていたので 40ページ中16ページにしか付いておらず、
  // 試験のワークフローでは 06・07 と試験詳細だけが守られていた。今はレイアウトに
  // 1つだけ置いてあり、守られていた画面（07）と守られていなかった画面（02）の
  // 両方で効くことを見る
  launched = await launchApp()
  const { page } = launched

  for (const step of ["07-score-at-once", "02-template"]) {
    await page.goto(`${E2E_BASE_URL}/exams/does-not-exist/${step}`, {
      waitUntil: "domcontentloaded",
    })
    await expect(page).toHaveURL(`${E2E_BASE_URL}/login`, { timeout: 15_000 })
  }
})

test("解答用紙を編集して概要へ移り、作成へ戻っても編集が残る", async () => {
  // 以前は、作成タブの編集状態を共有キャッシュから作り、保存側がそのキーを
  // 更新していなかった。戻ってきた瞬間に古い内容が入り、自動保存がそれを
  // DB へ書き戻していた（＝セッション中の編集が消える）
  //
  // 空のデータディレクトリ（＝新規インストール）から始めるので、「新規インストールで
  // 『新規作成』が無反応」の回帰もここで見る。原因は2つあった:
  //   1. DB初期化がファイル有無判定の競合でクラッシュ（bootstrapSchema で解消）
  //   2. AsbDefinition の原稿用紙罫線4列が migration 取りこぼしで欠落し
  //      保存が ColumnNotFound で失敗（20260725000000 migration で復元）
  launched = await launchApp()
  const { page, dataDir } = launched

  // DB初期化が成功し DBファイルが作成されている（クラッシュしていない）
  await expect
    .poll(() => fs.existsSync(`${dataDir}/database.db`), { timeout: 30_000 })
    .toBe(true)

  await loginAsAdmin(page)

  await page.goto(`${E2E_BASE_URL}/answer-sheet-builder`, {
    waitUntil: "domcontentloaded",
  })
  // 「新規作成」→ 作成に成功するとエディタ（/01-edit）へ遷移する
  await page.getByRole("button", { name: "新規作成" }).click()
  await expect(page).toHaveURL(/\/answer-sheet-builder\/[^/]+\/01-edit/, {
    timeout: 15_000,
  })

  await markDocument(page)
  const edited = `編集した解答用紙 ${Date.now()}`

  const nameInput = page.getByRole("textbox").first()
  await nameInput.fill(edited)
  // 自動保存が落ち着くまで待つ
  await expect(page.getByText("保存されました")).toBeVisible({
    timeout: 15_000,
  })

  await clickWorkflowTab(page, "概要")
  await expect(page).toHaveURL(/\/answer-sheet-builder\/[^/]+$/, {
    timeout: 15_000,
  })
  // 作成の段の見出しも「解答用紙の作成｜<名前>」なので、名前は完全一致で引く
  await expect(
    page.getByRole("heading", { name: edited, exact: true })
  ).toBeVisible({ timeout: 15_000 })

  await clickWorkflowTab(page, "1. 作成")
  await expect(page).toHaveURL(/\/answer-sheet-builder\/[^/]+\/01-edit/, {
    timeout: 15_000,
  })
  await expect(page.getByRole("textbox").first()).toHaveValue(edited, {
    timeout: 15_000,
  })

  // 概要へもう一度移って、書き戻されていないことを確かめる
  await clickWorkflowTab(page, "概要")
  await expect(page).toHaveURL(/\/answer-sheet-builder\/[^/]+$/, {
    timeout: 15_000,
  })
  await expect(
    page.getByRole("heading", { name: edited, exact: true })
  ).toBeVisible({ timeout: 15_000 })
  await expectSameDocument(page)
})

test("解答用紙の一覧は担当の切り替えを持ち、担当でないものは編集を出さない", async () => {
  // 編集できるのは担当者ひとりだけ（OWNER / VIEWER。Editor は作らない）
  launched = await launchApp()
  const { page } = launched

  // 担当を渡す相手を作る。新規インストールの利用者は見本の管理者1人だけなので、
  // ログイン画面から1人足す
  const otherOwnerName = "別の担当"
  await page.goto(`${E2E_BASE_URL}/login`, { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "追加", exact: true }).click()
  await page.getByLabel("ユーザー名").fill("other-owner")
  await page.getByLabel("表示名").fill(otherOwnerName)
  await page.getByRole("button", { name: "作成", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: otherOwnerName, exact: true })
  ).toBeVisible({ timeout: 15_000 })

  // 利用者が2人いるので、`loginAsAdmin` の「先頭の『採点を開始』」には頼らず、
  // 見本の管理者のカードを名指しで押す
  await page.getByRole("heading", { name: "管理者", exact: true }).click()
  await expect(page).toHaveURL(`${E2E_BASE_URL}/exams`, { timeout: 15_000 })

  await page.goto(`${E2E_BASE_URL}/answer-sheet-builder`, {
    waitUntil: "domcontentloaded",
  })
  await page.getByRole("button", { name: "新規作成" }).click()
  await expect(page).toHaveURL(/\/answer-sheet-builder\/[^/]+\/01-edit/, {
    timeout: 15_000,
  })
  const definitionName = `渡す解答用紙 ${Date.now()}`
  await page.getByRole("textbox").first().fill(definitionName)
  await expect(page.getByText("保存されました")).toBeVisible({
    timeout: 15_000,
  })

  await page.goto(`${E2E_BASE_URL}/answer-sheet-builder`, {
    waitUntil: "domcontentloaded",
  })

  // 自分が担当のうちは「編集」が出て、担当は「自分」
  const rowMenu = page.getByRole("button", {
    name: `${definitionName}の操作`,
  })
  await expect(rowMenu).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("cell", { name: "自分" }).first()).toBeVisible({
    timeout: 15_000,
  })
  await rowMenu.click()
  await expect(
    page.getByRole("menuitem", { name: "編集", exact: true })
  ).toBeVisible()

  // 担当を渡す
  await page.getByRole("menuitem", { name: "担当を渡す", exact: true }).click()
  await page
    .getByRole("dialog", { name: "担当を渡す" })
    .getByRole("button", { name: otherOwnerName, exact: true })
    .click()
  await expect(page.getByText("担当を渡しました")).toBeVisible({
    timeout: 15_000,
  })

  // 既定は自分が担当の分だけなので、渡したものは一覧から消える
  await expect(rowMenu).toHaveCount(0, { timeout: 15_000 })

  // 切り替えで全員分。
  //
  // **一覧の操作は幅に入りきらないと「…」へ畳まれる**（段階64 で4画面の一覧を
  // `OverflowToolbar` へ揃えた）ので、並びに出ているとは限らない。畳まれていたら
  // 開いてから探す。
  //
  // 役割で引くのは、幅を測るための控えの並びを避けるため。控えは `aria-hidden` なので
  // 支援技術の木には出ないが、文字では引けてしまう（そちらは常に hidden）。
  const ownerScopeToggle = page.getByRole("checkbox", {
    name: "全員の解答用紙を表示",
  })
  // count() は待たずに数えるので、並びが描き終わってから数える
  await expect(page.getByRole("toolbar", { name: "一覧の操作" })).toBeVisible({
    timeout: 15_000,
  })
  const isCollapsed = (await ownerScopeToggle.count()) === 0
  if (isCollapsed) {
    await page.getByRole("button", { name: "入りきらない操作" }).click()
  }
  await ownerScopeToggle.click()
  // 「…」の中で切り替えたなら、行の操作を押す前に閉じる
  if (isCollapsed) await page.keyboard.press("Escape")

  // 渡したものが戻ってきて、担当は渡した相手。操作に「編集」は無い
  await expect(rowMenu).toBeVisible({ timeout: 15_000 })
  await expect(
    page.getByRole("cell", { name: otherOwnerName }).first()
  ).toBeVisible({ timeout: 15_000 })
  await rowMenu.click()
  // メニューが開いたことは、担当でなくても出る「複製」で確かめる
  await expect(
    page.getByRole("menuitem", { name: "複製", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "編集", exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByRole("menuitem", { name: "担当を渡す", exact: true })
  ).toHaveCount(0)
})

test("04 を開いた後に 03 へ移っても、ページと採点領域の画面が出る", async () => {
  // 03 と 04 は同じ試験の別の複合ペイロードを取る。以前は同じキーだったので、
  // 04 を開いた後に 03 を開くと 04 のデータで描き始めていた
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  const examId = await createExam(page, `キー分離の試験 ${Date.now()}`)
  await uploadMasterPage(page, examId)

  await page.goto(`${E2E_BASE_URL}/exams/${examId}/04-question-group`, {
    waitUntil: "domcontentloaded",
  })
  await expect(page.getByRole("heading", { name: /小計/ })).toBeVisible({
    timeout: 30_000,
  })
  await markDocument(page)

  await clickWorkflowTab(page, "3. 領域情報")
  await expect(
    page.getByRole("heading", { name: /^採点領域の詳細情報設定/ })
  ).toBeVisible({ timeout: 30_000 })
  // 04 の画面ではなく 03 の画面が出ていること
  await expect(page.getByRole("heading", { name: /小計/ })).toHaveCount(0)
  await expectSameDocument(page)
})

test("09 で変えた出力設定は、07 へ移って戻っても残る", async () => {
  // 出力設定は取得結果を編集用 state へ写して使う。保存側が同じキーを更新しないと、
  // 戻ってきたときに保存前の値が種になり、そのまま上書き保存される
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  const examId = await createExam(page, `出力設定の試験 ${Date.now()}`)

  // 採点マーク設定の「未採点にマークを付けるか」を使う（保存対象の設定）
  const markUnscored = page.locator("#mark-unscored")
  await page.goto(`${E2E_BASE_URL}/exams/${examId}/09-export`, {
    waitUntil: "domcontentloaded",
  })
  await expect(markUnscored).toBeVisible({ timeout: 30_000 })
  await markDocument(page)

  const before = await markUnscored.getAttribute("aria-checked")
  await markUnscored.click()
  await expect(markUnscored).not.toHaveAttribute("aria-checked", before ?? "")
  const after = await markUnscored.getAttribute("aria-checked")

  // 保存の debounce を跨いで 07 へ移る
  await clickWorkflowTab(page, "7. 採点")
  await expect(page).toHaveURL(
    `${E2E_BASE_URL}/exams/${examId}/07-score-at-once`,
    { timeout: 15_000 }
  )
  await page.waitForTimeout(2_000)

  await clickWorkflowTab(page, "9. 結果")
  await expect(markUnscored).toBeVisible({ timeout: 30_000 })
  await expect(markUnscored).toHaveAttribute("aria-checked", after ?? "")
  await expectSameDocument(page)
})

test("資料の概要と評価項目を往復しても、どちらの画面も出る", async () => {
  // 概要と評価項目は同じ資料を同じ queryFn で取る。以前は評価項目の画面が
  // 同じキーへ項目の配列だけを書いていたので、概要へ戻ると資料本体が消えていた
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  const name = `往復する資料 ${Date.now()}`
  const courseworkId = await createCoursework(page, name)

  await page.goto(`${E2E_BASE_URL}/coursework/${courseworkId}`, {
    waitUntil: "domcontentloaded",
  })
  await expect(page.getByRole("heading", { name })).toBeVisible({
    timeout: 30_000,
  })
  await markDocument(page)

  await clickWorkflowTab(page, "2. 評価項目")
  // 段のヘッダーも `評価項目の設定｜…` という見出しを出すので、部分一致では2つに
  // 当たる（段階65）。画面そのものの見出しを名指しする
  await expect(
    page.getByRole("heading", { name: "評価項目", exact: true })
  ).toBeVisible({ timeout: 30_000 })

  // 戻っても資料本体が出る（項目の配列で上書きされていない）
  await clickWorkflowTab(page, "概要")
  await expect(page).toHaveURL(`${E2E_BASE_URL}/coursework/${courseworkId}`, {
    timeout: 15_000,
  })
  // 評価項目の段の見出しも「評価項目の設定｜<名前>」なので、名前は完全一致で引く
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({
    timeout: 30_000,
  })
  await expectSameDocument(page)
})

test("関門は画面遷移のたびに効き直す（レイアウトに置いても固まらない）", async () => {
  // 関門はレイアウトに1つだけ置いてある。Next.js の「レイアウトはナビゲーションで
  // 再実行されない」はサーバー側の話で、この関門は usePathname と認証コンテキストを
  // 購読するクライアントコンポーネントなので、画面を移るたびに評価し直される。
  // 固まっていれば、ここで中身が出ずに「読み込み中...」のままになる
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  await page.goto(`${E2E_BASE_URL}/exams`, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "試験一覧" })).toBeVisible({
    timeout: 30_000,
  })

  // サイドバーから画面内遷移する（ページ全体の読み込みではない）
  await page.getByRole("link", { name: "解答用紙作成" }).click()
  await expect(page).toHaveURL(`${E2E_BASE_URL}/answer-sheet-builder`, {
    timeout: 15_000,
  })
  await expect(page.getByRole("button", { name: "新規作成" })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole("link", { name: "試験一覧" }).click()
  await expect(page).toHaveURL(`${E2E_BASE_URL}/exams`, { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: "試験一覧" })).toBeVisible({
    timeout: 15_000,
  })
})
