/**
 * coursework-archive 1.1.0 → 1.2.0
 *
 * 資料の実施日のキーを `date` から `referenceDate` へ改名した。
 *
 * 「その実体がいつのものか（在籍判定の基準日）」という同じ役割の日付を、試験・資料・成績が
 * examDate / date / referenceDate という別々の名前で持っていた。DB の列名を referenceDate へ
 * 揃えたので、アーカイブのキーも合わせる（このアーカイブは Prisma の行をそのまま持つ形で、
 * 列名とキー名がずれると読み書きの両側に対応表が要る）。
 *
 * **値そのものは変わらない**（キーの付け替えだけ）ので警告は出さない。
 * 既に referenceDate を持つ行はその値を優先するので冪等。
 */

import type {
  ArchiveCourseworkRow,
  CourseworkArchiveVersion,
} from "../../../../src/types/courseworkArchive.types"
import {
  type AnyCourseworkArchiveData,
  type CourseworkTransformResult,
  type CourseworkVersionTransformer,
  isCourseworkArchiveV1_0_0,
} from "./types"

/**
 * 旧キー date を新キー referenceDate へ移す。
 *
 * 引数の型で「新キーはまだ無いかもしれず、旧キーがあるかもしれない」と名乗ることで、
 * 旧形式の行も現行形式の行も同じ関数へ渡せる（`as` は要らない）。
 */
const renameDateToReferenceDate = (
  coursework: Omit<ArchiveCourseworkRow, "referenceDate"> & {
    referenceDate?: unknown
    date?: unknown
  }
): ArchiveCourseworkRow => {
  const { date, ...rest } = coursework
  const referenceDate =
    typeof rest.referenceDate === "string"
      ? rest.referenceDate
      : typeof date === "string"
        ? date
        : null
  return { ...rest, referenceDate }
}

export class V1_1_0_to_V1_2_0_Transformer implements CourseworkVersionTransformer {
  readonly fromVersion: CourseworkArchiveVersion = "1.1.0"
  readonly toVersion: CourseworkArchiveVersion = "1.2.0"

  transform(data: AnyCourseworkArchiveData): CourseworkTransformResult {
    // 入れ子のままここへ来ることは無い（前段が平坦化する）が、型の上では起こりうる。
    // 触らずに通す（この版で変えるのは平坦なセクションの1キーだけ）
    if (isCourseworkArchiveV1_0_0(data)) {
      return {
        data: {
          ...data,
          manifest: { ...data.manifest, version: this.toVersion },
        },
        warnings: [],
      }
    }

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        courseworks: data.courseworks.map(renameDateToReferenceDate),
      },
      warnings: [],
    }
  }
}
