/**
 * 用語集の型。
 *
 * 用語集は2つに分けて持つ:
 * - **言語に依存しない側**（`categories/*.ts`）— 語の id・分類・指す表・列・値・型
 * - **言語ごとの文言**（`text/ja/*.ts`）— 呼び名・説明・使わない語・似た語との違い
 *
 * 翻訳するときは文言の側を言語の数だけ足せばよく、指す実体は言語をまたいで共有する。
 * 文言は分類ごとに `Record<その分類の語の id, …>` で書くので、語を足すと全言語の文言が
 * 揃うまで型検査が通らない。
 */

import type { GlossaryTermId } from "./glossaryTerms"

export const GLOSSARY_CATEGORY_IDS = [
  "user",
  "classroom",
  "student",
  "tag",
  "examSetup",
  "scoring",
  "finalizeExport",
  "aiGrading",
  "coursework",
  "grade",
  "answerSheetBuilder",
  "data",
] as const
export type GlossaryCategoryId = (typeof GLOSSARY_CATEGORY_IDS)[number]

/**
 * 大分類と、その中の小分類（＝分類）。小分類が1つだけの大分類は、見出しを1段にする。
 * 並びは `GLOSSARY_CATEGORY_IDS` と同じ順にする
 */
export const GLOSSARY_GROUPS = [
  { id: "user", categoryIds: ["user"] },
  { id: "classroom", categoryIds: ["classroom"] },
  { id: "student", categoryIds: ["student"] },
  { id: "tag", categoryIds: ["tag"] },
  {
    id: "exam",
    categoryIds: ["examSetup", "scoring", "finalizeExport", "aiGrading"],
  },
  { id: "coursework", categoryIds: ["coursework"] },
  { id: "grade", categoryIds: ["grade"] },
  { id: "answerSheetBuilder", categoryIds: ["answerSheetBuilder"] },
  { id: "data", categoryIds: ["data"] },
] as const satisfies readonly {
  id: string
  categoryIds: readonly GlossaryCategoryId[]
}[]
export type GlossaryGroupId = (typeof GLOSSARY_GROUPS)[number]["id"]

/** 本文と索引に並べる、絞り込んだあとの大分類1つ */
export interface GlossarySection {
  groupId: GlossaryGroupId
  /** 小分類の見出しを出すか（大分類が小分類を2つ以上持つとき） */
  hasSubgroups: boolean
  categories: { categoryId: GlossaryCategoryId; terms: GlossaryTerm[] }[]
}

/**
 * 語が指す実体。画面では語の呼び名のすぐ後ろに並べる。
 *
 * - `table` — Prisma のモデル（＝表）
 * - `column` — モデルの列
 * - `value` — 文字列で保存する列の取りうる値（SQLite に enum が無いので列＋値で指す）。
 *   `source` は値の集合を定義しているファイル
 * - `identifier` — 表に対応しないコードの識別子。`source` はそれを export するファイル
 */
export type GlossaryCodeRef =
  | { kind: "table"; model: string }
  | { kind: "column"; model: string; field: string }
  | {
      kind: "value"
      model: string
      field: string
      value: string
      /** 値の集合を定義しているファイル（SQLite に enum が無いので、ここが唯一の定義源） */
      source: string
    }
  | { kind: "identifier"; name: string; source: string }

export type GlossaryCodeRefKind = GlossaryCodeRef["kind"]

/** 1つの分類の、言語に依存しない側。並び順は `termIds` の順 */
export interface GlossaryCategory<TermId extends string = GlossaryTermId> {
  id: GlossaryCategoryId
  termIds: readonly TermId[]
  codeRefs: Record<TermId, GlossaryCodeRef[]>
}

/** 画面に並べる語1つ（分類から開いたもの） */
export interface GlossaryTerm {
  id: GlossaryTermId
  categoryId: GlossaryCategoryId
  codeRefs: GlossaryCodeRef[]
}

export interface GlossaryTermText {
  /** 画面での呼び名 */
  label: string
  /** 何を指すか */
  summary: string
  /**
   * 同じ実体を、別の画面・出力・通知で呼んでいる表記。今そう出ているという事実で、
   * 揃えるかどうかは決めていない（検索で引けるように載せる）
   */
  variants: string[]
  /** その実体を呼ぶのに使わない語（使えば別のものと紛れる・以前の呼び名） */
  avoidedAliases: string[]
  /** 似た語との違い。相手の語ごとに書く */
  distinctions: Partial<Record<GlossaryTermId, string>>
}

export interface GlossaryText {
  ui: {
    title: string
    subtitle: string
    searchPlaceholder: string
    noMatch: string
    variants: string
    avoidedAliases: string
    distinctions: string
    index: string
    termCount: (count: number) => string
    copied: (name: string) => string
    copyHint: string
  }
  groups: Record<GlossaryGroupId, string>
  /** 小分類の名前。大分類が小分類を1つしか持たないときは出さない */
  categories: Record<GlossaryCategoryId, string>
  codeRefKinds: Record<GlossaryCodeRefKind, string>
  terms: Record<GlossaryTermId, GlossaryTermText>
}
