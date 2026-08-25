/**
 * スクリーンショット用サンプルデータ生成スクリプト
 *
 * 専用の __tests__/screenshots/data/database.db にまっさらな状態からデータを生成する。
 * 既定の data/database.db には一切触れない。
 *
 * Phase 1（テスト前に実行）:
 *   - ユーザー作成
 *   - ASBテンプレート定義作成
 *
 * Phase 2 以降のデータ（生徒・学級・試験・採点結果等）は
 * テスト実行中に段階的に追加する。
 *
 * 使用方法:
 *   npx tsx __tests__/screenshots/setup-data.ts
 */

import { Prisma } from "@prisma/client"
import * as crypto from "crypto"
import * as fs from "fs"
import * as Module from "module"
import * as path from "path"

import { createPrismaClientForPath } from "../helpers/testPrismaClient"
import {
  describeSyncAbort,
  getSyncConfigPath,
  isSyncEnabled,
} from "./helpers/syncGuard"

// ---------------------------------------------------------------------------
// パス設定
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, "../..")
const TEST_DATA_DIR = path.join(__dirname, "data")
const DB_PATH = path.join(TEST_DATA_DIR, "database.db")
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, "prisma/migrations")

// ---------------------------------------------------------------------------
// Prisma Client（専用DB）
// ---------------------------------------------------------------------------
const prisma = createPrismaClientForPath(DB_PATH)

/**
 * 空DBに、アプリ本体と同じ初期化連鎖でスキーマを作る
 *
 * init ベースライン適用（`bootstrapSchema`）→ `_prisma_migrations` のベースライン作成
 * （`createBaseline`）→ `prisma/migrations` の昇順適用（`deployPendingMigrations`）。
 * 例は `__tests__/migration/freshInstallChain.test.ts`。
 *
 * `prisma db push` を使わない理由は2つある。
 * 1. `db push` はスキーマ定義から直接テーブルを作るので、実際の新規インストールが通る
 *    migration の連鎖を飛ばす。撮影が写すのは「新規インストール直後のアプリ」なので、
 *    本番と同じ道を通したほうが正確
 * 2. Prisma 7 の `db push` は AI が実行した破壊的操作として拒否される
 *
 * `deployPendingMigrations()` は接続先を `getDatabasePath()` で決め、その中の
 * `loadSyncConfig()` が Electron の `app.getPath("userData")` を読む。このスクリプトは
 * 素の Node で動くので `app` が無い（`require("electron")` は実行ファイルのパス文字列を
 * 返すだけ）。そこで `electron` を `app` だけ持つ形へ差し替えてから読み込む。同期設定は
 * 呼び出し前に `isSyncEnabled()` で無効だと確かめてあるので、`getDatabasePath()` は
 * `SCORE_AT_ONCE_DATA_DIR`（＝撮影用ディレクトリ）側を返す。
 */
