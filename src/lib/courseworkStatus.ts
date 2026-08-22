/**
 * 試験外成績資料（Coursework）のステータス判定ユーティリティ
 *
 * 一覧の「次のステップ」列に出す、4段ワークフローの現在地を求める。
 * 試験（examStatus）・成績（gradeStatus）と同じく、表示文言と遷移 URL は
 * presentation 情報なので main では組まず renderer 側の唯一の実装として持つ。
 */

import type { Prisma } from "@prisma/client"

import type { Serialized } from "@/types/prismaExtensions"

/**
 * 進捗判定 `getCourseworkCompletion` が読む資料1件。
 *
 * 一覧（`coursework.getAll`）と概要（`coursework.getById`）の双方が、この include を
 * 含む形で取っている。**手で `{ id, students, items }` と書き写してはいけない**
 * （列やリレーションが増減しても検査に掛からず、`rowTypeConventions` が捕まえる）。
 * 成績の `GradeProgressSource` と同じく Prisma の payload から導き、読む3つだけを
 * `Pick` で切り出す —— 判定のために新しい include を足させないための形。
 * 境界を越えた後の行なので `Serialized`（Decimal → number）を被せる。
 */
export type CourseworkProgressSource = Pick<
  Serialized<
    Prisma.CourseworkGetPayload<{
      include: { students: true; items: true }
    }>
  >,
  "id" | "students" | "items"
>

interface CourseworkStatus {
  step: number
  text: string
  url: string
}

/** 各段の完了状態 */
export interface CourseworkStepCompletion {
  /** 1. 生徒管理（02-students） */
  hasStudents: boolean
  /** 2. 評価項目（03-items） */
  hasItems: boolean
}

/**
 * 試験外成績資料の各段の完了状態を取得する。
 *
 * **「3. 点数入力」の完了は判定できない。** 点数（CourseworkScore）は一覧の
 * 取得（`getCourseworks`）にも概要の名前セル2行目にも含まれておらず、
 * 判定のためだけに include を増やすことはしない。ゆえに完了状態は
 * 生徒と評価項目の2つで、点数入力が「次のステップ」の行き止まりになる。
 */
export function getCourseworkCompletion(
  coursework: CourseworkProgressSource
): CourseworkStepCompletion {
  return {
    hasStudents: coursework.students.length > 0,
    hasItems: coursework.items.length > 0,
  }
}

/**
 * 試験外成績資料の「次のステップ」を導出する。
 *
 * 前の段が空なら、そこが次のステップ。すべて埋まっていれば点数入力を指す
 * （試験・成績が最後に出力の段を指し続けるのと同じで、行き止まりの段は
 * 「もう何も無い」ではなく「今やる仕事」を出し続ける）。
 * 「4. 結果」は集計の確認であって作業ではないので、ここからは提案しない。
 */
export function getCourseworkStatus(
  coursework: CourseworkProgressSource
): CourseworkStatus {
  const id = coursework.id
  const completion = getCourseworkCompletion(coursework)

  if (!completion.hasStudents) {
    return {
      step: 2,
      text: "生徒の登録",
      url: `/coursework/${id}/02-students`,
    }
  }

  if (!completion.hasItems) {
    return {
      step: 3,
      text: "評価項目の設定",
      url: `/coursework/${id}/03-items`,
    }
  }

  return {
    step: 4,
    text: "点数の入力",
    url: `/coursework/${id}/04-scores`,
  }
}
