import type { DataTermId } from "../../categories/dataCategory"
import type { GlossaryTermText } from "../../types"

export const DATA_TEXT_JA: Record<DataTermId, GlossaryTermText> = {
  unifiedArchive: {
    label: "統合アーカイブ（.sao）",
    summary:
      "試験・資料・成績算出・解答用紙と、それに関わる生徒・学級などを1つのファイルにまとめる今の書き出しの形式。「データ書き出し」で作る。",
    variants: [".sao 書き出し", "データ書き出し", "アーカイブ"],
    avoidedAliases: [],
    distinctions: {
      legacyArchiveFormats: "旧形式は読み込みだけで、新しく書き出せない。",
      archiveImport:
        "取り込みの「統合する」は重なったものの扱いの選択肢で、形式の名前とは関係しない。",
    },
  },
  legacyArchiveFormats: {
    label: "旧形式（.score・.coursework・.grade・.asb・.students）",
    summary:
      "以前の版の書き出しの形式。今は読み込みだけで、新しく書き出すことはできない。",
    variants: ["古い形式のアーカイブ", "インポート"],
    avoidedAliases: [],
    distinctions: {},
  },
  archiveImport: {
    label: "取り込み",
    summary:
      "アーカイブを開き、内容の確認 → 紐づけ → 衝突 → 確認 → 実行の順で取り込む。重なったものは「上書きする」「統合する」（既定）「別で追加する」から選ぶ。このパソコンの行は消さない。",
    variants: ["読み込み", "インポート", "取込"],
    avoidedAliases: [],
    distinctions: {
      sync: "同期は共有フォルダを通して続けて揃える。取り込みは1回きりのファイルの操作。",
    },
  },
  idIntegration: {
    label: "紐づけ",
    summary:
      "取り込む生徒・学級などを、このパソコンの既存のものと同じとして扱うか、新しく登録するか、取り込まないかを選ぶ段。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  storageMode: {
    label: "ローカルモード・共有モード",
    summary:
      "起動するデータの置き場。ローカルモードはこのパソコンだけで同期しない。共有モードは共有フォルダを使ってほかのパソコンと同期する。2つは別々のデータ。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      sharedProfile:
        "共有プロファイルは、共有モードでどの共有フォルダを使うか。",
    },
  },
  sharedProfile: {
    label: "共有プロファイル",
    summary:
      "共有モードで使う共有フォルダ1つ分の登録。パスではなく共有フォルダの識別IDで見分ける。",
    variants: ["共有フォルダ"],
    avoidedAliases: [],
    distinctions: {
      user: "プロファイルはデータの置き場で、人（ユーザー）ではない。",
    },
  },
  sync: {
    label: "同期",
    summary:
      "共有モードのとき、共有フォルダを通して各パソコンのデータを定期的に揃える仕組み。同じものが両方で変わったら、後に書かれた方が残る。",
    variants: ["同期設定"],
    avoidedAliases: [],
    distinctions: {},
  },
  syncRecordFold: {
    label: "重なって隠したデータ",
    summary:
      "ほかのパソコンと同じもの（内部の id は違う）が二重にできたとき、片方だけを表示して、もう片方を隠すこと。消してはいないので、重なりが解ければ表示に戻る。",
    variants: ["重複していたデータの片方を隠しました", "かぶって隠れた行"],
    avoidedAliases: [],
    distinctions: {
      syncParentDeleted: "親の削除で外したデータは、重なりではなく削除が原因。",
    },
  },
  syncParentDeleted: {
    label: "削除にともない外したデータ",
    summary:
      "ほかのパソコンで親が削除されたのに、同じころに書かれた子のデータ。表示から外すが中身は残し、親が戻れば表示に戻る。",
    variants: ["親が削除されて表から外れた行"],
    avoidedAliases: [],
    distinctions: {},
  },
  auditLog: {
    label: "操作履歴",
    summary:
      "状態を変える操作と書き出しの記録（見ただけでは残らない）。追記だけで、対象が消えても名前を残す。残す期間は設定で決める。",
    variants: ["監査ログ"],
    avoidedAliases: [],
    distinctions: {},
  },
  userPreference: {
    label: "自分の設定",
    summary:
      "利用者ごとの好み（表示・画面制御など）。同じデータでも人によって違う。",
    variants: ["利用者の設定", "利用者個人の設定"],
    avoidedAliases: [],
    distinctions: {
      appPreference: "全員で共通の設定は、データを共有する全員が同じ値を見る。",
    },
  },
  appPreference: {
    label: "全員で共通の設定",
    summary:
      "データを共有する全員が同じ値を見る設定（年度の開始日・操作履歴を残す期間など）。",
    variants: ["組織の設定"],
    avoidedAliases: [],
    distinctions: {},
  },
  pdfTools: {
    label: "PDF加工",
    summary:
      "PDF を読み込んで並べ替え・回転・Nin1 をし、「結合」か「交互挿入」で書き出す道具。データには保存しない。",
    variants: ["結合", "交互挿入"],
    avoidedAliases: [],
    distinctions: {},
  },
}
