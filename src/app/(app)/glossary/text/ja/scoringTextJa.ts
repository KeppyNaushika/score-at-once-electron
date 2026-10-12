import type { ScoringTermId } from "../../categories/scoringCategory"
import type { GlossaryTermText } from "../../types"

export const SCORING_TEXT_JA: Record<ScoringTermId, GlossaryTermText> = {
  questionScore: {
    label: "採点",
    summary:
      "1人の採点者が、1人の受験生徒の1つの設問に付けた採点1件（生徒×設問×採点者で1行）。採点状態・得点（部分点・保留のとき）・覚え書き・付けた類型を持つ。",
    variants: ["採点提案", "採点者の結果"],
    avoidedAliases: [],
    distinctions: {
      scoreDecision:
        "採点確定は、試験の所有者が生徒×設問ごとに決める最終の結果。採点はその手前の、採点者ごとの結果。",
    },
  },
  scoringStatus: {
    label: "採点状態",
    summary:
      "採点1件に付ける状態（8つ）。進み具合（未採点・保留）、答案の様子（無答・Wマーク）、評価（正答・誤答・部分点・類型採点済み）が混ざっている。",
    variants: ["判定", "判定キー"],
    avoidedAliases: [],
    distinctions: {
      scoringMethod:
        "採点方式は設問ごとの点の付け方。採点状態は答案ごとの結果。",
    },
  },
  statusUnscored: {
    label: "未採点",
    summary: "まだ何も付けていない状態（既定）。得点は欠測として扱う。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      statusPending:
        "保留は、見たうえで決めかねている状態。未採点は手を付けていない状態。",
    },
  },
  statusCorrect: {
    label: "正答",
    summary: "正しい答え。得点は設問の配点になる。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  statusPartial: {
    label: "部分点",
    summary: "配点の一部を与える状態。得点は部分点の値に入れる。",
    variants: ["部分点入力"],
    avoidedAliases: [],
    distinctions: {
      partialScore:
        "「部分点」は状態の名前でもあり、そのときの得点の呼び名でもある。",
    },
  },
  statusPending: {
    label: "保留",
    summary: "判断を後に回した状態。仮の得点を入れておくこともできる。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  statusIncorrect: {
    label: "誤答",
    summary: "誤った答え。得点は0。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      statusNoAnswer: "無答も0点だが、答えが書かれていない状態。",
    },
  },
  statusNoAnswer: {
    label: "無答",
    summary: "何も書かれていない答案。得点は0。",
    variants: ["白紙"],
    avoidedAliases: [],
    distinctions: {},
  },
  statusDoubleMark: {
    label: "Wマーク",
    summary: "マークを複数塗った答案。得点は0。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  statusEvaluated: {
    label: "類型採点済み",
    summary:
      "類型方式の設問で類型を付けた状態。得点は付けた類型の点数（配点を超えてよい）。答案1件を見せるところでは、この名前ではなく付けた類型の記号を出す。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      scoringMethodScale:
        "類型方式は採点方式の名前。この状態は類型を付けたかどうかだけを表す。",
    },
  },
  pointAllocation: {
    label: "配点",
    summary:
      "項目に定める100%の点数。設問の配点、資料評価項目の配点、成績算出の換算配点がこれに当たる。試験全体の100%は「合計配点」と呼ぶ。",
    variants: [],
    avoidedAliases: ["満点"],
    distinctions: {
      earnedPoints:
        "得点は、ある生徒がその項目で与えられた点数。配点はその100%の側。",
      pointValue: "点数は、配点にも得点にも当たらない定めた値と、点の総称。",
    },
  },
  earnedPoints: {
    label: "得点",
    summary:
      "ある生徒がその項目で与えられた点数。設問の得点（部分点の値・確定した得点）、複合解答の得点、資料の得点、推定後の得点をこう呼ぶ。生徒の合計・小計の得点は「合計点」「小計点」と呼ぶ。",
    variants: [],
    avoidedAliases: ["スコア", "設問部分点数"],
    distinctions: {
      pointAllocation:
        "配点は、項目に定める100%の点数。得点はそのうち生徒が得た分。",
      pointValue:
        "類型の点数・変換表の点数は、付けると得点になる元の値で、得点そのものではない。",
    },
  },
  pointValue: {
    label: "点数",
    summary:
      "配点にも得点にも当たらない、定めた値（類型の点数・変換表の点数）。点の総称としても使う。得点率・得点分布・換算得点はこの区別によらず、その呼び名のまま。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      pointAllocation: "配点は項目に定める100%の点数。",
      earnedPoints: "得点は生徒がその項目で与えられた点数。",
    },
  },
  partialScore: {
    label: "部分点（点の値）",
    summary:
      "部分点・保留のときの得点。正答・誤答などでは得点が状態から決まるので使わない。",
    variants: [],
    avoidedAliases: ["設問部分点数"],
    distinctions: {
      earnedPoints: "得点は、生徒がその項目で与えられた点数の総称。",
    },
  },
  scoringKeys: {
    label: "ショートカットキー",
    summary:
      "キーに割り当てた操作。採点状態を1打で付けるキー（採点キー）もここに入り、既定は q=未採点・e=正答・f=部分点・j=保留・o=誤答・p=無答・u=Wマーク・k=覚え書き。設定の「ショートカットキー」でユーザーごとに変えられる。",
    variants: ["採点キー", "採点操作", "判定キー"],
    avoidedAliases: ["キーボードショートカット"],
    distinctions: {
      clickScoring:
        "クリック採点は、マウスの連続クリックに動作を割り当てる仕組み。",
    },
  },
  scoreComment: {
    label: "覚え書き",
    summary:
      "採点者がその点にした理由のメモ（自分用）。採点確定には別に「確定の覚え書き」が付く。",
    variants: ["確定の覚え書き"],
    avoidedAliases: [],
    distinctions: {
      drawingAnnotation:
        "注釈は答案の上の位置を持つ。覚え書きは位置を持たない、採点1件のメモ。",
    },
  },
  scoringMethod: {
    label: "採点方式",
    summary:
      "設問ごとの点の付け方。正誤方式・減点方式・加点方式・類型方式の4つから選ぶ。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      scoringInputMode:
        "採点操作モード（キーボード・マウス）は操作の手段の選択で、点の付け方ではない。",
    },
  },
  scoringMethodPoints: {
    label: "正誤方式",
    summary: "採点キー・部分点で得点を直接付ける採点方式。設問の既定。",
    variants: [],
    avoidedAliases: ["直接採点"],
    distinctions: {},
  },
  scoringMethodDeduction: {
    label: "減点方式",
    summary:
      "配点から、当たった採点項目の減点を引く採点方式。結果は0〜配点に収める。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  scoringMethodAddition: {
    label: "加点方式",
    summary:
      "0点から、当たった採点項目の加点を足す採点方式。結果は0〜配点に収める。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  scoringMethodScale: {
    label: "類型方式",
    summary:
      "答案を類型（A/B/C など）に当てはめる採点方式。得点は類型の点数から出す。使う類型表は「3. 領域設定」で選ぶ。",
    variants: [],
    avoidedAliases: ["類型評価"],
    distinctions: {
      scoreScale: "類型表は、この方式で使う類型と点数の表。",
    },
  },
  incompatibleScore: {
    label: "方式と合わない採点",
    summary:
      "設問の採点方式と合わない採点状態（類型方式の設問の正答・誤答・部分点や、点で採点する設問の類型採点済み）。消さずに得点だけ欠測にするので、方式を戻せば元の得点に戻る。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  rubricItem: {
    label: "採点項目",
    summary:
      "設問ごとの採点の基準の1つ（例「単位が無い：−1点」）。試験の採点者どうしで共有し、教員向けの判断理由と生徒向けの助言を別々に持つ。",
    variants: ["項目"],
    avoidedAliases: ["評価項目", "ルーブリック項目"],
    distinctions: {
      gradeItem: "成績評価項目は成績を出す単位。採点項目は設問の中の基準。",
      courseworkItem: "資料評価項目は資料の列。採点項目は設問の中の基準。",
      scoreScaleLevel:
        "類型は答案を当てはめる区分の1つ。採点項目は当たり外れを付ける基準。",
    },
  },
  rubricItemReason: {
    label: "判断理由",
    summary:
      "採点項目の、教員だけが見る理由の文（印刷しない）。空のときは効き方（「−1点」など）が名前の代わりに出る。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      rubricAdvice: "助言は生徒向けの文で、朱書きになる。",
    },
  },
  rubricAdjust: {
    label: "点を加減する",
    summary:
      "採点項目の種類の1つ。当たると決めた点（減点は負の数）を足し引きする。",
    variants: ["加減"],
    avoidedAliases: [],
    distinctions: {},
  },
  rubricSet: {
    label: "判定と点を決める",
    summary:
      "採点項目の種類の1つ。当たると採点状態（正答・部分点・誤答・無答・保留）と得点を決める。加減より優先する。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  rubricApplication: {
    label: "採点項目の適用",
    summary:
      "「この答案にこの採点項目が当たっている」という記録。採点者ごとに持つ。画面では「当てる・外す」と言う。",
    variants: ["当てる", "外す"],
    avoidedAliases: [],
    distinctions: {},
  },
  manualOverride: {
    label: "手での上書き",
    summary:
      "減点・加点方式の設問で、採点キーで付けた得点を採点項目から計算した点より優先させる印。「項目の点に戻す」で外す。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      gradeOverride:
        "成績算出の「上書き」は成績評価記号を書き換えるもので、別のもの。",
    },
  },
  rubricAdvice: {
    label: "助言",
    summary:
      "採点項目に書く生徒向けの文。当たった答案に朱書きとして入る。空なら朱書きを作らない。",
    variants: ["朱書き", "助言の朱書き"],
    avoidedAliases: [],
    distinctions: {
      drawingAnnotation:
        "朱書きも注釈の1つとして保存するが、教員が手で描いた注釈とは印で分けている。",
    },
  },
  rubricAdviceCombination: {
    label: "重なった助言の決まり",
    summary:
      "助言のある採点項目が2つ以上同時に当たったとき、朱書きをどうするかの決まり（まとめた一文・1つの項目の助言だけ・すべて並べる・朱書きなし）。決まりの無い組み合わせは「未決定」と出る。",
    variants: ["重なった助言", "朱書きの扱い"],
    avoidedAliases: [],
    distinctions: {},
  },
  scoreScale: {
    label: "類型表",
    summary:
      "類型（A/B/C など）と、その説明・点数を並べた表。「類型表管理」で作る共通のものと、試験だけで使うものがある。",
    variants: [],
    avoidedAliases: ["ルーブリック", "類型評価", "類型の組"],
    distinctions: {
      scoringMethodScale: "類型方式は、この表を使って採点する採点方式の名前。",
      statusEvaluated: "類型採点済みは、類型を付けた答案の状態。",
      rubricItem:
        "採点項目は答案に当たり外れを付ける基準。類型表は答案を1つの類型に当てはめるための表。",
      courseworkLetterScale: "資料の変換表も記号を点数に換えるが、別の表。",
    },
  },
  scoreScaleLevel: {
    label: "類型",
    summary:
      "類型表の中の1つの区分。記号（例「A」）・説明・点数を持つ。表の「記号」の列は類型の記号。",
    variants: ["記号"],
    avoidedAliases: ["段階"],
    distinctions: {},
  },
  scoreScaleLevelDescription: {
    label: "説明（類型）",
    summary:
      "類型に当てはまる答案の様子（例「根拠を2つ以上挙げて説明している」）。",
    variants: [],
    avoidedAliases: ["記述語"],
    distinctions: {},
  },
  scoreScaleLevelScore: {
    label: "点数（類型）",
    summary: "その類型を付けた答案の得点になる値（0以上。配点を超えてよい）。",
    variants: [],
    avoidedAliases: ["割合"],
    distinctions: {
      points: "配点は設問に定める100%の点数。点数は類型ごとに決める値。",
    },
  },
  drawingAnnotation: {
    label: "注釈",
    summary:
      "個別表示で答案の上に注釈ツールで描く印（テキスト・直線・長方形・楕円）。採点者ごとに持ち、助言の朱書きもここに入る。",
    variants: ["注釈ツール", "手書き"],
    avoidedAliases: [
      "採点マーク",
      "アノテーション",
      "答案への書き込み",
      "描画要素",
    ],
    distinctions: {
      scoringMark:
        "採点マークは、採点状態に応じて答案へ重ねる◯✕△の画像。注釈は1枚の答案の上に描く印。",
    },
  },
  gridView: {
    label: "一覧表示",
    summary: "07 の表示の1つ。切り抜いた答案を並べて、まとめて採点する。",
    variants: ["グリッド"],
    avoidedAliases: [],
    distinctions: {},
  },
  individualView: {
    label: "個別表示",
    summary: "07 の表示の1つ。1枚の答案を大きく見て採点し、注釈も描ける。",
    variants: ["個別採点"],
    avoidedAliases: [],
    distinctions: {},
  },
  scoringInputMode: {
    label: "採点操作モード",
    summary:
      "採点の操作を「キーボード」（選んでキーで付ける）にするか、「マウス」（クリックで直接付ける）にするかの選択。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  clickScoring: {
    label: "クリック採点",
    summary:
      "マウスで2〜4回続けてクリックしたときの動作（正答・誤答・部分点入力・個別表示など）を、ユーザーごとに割り当てる設定。",
    variants: ["クリック採点の設定"],
    avoidedAliases: [],
    distinctions: {},
  },
  scoringStatusColor: {
    label: "採点状態の表示色",
    summary:
      "採点状態ごとの、採点画面での背景・文字・アイコンの色（ユーザーごと）。設定の「表示設定」にある。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      answerOverlay:
        "採点マークと点数の表示設定は印刷物の見た目で、試験ごとの設定。こちらは画面の色。",
    },
  },
}
