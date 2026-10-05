/**
 * 監査ログの絞り込みの欄（フィールド）の定義。**次元を足すときはここに1項目足すだけ。**
 *
 * 画面の状態は「確定した欄（トークン）の並び＋未確定の文字列」という構造で持つ
 * （状態の型と URL との往復は `src/lib/auditLogFilterQuery.ts`）。
 * 文字列の構文（`student:…`）は入力の手がかりにだけ使い、任意の文字列をパースして
 * 状態を作ることはしない（docs/audit-log-redesign.md「フィルタ UI」）。
 *
 * 各欄は、候補の出し方（`candidates`）と、絞り込み条件への写し方（`apply`）を持つ。
 * 候補の出どころは、作業領域・対象ならログ自身（`audit:getScopes`）、操作者なら利用者の一覧、
 * 種別・カテゴリならカタログ。
 */

import type {
  AuditLogFilter,
  AuditScopeFacet,
  AuditTargetFacet,
} from "@/electron-src/lib/prisma/auditQuery"
import {
  type AuditFilterFieldKey,
  type AuditFilterState,
  type AuditFilterToken,
  isDateText,
} from "@/lib/auditLogFilterQuery"
import { matchesSearchTerm } from "@/lib/searchText"
import {
  AUDIT_VERBS,
  auditActionKeysOfVerb,
  type AuditTargetType,
} from "@/lib/shared/auditActions"
import type { PublicUser } from "@/queries/user"

import {
  CATEGORY_LABELS,
  isAuditCategory,
  isAuditVerb,
  VERB_META,
} from "./constants"

/** 候補1つ。選ぶと `tokens` が足される（採点領域は試験の欄も一緒に足す） */
export interface AuditFilterCandidate {
  /** 候補の中で一意な値（cmdk の value・React の key） */
  key: string
  label: string
  /** 候補の横に添える補足（採点領域なら試験名） */
  description?: string
  tokens: AuditFilterToken[]
}

/** 候補を作るための材料 */
export interface AuditFilterSources {
  scopes: AuditScopeFacet[]
  targets: AuditTargetFacet[]
  users: PublicUser[]
  /** いま確定している欄（依存する欄の候補を絞るのに使う） */
  tokens: AuditFilterToken[]
}

interface AuditFilterField {
  key: AuditFilterFieldKey
  /** 入力欄で打つ名前（`student:`） */
  keyword: string
  /** 画面に出す名前 */
  label: string
  /** 同じ欄を複数並べられるか。並べられない欄は、選び直すと置き換わる */
  multiple: boolean
  /** 今の状態でこの欄を選べるか（省略時は常に選べる） */
  isAvailable?: (tokens: AuditFilterToken[]) => boolean
  /** 打った文字列（`student:` の後ろ）に合う候補 */
  candidates: (
    sources: AuditFilterSources,
    query: string
  ) => AuditFilterCandidate[]
  /** 絞り込み条件へ写す */
  apply: (filter: AuditLogFilter, token: AuditFilterToken) => AuditLogFilter
}

/** 名前の違う行が複数あるときは並べて出す（改名前後のどちらで打っても引っかかる） */
const joinLabels = (labels: Iterable<string>): string =>
  [...labels].join(" / ") || "（名前なし）"

/** 作業領域を id ごとにまとめる（名前が変わった作業領域は複数の行で届く） */
const groupScopes = (scopes: AuditScopeFacet[]) => {
  const scopeById = new Map<string, { labels: Set<string>; category: string }>()
  for (const scope of scopes) {
    const entry = scopeById.get(scope.scopeId) ?? {
      labels: new Set<string>(),
      category: scope.category,
    }
    if (scope.scopeLabel) entry.labels.add(scope.scopeLabel)
    scopeById.set(scope.scopeId, entry)
  }
  return scopeById
}

/** 対象を id ごとにまとめ、それが現れた作業領域も集める */
const groupTargets = (
  targets: AuditTargetFacet[],
  targetType: AuditTargetType
) => {
  const targetById = new Map<
    string,
    { labels: Set<string>; scopeLabelById: Map<string, string | null> }
  >()
  for (const target of targets) {
    if (target.targetType !== targetType) continue
    const entry = targetById.get(target.targetId) ?? {
      labels: new Set<string>(),
      scopeLabelById: new Map<string, string | null>(),
    }
    if (target.targetLabel) entry.labels.add(target.targetLabel)
    if (target.scopeId)
      entry.scopeLabelById.set(target.scopeId, target.scopeLabel)
    targetById.set(target.targetId, entry)
  }
  return targetById
}

