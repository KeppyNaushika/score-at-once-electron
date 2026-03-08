/**
 * スクリーンショット用サンプルデータ生成スクリプト
 *
 * 専用の __tests__/screenshots/data/database.db にまっさらな状態からデータを生成する。
 * 実データ(database.db)には一切触れない。
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

import { PrismaClient } from "@prisma/client"
import { randomUUID } from "crypto"
import * as fs from "fs"
import * as path from "path"

// ---------------------------------------------------------------------------
// パス設定
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, "../..")
const TEST_DATA_DIR = path.join(__dirname, "data")
const DB_PATH = path.join(TEST_DATA_DIR, "database.db")

// ---------------------------------------------------------------------------
// Prisma Client（専用DB）
// ---------------------------------------------------------------------------
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${DB_PATH}` } },
  log: ["error"],
})

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== スクリーンショット専用データ生成 (Phase 1) ===")
  console.log(`DB: ${DB_PATH}`)
  console.log(`Data: ${TEST_DATA_DIR}\n`)

  // 既存DB削除してまっさらに
  for (const ext of ["", "-shm", "-wal", "-journal"]) {
    const f = DB_PATH + ext
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true })

  // Prisma db push でスキーマ作成
  console.log("[0/2] スキーマ作成 (prisma db push)...")
  const { execSync } = await import("child_process")
  execSync(`npx prisma db push --skip-generate --accept-data-loss`, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
    stdio: "pipe",
  })
  console.log("  -> スキーマ作成完了")

  // ========== 1. ユーザー ==========
  console.log("[1/2] ユーザー作成...")
  const userId = randomUUID()
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
  const asbDefId = randomUUID()

  if (fs.existsSync(asbTemplateFile)) {
    const template = JSON.parse(fs.readFileSync(asbTemplateFile, "utf-8"))

    const defData: Record<string, unknown> = { ...template }
    defData.id = asbDefId
    defData.name = "第２回定期テスト 中２数学"
    defData.userId = userId
    delete defData.headerFields
    delete defData.majorQuestions
    delete defData.createdAt
    delete defData.updatedAt
    await prisma.asbDefinition.create({ data: defData as never })

    for (const hf of template.headerFields) {
      await prisma.asbHeaderField.create({
        data: { ...hf, id: randomUUID(), definitionId: asbDefId },
      })
    }

    for (const mq of template.majorQuestions) {
      const newMqId = randomUUID()
      await prisma.asbMajorQuestion.create({
        data: {
          id: newMqId,
          definitionId: asbDefId,
          label: mq.label,
          order: mq.order,
        },
      })
      for (const sq of mq.subQuestions) {
        const newSqId = randomUUID()
        await prisma.asbSubQuestion.create({
          data: {
            id: newSqId,
            majorQuestionId: newMqId,
            label: sq.label,
            order: sq.order,
            heightMultiplier: sq.heightMultiplier,
            points: sq.points,
            usesBranchPoints: sq.usesBranchPoints,
            layoutWidth: sq.layoutWidth,
            nextPlacement: sq.nextPlacement,
            goUp: sq.goUp,
            manuscriptEnabled: sq.manuscriptEnabled,
            manuscriptColumns: sq.manuscriptColumns,
            manuscriptRows: sq.manuscriptRows,
            manuscriptCellSizeMm: sq.manuscriptCellSizeMm,
            borderStyleTop: sq.borderStyleTop,
            borderStyleBottom: sq.borderStyleBottom,
            borderStyleLeft: sq.borderStyleLeft,
            borderStyleRight: sq.borderStyleRight,
          },
        })
        for (const te of sq.textElements || []) {
          await prisma.asbTextElement.create({
            data: {
              id: randomUUID(),
              subQuestionId: newSqId,
              branchQuestionId: null,
              text: te.text,
              fontSize: te.fontSize,
              horizontalAlign: te.horizontalAlign,
              verticalAlign: te.verticalAlign,
              order: te.order,
            },
          })
        }
        if (sq.omrConfig) {
          const newOmrId = randomUUID()
          await prisma.asbOmrConfig.create({
            data: {
              id: newOmrId,
              subQuestionId: newSqId,
              type: sq.omrConfig.type,
              numChoices: sq.omrConfig.numChoices,
              choiceLayout: sq.omrConfig.choiceLayout,
              numDigits: sq.omrConfig.numDigits,
              correctAnswer: sq.omrConfig.correctAnswer,
            },
          })
          for (const co of sq.omrConfig.choiceOptions || []) {
            await prisma.asbOmrChoiceOption.create({
              data: {
                id: randomUUID(),
                omrConfigId: newOmrId,
                choiceIndex: co.choiceIndex,
                label: co.label,
                isCorrect: co.isCorrect,
              },
            })
          }
        }
        for (const bq of sq.branchQuestions || []) {
          await prisma.asbBranchQuestion.create({
            data: {
              id: randomUUID(),
              subQuestionId: newSqId,
              label: bq.label,
              order: bq.order,
              heightMultiplier: bq.heightMultiplier,
              points: bq.points,
              layoutWidth: bq.layoutWidth,
              nextPlacement: bq.nextPlacement,
              goUp: bq.goUp,
              borderStyleTop: bq.borderStyleTop,
              borderStyleBottom: bq.borderStyleBottom,
              borderStyleLeft: bq.borderStyleLeft,
              borderStyleRight: bq.borderStyleRight,
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
