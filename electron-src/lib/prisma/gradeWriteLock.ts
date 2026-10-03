/**
 * 成績算出（Grade）で使われている試験・資料を開いている間の、書き込みのロック。
 *
 * **止めるのは、成績算出の結果を変える書き込みだけ。** 出力設定・統計対象の学級・
 * タグ・メンバー・採点担当・注釈・利用者の設定・監査ログなど、成績算出が読まない
 * テーブルへの書き込みは止めない。書き出しのためにロックの解除を求めると、解除した
 * まま作業を続けて、かえって誤ってデータを変えることにつながる。
 *
 * **どの書き込みを止めるかは、宣言でなく計算で決める。** 成績算出が読むテーブルは、
 * 算出が使う include（`gradeCalculationReads`）から型で導く（`GradeCalculationModel`）。
 * 書き込みごとに「止める／止めない」を名乗らせる形にすると、書き込みを足すたびに
 * 判断が1つ増え、増え続ける。粒度はテーブル単位で、列ごとの例外は作らない
 * （試験名・設問のラベルのように結果に効かない列の書き込みも止まる）。
 *
 * **止める場所は DB の手前の1か所。** Prisma のアダプタ（`sqliteConnection.ts`）が
 * 発行する SQL の書き込み先テーブルを見て断る。mutation の経路・IPC の経路・
 * トランザクション・入れ子の書き込み（`create: { … }`）・生 SQL のどれから来ても
 * 同じ判定を通る。同期（sqlite-nas-sync）とマイグレーションは Prisma を通らない
 * 別の接続で書くので、ここでは止まらない。
 *
 * **ロックを握るのは renderer。** 試験・資料の layout に置く `GradeLockProvider` が、
 * 使われていて解除していない間だけ握る（`grade-lock:hold`）。解除する・layout を出ると
 * 手放す（`grade-lock:release`）。開いている試験・資料は1つなので、握るのは1つだけで、
 * 後から握ったものが勝ち、先に握ったものの手放しは効かない。握った画面が閉じる・
 * 読み込み直すと、手放し忘れの無いよう main が外す（`gradeLockHandlers.ts`）。
 */

import type { Prisma } from "@prisma/client"

import { GRADE_WRITE_LOCKED_CODE } from "../../../src/lib/shared/gradeWriteLock"
import type { gradeCalculationReads } from "../shared/calculations/gradeCalculatorTypes"

// =====================================================================
// 成績算出が読むテーブル
// =====================================================================

/** Prisma が生成したモデルの形（`name` と、関係名 → 相手のモデルの形） */
type ModelPayload<Model extends Prisma.ModelName> =
  Prisma.TypeMap["model"][Model]["payload"]

interface PayloadShape {
  name: string
  objects: object
}

/** モデルの形だけを残す */
type AsPayload<Candidate> = Candidate extends PayloadShape ? Candidate : never

/** 関係 `Key` の相手のモデルの形（1対多の配列・省略可の null をほどく） */
type RelationPayload<
  Payload extends PayloadShape,
  Key,
> = Key extends keyof Payload["objects"]
  ? AsPayload<
      NonNullable<Payload["objects"][Key]> extends readonly (infer Element)[]
        ? Element
        : NonNullable<Payload["objects"][Key]>
    >
  : never

/** 関係の条件（`some` / `every` / `none` / `is` / `isNot`）の中身 */
type RelationFilterBody<Filter> = Filter extends {
  some: infer Body
}
  ? Body
  : Filter extends { every: infer Body }
    ? Body
    : Filter extends { none: infer Body }
      ? Body
      : Filter extends { is: infer Body }
        ? Body
        : Filter extends { isNot: infer Body }
          ? Body
          : Filter

/** where が条件に使う関係の相手のモデル名（条件も結果を変えるので読むものに数える） */
type ModelsInWhere<Payload extends PayloadShape, Where> = {
  [Key in keyof Where & keyof Payload["objects"]]:
    | RelationPayload<Payload, Key>["name"]
    | ModelsInWhere<
        RelationPayload<Payload, Key>,
        RelationFilterBody<Where[Key]>
      >
}[keyof Where & keyof Payload["objects"]]

/** include（と、その中の where）が辿る関係の相手のモデル名 */
type ModelsInInclude<Payload extends PayloadShape, Include> = {
  [Key in keyof Include & keyof Payload["objects"]]: Include[Key] extends
    false | undefined
    ? never
    : | RelationPayload<Payload, Key>["name"]
      | (Include[Key] extends { include: infer Nested }
          ? ModelsInInclude<RelationPayload<Payload, Key>, Nested>
          : never)
      | (Include[Key] extends { where: infer Where }
          ? ModelsInWhere<RelationPayload<Payload, Key>, Where>
          : never)
}[keyof Include & keyof Payload["objects"]]

/** 問い合わせ口（`prisma.<キー>`）が引くモデル */
type ModelOfDelegate<Delegate extends string> =
  Capitalize<Delegate> extends Prisma.ModelName ? Capitalize<Delegate> : never

