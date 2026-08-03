/**
 * id は uuidv4 で作る、という不変式の網羅テスト
 *
 * **id は同一性を持たない不透明な値**とし、行の同定は `@@unique` が担う。同じ組み合わせの
 * 行が2端末にできても sqlite-nas-sync が収束させる — `conflict.ts` の `applyInsert` が
 * セカンダリUNIQUE違反を検出し、`updatedAt` のLWWで敗者行を削除する。ライブラリは
 * この用途のために拡張された（v0.11.0「セカンダリUNIQUE違反のLWW競合解決」）ので、
 * アプリ側で id を親子キーから組み立てる必要はない（issue #1128）。
 *
 * 既知の残件（許容と判断済み）: ケース2のLWWは INSERT が実際に UNIQUE エラーを出したとき
 * にだけ動く。相手の行が既に削除されていればエラーが起きず、削除は主キーでしか照合されない
 * （`_tombstone` は id しか持たない）ため、**2行が一度も出会わないうちの削除は伝わらない**。
 * 一度でも同期して収束すれば以後は正常で、再操作でも直るため受容する。
 *
 * ここでは3つを検査する。いずれもDBは強制できない（id は任意の文字列を受け付ける）。
 *
 * 1. schema の全モデルの `id` が `@default(uuid())` を持つこと
 * 2. `create` / `upsert` / `createMany` に導出した id を渡していないこと
 *    （合成id `${parentId}:${kind}` と、親の id の流用 `{ id: examId, examId }` の両方。
 *    後者は ExamAnswerOverlayStyle など4テーブルが実際にやっており、schema上は
 *    `@default(uuid())` のままだったため旧テストの検出条件をすり抜けていた）
 * 3. uuidv5 を組み立てるコードが無いこと
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

  it("create/upsert に導出した id を渡していない", () => {
    const models = schemaModels().map(({ name }) => name)
    expect(models.length).toBeGreaterThan(0)

    // 導出idの書き方は2つある。
    //   1. テンプレートリテラルでの組み立て（`${examId}:${kind}`）
    //   2. 親の id をそのまま主キーにする（`{ id: examId, examId, ... }`）
    // 2 は ExamIndividualReportSettings などが実際にやっていて、テンプレートリテラル
    // だけを見る検査ではすり抜けていた。ただし `id: <変数>` 全般を弾くと、uuid を
    // 生成して変数へ入れてから渡す正当な書き方まで落ちる。**同じオブジェクトの中で
    // その識別子が他のフィールドにも現れているか**で切り分ける（現れていれば、
    // その行が持つ他の値＝多くは外部キーを id に流用している）。
    const COMPOSED_ID = /\bid:\s*`[^`]*\$\{/
    const borrowsAnotherField = (body: string): boolean => {
      const idValue = /\bid:\s*([A-Za-z_$][\w$]*)\s*[,}]/.exec(body)
      if (!idValue) return false
      const name = idValue[1]
      // 同じ識別子が「別のキーの値」または「短縮プロパティ」として再登場するか
      const reusedAsValue = new RegExp(`\\b(?!id)\\w+:\\s*${name}\\s*[,}]`)
      const reusedAsShorthand = new RegExp(`[{,]\\s*${name}\\s*[,}]`)
      return reusedAsValue.test(body) || reusedAsShorthand.test(body)
    }

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
          if (COMPOSED_ID.test(body) || borrowsAnotherField(body)) {
            violations.push(
              `${path.relative(ROOT, file)}: ${model}.${match[1]} に導出した id を渡している`
            )
          }
        }
      }
    }

    expect(violations).toEqual([])
  })

  it("uuidv5 を組み立てるコードが無い", () => {
    // v5 は形が uuid なので v4 と区別できず、「この id は内容から導出されている」と
    // 後から気づけない。合成idより発見しにくいため、生成そのものを禁じる。
    // RFC 4122 の名前ベースUUIDは sha1 とバージョンニブルの立て方で判別できる。
    const violations: string[] = []
    for (const file of sourceFiles()) {
      const text = fs.readFileSync(file, "utf-8")
      if (/createHash\(\s*["']sha1["']\s*\)/.test(text)) {
        violations.push(
          `${path.relative(ROOT, file)}: sha1 で id を導出している疑い`
        )
      }
      if (/&\s*0x0f\s*\)\s*\|\s*0x50/.test(text)) {
        violations.push(
          `${path.relative(ROOT, file)}: uuidv5 のバージョンビットを立てている`
        )
      }
    }
    expect(violations).toEqual([])
  })
})
