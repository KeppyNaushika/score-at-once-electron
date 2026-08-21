/**
 * スクリーンショット用サンプルデータ生成スクリプト
 *
 * 専用の __tests__/screenshots/data/database.db にまっさらな状態からデータを生成する。
 * データ(database.db)には一切触れない。
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

import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

import { createPrismaClientForPath } from "../helpers/testPrismaClient"

// ---------------------------------------------------------------------------
// パス設定
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, "../..")
const TEST_DATA_DIR = path.join(__dirname, "data")
const DB_PATH = path.join(TEST_DATA_DIR, "database.db")

// ---------------------------------------------------------------------------
// Prisma Client（専用DB）
// ---------------------------------------------------------------------------
const prisma = createPrismaClientForPath(DB_PATH)

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== スクリーンショット専用データ生成 (Phase 1) ===")
  console.log(`DB: ${DB_PATH}`)
  console.log(`Data: ${TEST_DATA_DIR}\n`)

  // 既存DB削除してまっさらに
  for (const ext of ["", "-shm", "-wal", "-journal"]) {
    const dbFilePath = DB_PATH + ext
    if (fs.existsSync(dbFilePath)) fs.unlinkSync(dbFilePath)
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true })

  // Prisma db push でスキーマ作成
  console.log("[0/2] スキーマ作成 (prisma db push)...")
  const { execSync } = await import("child_process")
  // Prisma 7では DATABASE_URL 環境変数が自動参照されないため --url で明示
  execSync(`npx prisma db push --url=file:${DB_PATH} --accept-data-loss`, {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
  })
  console.log("  -> スキーマ作成完了")

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

    const defData: Record<string, unknown> = { ...template }
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
