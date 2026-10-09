/**
 * AI 採点の出力スキーマが、全事業者の受け付ける共通の書き方だけで書かれていること
 * （docs/vlm-grading-design.md §6-2。convention-as-code）
 *
 * 事業者ごとに受け付ける JSON Schema の語は違い、拒まれるか黙って無視される。スキーマを
 * 直したときに、共通の書き方から外れたら止める。
 */

import { describe, expect, it } from "vitest"

import {
  buildGradingOutputSchema,
  type GradingJsonSchema,
} from "@/lib/shared/aiGrading/gradingSchema"

/** 共通の書き方で使ってよい語 */
const ALLOWED_KEYWORDS = new Set([
  "type",
  "description",
  "enum",
  "properties",
  "required",
  "additionalProperties",
  "items",
])

/** 名指しで禁じる語（ALLOWED_KEYWORDS で塞がっているが、意図を残す） */
const FORBIDDEN_KEYWORDS = [
  "oneOf",
  "anyOf",
  "allOf",
  "not",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "pattern",
  "format",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "const",
  "default",
  "$ref",
  "$defs",
]

interface SchemaNodeAtPath {
  readonly path: string
  readonly node: GradingJsonSchema
}

/** スキーマの全ての節を、ルートからのパスつきで並べる */
function collectNodes(node: GradingJsonSchema, path = "$"): SchemaNodeAtPath[] {
  const children = [
    ...Object.entries(node.properties ?? {}).flatMap(([key, child]) =>
      collectNodes(child, `${path}.${key}`)
    ),
    ...(node.items ? collectNodes(node.items, `${path}[]`) : []),
  ]
  return [{ path, node }, ...children]
}

const typesOf = (node: GradingJsonSchema): readonly string[] =>
  typeof node.type === "string" ? [node.type] : node.type

describe.each([["採点の出力", buildGradingOutputSchema()]])(
  "%s のスキーマ",
  (_label, schema) => {
    const nodes = collectNodes(schema)

    it("共通の書き方の語だけを使い、禁じた語を含まない", () => {
      for (const { path, node } of nodes) {
        for (const keyword of Object.keys(node)) {
          expect(ALLOWED_KEYWORDS.has(keyword), `${path}.${keyword}`).toBe(true)
          expect(FORBIDDEN_KEYWORDS, `${path}.${keyword}`).not.toContain(
            keyword
          )
        }
      }
    })

    it("オブジェクトはすべて additionalProperties: false で、全項目が required", () => {
      const objectNodes = nodes.filter(({ node }) =>
        typesOf(node).includes("object")
      )
      expect(objectNodes.length).toBeGreaterThan(0)
      for (const { path, node } of objectNodes) {
        expect(node.additionalProperties, path).toBe(false)
        expect([...(node.required ?? [])].sort(), path).toEqual(
          Object.keys(node.properties ?? {}).sort()
        )
      }
    })

    it("enum は文字列型の節にだけ付き、空でない", () => {
      for (const { path, node } of nodes) {
        if (!node.enum) continue
        expect(typesOf(node), path).toEqual(["string"])
        expect(node.enum.length, path).toBeGreaterThan(0)
      }
    })

    it("JSON として書き出して読み戻しても同じ（関数や undefined を含まない）", () => {
      expect(JSON.parse(JSON.stringify(schema))).toEqual(schema)
    })
  }
)

describe("採点の出力のスキーマの中身", () => {
  const schema = buildGradingOutputSchema()

  it("6項目を持ち、null を取る項目は型の union で表す", () => {
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      [
        "annotation",
        "comment",
        "confidence",
        "partialScore",
        "status",
        "transcription",
      ].sort()
    )
    expect(schema.properties?.partialScore.type).toEqual(["number", "null"])
    expect(schema.properties?.annotation.type).toEqual(["string", "null"])
  })

  it("status は unscored と double_mark を返させない", () => {
    expect(schema.properties?.status.enum).toEqual([
      "correct",
      "partial",
      "incorrect",
      "no_answer",
      "pending",
    ])
  })

  it("呼ぶたびに同じ内容を返す（送る固定部がバイト単位で変わらない）", () => {
    expect(JSON.stringify(buildGradingOutputSchema())).toBe(
      JSON.stringify(schema)
    )
  })
})