/**
 * 読むもの（問い合わせ口 → include）が読むモデル。起点と、その include が辿る先。
 *
 * 成績算出の分は `gradeCalculationReads` から導く。読むものを変えると、この型が
 * 変わることは規約テストが確かめる。
 */
export type ModelsReadBy<Reads> = {
  [Delegate in keyof Reads & string]:
    | ModelOfDelegate<Delegate>
    | ModelsInInclude<ModelPayload<ModelOfDelegate<Delegate>>, Reads[Delegate]>
}[keyof Reads & string]

/** 成績算出が読むモデル */
type GradeCalculationModel = ModelsReadBy<typeof gradeCalculationReads>

/**
 * 成績算出が読むテーブル。
 *
 * 中身は上の型が導いたものと**過不足なく一致しなければコンパイルが通らない**
 * （`Record` が欠けを、余計なキーの検査が余りを止める）。実行時に関係名から相手の
 * モデルを引く口は Prisma の生成物に公開されていないので、型で導いた集合を実行時の
 * 値に写すためだけにここへ並べている。`gradeCalculationReads` を変えて読むものが
 * 変われば、ここを直すまで型検査が落ちる。
 */
const GRADE_CALCULATION_TABLE_FLAGS: Record<GradeCalculationModel, true> = {
  Grade: true,
  GradeClassroom: true,
  Classroom: true,
  GradeItem: true,
  GradeItemBoundary: true,
  GradeDataSource: true,
  GradeDataSourceEstimationSource: true,
  Exam: true,
  ExamPage: true,
  CropRegion: true,
  Subtotal: true,
  CropSubtotal: true,
  Coursework: true,
  CourseworkItem: true,
  CourseworkScore: true,
  CourseworkStudent: true,
  CourseworkLetterScale: true,
  GradeStudent: true,
  Student: true,
  StudentClassroomMembership: true,
  GradeOverride: true,
  GradeFrozenScore: true,
  GradeItemExclusion: true,
  ExamStudent: true,
  QuestionScore: true,
  ScoreDecision: true,
}

/** 成績算出が読むテーブル（ロック中はここへの書き込みを止める） */
export const GRADE_CALCULATION_TABLES: ReadonlySet<string> = new Set(
  Object.keys(GRADE_CALCULATION_TABLE_FLAGS)
)

// =====================================================================
// ロックの状態
// =====================================================================

/** いま握っているもの。握り直しで前の手放しが後から届いても外さないよう、印で持つ */
let heldBy: { token: string; ownerId: number } | null = null

/**
 * ロックを握る。後から握ったものが勝つ。
 *
 * @param token 握った側が決める印。手放すときに同じ印を渡す
 * @param ownerId 握った画面（webContents の id）。画面が閉じたら外すのに使う
 */
export function holdGradeWriteLock(token: string, ownerId: number): void {
  heldBy = { token, ownerId }
}

/** ロックを手放す。いま握っているものと印が違えば何もしない */
export function releaseGradeWriteLock(token: string): void {
  if (heldBy?.token === token) heldBy = null
}

/** 画面が閉じた・読み込み直したとき、その画面が握っていたロックを外す */
export function releaseGradeWriteLockOf(ownerId: number): void {
  if (heldBy?.ownerId === ownerId) heldBy = null
}

/** ロックで断った書き込みの失敗 */
class GradeWriteLockedError extends Error {
  readonly code = GRADE_WRITE_LOCKED_CODE

  constructor(table: string) {
    super(`成績算出で使われているため、ロックしています（${table}）`)
    this.name = "GradeWriteLockedError"
  }
}

/** 例外がロックで断ったものか（Prisma が包んでも `code` は引き継がれる） */
export function isGradeWriteLockedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === GRADE_WRITE_LOCKED_CODE
  )
}

// =====================================================================
// SQL の書き込み先
// =====================================================================

/** 書き込みの文の頭。書き込み先のテーブル名を取り出す */
const WRITE_STATEMENT =
  /^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM)\s+(?:[`"[]?\w+[`"\]]?\s*\.\s*)?[`"[]?(\w+)[`"\]]?/i

/** 書き込みを含むかもしれない文（WITH から始まる文など、頭で書き込み先を読めないもの） */
const MAY_WRITE = /\b(?:INSERT|REPLACE|UPDATE|DELETE)\b/i

/**
 * 文の書き込み先のテーブル。書き込みでなければ null。
 *
 * 書き込みらしいのに書き込み先を読めない文は `"?"` を返し、ロック中は止める側に倒す。
 */
export function writeTargetOf(sql: string): string | null {
  const match = WRITE_STATEMENT.exec(sql)
  if (match) return match[1]
  if (
    /^\s*(?:SELECT|PRAGMA|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(sql)
  ) {
    return null
  }
  return MAY_WRITE.test(sql) ? "?" : null
}

/** ロック中に、成績算出が読むテーブルへ書く文なら断る */
export function assertGradeWriteAllowed(sql: string): void {
  if (heldBy === null) return
  const target = writeTargetOf(sql)
  if (target === null) return
  if (target === "?" || GRADE_CALCULATION_TABLES.has(target)) {
    throw new GradeWriteLockedError(target)
  }
}
