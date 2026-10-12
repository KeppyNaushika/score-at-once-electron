import type { GradeTermId } from "../../categories/gradeCategory"
import type { GlossaryTermText } from "../../types"

export const GRADE_TEXT_JA: Record<GradeTermId, GlossaryTermText> = {
  grade: {
    label: "成績算出",
    summary:
      "試験・資料の得点を成績評価項目ごとに集めて、成績境界で成績評価記号を付ける単位。得点は自分では持たず、データソースを通して参照する。新しく作ると「新しい成績算出」という名前になる。",
    variants: ["成績"],
    avoidedAliases: [],
    distinctions: {
      coursework:
        "試験外成績資料は得点を自分で持つ素材。成績算出はそれを参照して集める側。",
    },
  },
  gradeReferenceDate: {
    label: "成績算出日",
    summary:
      "その成績算出がいつのものかを表す日付（任意）。学級から生徒を足すとき、在籍しているかをこの日で判定する（無ければ今日）。",
    variants: [],
    avoidedAliases: ["基準日"],
    distinctions: {
      courseworkReferenceDate:
        "資料の実施日と同じ列名（referenceDate）だが、画面での呼び名が違う。",
    },
  },
  gradeClassroom: {
    label: "登録済み学級（成績算出）",
    summary:
      "成績算出に結び付けた学級。並び順をリセットするときの学級の順になる。",
    variants: ["成績算出の学級"],
    avoidedAliases: [],
    distinctions: {
      gradeStudent:
        "対象生徒は成績を付ける1人1人。学級を外しても、ほかの学級から入った生徒は残せる。",
    },
  },
  gradeStudent: {
    label: "対象生徒（成績算出）",
    summary:
      "成績算出の名簿の1人。上書き・固定値・成績評価項目の除外は、人ではなくこの名簿の行に付く。",
    variants: ["成績算出の対象生徒"],
    avoidedAliases: [],
    distinctions: {
      courseworkStudent:
        "資料の対象生徒は別の名簿。資料から外しても成績算出の名簿は変わらない。",
    },
  },
  gradeItem: {
    label: "成績評価項目",
    summary:
      "成績算出の中の評価の単位（例: 知識・技能、思考・判断・表現、評定）。データソース・成績境界・比較はこの単位に付く。",
    variants: ["観点"],
    avoidedAliases: ["評価項目"],
    distinctions: {
      courseworkItem:
        "資料評価項目は別の表。配点と入力方式を持ち、得点を直接入れる。成績評価項目は得点を持たず、データソースを集める。",
      rubricItem: "採点項目は設問の中の採点の基準。成績とは関係しない。",
    },
  },
  gradeDataSource: {
    label: "データソース",
    summary:
      "成績評価項目に入れる素材（試験の合計点・小計点・設問の得点・資料評価項目・資料の合計点）。種類によって、どの参照の列を使うかが決まる。",
    variants: [],
    avoidedAliases: ["成績資料", "データ元"],
    distinctions: {
      coursework: "試験外成績資料は、データソースが指す先の1つ。",
    },
  },
  dataSourceExamTotal: {
    label: "試験の合計点",
    summary: "試験1つの合計点を素材にするデータソースの種類。",
    variants: [],
    avoidedAliases: ["全設問合計"],
    distinctions: {
      dataSourceSubtotal: "小計点は試験の一部（小計項目）だけを使う。",
    },
  },
  dataSourceSubtotal: {
    label: "小計点（データソース）",
    summary:
      "試験の小計項目1つを素材にするデータソースの種類。小計点グループは試験をまたいで使うので、試験も合わせて指す。",
    variants: [],
    avoidedAliases: ["観点", "観点グループ"],
    distinctions: {
      gradeItem:
        "観点間制約の「観点」は成績評価項目のこと。小計点とは別のもの。",
    },
  },
  dataSourceCropRegion: {
    label: "設問の得点",
    summary: "試験の設問1つの得点を素材にするデータソースの種類。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  dataSourceCoursework: {
    label: "資料評価項目（データソース）",
    summary: "資料評価項目1つの得点を素材にするデータソースの種類。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      dataSourceCourseworkTotal:
        "資料の合計点は資料の全資料評価項目を合わせる。",
    },
  },
  dataSourceCourseworkTotal: {
    label: "資料の合計点",
    summary:
      "資料全体を参照し、全資料評価項目の得点を合わせて素材にするデータソースの種類。",
    variants: [],
    avoidedAliases: ["資料合計"],
    distinctions: {},
  },
  convertedMaxScore: {
    label: "換算配点",
    summary:
      "そのデータソースを成績評価項目の中で何点として数えるか。素点 ÷ 配点 × 換算配点で換算する。",
    variants: ["換算得点"],
    avoidedAliases: ["換算満点", "重み"],
    distinctions: {
      courseworkItemMaxScore:
        "データソースの配点は元データからその場で計算する値で、列には持たない。換算配点は成績算出の中での数え方。",
    },
  },
  absentEstimation: {
    label: "欠測時推定",
    summary:
      "データソースに点が無い生徒の値をどう埋めるかの設定。推定方法（なし・0点・平均比率法・重回帰法・順位法・標準偏差法）、補正（乗率・加減点）、「見込」を欠測とするかを持つ。",
    variants: ["欠測推定", "欠測一括設定"],
    avoidedAliases: [],
    distinctions: {
      gradeItemExclusion:
        "成績評価項目の除外は、推定せずにその生徒の成績評価項目を計算から外す。",
      courseworkScoreAdjustment:
        "資料の加減点（得点に足し引きする値）と同じ語だが別のもの。",
    },
  },
  estimationSource: {
    label: "推定に使うデータソース",
    summary:
      "欠測を推定する材料にする、同じ成績算出の中のほかのデータソース。「選択」にしたときだけ使う（既定は「自ソース以外の全て」）。",
    variants: [],
    avoidedAliases: ["推定に使用するソース", "推定元", "見込みの元"],
    distinctions: {},
  },
  gradeItemExclusion: {
    label: "成績評価項目の除外",
    summary:
      "特定の対象生徒について、ある成績評価項目を成績算出から外す設定（名簿の行×成績評価項目）。画面では「対象生徒設定」から開く。",
    variants: ["除外", "対象生徒設定"],
    avoidedAliases: [],
    distinctions: {
      gradeStudent:
        "名簿から外すとすべての成績評価項目から消える。除外はその項目だけを外し、生徒は名簿に残る。",
    },
  },
  gradeItemBoundary: {
    label: "成績境界",
    summary:
      "成績評価項目ごとに「得点率がこの % 以上ならこの成績評価記号」を1行ずつ並べた表。行が無ければ境界は無い。",
    variants: [],
    avoidedAliases: ["成績境界設定", "境界設定"],
    distinctions: {
      gradeConstraint:
        "観点間制約も同じ段で設定するが、境界ではなく、付いた成績評価記号の組み合わせを確かめるもの。",
      courseworkLetterScale:
        "変換表は資料評価記号を点数に換える。成績境界は得点率を成績評価記号に換える（向きが逆）。",
    },
  },
  gradeLabel: {
    label: "成績評価記号",
    summary:
      "成績境界で付く記号（A/B/C、5〜1 など）。結果の画面で押すと上書きできる。",
    variants: [],
    avoidedAliases: ["成績ラベル", "ラベル", "評語"],
    distinctions: {
      gradeItem:
        "「評定」は成績評価項目の名前（総括の項目）として使われることが多い。記号のことは成績評価記号と呼ぶ。",
      courseworkInputLetter:
        "資料評価記号は入力する値。成績評価記号は成績境界から出てくる値。",
    },
  },
  gradeConstraint: {
    label: "観点間の制約ルール",
    summary:
      "観点別の評価と評定の組み合わせが校内のきまりに合わない生徒を、結果の表で色を付けて知らせるルール。成績の値は変えない。",
    variants: ["制約ルール", "ルール"],
    avoidedAliases: [],
    distinctions: {
      gradeItemBoundary:
        "成績境界は成績評価記号を決める。制約は決まった成績評価記号の組み合わせを確かめる。",
    },
  },
  constraintConsistency: {
    label: "整合（観点集計と評定）",
    summary:
      "選んだ観点の成績評価記号を数に換えて平均（または合計）し、評定とのずれが許容差を超えたら知らせる制約の種類。",
    variants: ["整合ルール"],
    avoidedAliases: [],
    distinctions: {},
  },
  constraintMutualExclusion: {
    label: "混在禁止",
    summary:
      "観点の中に、選んだ成績評価記号のうち2つ以上が現れたら知らせる制約の種類（例: A と C の混在）。",
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
    label: "上書き",
    summary:
      "教員が対象生徒×成績評価項目の成績評価記号を書き換えた記録（例「自動算出: B → 上書き: A」）。元データが変わっても書き換えた記号が残る。",
    variants: ["成績評価記号の上書き"],
    avoidedAliases: [
      "手動",
      "手動で上書きした評定",
      "手直しした成績",
      "成績の上書き",
    ],
    distinctions: {
      gradeFrozenScore:
        "成績の固定は、上書きを当てた今の値をまとめて固定する。上書きは1マスの書き換え。",
    },
  },
  gradeFrozenScore: {
    label: "成績の固定",
    summary:
      "固定した時点の値（算出に上書きを当てたもの）を対象生徒×成績評価項目ごとに固定する。固定した値は「固定値」と呼ぶ。以後は資料や成績境界を変えても動かず、元データが変わると知らせる。採用の順は 固定値 > 上書き > 算出。",
    variants: ["固定値"],
    avoidedAliases: [
      "成績の確定",
      "確定値",
      "確定した成績",
      "確定（凍結）した成績値",
    ],
    distinctions: {
      scoreDecision:
        "採点確定は採点者どうしの採点の不一致を裁定するもので、成績の固定とは関係しない。",
      gradeLock:
        "ロックは元データの編集を止めるもの。成績の値そのものは固定しない。",
    },
  },
  gradeComparison: {
    label: "比較",
    summary:
      "成績評価項目に、別の成績算出（同じ成績算出でもよい）の成績評価項目を対応付け、結果の表で ↑↓→ を並べて見る設定。上下の判定は自分の側の成績境界で行う。",
    variants: ["比較先", "変化の表示"],
    avoidedAliases: [],
    distinctions: {
      gradeExportComparison:
        "出力に載せる比較は、比較のうちどれを Excel や個人成績通知書に出すかの選択。",
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
      "成績算出の結果を生徒ごとに印刷する通知書。成績評価項目ごとの成績評価記号・データソースの内訳・コメント欄・押印欄の設定を成績算出ごとに持つ。",
    variants: [],
    avoidedAliases: ["成績通知書"],
    distinctions: {
      individualReport:
        "試験採点結果個表は試験1つの採点結果を生徒ごとに印刷するもので、設定も出力も別。",
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
