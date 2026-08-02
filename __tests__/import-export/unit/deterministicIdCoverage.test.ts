/**
 * 決定論的idテーブルの書き込み経路の網羅テスト
 *
 * `@id`（`@default(uuid())` 無し）で宣言されたテーブルは、idを親子キーから組み立てる
 * 前提で運用する。`@default(uuid())` のままだと、2端末が同じ組み合わせを追加したときに
 * id 違い・`@@unique` 同値の行ができてNAS同期で衝突するためで、同一idなら行レベルLWWが
 * 1行へ収束する。
 *
 * この不変式は**DBが強制できない**（id は任意の文字列を受け付ける）。実際、
 * ExamSubtotalGroup を決定論的idへ移した際、`crypto.randomUUID()` を書く経路が
 * 取り残されて残り、後の取り込みが unique 違反で全滅する状態を作った。移行は実行時に
 * あった行しか直さないので、取り残した経路は新しい旧形式の行を作り続ける。
 *
 * ここでは「決定論的idのテーブルへ id を渡さず create している箇所が無いか」を
 * ソースから検査する。id を省くと Prisma が型エラーにするので TypeScript も守るが、
 * uuid を渡す書き方は型では止められないため、生成関数の使用まで見る。
 */
import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"

const ROOT = path.resolve(__dirname, "../../..")
const SCHEMA_PATH = path.join(ROOT, "prisma/schema.prisma")

/** 決定論的id前提のモデル（`@id` のみで `@default` を持たない） */
function deterministicIdModels(): string[] {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8")
  return [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)]
    .filter(([, , body]) => /^\s+id\s+String\s+@id\s*$/m.test(body))
    .map(([, name]) => name)
}

/** 走査対象のソース（生成物・依存は除く） */
function sourceFiles(): string[] {
  const targets = ["electron-src", "src", "scripts", "__tests__"]
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue
        walk(full)
      } else if (/\.tsx?$/.test(entry.name)) {
        found.push(full)
      }
    }
  }
  for (const target of targets) walk(path.join(ROOT, target))
  return found
}

/** モデル名 → Prisma クライアントのプロパティ名 */
const toClientProperty = (model: string): string =>
  model.charAt(0).toLowerCase() + model.slice(1)

/** `openParenIndex` の丸括弧に対応する閉じ括弧までの中身を返す */
function callArgument(text: string, openParenIndex: number): string {
  let depth = 0
  for (let i = openParenIndex; i < text.length; i++) {
    if (text[i] === "(") depth++
    else if (text[i] === ")") {
      depth--
      if (depth === 0) return text.slice(openParenIndex + 1, i)
    }
  }
  return text.slice(openParenIndex + 1)
}

describe("決定論的idテーブルの書き込み経路", () => {
  it("id を uuid で作っている箇所が無い", () => {
    const models = deterministicIdModels()
    expect(models.length).toBeGreaterThan(0)

    const violations: string[] = []

    for (const file of sourceFiles()) {
      const text = fs.readFileSync(file, "utf-8")
      for (const model of models) {
        const property = toClientProperty(model)
        const callPattern = new RegExp(
          `\\.${property}\\.(create|upsert|createMany)\\(`,
          "g"
        )
        for (const match of text.matchAll(callPattern)) {
          // 引数の括弧を対応させて呼び出し1件分だけを取る。固定文字数で切ると
          // 次の別モデルの生成コードを拾って誤検知する
          const body = callArgument(text, match.index + match[0].length - 1)
          if (/randomUUID\(\)|generateId\(\)|uuidv4\(\)/.test(body)) {
            violations.push(
              `${path.relative(ROOT, file)}: ${model}.${match[1]} に uuid を渡している`
            )
          }
        }
      }
    }

    // 決定論的idは deterministicId.ts の build*Id を使って組み立てること。
    // uuid を渡すと、DB は受け付けるが2端末で別idの同値行ができて同期で衝突する
    expect(violations).toEqual([])
  })
})
