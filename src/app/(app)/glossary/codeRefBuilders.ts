/**
 * 用語集の分類ファイルで、語が指す実体を短く書くための組み立て関数。
 * 名前が実在することは `__tests__/renderer/glossaryCodeRefs.test.ts` が守る。
 */

import type { GlossaryCodeRef } from "./types"

export const table = (model: string): GlossaryCodeRef => ({
  kind: "table",
  model,
})

export const column = (model: string, field: string): GlossaryCodeRef => ({
  kind: "column",
  model,
  field,
})

/** `source` は値の集合を定義しているファイル（リポジトリ直下からのパス） */
export const value = (
  model: string,
  field: string,
  storedValue: string,
  source: string
): GlossaryCodeRef => ({
  kind: "value",
  model,
  field,
  value: storedValue,
  source,
})

/** `source` はその識別子を export しているファイル（リポジトリ直下からのパス） */
export const identifier = (name: string, source: string): GlossaryCodeRef => ({
  kind: "identifier",
  name,
  source,
})
