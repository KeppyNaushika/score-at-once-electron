/**
 * id は uuidv4 で作る、という不変式の網羅テスト
 *
 * NAS同期は行を主キーで突き合わせるが、**同じ組み合わせの行が2端末にできても
 * sqlite-nas-sync が解決する**（`conflict.ts` の `applyInsert` がセカンダリUNIQUE違反を
 * 検出し、`updatedAt` のLWWで敗者行を削除して1行へ収束させる）。よってアプリ側で id を
 * 親子キーから組み立てる必要はなく、むしろ有害だった — 決定論的 id は削除した id を
 * 再利用するため、付け外しの多い表で「過去の削除tombstoneが未来の同一組み合わせを撃つ」
 * 「別端末の新規作成が他端末の解除に吸収される」混線を生む（issue #1128）。
 *
 * ここでは2つを検査する。どちらもDBは強制できない（id は任意の文字列を受け付ける）。
 *
 * 1. schema の全モデルの `id` が `@default(uuid())` を持つこと
 * 2. `create` / `upsert` / `createMany` に、uuid生成関数以外で作った id を渡していないこと
 *    （合成id `${parentId}:${kind}` の類。以前 ExamAnswerOverlayStyle など4テーブルが
 *    schema上は `@default(uuid())` のままコード側で合成idを書いており、旧テストの
 *    検出条件（`@default` を持たないモデルだけを見る）をすり抜けていた）
 */
import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"

const ROOT = path.resolve(__dirname, "../../..")
const SCHEMA_PATH = path.join(ROOT, "prisma/schema.prisma")

/** schema のモデル名 → 本体 */
function schemaModels(): { name: string; body: string }[] {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8")
  return [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)].map(
    ([, name, body]) => ({ name, body })
  )
}

/**
 * 走査対象のソース（生成物・依存は除く）。
 *
 * `__tests__` は入れない。テストのフィクスチャは読みやすさのために `cw_embed_1` のような
 * 固定idを振ってよく、これは「親子キーからidを組み立てる」という検出したい形ではない。
 */
function sourceFiles(): string[] {
  const targets = ["electron-src", "src", "scripts"]
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

describe("idはuuidv4で作る", () => {
  it("全モデルの id が @default(uuid()) を持つ", () => {
    const missing = schemaModels()
      .filter(({ body }) => /^\s+id\s+String\s+@id\s*$/m.test(body))
      .map(({ name }) => name)

    expect(missing).toEqual([])
  })

  it("create/upsert に文字列連結で組み立てた id を渡していない", () => {
    const models = schemaModels().map(({ name }) => name)
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
          // `id: \`...${...}...\`` のようにテンプレートリテラルで組み立てている箇所
          if (/\bid:\s*`[^`]*\$\{/.test(body)) {
            violations.push(
              `${path.relative(ROOT, file)}: ${model}.${match[1]} に組み立てた id を渡している`
            )
          }
        }
      }
    }

    expect(violations).toEqual([])
  })
})
