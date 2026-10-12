import type { AnswerSheetBuilderTermId } from "../../categories/answerSheetBuilderCategory"
import type { GlossaryTermText } from "../../types"

export const ANSWER_SHEET_BUILDER_TEXT_JA: Record<
  AnswerSheetBuilderTermId,
  GlossaryTermText
> = {
  answerSheetDefinition: {
    label: "解答用紙",
    summary:
      "「解答用紙作成」で作る、印刷する解答用紙の設計図。用紙・罫線・ヘッダー・問題の構成を持つ。",
    variants: ["解答用紙定義"],
    avoidedAliases: [],
    distinctions: {
      exam: "試験は採点する側のまとまり。解答用紙は設計図で、そこから試験を作れる。",
    },
  },
  examConversion: {
    label: "採点試験に変換",
    summary:
      "解答用紙から試験を作り、模範解答の画像・採点領域・配点を自動で作る操作。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  asbHeaderField: {
    label: "記入欄",
    summary:
      "用紙の上部（ヘッダー）に並べる欄。種類は記入欄・可変スペース・ラベルの3つ。",
    variants: ["ヘッダー記入欄", "解答用紙のヘッダー欄"],
    avoidedAliases: [],
    distinctions: {
      asbTextElement: "テキスト要素は小問・枝問の欄の中に置く文字。",
    },
  },
  asbLinkedRegion: {
    label: "採点領域連携",
    summary:
      "記入欄を、試験にしたときどの種類の採点領域（番号・氏名・合計点・小計点）にするかの指定。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      cropRegionType: "試験の側では、これが採点領域の種類になる。",
    },
  },
  asbMajorQuestion: {
    label: "大問",
    summary: "解答用紙の問題の構成のいちばん上の区切り。小問をまとめる。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      subtotal:
        "小計項目は試験の側で点を集める単位。大問は用紙の上の区切りで、点は集めない。",
    },
  },
  asbSubQuestion: {
    label: "小問",
    summary:
      "大問の中の1つの解答欄。配点を持ち、文字・画像・OMR・原稿用紙を付けられる。枝問が無ければ、試験にすると採点領域1つになる。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      cropRegion:
        "採点領域は試験の側の枠。小問・枝問を試験にするとこれになる。",
    },
  },
  asbBranchQuestion: {
    label: "枝問",
    summary:
      "小問をさらに分けた解答欄（(1)(2)…）。それぞれ配点を持てる（「枝問配点」のとき）。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  asbTextElement: {
    label: "テキスト要素",
    summary:
      "小問・枝問の欄の中に置く文字。太字・数式などが使え、||…|| で模範解答だけに出す文字を書ける。",
    variants: ["解答用紙の文字"],
    avoidedAliases: [],
    distinctions: {},
  },
  asbImageElement: {
    label: "画像要素",
    summary:
      "小問・枝問の欄の中に置く画像。常に表示・解答用紙のみ・模範解答のみから出し分けを選ぶ。",
    variants: ["解答用紙の画像"],
    avoidedAliases: [],
    distinctions: {},
  },
  asbOmrConfig: {
    label: "OMR自動認識",
    summary:
      "小問・枝問を、塗りつぶして答える選択式の欄にする設定。選択肢の数・記号・並び・正解を持つ。試験にすると採点領域のOMR設定になる。",
    variants: ["マーク欄", "解答用紙のマーク欄"],
    avoidedAliases: [],
    distinctions: {
      omrMarker: "OMRマーカーは用紙全体の四隅の印。こちらは設問ごとの設定。",
    },
  },
  omrMarker: {
    label: "OMRマーカー",
    summary:
      "用紙の四隅に印刷する位置合わせの印。スキャンした答案の傾き・ずれを直すのに使う。",
    variants: ["OMR", "マーカー"],
    avoidedAliases: [],
    distinctions: {
      asbCharGuide:
        "原稿用紙の文字位置マーカーも「マーカー」と呼ぶが別のもの。",
    },
  },
  asbManuscriptPaper: {
    label: "原稿用紙",
    summary: "小問・枝問の欄を、マス目（列数×行数）の作文の欄にする設定。",
    variants: ["原稿用紙マス目"],
    avoidedAliases: [],
    distinctions: {},
  },
  asbCharGuide: {
    label: "文字位置マーカー",
    summary:
      "原稿用紙の「先頭から何字目か」に置く目印。数字（例: 80）と「○字以内・以上」の区切りの罫線を組み合わせられる。",
    variants: ["文字数の目印", "マーカー", "字数ガイド"],
    avoidedAliases: [],
    distinctions: {},
  },
  verticalLayout: {
    label: "書字方向",
    summary:
      "解答用紙全体を横書きにするか縦書きにするかの切り替え。縦書きでは段組みが上下になる。",
    variants: ["縦書き", "横書き"],
    avoidedAliases: [],
    distinctions: {},
  },
  multiColumn: {
    label: "段組み",
    summary: "問題の構成を複数の段に分けて並べる設定。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
}
