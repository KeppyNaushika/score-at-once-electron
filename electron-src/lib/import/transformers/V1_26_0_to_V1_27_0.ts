/**
 * v1.26.0 → v1.27.0 変換器
 *
 * 試験の日付のキーを `examDate` から `referenceDate` へ改名した。
 *
 * 「その実体がいつのものか（在籍判定の基準日）」という同じ役割の日付を、試験・資料・成績が
 * それぞれ examDate / date / referenceDate という別々の名前で持っていた。DB の列名を
 * referenceDate へ揃えたので、アーカイブのキーも合わせる（アーカイブは Prisma の行を
 * そのまま持つ形なので、列名とキー名がずれると読み書きの両側に対応表が要る）。
 *
 * **値そのものは変わらない**（キーの付け替えだけ）ので警告は出さない。旧アーカイブの
 * examDate をそのまま referenceDate へ移し、日付を持たない旧アーカイブは null になる。
 *
 * 既に referenceDate を持つ行はその値を優先するので冪等。
 */

import type {
  ArchiveExamData,
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

type ArchiveExam = ArchiveExamData["exam"]

/**
 * 旧キー examDate を新キー referenceDate へ移す。
 *
 * 引数の型で「新キーはまだ無いかもしれず、旧キーがあるかもしれない」と名乗ることで、
 * 旧形式の行も現行形式の行も同じ関数へ渡せる（`as` は要らない）。
 */
const renameExamDateToReferenceDate = (
  exam: Omit<ArchiveExam, "referenceDate"> & {
    referenceDate?: unknown
    examDate?: unknown
  }
): ArchiveExam => {
  const { examDate, ...rest } = exam
  const referenceDate =
    typeof rest.referenceDate === "string"
      ? rest.referenceDate
      : typeof examDate === "string"
        ? examDate
        : null
  return { ...rest, referenceDate }
}

export class V1_26_0_to_V1_27_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.26.0"
  readonly toVersion: ExamArchiveVersion = "1.27.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        examData: {
          ...data.examData,
          exam: renameExamDateToReferenceDate(data.examData.exam),
        },
      },
      warnings: [],
    }
  }
}
