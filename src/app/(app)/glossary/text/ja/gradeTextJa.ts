import type { GradeTermId } from "../../categories/gradeCategory"
import type { GlossaryTermText } from "../../types"

export const GRADE_TEXT_JA: Record<GradeTermId, GlossaryTermText> = {
  grade: {
    label: "成績算出",
    summary:
      "試験・資料の点数を評価項目ごとに集めて、成績境界で成績ラベルを付ける単位。点数は自分では持たず、データソースを通して参照する。",
    variants: ["新しい成績", "成績"],
    avoidedAliases: [],
    distinctions: {
      coursework:
        "試験外成績資料は点数を自分で持つ素材。成績算出はそれを参照して集める側。",
    },
  },
  gradeReferenceDate: {
    label: "成績算出日",
    summary:
      "その成績算出がいつのものかを表す日付（任意）。学級から生徒を足すとき、在籍しているかをこの日で判定する（無ければ今日）。",
    variants: ["基準日"],
    avoidedAliases: [],
    distinctions: {
      courseworkReferenceDate:
        "資料の実施日と同じ列名（referenceDate）だが、画面での呼び名が違う。",
    },
  },
  gradeClassroom: {
    label: "登録済み学級（成績算出）",
    summary:
      "成績算出に結び付けた学級。並び順をリセットするときの学級の順になる。",
    variants: ["成績の学級"],
    avoidedAliases: [],
    distinctions: {
      gradeStudent:
        "対象生徒は成績を付ける1人1人。学級を外しても、ほかの学級から入った生徒は残せる。",
    },
  },
  gradeStudent: {
    label: "対象生徒（成績算出）",
    summary:
      "成績算出の名簿の1人。上書き・確定値・評価項目の除外は、人ではなくこの名簿の行に付く。",
    variants: ["成績の生徒"],
    avoidedAliases: [],
    distinctions: {
      courseworkStudent:
        "資料の対象生徒は別の名簿。資料から外しても成績算出の名簿は変わらない。",
    },
  },
  gradeItem: {
    label: "評価項目（成績算出）",
    summary:
      "成績算出の中の評価の単位（例: 知識・技能、思考・判断・表現、評定）。データソース・成績境界・比較はこの単位に付く。",
    variants: ["観点"],
    avoidedAliases: [],
    distinctions: {
      courseworkItem:
        "資料の評価項目は、画面での呼び名が同じで別の表。満点と入力方式を持ち、点数を直接入れる。成績算出の評価項目は点数を持たず、データソースを集める。",
      rubricItem: "採点項目は設問の中の採点の基準。成績とは関係しない。",
    },
  },
  gradeDataSource: {
    label: "データソース",
    summary:
      "評価項目に入れる素材（試験の合計・小計・設問・資料の評価項目・資料全体）。種類によって、どの参照の列を使うかが決まる。",
    variants: ["成績資料", "データ元", "成績のデータソース"],
    avoidedAliases: [],
    distinctions: {
      coursework: "試験外成績資料は、データソースが指す先の1つ。",
    },
  },
  dataSourceExamTotal: {
    label: "全設問合計",
    summary: "試験1つの合計点を素材にするデータソースの種類。",
    variants: ["合計", "試験の合計点"],
    avoidedAliases: [],
    distinctions: {
      dataSourceSubtotal: "小計点は試験の一部（小計）だけを使う。",
    },
  },
  dataSourceSubtotal: {
    label: "小計点",
    summary:
      "試験の小計項目1つを素材にするデータソースの種類。小計点グループは試験をまたいで使うので、試験も合わせて指す。",
    variants: ["小計"],
    avoidedAliases: ["観点", "観点グループ"],
    distinctions: {
      gradeItem:
        "観点間制約の「観点」は成績算出の評価項目のこと。小計点とは別のもの。",
    },
  },
  dataSourceCropRegion: {
    label: "設問（データソース）",
    summary: "試験の設問1つの点数を素材にするデータソースの種類。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  dataSourceCoursework: {
    label: "試験外成績資料（データソース）",
    summary: "資料の評価項目1つの点数を素材にするデータソースの種類。",
    variants: ["資料", "評価項目"],
    avoidedAliases: [],
    distinctions: {
      dataSourceCourseworkTotal: "資料合計は資料の全評価項目を合わせる。",
    },
  },
  dataSourceCourseworkTotal: {
    label: "資料合計",
    summary:
      "資料全体を参照し、全評価項目の点数を合わせて素材にするデータソースの種類。",
    variants: ["（資料全体）", "全項目"],
    avoidedAliases: [],
    distinctions: {},
  },
  convertedMaxScore: {
    label: "換算満点",
    summary:
      "そのデータソースを評価項目の中で何点満点として数えるか。素点 ÷ 満点 × 換算満点で換算する。",
    variants: ["換算得点", "重み"],
    avoidedAliases: [],
    distinctions: {
      courseworkItemMaxScore:
        "満点は元データからその場で計算する値で、列には持たない。換算満点は成績算出の中での数え方。",
    },
  },
  absentEstimation: {
    label: "欠測時推定",
    summary:
      "データソースに点が無い生徒の値をどう埋めるかの設定。推定方法（なし・0点・平均比率法・重回帰法・順位法・標準偏差法）、乗率、加減点、「見込」を欠測とするかを持つ。",
    variants: ["欠測推定", "欠測一括設定"],
    avoidedAliases: [],
    distinctions: {
      gradeItemExclusion:
        "評価項目の除外は、推定せずにその生徒の評価項目を計算から外す。",
      courseworkScoreAdjustment:
        "資料の加減点（点数に足し引きする値）と同じ語だが別のもの。",
    },
  },
  estimationSource: {
    label: "推定に使用するソース",
    summary:
      "欠測を推定する材料にする、同じ成績算出の中のほかのデータソース。「選択」にしたときだけ使う（既定は「自ソース以外の全て」）。",
    variants: ["推定元"],
    avoidedAliases: [],
    distinctions: {},
  },
  gradeItemExclusion: {
    label: "評価項目の除外",
    summary:
      "特定の対象生徒について、ある評価項目を成績算出から外す設定（名簿の行×評価項目）。画面では「対象生徒」から開く。",
    variants: ["除外", "対象生徒設定"],
    avoidedAliases: [],
    distinctions: {
      gradeStudent:
        "名簿から外すとすべての評価項目から消える。除外はその項目だけを外し、生徒は名簿に残る。",
    },
  },
  gradeItemBoundary: {
    label: "成績境界",
    summary:
      "評価項目ごとに「得点率がこの % 以上ならこの成績ラベル」を1行ずつ並べた表。行が無ければ境界は無い。",
    variants: ["境界設定", "成績境界設定"],
    avoidedAliases: [],
    distinctions: {
      gradeConstraint:
        "観点間制約も同じ段で設定するが、境界ではなく、付いたラベルの組み合わせを確かめるもの。",
      courseworkLetterScale:
        "変換表は記号を点数に換える。成績境界は得点率をラベルに換える（向きが逆）。",
    },
  },
  gradeLabel: {
    label: "成績ラベル",
    summary:
      "成績境界で付く記号（A/B/C、5〜1 など）。結果の画面で押すと手で書き換えられる。",
    variants: ["ラベル", "評定", "評価", "評語"],
    avoidedAliases: [],
    distinctions: {
      gradeItem: "「評定」は評価項目の名前（総括の項目）にも使われている。",
      courseworkInputLetter:
        "資料の評価記号は入力する値。成績ラベルは境界から出てくる値。",
    },
  },
  gradeConstraint: {
    label: "観点間の制約ルール",
    summary:
      "観点別の評価と評定の組み合わせが校内のきまりに合わない生徒を、結果の表で色を付けて知らせるルール。成績の値は変えない。",
    variants: ["制約ルール", "観点間制約", "ルール"],
    avoidedAliases: [],
    distinctions: {
      gradeItemBoundary:
        "成績境界はラベルを決める。制約は決まったラベルの組み合わせを確かめる。",
    },
  },
  constraintConsistency: {
    label: "整合（観点集計と評定）",
    summary:
      "選んだ観点のラベルを数に換えて平均（または合計）し、評定とのずれが許容差を超えたら知らせる制約の種類。",
    variants: ["整合ルール"],
    avoidedAliases: [],
    distinctions: {},
  },
  constraintMutualExclusion: {
    label: "混在禁止",
    summary:
      "観点の中に、選んだラベルのうち2つ以上が現れたら知らせる制約の種類（例: A と C の混在）。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  constraintExpression: {
    label: "上級: 式",
    summary:
      "item・label・has・count・sum・mean などの関数で条件を書き、式が真になった生徒に色を付ける制約の種類。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  gradeOverride: {
    label: "成績ラベルの手動上書き",
    summary:
      "教員が対象生徒×評価項目の成績ラベルを手で書き換えた記録。元データが変わっても書き換えたラベルが残る。",
    variants: [
      "手動入力",
      "手動で上書きした評定",
      "手直しした成績",
      "成績の上書き",
    ],
    avoidedAliases: [],
    distinctions: {
      gradeFrozenScore:
        "確定は、上書きを当てた今の値をまとめて固定する。上書きは1マスの手直し。",
    },
  },
  gradeFrozenScore: {
    label: "成績の確定",
    summary:
      "確定した時点の値（算出に上書きを当てたもの）を対象生徒×評価項目ごとに固定する。以後は資料や境界を変えても動かず、元データが変わると知らせる。採用の順は 確定値 > 上書き > 算出。",
    variants: [
      "確定済み",
      "確定値",
      "確定した成績値",
      "確定（凍結）した成績値",
    ],
    avoidedAliases: [],
    distinctions: {
      scoreDecision:
        "採点確定は採点者どうしの食い違いを裁定するもので、成績の確定とは関係しない。",
      gradeLock:
        "ロックは元データの編集を止めるもの。成績の値そのものは固定しない。",
    },
  },
  gradeComparison: {
    label: "比較",
    summary:
      "評価項目に、別の成績算出（同じ成績算出でもよい）の評価項目を対応付け、結果の表で ↑↓→ を並べて見る設定。上下の判定は自分の側の成績境界で行う。",
    variants: ["比較先", "変化の表示"],
    avoidedAliases: [],
    distinctions: {
      gradeExportComparison:
        "出力に載せる比較は、比較のうちどれを Excel や通知書に出すかの選択。",
    },
  },
  gradeExportComparison: {
    label: "載せる比較",
    summary:
      "比較を出力（Excel の成績一覧・個人成績通知書の記号）に載せるかどうかの選択。何もしなければ載り、外したときだけ記録が残る。",
    variants: ["出力に載せる比較"],
    avoidedAliases: [],
    distinctions: {},
  },
  gradeIndividualReport: {
    label: "個人成績通知書",
    summary:
      "成績算出の結果を生徒ごとに印刷する通知書。評価項目ごとの評価・データソースの内訳・コメント欄・押印欄の設定を成績算出ごとに持つ。",
    variants: ["成績通知書"],
    avoidedAliases: [],
    distinctions: {
      individualReport:
        "個人成績表は試験1つの成績を生徒ごとに印刷するもので、設定も出力も別。",
    },
  },
  gradeLock: {
    label: "成績算出のロック",
    summary:
      "成績算出で使われている試験・資料を開いている間、成績の結果を変える書き込みを止める仕組み。DB には何も保存せず、画面で解除するとその画面を離れるまで編集できる。",
    variants: ["ロック"],
    avoidedAliases: [],
    distinctions: {},
  },
}