const scopeTokenOf = (
  scopeId: string,
  scopeLabel: string | null
): AuditFilterToken => ({
  field: "scope",
  value: scopeId,
  label: scopeLabel ?? "（名前なし）",
})

/** 候補の文言（と補足）に、打った文字列が含まれるものだけ残す */
const matching = (
  candidates: AuditFilterCandidate[],
  query: string
): AuditFilterCandidate[] =>
  candidates.filter((candidate) =>
    matchesSearchTerm(query, [candidate.label, candidate.description])
  )

/** 日付の欄の候補: 打った日付が読めれば、それを1つだけ出す */
const dateCandidates =
  (field: "since" | "until", suffix: string) =>
  (_sources: AuditFilterSources, query: string): AuditFilterCandidate[] => {
    const dateText = query.trim()
    if (!isDateText(dateText)) return []
    return [
      {
        key: `${field}:${dateText}`,
        label: `${dateText}${suffix}`,
        tokens: [{ field, value: dateText, label: `${dateText}${suffix}` }],
      },
    ]
  }

const addTarget = (
  filter: AuditLogFilter,
  targetType: AuditTargetType,
  targetId: string
): AuditLogFilter => ({
  ...filter,
  targets: [...(filter.targets ?? []), { targetType, targetId }],
})

export const AUDIT_FILTER_FIELDS: readonly AuditFilterField[] = [
  {
    key: "scope",
    keyword: "scope",
    label: "作業領域",
    multiple: false,
    candidates: (sources, query) =>
      matching(
        [...groupScopes(sources.scopes)].map(([scopeId, scope]) => {
          const label = joinLabels(scope.labels)
          return {
            key: `scope:${scopeId}`,
            label,
            description: isAuditCategory(scope.category)
              ? CATEGORY_LABELS[scope.category]
              : undefined,
            tokens: [{ field: "scope", value: scopeId, label }],
          }
        }),
        query
      ),
    apply: (filter, token) => ({ ...filter, scopeId: token.value }),
  },
  {
    key: "student",
    keyword: "student",
    label: "生徒",
    multiple: true,
    candidates: (sources, query) =>
      matching(
        [...groupTargets(sources.targets, "Student")].map(
          ([studentId, student]) => {
            const label = joinLabels(student.labels)
            return {
              key: `student:${studentId}`,
              label,
              tokens: [{ field: "student", value: studentId, label }],
            }
          }
        ),
        query
      ),
    apply: (filter, token) => addTarget(filter, "Student", token.value),
  },
  {
    key: "cropRegion",
    keyword: "region",
    label: "採点領域",
    multiple: true,
    // 同じ名前（「1-1」「氏名」）の採点領域が多くの試験にあるので、試験名を必ず添える。
    // 試験が確定していればその試験の中だけを出し、未確定なら全試験から探して、
    // 選んだときに試験の欄も一緒に足す
    candidates: (sources, query) => {
      const selectedScopeId = sources.tokens.find(
        (token) => token.field === "scope"
      )?.value
      return matching(
        [...groupTargets(sources.targets, "CropRegion")]
          .filter(
            ([, cropRegion]) =>
              !selectedScopeId || cropRegion.scopeLabelById.has(selectedScopeId)
          )
          .map(([cropRegionId, cropRegion]) => {
            const label = joinLabels(cropRegion.labels)
            const scopeEntries = [...cropRegion.scopeLabelById]
            const regionToken: AuditFilterToken = {
              field: "cropRegion",
              value: cropRegionId,
              label,
            }
            return {
              key: `cropRegion:${cropRegionId}`,
              label,
              description: joinLabels(
                scopeEntries.flatMap(([, scopeLabel]) =>
                  scopeLabel ? [scopeLabel] : []
                )
              ),
              tokens:
                !selectedScopeId && scopeEntries.length === 1
                  ? [regionToken, scopeTokenOf(...scopeEntries[0])]
                  : [regionToken],
            }
          }),
        query
      )
    },
    apply: (filter, token) => addTarget(filter, "CropRegion", token.value),
  },
  {
    key: "user",
    keyword: "user",
    label: "操作者",
    multiple: false,
    candidates: (sources, query) =>
      sources.users
        .filter((user) => matchesSearchTerm(query, [user.name, user.username]))
        .map((user) => ({
          key: `user:${user.id}`,
          label: user.name,
          description: user.username,
          tokens: [{ field: "user", value: user.id, label: user.name }],
        })),
    apply: (filter, token) => ({ ...filter, userId: token.value }),
  },
  {
    key: "verb",
    keyword: "is",
    label: "操作種別",
    multiple: true,
    candidates: (_sources, query) =>
      matching(
        AUDIT_VERBS.map((verb) => ({
          key: `verb:${verb}`,
          label: VERB_META[verb].label,
          tokens: [
            { field: "verb", value: verb, label: VERB_META[verb].label },
          ],
        })),
        query
      ),
    // 複数の種別はどれか（和集合）。DB に verb の列は無いので action の集合へ展開する
    apply: (filter, token) =>
      isAuditVerb(token.value)
        ? {
            ...filter,
            actions: [
              ...(filter.actions ?? []),
              ...auditActionKeysOfVerb(token.value),
            ],
          }
        : filter,
  },
  {
    key: "category",
    keyword: "category",
    label: "カテゴリ",
    multiple: false,
    // 作業領域を選んだら効かない（同じ試験のログはほぼ全部が「試験」）
    isAvailable: (tokens) => !tokens.some((token) => token.field === "scope"),
    candidates: (_sources, query) =>
      matching(
        Object.entries(CATEGORY_LABELS).map(([category, label]) => ({
          key: `category:${category}`,
          label,
          tokens: [{ field: "category", value: category, label }],
        })),
        query
      ),
    apply: (filter, token) =>
      isAuditCategory(token.value)
        ? { ...filter, category: token.value }
        : filter,
  },
  {
    key: "since",
    keyword: "since",
    label: "この日から",
    multiple: false,
    candidates: dateCandidates("since", " から"),
    apply: (filter, token) => ({
      ...filter,
      dateFrom: new Date(`${token.value}T00:00:00`).toISOString(),
    }),
  },
  {
    key: "until",
    keyword: "until",
    label: "この日まで",
    multiple: false,
    candidates: dateCandidates("until", " まで"),
    apply: (filter, token) => ({
      ...filter,
      dateTo: new Date(`${token.value}T23:59:59.999`).toISOString(),
    }),
  },
]

