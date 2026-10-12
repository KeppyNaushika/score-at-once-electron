import type { CourseworkTermId } from "../../categories/courseworkCategory"
import type { GlossaryTermText } from "../../types"

export const COURSEWORK_TEXT_JA: Record<CourseworkTermId, GlossaryTermText> = {
  coursework: {
    label: "試験外成績資料",
    summary:
      "レポート・提出物・小テストなど、試験以外の成績を自分で入力して持つ資料。成績算出からデータソースとして参照される。",
    variants: ["資料", "新しい資料"],
    avoidedAliases: [],
    distinctions: {
      exam: "試験は答案の画像を採点する。資料は点数を直接入れる。",
    },
  },
  courseworkReferenceDate: {
    label: "実施日",
    summary: "資料をいつ行ったかの日付（任意）。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  courseworkClassroom: {
    label: "登録済み学級（試験外成績資料）",
    summary: "資料に結び付けた学級。",
    variants: ["試験外成績資料の学級"],
    avoidedAliases: [],
    distinctions: {
      gradeClassroom: "成績算出の登録済み学級と、画面の語は同じで表は別。",
    },
  },
  courseworkStudent: {
    label: "対象生徒（試験外成績資料）",
    summary: "資料の名簿の1人。点数はこの行×評価項目に付く。",
    variants: ["試験外成績資料の生徒"],
    avoidedAliases: [],
    distinctions: {},
  },
  courseworkItem: {
    label: "評価項目（試験外成績資料）",
    summary:
      "資料の中で点数を入れる単位（例: 提出物、小テスト）。満点と入力方式（数値・文字評価）を持つ。",
    variants: ["項目名", "試験外成績資料の項目"],
    avoidedAliases: [],
    distinctions: {
      gradeItem:
        "成績算出の評価項目は、画面での呼び名が同じで別の表。点数を持たず、データソースを集める。",
    },
  },
  courseworkItemMaxScore: {
    label: "満点",
    summary:
      "資料の評価項目の満点。成績算出のデータソースの満点は、ここからその場で計算する。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      convertedMaxScore: "換算満点は、成績算出の中で何点として数えるか。",
    },
  },
  courseworkInputNumeric: {
    label: "数値（入力方式）",
    summary: "評価項目の点数を数で入れる入力方式。既定。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  courseworkInputLetter: {
    label: "文字評価（入力方式）",
    summary:
      "評価記号（A/B/C など）を入れ、変換表で点数に換える入力方式。入れた記号は「評価記号」と呼ぶ。",
    variants: ["評価記号", "評価"],
    avoidedAliases: [],
    distinctions: {
      gradeLabel: "成績ラベルは成績境界から出てくる値。評価記号は入力する値。",
    },
  },
  courseworkScore: {
    label: "点数（試験外成績資料）",
    summary:
      "対象生徒×評価項目の値。数の点数か評価記号に加えて、加減点・理由・通知書に載せるコメントを持つ。",
    variants: ["点数入力", "試験外成績資料の点数"],
    avoidedAliases: [],
    distinctions: {},
  },
  courseworkScoreAdjustment: {
    label: "加減点（試験外成績資料）",
    summary: "資料の点数に足し引きする値と、その理由。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      absentEstimation:
        "欠測時推定の加減点は、推定した値に足し引きする別の設定。",
    },
  },
  courseworkLetterScale: {
    label: "変換表",
    summary:
      "文字評価の評価項目で、記号を点数に換える表（例 A=100, B=80）。同じ記号の行が2つあると画面で知らせる。",
    variants: ["評価記号 → 点数の変換表", "文字評価の変換表", "評語"],
    avoidedAliases: [],
    distinctions: {
      gradeItemBoundary:
        "成績境界は得点率をラベルに換える。変換表は記号を点数に換える（向きが逆）。",
    },
  },
  customOrder: {
    label: "並び順",
    summary:
      "名簿をドラッグで並べ替えた順（成績算出・資料それぞれ）。リセットすると学級の順 → 学級の中の出席番号の順で振り直す。出力はこの順に従う。",
    variants: ["順序"],
    avoidedAliases: [],
    distinctions: {
      attendanceNumber: "出席番号は学級での番号で、並び順とは別。",
    },
  },
}
