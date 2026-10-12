import type { ExamSetupTermId } from "../../categories/examSetupCategory"
import type { GlossaryTermText } from "../../types"

export const EXAM_SETUP_TEXT_JA: Record<ExamSetupTermId, GlossaryTermText> = {
  exam: {
    label: "試験",
    summary:
      "1回の試験の採点作業のひとまとまり。試験名・試験日・説明・タグを持ち、「1. 模範解答」から「9. 結果と出力」までの段で進める。",
    variants: [],
    avoidedAliases: ["採点試験"],
    distinctions: {
      coursework: "試験外成績資料は答案の画像を採点しない、得点を入れる資料。",
      answerSheetDefinition:
        "解答用紙は印刷する用紙の設計図。「試験に変換」で、そこから試験を作れる。",
    },
  },
  examReferenceDate: {
    label: "試験日",
    summary:
      "試験を行った日（任意）。学級から受験生徒を足すとき、この日に在籍していた生徒を対象にする。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      courseworkReferenceDate:
        "試験外成績資料の日付は「実施日」と呼ぶ。列名（referenceDate）は同じ。",
    },
  },
  examMember: {
    label: "メンバー",
    summary:
      "試験に参加している教員と、その試験での権限（所有者・採点者・閲覧者）の組み合わせ。所有者が招待する。試験を作った人は自動で所有者になる。",
    variants: ["参加者", "試験のメンバー"],
    avoidedAliases: ["ロール", "役割"],
    distinctions: {
      graderAssignmentByQuestion:
        "採点担当は、メンバーのうち誰がどの設問・生徒を採点するかの割り当て。",
    },
  },
  roleOwner: {
    label: "所有者",
    summary:
      "試験のすべての段を使える権限。試験の設定・メンバーの招待・権限の変更・採点担当の割り当て・採点確定ができる。複数人にできる。",
    variants: [],
    avoidedAliases: ["オーナー"],
    distinctions: {},
  },
  roleEditor: {
    label: "採点者",
    summary:
      "「7. 採点」と、許可されていれば「9. 結果と出力」を使える権限（結果の出力は既定で許可）。試験の設定は変えない。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      user: "ユーザーは人そのもの。採点者は試験での権限。",
    },
  },
  roleViewer: {
    label: "閲覧者",
    summary: "「9. 結果と出力」だけを使える権限。採点はしない。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  anonymousScoring: {
    label: "匿名採点",
    summary:
      "採点中に生徒の名前・答案の氏名と番号の枠・名簿の順を隠し、「匿名 12」のような仮の名前で出すこと。所有者が試験として固定すると、所有者以外は自分で解除できない。",
    variants: ["匿名採点を固定する"],
    avoidedAliases: [],
    distinctions: {},
  },
  examPage: {
    label: "模範解答（ページ）",
    summary:
      "解答用紙の1ページと、その模範解答の画像。採点領域と答案画像はこのページに付く。画像を差し替えても、答案と採点は残る。",
    variants: ["ページ", "模範解答ページ"],
    avoidedAliases: [],
    distinctions: {
      studentAnswerImage:
        "答案画像は生徒ごと・ページごとの画像。模範解答はページごとに1枚。",
    },
  },
  markerCorrection: {
    label: "OMRマーカー補正",
    summary:
      "答案を取り込むとき、用紙の隅のOMRマーカーで位置のずれを直す処理。OMRマーカー付きの解答用紙から作った試験では最初から入っている。",
    variants: ["OMRマーカー補正スキップ"],
    avoidedAliases: ["マーカー補正"],
    distinctions: {
      omrMarker: "OMRマーカーは解答用紙作成で用紙の隅に印刷する印そのもの。",
      omr: "OMR設定はマーク欄の読み取り。OMRマーカー補正は答案全体の位置合わせ。",
    },
  },
  cropRegion: {
    label: "採点領域",
    summary:
      "模範解答のページの上で枠で囲んだ範囲。設問の解答欄だけでなく、氏名・番号・合計・小計を書く欄なども兼ね、役割は種類で決まる。",
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
      omr: "種類の「マーク」は名前だけで、OMR設定（マーク欄の読み取り）とは関係しない。",
    },
  },
  question: {
    label: "設問",
    summary:
      "種類が「設問」の採点領域。配点と採点方式を持ち、採点の単位になる。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  studentNameArea: {
    label: "氏名（採点領域）",
    summary:
      "答案で氏名を書かせる枠（種類が「氏名」の採点領域）。匿名採点のときは隠す。",
    variants: ["氏名欄"],
    avoidedAliases: [],
    distinctions: {},
  },
  studentIdArea: {
    label: "番号（採点領域）",
    summary: "答案で番号を書かせる枠（種類が「番号」の採点領域）。",
    variants: ["番号欄", "受験番号"],
    avoidedAliases: [],
    distinctions: {
      studentNumber: "学籍番号は生徒そのものに付く番号。",
    },
  },
  totalScoreArea: {
    label: "合計（採点領域）",
    summary:
      "合計点を書き込む用紙上の枠（種類が「合計」の採点領域）。出力で合計点を重ねる場所になる。",
    variants: ["合計点欄"],
    avoidedAliases: [],
    distinctions: {},
  },
  subtotalArea: {
    label: "小計（採点領域）",
    summary:
      "小計点を書き込む用紙上の枠（種類が「小計」の採点領域）。どの小計項目を出すかは「4. 小計点」で関連付ける。",
    variants: ["小計欄"],
    avoidedAliases: [],
    distinctions: {
      subtotal: "小計項目は計算の定義。この枠はそれを書き込む場所。",
    },
  },
  regionLabel: {
    label: "ラベル（採点領域）",
    summary:
      "採点領域に付ける名前（例「問1」）。設問の番号の役割もこれが担う（設問番号という別の項目は無い）。",
    variants: [],
    avoidedAliases: ["設問番号"],
    distinctions: {},
  },
  points: {
    label: "配点（設問）",
    summary:
      "設問の配点（整数）。設問以外の種類の採点領域には無い。試験全体の配点の合計は「合計配点」と呼ぶ。",
    variants: [],
    avoidedAliases: ["満点"],
    distinctions: {
      pointAllocation:
        "配点は、項目に定める100%の点数の総称。これは設問の配点。",
      scoreScaleLevelScore:
        "類型の点数は類型ごとに決める値で、配点を超えてもよい。",
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
      "小計点グループの中の1項目（例「大問1」「知識・理解」）。関連付けた設問の得点を合計して小計点を出す。成績算出のデータソースにもなる。",
    variants: ["小計点", "小計", "項目"],
    avoidedAliases: [],
    distinctions: {
      subtotalArea: "小計（採点領域）は小計点を書き込む用紙上の枠。",
    },
  },
  cropSubtotal: {
    label: "設問と小計項目の関連付け",
    summary:
      "「4. 小計点」の対応表のマス1つ。設問をその小計項目へ足し込む関連付けと、小計の枠にどの小計項目を出すかの関連付けの2種類がある。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  examStudent: {
    label: "受験生徒",
    summary:
      "その試験を受ける生徒として登録したもの。答案画像・採点・採点確定・返却版はすべてこれに付くので、試験から外すと採点も消える。",
    variants: ["受験者"],
    avoidedAliases: [],
    distinctions: {
      student: "生徒は学校の名簿の1人。受験生徒は試験ごとの登録。",
    },
  },
  examStudentStatus: {
    label: "受験状態（受験・見込・欠席）",
    summary:
      "受験生徒ごとの状態。受験、受験する見込みだがまだ決まっていない見込、欠席の3つ。統計や試験採点結果個表でどれを含めるかを選べ、成績算出では見込を欠測として扱う。",
    variants: [],
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
    variants: ["学級の関連付け"],
    avoidedAliases: ["対象クラス"],
    distinctions: {
      classroomMembership:
        "在籍は生徒と学級の結び付き。試験の学級は生徒を直接持たない。",
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
        "生徒表示は、生徒に渡す試験採点結果個表に出す学級。",
    },
  },
  examClassroomStudentReport: {
    label: "生徒表示",
    summary:
      "試験採点結果個表の学級との比較に、この学級を出すかどうかのスイッチ。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  graderAssignmentByQuestion: {
    label: "採点担当（設問ごと）",
    summary:
      "どの教員がどの設問を採点するかの割り当て（「3. 領域設定」）。担当が0人の設問は全員の担当とみなす。ほかの設問を採点できなくするのではなく、採点画面に出る設問を絞るためのもの。",
    variants: ["設問ごとの採点担当", "設問の担当"],
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
    variants: ["生徒ごとの採点担当"],
    avoidedAliases: [],
    distinctions: {},
  },
  omr: {
    label: "OMR設定",
    summary:
      "設問のマーク欄を読み取って自動で採点するための設定。選択肢（OMRの選択肢）の数・並び・読み取りのしきい値を持つ。",
    variants: ["OMR", "OMR自動採点"],
    avoidedAliases: [],
    distinctions: {
      asbOmrConfig:
        "解答用紙作成の「マーク欄」は印刷する側の設定で、試験にするとこれになる。",
    },
  },
  omrChoiceOption: {
    label: "OMRの選択肢",
    summary:
      "OMR設定の選択肢1つ。記号（既定は「ア」「イ」…）・正答かどうか（複数可）・マークの形と位置を持つ。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      asbOmrConfig: "解答用紙作成の側では「マーク欄の選択肢」と呼ぶ。",
    },
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