const fieldByKey = new Map(
  AUDIT_FILTER_FIELDS.map((field) => [field.key, field])
)

/** 欄の定義（key から） */
export const auditFilterFieldOf = (
  key: AuditFilterFieldKey
): AuditFilterField | undefined => fieldByKey.get(key)

/** 入力欄で打つ名前（`student`）から欄の定義を引く */
export const auditFilterFieldByKeyword = (
  keyword: string
): AuditFilterField | undefined =>
  AUDIT_FILTER_FIELDS.find((field) => field.keyword === keyword)

/**
 * 確定している欄に、選んだ候補の欄を足す。
 *
 * 並べられない欄（作業領域・操作者など）は置き換え、並べられる欄は同じ値を重ねない。
 * 作業領域を選んだらカテゴリの欄は外す（作業領域の中ではカテゴリは効かない）。
 */
export function addAuditFilterTokens(
  current: AuditFilterToken[],
  added: AuditFilterToken[]
): AuditFilterToken[] {
  return added.reduce((tokens, token) => {
    const field = fieldByKey.get(token.field)
    const kept = tokens.filter((existing) => {
      if (existing.field !== token.field) {
        return !(token.field === "scope" && existing.field === "category")
      }
      return field?.multiple ? existing.value !== token.value : false
    })
    return [...kept, token]
  }, current)
}

/** 画面の状態を、main へ渡す絞り込み条件にする */
export function toAuditLogFilter(state: AuditFilterState): AuditLogFilter {
  const filter = state.tokens.reduce<AuditLogFilter>((acc, token) => {
    const field = fieldByKey.get(token.field)
    if (!field) return acc
    if (field.isAvailable && !field.isAvailable(state.tokens)) return acc
    return field.apply(acc, token)
  }, {})
  return state.search ? { ...filter, search: state.search } : filter
}