async function createSchemaLikeFreshInstall(): Promise<void> {
  process.env.SCORE_AT_ONCE_DATA_DIR = TEST_DATA_DIR

  const electronEntry = require.resolve("electron")
  const electronStub = new Module.Module(electronEntry)
  electronStub.exports = { app: { getPath: () => TEST_DATA_DIR } }
  electronStub.loaded = true
  require.cache[electronEntry] = electronStub

  // 差し替えたあとに読み込む必要があるので動的 import にする
  const { bootstrapSchema } =
    await import("../../electron-src/lib/prisma/schema/schemaBootstrap")
  const { createBaseline } =
    await import("../../electron-src/lib/prisma/schema/baselineMigrations")
  const { deployPendingMigrations } =
    await import("../../electron-src/lib/prisma/schema/migrationDeployer")

  bootstrapSchema(DB_PATH)
  const baselineClient = createPrismaClientForPath(DB_PATH)
  try {
    await createBaseline(baselineClient)
  } finally {
    await baselineClient.$disconnect()
  }
  const appliedCount = deployPendingMigrations({
    migrationsDir: MIGRATIONS_DIR,
  })
  console.log(`  -> init + マイグレーション ${appliedCount} 本を適用`)
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------
async function main() {
  // 種を蒔く前に同期設定を見る。同期が有効だとアプリは userData のローカル DB を
  // 開くので、ここで作る撮影用 DB は使われず、実運用のデータベースが撮られる。
  // 作ってから気づくのは無駄なので、始める前に止める。
  if (isSyncEnabled()) {
    throw new Error(describeSyncAbort(`同期設定: ${getSyncConfigPath()}`))
  }

  console.log("=== スクリーンショット専用データ生成 (Phase 1) ===")
  console.log(`DB: ${DB_PATH}`)
  console.log(`Data: ${TEST_DATA_DIR}\n`)

  // 既存DB削除してまっさらに
  for (const ext of ["", "-shm", "-wal", "-journal"]) {
    const dbFilePath = DB_PATH + ext
    if (fs.existsSync(dbFilePath)) fs.unlinkSync(dbFilePath)
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
  // マイグレーション適用前のバックアップは実行のたびに増えるので、作り直しの前に掃く
  for (const fileName of fs.readdirSync(TEST_DATA_DIR)) {
    if (fileName.startsWith("database.db.pre-migration-backup-")) {
      fs.unlinkSync(path.join(TEST_DATA_DIR, fileName))
    }
  }

  // スキーマ作成（アプリの新規インストールと同じ連鎖を通す）
  console.log("[0/2] スキーマ作成 (init + migrations)...")
  await createSchemaLikeFreshInstall()

  // ========== 1. ユーザー ==========
  console.log("[1/2] ユーザー作成...")
  const userId = crypto.randomUUID()
  await prisma.user.create({
    data: {
      id: userId,
      username: "yamada-t",
      name: "山田 太郎",
      role: "teacher",
      passcodeType: "none",
    },
  })
  console.log("  -> 山田 太郎 (yamada-t)")

  // ========== 2. 解答用紙ビルダーテンプレート ==========
  console.log("[2/2] 解答用紙ビルダー定義作成...")
  const asbTemplateFile = path.join(TEST_DATA_DIR, "asb-template.json")
  const asbDefId = crypto.randomUUID()

  if (fs.existsSync(asbTemplateFile)) {
    const template = JSON.parse(fs.readFileSync(asbTemplateFile, "utf-8"))

    // 雛形は書き出した当時のスキーマで固まっているので、いま存在しない列が混じる
    // （実際 `renderMode` が廃止済みで create が落ちていた）。生成された
    // ScalarFieldEnum を正として、今ある列だけを通す
    const asbDefinitionColumns: Set<string> = new Set(
      Object.keys(Prisma.AsbDefinitionScalarFieldEnum)
    )
    const defData: Record<string, unknown> = Object.fromEntries(
      Object.entries(template).filter(([columnName]) =>
        asbDefinitionColumns.has(columnName)
      )
    )
    defData.id = asbDefId
    defData.name = "第２回定期テスト 中２数学"
    defData.userId = userId
    delete defData.headerFields
    delete defData.majorQuestions
    delete defData.createdAt
    delete defData.updatedAt
    await prisma.asbDefinition.create({ data: defData as never })

    for (const headerField of template.headerFields) {
      await prisma.asbHeaderField.create({
        data: {
          ...headerField,
          id: crypto.randomUUID(),
          definitionId: asbDefId,
        },
      })
    }

    for (const majorQuestion of template.majorQuestions) {
      const newMajorQuestionId = crypto.randomUUID()
      await prisma.asbMajorQuestion.create({
        data: {
          id: newMajorQuestionId,
          definitionId: asbDefId,
          label: majorQuestion.label,
          order: majorQuestion.order,
        },
      })
      for (const subQuestion of majorQuestion.subQuestions) {
        const newSubQuestionId = crypto.randomUUID()
        await prisma.asbSubQuestion.create({
          data: {
            id: newSubQuestionId,
            majorQuestionId: newMajorQuestionId,
            label: subQuestion.label,
            order: subQuestion.order,
            heightMultiplier: subQuestion.heightMultiplier,
            points: subQuestion.points,
            usesBranchPoints: subQuestion.usesBranchPoints,
            layoutWidth: subQuestion.layoutWidth,
            nextPlacement: subQuestion.nextPlacement,
            goUp: subQuestion.goUp,
            borderStyleTop: subQuestion.borderStyleTop,
            borderStyleBottom: subQuestion.borderStyleBottom,
            borderStyleLeft: subQuestion.borderStyleLeft,
            borderStyleRight: subQuestion.borderStyleRight,
          },
        })
        // 原稿用紙は別テーブル（雛形は旧形式の列名で持っている）
        if (subQuestion.manuscriptEnabled) {
          await prisma.asbManuscriptPaper.create({
            data: {
              id: crypto.randomUUID(),
              subQuestionId: newSubQuestionId,
              enabled: true,
              columns: subQuestion.manuscriptColumns,
              rows: subQuestion.manuscriptRows,
            },
          })
        }
        for (const textElement of subQuestion.textElements || []) {
          await prisma.asbTextElement.create({
            data: {
              id: crypto.randomUUID(),
              subQuestionId: newSubQuestionId,
              branchQuestionId: null,
              text: textElement.text,
              fontSize: textElement.fontSize,
              horizontalAlign: textElement.horizontalAlign,
              verticalAlign: textElement.verticalAlign,
              order: textElement.order,
            },
          })
        }
        if (subQuestion.omrConfig) {
          const newOmrId = crypto.randomUUID()
          await prisma.asbOmrConfig.create({
            data: {
              id: newOmrId,
              subQuestionId: newSubQuestionId,
              type: subQuestion.omrConfig.type,
              numChoices: subQuestion.omrConfig.numChoices,
              choiceLayout: subQuestion.omrConfig.choiceLayout,
            },
          })
          for (const choiceOption of subQuestion.omrConfig.choiceOptions ||
            []) {
            await prisma.asbOmrChoiceOption.create({
              data: {
                id: crypto.randomUUID(),
                omrConfigId: newOmrId,
                choiceIndex: choiceOption.choiceIndex,
                label: choiceOption.label,
                isCorrect: choiceOption.isCorrect,
              },
            })
          }
        }
        for (const branchQuestion of subQuestion.branchQuestions || []) {
          await prisma.asbBranchQuestion.create({
            data: {
              id: crypto.randomUUID(),
              subQuestionId: newSubQuestionId,
              label: branchQuestion.label,
              order: branchQuestion.order,
              heightMultiplier: branchQuestion.heightMultiplier,
              points: branchQuestion.points,
              layoutWidth: branchQuestion.layoutWidth,
              nextPlacement: branchQuestion.nextPlacement,
              goUp: branchQuestion.goUp,
              borderStyleTop: branchQuestion.borderStyleTop,
              borderStyleBottom: branchQuestion.borderStyleBottom,
              borderStyleLeft: branchQuestion.borderStyleLeft,
              borderStyleRight: branchQuestion.borderStyleRight,
            },
          })
        }
      }
    }
    console.log("  -> テンプレートから復元完了")
  } else {
    await prisma.asbDefinition.create({
      data: {
        id: asbDefId,
        name: "第２回定期テスト 中２数学",
        userId,
        paperSize: "B4",
        orientation: "portrait",
        multiColumnEnabled: true,
        multiColumnCount: 2,
      },
    })
    console.log("  -> シンプル定義を作成")
  }

  // ========== ID情報をファイルに保存 ==========
  const ids = {
    userId,
    asbDefId,
  }
  fs.writeFileSync(
    path.join(TEST_DATA_DIR, "screenshot-ids.json"),
    JSON.stringify(ids, null, 2)
  )

  // ========== サマリー ==========
  console.log("\n=== Phase 1 セットアップ完了 ===")
  console.log(`ユーザー: 1名 (山田 太郎)`)
  console.log(`解答用紙: 第２回定期テスト 中２数学`)
  console.log(`\n※ 生徒・学級・試験等はテスト実行中に段階的に追加されます。`)
  console.log(`DB: ${DB_PATH}`)
  console.log(`IDs: ${path.join(TEST_DATA_DIR, "screenshot-ids.json")}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("Error:", e)
  prisma.$disconnect()
  process.exit(1)
})
