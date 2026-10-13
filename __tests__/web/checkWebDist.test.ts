/**
 * 配る前の点検（`scripts/web/checkWebDist.mjs`）が、入っていてはいけないものを見つけ、
 * 普通の書き出しは通すことの固定。デプロイのワークフローはこれが失敗するとデプロイしない。
 */
import { describe, expect, it } from "vitest"

import {
  envValuesOf,
  findWebDistProblems,
} from "../../scripts/web/checkWebDist.mjs"

const reasonsOf = (relativePath: string, text: string | null) =>
  findWebDistProblems([{ relativePath, text }]).map(({ reason }) => reason)

describe("web-dist の点検", () => {
  it("普通の書き出しは通す", () => {
    expect(
      findWebDistProblems([
        { relativePath: "index.html", text: "<html><head></head></html>" },
        { relativePath: "__web/worker/worker.js", text: "const task='x'" },
        { relativePath: "__web/worker/vips.wasm", text: null },
        { relativePath: "_headers", text: "/*\n  X-Frame-Options: DENY\n" },
        {
          relativePath: "_redirects",
          text: "/exams/:examId /exams/__ 200\n",
        },
        // 画面の入力欄の見本（キーの頭だけ）は鍵ではない
        { relativePath: "ai-grading.html", text: 'placeholder="sk-ant-..."' },
      ])
    ).toEqual([])
  })

  it.each([
    ["_next/static/chunks/main.js.map"],
    ["data/database.db"],
    ["database.db-wal"],
    [".env"],
    [".env.local"],
    ["keys/server.pem"],
  ])("入っていてはいけないファイル（%s）を見つける", (relativePath) => {
    expect(reasonsOf(relativePath, null)).not.toEqual([])
  })

  it.each([
    ["手元のパス", "from /Users/someone/dev/app/src"],
    ["CI のパス", "/home/runner/work/app/app/src/lib/a.ts"],
    ["Windows のパス", "C:\\\\Users\\\\someone\\\\app"],
    ["Anthropic のキー", `"sk-ant-${"a".repeat(40)}"`],
    ["OpenAI のキー", `"sk-proj-${"B".repeat(40)}"`],
    ["秘密鍵", "-----BEGIN RSA PRIVATE KEY-----"],
    ["GitHub のトークン", `ghp_${"c".repeat(36)}`],
  ])("中身の%sを見つける", (_, text) => {
    expect(reasonsOf("__web/page.js", text)).not.toEqual([])
  })

  it(".env の値を見つける（短い値は照らさない）", () => {
    const envValues = envValuesOf(
      [
        "# コメント",
        'SECRET_TOKEN="a-very-secret-value"',
        "export OTHER=another-secret",
        "PORT=3000",
      ].join("\n")
    )
    expect(envValues).toEqual(["a-very-secret-value", "another-secret"])
    expect(
      findWebDistProblems(
        [{ relativePath: "index.html", text: "x a-very-secret-value x" }],
        envValues
      )
    ).toEqual([{ relativePath: "index.html", reason: ".env の値" }])
  })
})
