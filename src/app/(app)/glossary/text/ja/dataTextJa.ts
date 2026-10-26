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
      legacyArchiveFormats: "旧形式は取り込むだけで、新しく書き出せない。",
      archiveImport:
        "「統合」は形式の名前にだけ使う。取り込みで重なったものの扱いは「新しい方を残す」などの選択肢で選ぶ。",
    },
  },
  legacyArchiveFormats: {
    label: "旧形式（.score・.coursework・.grade・.asb・.students）",
    summary:
      "以前の版の書き出しの形式。今は取り込むだけで、新しく書き出すことはできない。",
    variants: ["古い形式のアーカイブ"],
    avoidedAliases: [],
    distinctions: {},
  },
  archiveImport: {
    label: "取り込み",
    summary:
      "アーカイブを開き、内容の確認・紐づけ・競合の確認を経て取り込む。同じデータがアーカイブとこのPCで違うものを「競合」と呼び（採点に限らない）、重なったものは「上書きする」「新しい方を残す」（既定）「別で追加する」から選ぶ。このPCの行は消さない。",
    variants: [],
    avoidedAliases: ["インポート", "取込", "読み込み"],
    distinctions: {
      sync: "同期は共有フォルダを通して続けて揃える。取り込みは1回きりのファイルの操作。",
      scoreConflict:
        "採点の不一致は採点者どうしの採点の違い。取り込みの競合はアーカイブとこのPCの違い。",
    },
  },
  idIntegration: {
    label: "紐づけ",
    summary:
      "取り込む生徒・学級などを、このPCの既存のものと同じとして扱うか、新しく登録するか、取り込まないかを選ぶ段。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  storageMode: {
    label: "ローカルモード・共有モード",
    summary:
      "起動するデータの置き場。ローカルモードはこのPCだけで同期しない。共有モードは共有フォルダを使ってほかのPCと同期する。2つは別々のデータ。",
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
  sharedReplica: {
    label: "このPCの共有モードのデータベース",
    summary:
      "共有モードで起動したときに、このPCで読み書きするデータベース。共有プロファイルごとにこのPCの中に作り、共有フォルダの同期用ファイルを通して、ほかのPCの変更を反映する。答案などの画像はこのデータベースに含めず、共有フォルダから読み込む。",
    variants: [],
    avoidedAliases: ["このPCの控え", "手元の控え", "控え"],
    distinctions: {
      sharedProfile:
        "共有プロファイルは共有フォルダ1つ分の登録。このデータベースは、その共有プロファイルで使うためにこのPCの中に作るもの。",
      sync: "同期では、共有フォルダの同期用ファイルを通して、各PCのデータベースに変更を反映する。共有フォルダにアクセスできないあいだも、このデータベースで作業できる。",
    },
  },
  syncFile: {
    label: "同期用ファイル",
    summary:
      "各PCが共有フォルダの sync フォルダに保存する、変更を同期するためのファイル。ほかのPCはこのファイルを読み、自分のデータベースに変更を反映する。バックアップではなく、このファイルからデータを元に戻す操作はない。",
    variants: [],
    avoidedAliases: ["同期のための写し", "同期の写し"],
    distinctions: {
      sharedReplica:
        "このPCの共有モードのデータベースは、ふだんの読み書きに使うもの。同期用ファイルは、ほかのPCと変更を同期するために共有フォルダへ保存するもの。",
    },
  },
  sync: {
    label: "同期",
    summary:
      "共有モードのとき、共有フォルダを通して各PCのデータを定期的に揃える仕組み。同じものが両方で変わったら、後に書かれた方が残る。",
    variants: ["同期設定"],
    avoidedAliases: [],
    distinctions: {},
  },
  syncRecordFold: {
    label: "重なって隠したデータ",
    summary:
      "ほかのPCと同じもの（内部の id は違う）が二重にできたとき、片方だけを表示して、もう片方を隠すこと。消してはいないので、重なりが解ければ表示に戻る。",
    variants: ["重複していたデータの片方を隠しました"],
    avoidedAliases: [],
    distinctions: {
      syncParentDeleted: "親の削除で外したデータは、重なりではなく削除が原因。",
    },
  },
  syncParentDeleted: {
    label: "削除にともない外したデータ",
    summary:
      "ほかのPCで親が削除されたのに、同じころに書かれた子のデータ。表示から外すが中身は残し、親が戻れば表示に戻る。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  auditLog: {
    label: "操作履歴",
    summary:
      "状態を変える操作と、出力・書き出しの記録（見ただけでは残らない）。追記だけで、対象が消えても名前を残す。残す期間は設定で決める。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  userPreference: {
    label: "ユーザーごとの設定",
    summary:
      "ユーザーごとの好み（表示・画面制御など）。同じデータでも人によって違う。",
    variants: [],
    avoidedAliases: ["自分の設定", "利用者の設定", "利用者個人の設定"],
    distinctions: {
      appPreference: "全員で共通の設定は、データを共有する全員が同じ値を見る。",
    },
  },
  appPreference: {
    label: "全員で共通の設定",
    summary:
      "データを共有する全員が同じ値を見る設定（年度の開始日・操作履歴を残す期間など）。",
    variants: [],
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
