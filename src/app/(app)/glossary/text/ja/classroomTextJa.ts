import type { ClassroomTermId } from "../../categories/classroomCategory"
import type { GlossaryTermText } from "../../types"

export const CLASSROOM_TEXT_JA: Record<ClassroomTermId, GlossaryTermText> = {
  classroom: {
    label: "学級",
    summary:
      "生徒が所属する組（例「1年A組」）。学級名・学級コード・学年・説明・表示/非表示を持つ。年度が違えば同じ名前でも別の学級。",
    variants: ["クラス"],
    avoidedAliases: [],
    distinctions: {
      examClassroom: "試験の学級は、学級を1つの試験に結び付けたもの。",
      grade:
        "学級の「学年」の列は grade だが、成績算出（Grade）とは関係しない。",
    },
  },
  classroomCode: {
    label: "学級コード",
    summary: "学級を所属の表示などで短く示す表記。",
    variants: ["クラスコード", "コード"],
    avoidedAliases: [],
    distinctions: {},
  },
  classroomMembership: {
    label: "学級所属",
    summary:
      "ある生徒がある学級にいつからいつまで所属するかの記録。開始日・終了日（任意）・出席番号・備考を持ち、年度ごとに重ねていく。",
    variants: ["所属関係", "所属学級", "生徒の学級所属", "在籍"],
    avoidedAliases: [],
    distinctions: {
      examClassroom:
        "試験の学級は試験と学級の結び付き。学級所属は生徒と学級の結び付き（日付つき）。",
    },
  },
  membershipPhase: {
    label: "在籍中・在籍予定・過去在籍",
    summary:
      "学級所属の時期。開始日より前は在籍予定、開始日から終了日までは在籍中、終了日を過ぎると過去在籍。保存せず、日付から毎回決める。",
    variants: [
      "所属状況",
      "終了",
      "終了済み",
      "過去の所属",
      "未在籍",
      "未所属",
    ],
    avoidedAliases: [],
    distinctions: {
      examStudentStatus:
        "受験状態（受験・見込・欠席）は1つの試験での生徒の状態で、学級所属の時期とは関係しない。",
    },
  },
  attendanceNumber: {
    label: "出席番号",
    summary:
      "学級の中での生徒の番号。学級所属ごとに持つので、学級が変われば番号も変わる。",
    variants: ["番号"],
    avoidedAliases: [],
    distinctions: {
      studentNumber: "学籍番号は生徒そのものに付く番号。",
      customOrder: "並び順は名簿をドラッグで並べ替えた順で、出席番号とは別。",
    },
  },
}
