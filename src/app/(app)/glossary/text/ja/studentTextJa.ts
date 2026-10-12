import type { StudentTermId } from "../../categories/studentCategory"
import type { GlossaryTermText } from "../../types"

export const STUDENT_TEXT_JA: Record<StudentTermId, GlossaryTermText> = {
  student: {
    label: "生徒",
    summary:
      "学校の生徒1人。学籍番号・姓・名・姓カナ・名カナ・入学年度を持つ。学籍番号は重なってよく、見分けは内部の id で行う。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      examStudent: "受験生徒は、生徒を1つの試験に登録したもの。",
    },
  },
  studentNumber: {
    label: "学籍番号",
    summary: "生徒そのものに付く番号。学級が変わっても変わらない。",
    variants: ["生徒番号"],
    avoidedAliases: [],
    distinctions: {
      attendanceNumber: "出席番号は学級所属に付く番号で、年度ごとに変わる。",
      studentIdArea:
        "番号欄は答案の上で番号を書かせる枠。学籍番号そのものではない。",
    },
  },
  studentKana: {
    label: "姓カナ・名カナ",
    summary: "生徒の名前の読み。今は必須。",
    variants: ["ふりがな", "姓（カナ）"],
    avoidedAliases: [],
    distinctions: {},
  },
}
