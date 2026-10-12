import type { ExamSetupTermId } from "../../categories/examSetupCategory"
import type { GlossaryTermText } from "../../types"

export const EXAM_SETUP_TEXT_JA: Record<ExamSetupTermId, GlossaryTermText> = {
  exam: {
    label: "試験",
    summary:
      "1回の試験の採点作業のひとまとまり。試験名・試験日・説明・タグを持ち、「1. 模範解答」から「9. 結果」までの段で進める。",
    variants: ["採点試験", "一括採点試験データ"],
    avoidedAliases: [],
    distinctions: {
      coursework: "試験外成績資料は答案の画像を採点しない、点数を入れる資料。",
      answerSheetDefinition:
        "解答用紙は印刷する用紙の設計図。「採点試験に変換」で、そこから試験を作れる。",
    },
  },
  examReferenceDate: {
    label: "試験日",
    summary:
      "試験を行った日（任意）。学級から受験生徒を足すとき、この日に在籍していた生徒を対象にする。",
    variants: ["実施日"],
    avoidedAliases: [],
    distinctions: {},
  },
  examMember: {
    label: "メンバー",
    summary:
      "試験に参加している教員と、その試験での役割の組み合わせ。オーナーが招待する。試験を作った人は自動でオーナーになる。",
    variants: ["参加者", "試験の担当者", "試験への参加"],
    avoidedAliases: [],
    distinctions: {
      graderAssignmentByQuestion:
        "採点担当は、メンバーのうち誰がどの設問・生徒を採点するかの割り当て。",
    },
  },
  roleOwner: {
    label: "オーナー",
    summary:
      "試験のすべての段を使える役割。試験の設定・メンバーの招待・採点担当の割り当て・採点確定ができる。複数人にできる。",
    variants: ["試験の所有者"],
    avoidedAliases: [],
    distinctions: {},
  },
  roleEditor: {
    label: "採点者",
    summary:
      "「7. 採点」と、許可されていれば「9. 結果」を使える役割（結果の出力は既定で許可）。試験の設定は変えない。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      user: "ユーザーは人そのもの。採点者は試験での役割。",
    },
  },
  roleViewer: {
    label: "閲覧者",
    summary: "「9. 結果」だけを使える役割。採点はしない。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  anonymousScoring: {
    label: "匿名採点",
    summary:
      "採点中に生徒の名前・答案の氏名欄と番号欄・名簿の順を隠し、「匿名 12」のような仮の名前で出すこと。オーナーが試験として固定すると、オーナー以外は自分で解除できない。",
    variants: ["匿名採点を固定する"],
    avoidedAliases: [],
    distinctions: {},
  },
  examPage: {
    label: "模範解答（ページ）",
    summary:
      "解答用紙の1ページと、その模範解答の画像。採点領域と答案画像はこのページに付く。画像を差し替えても、答案と採点は残る。",
    variants: ["ページ", "試験のページ", "模範解答ページ"],
    avoidedAliases: [],
    distinctions: {
      studentAnswerImage:
        "答案画像は生徒ごと・ページごとの画像。模範解答はページごとに1枚。",
    },
  },
  markerCorrection: {
    label: "マーカー補正",
    summary:
      "答案を取り込むとき、用紙の隅の印で位置のずれを直す処理。マーカー付きの解答用紙から作った試験では最初から入っている。",
    variants: ["マーカー補正スキップ"],
    avoidedAliases: [],
    distinctions: {
      omrMarker: "OMRマーカーは解答用紙作成で用紙の隅に印刷する印そのもの。",
      omr: "OMR はマーク欄の読み取り。マーカー補正は答案全体の位置合わせ。",
    },
  },
  cropRegion: {
    label: "採点領域",
    summary:
      "模範解答のページの上で枠で囲んだ範囲。設問の解答欄だけでなく、氏名欄・番号欄・合計欄・小計欄なども兼ね、役割は種類で決まる。",
    variants: ["領域", "採点枠"],
    avoidedAliases: [],
    distinctions: {
      question: "設問は、種類が「設問」の採点領域だけを指す。",
      asbSubQuestion:
        "解答用紙の小問・枝問は印刷する側の区切り。試験にすると採点領域になる。",
    },
  },
  cropRegionType: {
    label: "種類（採点領域）",
    summary:
      "採点領域の役割（設問・氏名・番号・合計・小計・マーク・コメント・その他）。採点するのは「設問」だけ。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      scoringMethod: "採点方式は設問の点の付け方。種類は採点領域の役割。",
      omr: "種類の「マーク」は名前だけで、OMR（マーク欄の読み取り）とは関係しない。",
    },
  },
  question: {
    label: "設問",
    summary:
      "種類が「設問」の採点領域。配点と採点方式を持ち、採点の単位になる。",
    variants: ["設問解答"],
    avoidedAliases: [],
    distinctions: {},
  },
  studentNameArea: {
    label: "氏名欄",
    summary:
      "答案で氏名を書かせる枠（種類が「氏名」の採点領域）。匿名採点のときは隠す。",
    variants: ["氏名"],
    avoidedAliases: [],
    distinctions: {},
  },
  studentIdArea: {
    label: "番号欄",
    summary: "答案で番号を書かせる枠（種類が「番号」の採点領域）。",
    variants: ["番号", "生徒番号", "受験番号"],
    avoidedAliases: [],
    distinctions: {
      studentNumber: "学籍番号は生徒そのものに付く番号。",
    },
  },
  totalScoreArea: {
    label: "合計欄",
    summary:
      "合計点を書き込む用紙上の枠（種類が「合計」の採点領域）。出力で合計点を重ねる場所になる。",
    variants: ["合計", "合計点"],
    avoidedAliases: [],
    distinctions: {},
  },
  subtotalArea: {
    label: "小計欄",
    summary:
      "小計点を書き込む用紙上の枠（種類が「小計」の採点領域）。どの小計項目を出すかは「4. 小計点」で関連付ける。",
    variants: ["小計", "小計点", "小計点領域"],
    avoidedAliases: [],
    distinctions: {
      subtotal: "小計項目は計算の定義。小計欄はそれを書き込む枠。",
    },
  },
  regionLabel: {
    label: "ラベル（採点領域）",
    summary:
      "採点領域に付ける名前（例「問1」）。設問番号の役割もこれが担う（設問番号という別の列は無い）。",
    variants: ["設問番号"],
    avoidedAliases: [],
    distinctions: {},
  },
  points: {
    label: "配点",
    summary: "設問の満点（整数）。設問以外の種類の採点領域には無い。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      scoreScaleLevelScore:
        "類型の点数は類型ごとに決める答案の点で、配点を超えてもよい。",
    },
  },
  subtotalGroup: {
    label: "小計点グループ",
    summary:
      "小計の切り口のひとまとまり（例「大問別」「観点別」）。中に小計項目を並べ、「小計点管理」で作って試験をまたいで使い回す。試験では「4. 小計点」で使うものを足す。",
    variants: ["小計グループ", "グループ"],
    avoidedAliases: [],
    distinctions: {
      subtotal: "点を集める単位は中の小計項目。グループは入れ物。",
    },
  },
  subtotal: {
    label: "小計項目",
    summary:
      "小計点グループの中の1項目（例「大問1」「知識・理解」）。関連付けた設問の点を合計して小計点を出す。成績算出のデータソースにもなる。",
    variants: ["小計点", "小計", "グループ項目", "項目"],
    avoidedAliases: [],
    distinctions: {
      subtotalArea: "小計欄は小計点を書き込む用紙上の枠。",
    },
  },
  cropSubtotal: {
    label: "関連付け（小計点）",
    summary:
      "「4. 小計点」の対応表のマス1つ。設問をその小計項目へ足し込む関連付けと、小計欄にどの小計項目を出すかの関連付けの2種類がある。",
    variants: ["小計点の対象領域", "採点枠の小計"],
    avoidedAliases: [],
    distinctions: {},
  },
  examStudent: {
    label: "受験生徒",
    summary:
      "その試験を受ける生徒として登録したもの。答案画像・採点・確定・返却版はすべてこれに付くので、試験から外すと採点も消える。",
    variants: ["受験者", "試験の受験生徒"],
    avoidedAliases: [],
    distinctions: {
      student: "生徒は学校の名簿の1人。受験生徒は試験ごとの登録。",
    },
  },
  examStudentStatus: {
    label: "受験状態（受験・見込・欠席）",
    summary:
      "受験生徒ごとの状態。受験、受験する見込みだがまだ決まっていない見込、欠席の3つ。統計や個人成績表でどれを含めるかを選べ、成績算出では見込を欠測として扱う。",
    variants: ["受験者", "見込受験", "欠席者"],
    avoidedAliases: [],
    distinctions: {},
  },
  studentAnswerImage: {
    label: "答案画像",
    summary:
      "受験生徒1人の答案1ページ分のスキャン画像。「6. 生徒答案」でファイル名などから生徒に結び付ける。",
    variants: ["答案", "生徒答案"],
    avoidedAliases: [],
    distinctions: {},
  },
  examClassroom: {
    label: "試験の学級",
    summary:
      "試験に結び付けた学級（「5. 受験生徒」の「学級の関連付け」）。再採番・教員集計・生徒表示の3つのスイッチと、優先の順を持つ。",
    variants: ["学級の関連付け", "対象クラス"],
    avoidedAliases: [],
    distinctions: {
      classroomMembership:
        "学級所属は生徒と学級の結び付き。試験の学級は生徒を直接持たない。",
    },
  },
  examClassroomRenumber: {
    label: "再採番",
    summary:
      "この学級の学級名・出席番号を、受験生徒の表示と並べ替えに使うかどうかのスイッチ。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  examClassroomTeacherStats: {
    label: "教員集計",
    summary: "Excel 出力の学級平均の行に、この学級を出すかどうかのスイッチ。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      examClassroomStudentReport:
        "生徒表示は、生徒に渡す個人成績表に出す学級。",
    },
  },
  examClassroomStudentReport: {
    label: "生徒表示",
    summary: "個人成績表の学級との比較に、この学級を出すかどうかのスイッチ。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  graderAssignmentByQuestion: {
    label: "採点担当（設問ごと）",
    summary:
      "どの教員がどの設問を採点するかの割り当て（「3. 領域情報」）。担当が0人の設問は全員の担当とみなす。権限で拒むのではなく、採点画面に出る設問を絞るためのもの。",
    variants: ["設問ごとの採点担当", "採点領域の担当割り当て", "設問の担当"],
    avoidedAliases: [],
    distinctions: {
      graderAssignmentByStudent:
        "生徒ごとの採点担当と合わせて、採点画面には「自分の設問 × 自分の生徒」が出る。",
    },
  },
  graderAssignmentByStudent: {
    label: "採点担当（生徒ごと）",
    summary:
      "どの教員がどの受験生徒の答案を採点するかの割り当て（「5. 受験生徒」）。学級からまとめて割り当てても、その時点の生徒1人ずつに書き込む。",
    variants: ["生徒ごとの採点担当", "受験生徒の担当割り当て", "生徒の担当"],
    avoidedAliases: [],
    distinctions: {},
  },
  omr: {
    label: "OMR設定",
    summary:
      "設問のマーク欄を読み取って自動で採点するための設定。選択肢の数・並び・読み取りのしきい値を持つ。",
    variants: ["OMR", "OMR自動採点", "マークシートの設定"],
    avoidedAliases: [],
    distinctions: {
      asbOmrConfig:
        "解答用紙作成の「OMR自動認識」は印刷する側の設定で、試験にするとこれになる。",
    },
  },
  omrChoiceOption: {
    label: "選択肢（OMR）",
    summary:
      "OMR設定の選択肢1つ。記号（既定は「ア」「イ」…）・正答かどうか（複数可）・マークの形と位置を持つ。",
    variants: ["OMRの選択肢", "マークシートの選択肢"],
    avoidedAliases: [],
    distinctions: {},
  },
  compoundAnswer: {
    label: "複合解答",
    summary:
      "複数のマーク欄をつないで1つの答えとして採点するまとまり（共通テストの分数など）。正答・別解・約分が要るか・配点を持つ。今はアーカイブの取り込みでだけ作られる。",
    variants: ["複合回答"],
    avoidedAliases: [],
    distinctions: {},
  },
}
