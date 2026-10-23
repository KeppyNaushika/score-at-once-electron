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
      exam: "試験は答案の画像を採点する。資料は得点や資料評価記号を直接入れる。",
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
    variants: ["資料の学級"],
    avoidedAliases: [],
    distinctions: {
      gradeClassroom: "成績算出の登録済み学級と、画面の語は同じで表は別。",
    },
  },
  courseworkStudent: {
    label: "対象生徒（試験外成績資料）",
    summary:
      "資料の名簿の1人。得点や資料評価記号は、この行×資料評価項目に付く。",
    variants: ["資料の対象生徒"],
    avoidedAliases: [],
    distinctions: {},
  },
  courseworkItem: {
    label: "資料評価項目",
    summary:
      "資料の中で、生徒ごとの得点や資料評価記号を入れる単位（例: 提出物、小テスト）。配点と入力方式（点数・評価記号）を持つ。",
    variants: ["項目名"],
    avoidedAliases: ["評価項目"],
    distinctions: {
      gradeItem: "成績評価項目は別の表。得点を持たず、データソースを集める。",
    },
  },
  courseworkItemMaxScore: {
    label: "配点（資料評価項目）",
    summary:
      "資料評価項目の配点。成績算出のデータソースの配点は、ここからその場で計算する。",
    variants: [],
    avoidedAliases: ["満点"],
    distinctions: {
      convertedMaxScore: "換算配点は、成績算出の中で何点として数えるか。",
      pointAllocation: "配点は、項目に定める100%の点数の総称。",
    },
  },
  courseworkInputNumeric: {
    label: "点数（入力方式）",
    summary: "資料評価項目の得点を数で入れる入力方式。既定。",
    variants: [],
    avoidedAliases: ["数値"],
    distinctions: {},
  },
  courseworkInputLetter: {
    label: "評価記号（入力方式）",
    summary:
      "資料評価記号（A/B/C など）を入れ、変換表で点数に換える入力方式。入れた記号は「資料評価記号」と呼ぶ。",
    variants: ["資料評価記号"],
    avoidedAliases: ["文字評価", "評語"],
    distinctions: {
      gradeLabel:
        "成績評価記号は成績境界から出てくる値。資料評価記号は入力する値。",
    },
  },
  courseworkScore: {
    label: "得点（試験外成績資料）",
    summary:
      "対象生徒×資料評価項目の点数。入力方式が点数なら入れた数、評価記号なら変換表で資料評価記号を換えた点数。加減点はこの点数に足し引きする。",
    variants: ["得点入力", "資料の得点"],
    avoidedAliases: ["点数入力"],
    distinctions: {
      courseworkInputLetter:
        "資料評価記号そのものは得点ではない。マス1つには、得点か資料評価記号と、加減点・理由・個人成績通知書に載せるコメントを入れる。",
    },
  },
  courseworkScoreAdjustment: {
    label: "加減点（試験外成績資料）",
    summary: "資料の得点に足し引きする値と、その理由。",
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
      "入力方式が評価記号の資料評価項目で、資料評価記号を点数に換える表（例 A=100, B=80）。同じ記号の行が2つあると画面で知らせる。",
    variants: ["評価記号 → 点数の変換表"],
    avoidedAliases: ["文字評価の変換表", "評語"],
    distinctions: {
      gradeItemBoundary:
        "成績境界は得点率を成績評価記号に換える。変換表は資料評価記号を点数に換える（向きが逆）。",
    },
  },
  customOrder: {
    label: "並び順",
    summary:
      "名簿をドラッグで並べ替えた順（成績算出・資料それぞれ）。リセットすると学級の順 → 学級の中の出席番号の順で振り直す。出力はこの順に従う。",
    variants: [],
    avoidedAliases: ["順序"],
    distinctions: {
      attendanceNumber: "出席番号は学級での番号で、並び順とは別。",
    },
  },
}
