/**
 * 同期が1回ごとに返す注意書き（ライブラリの `SyncResult.warnings`）を、
 * 教員が読んで意味の分かる日本語へ言い換える。
 *
 * ライブラリの文面は、表の名前・内部テーブル・`lamport`・`clientId` といった、
 * 組み込む側の開発者に向けた言葉で書かれている。ライブラリの `warnings` の説明には
 * 「アプリケーションの利用者に見える場所へ出すこと」とあるので、**出さない**という
 * 選択肢は無い。出すなら、そのままではなく読める形にする。
 *
 * **言い換えられないものは、そのまま出す。** 対応表に載らない文面は、ライブラリが
 * 増えれば必ず出てくる。知らないものを黙って捨てると、利用者にも開発者にも
 * 届かなくなる（それが一番まずい）。原文のまま出して、言い換えていないことが
 * 分かるようにする。
 *
 * **同じ注意は1行にまとめて件数を出す。** 1回の同期で、表から外れた行の数だけ
 * 同じ形の注意が並ぶことがある。行ごとに並べると、他の注意が埋もれる。
 *
 * 置き場が `src/lib/shared/` なのは、renderer（設定画面の一覧・トースト）と
 * main（将来の記録）の両方が同じ言い換えを引けるようにするため。
 * main が押し出してくるのは**原文のまま**で、言い換えはここ1か所で行う。
 */
import { syncTableLabel } from "./syncTableLabels"

/** 同じ種類にまとめた、利用者へ見せる1行ぶんの注意。 */
export interface SyncWarningNotice {
  /** 同じ種類をまとめるための鍵。React の key にも使う */
  key: string
  /** 利用者へ見せる本文。言い換えられなかったときはライブラリの原文 */
  message: string
  /** この種類がこの回に出た件数 */
  count: number
  /** 言い換えたか。`false` なら {@link message} はライブラリの原文そのもの */
  translated: boolean
  /** 言い換えたときの原文（詳細を開いたときに見せる） */
  originals: string[]
  /** 知らせの重さ。`warning` は手当てが要る、`info` は起きたことの報告 */
  severity: "info" | "warning"
}

/** 1つの注意の形と、その言い換え。上から順に当てて、最初に当たったものを使う */
interface SyncWarningRule {
  key: string
  pattern: RegExp
  severity: "info" | "warning"
  /** 当たった正規表現の結果から本文を組み立てる */
  describe: (match: RegExpMatchArray) => string
}

const RULES: SyncWarningRule[] = [
  {
    key: "retention-days",
    pattern:
      /^changelogRetentionDays: .* is not a usable number of days, falling back to (\d+)/,
    severity: "warning",
    describe: (match) =>
      `同期の設定のうち、変更の記録を残す日数が正しくありませんでした。初期値（${match[1]}日）に戻して同期しています。設定を見直してください。`,
  },
  {
    key: "remote-unreadable",
    pattern: /^Failed to open remote database:/,
    severity: "warning",
    describe: () =>
      "他のPCのデータを読み取れませんでした。共有フォルダにつながっているか確認してください。そのPCとの同期は次回やり直します。",
  },
  {
    key: "version-mismatch",
    pattern: /^Skipping client .*: schema version mismatch/,
    severity: "warning",
    describe: () =>
      "バージョンの違う一括採点を使っているPCがあるため、そのPCとは同期していません。すべてのPCを同じバージョンに更新してください。",
  },
  {
    key: "remote-skipped",
    pattern: /^Skipped remote /,
    severity: "warning",
    describe: () =>
      "一部のPCのデータを、今回は取り込めませんでした。次回の同期でやり直します。",
  },
  {
    key: "table-skipped",
    pattern: /^Skipped table /,
    severity: "warning",
    describe: () =>
      "一部のデータを、今回は取り込めませんでした。次回の同期でやり直します。",
  },
  {
    key: "sync-failed",
    pattern: /^Sync failed for client /,
    severity: "warning",
    describe: () =>
      "一部のPCからのデータの取り込みに失敗しました。次回の同期で読み直します。",
  },
  {
    key: "rebuild-deferred",
    pattern: /^Rebuild deferred:/,
    severity: "info",
    describe: () =>
      "このPCでの入力と重なったため、今回は画面への反映を見送りました。次回の同期で反映されます。",
  },
  {
    key: "rebuild-failed",
    pattern: /^Rebuild failed:/,
    severity: "warning",
    describe: () =>
      "一部のデータを画面へ反映できませんでした。この知らせが続くときは、データの控えを取ったうえで問い合わせてください。",
  },
  {
    key: "unplaceable",
    pattern: /^Unplaceable ([^:]+):/,
    severity: "warning",
    describe: (match) =>
      `${syncTableLabel(match[1])}に、まだ画面に出せていないデータがあります。消えてはいません。関わりのあるデータが他のPCから届けば、自動で表示に戻ります。`,
  },
  {
    key: "changelog-unparseable",
    pattern: /unparseable changedAt/,
    severity: "info",
    describe: () =>
      "古い変更の記録を整理できませんでした。同期そのものには影響しませんが、記録が溜まり続けます。",
  },
  {
    key: "machinery-missing",
    pattern: /^同期の仕組み（内部テーブルの行・トリガー）が/,
    severity: "warning",
    describe: () =>
      "同期の準備が一部そろっていませんでした。このPCのデータが、同期以外の方法で書き換えられた可能性があります。",
  },
  {
    key: "machinery-rebuilt",
    pattern: /^欠けていた同期の仕組みを作り直した/,
    severity: "info",
    describe: () =>
      "同期の準備をやり直しました。次の同期からは通常どおり動きます。",
  },
  {
    key: "rebuilding-leftover",
    pattern: /^_sns_rebuilding に行が残っている/,
    severity: "warning",
    describe: () =>
      "前回の同期が、画面への反映の途中で終わっていたようです。今回やり直しています。それまでのあいだ、このPCでの変更は他のPCへ届いていませんでした。",
  },
  {
    key: "client-id-taken",
    pattern: /同じ clientId を使うクライアントが他にある/,
    severity: "warning",
    describe: () =>
      "同じ識別番号を使っているPCが他にあります。取り違えを避けるため、この回の同期は中止しました。一括採点をコピーして別のPCへ持ち込むと起きます。問い合わせてください。",
  },
  {
    key: "restored-from-backup",
    pattern: /バックアップから戻された/,
    severity: "warning",
    describe: () =>
      "このPCのデータが、以前の状態に戻された形跡があります。戻したあとの同期では、他のPCの変更の方が新しいものとして扱われます。",
  },
  {
    key: "self-copy-unreadable",
    pattern: /NAS 上の自分のコピー .* が読めない/,
    severity: "warning",
    describe: () =>
      "共有フォルダにある、このPC用の控えを読み取れませんでした。共有フォルダにつながっているか確認してください。",
  },
  {
    key: "missing-parent-synced",
    pattern: /^同期する表 (\S+) に、親のいない行が (\d+) 件ある/,
    severity: "warning",
    describe: (match) =>
      `${syncTableLabel(match[1])}に、もとになるものが見当たらないデータが${match[2]}件あります。このまま同期を続けると、それらは表示から外れます（消えてはいません）。`,
  },
  {
    key: "missing-parent-unsynced",
    pattern: /^同期しない表 (\S+) に、親のいない行が (\d+) 件ある/,
    severity: "warning",
    describe: (match) =>
      `${syncTableLabel(match[1])}に、もとになるものが見当たらないデータが${match[2]}件あります。同期では触りませんが、データの傷なので問い合わせてください。`,
  },
  {
    key: "missing-parent-rest",
    pattern: /^ほか (\d+) 表.*親がい?ない.*合計 (\d+) 件/,
    severity: "warning",
    describe: (match) =>
      `ほかにも、もとになるものが見当たらないデータが${match[1]}種類・合計${match[2]}件あります。`,
  },
  {
    key: "future-timestamp",
    pattern: /^同期する表 (\S+) の時刻列 \S+ に大きく未来の値がある/,
    severity: "warning",
    describe: (match) =>
      `${syncTableLabel(match[1])}に、日時が大きく先の日付になっているデータがあります。どのPCの変更が新しいかを正しく比べられません。各PCの時計が合っているか確認してください。`,
  },
  {
    key: "added-column-not-null",
    pattern: /^同期する表 (\S+) に増えた列 \S+ は NOT NULL/,
    severity: "info",
    describe: (match) =>
      `${syncTableLabel(match[1])}に増えた項目について、アプリの更新の都合で注意が出ています。動作に影響はありません。`,
  },
]

/**
 * ライブラリの注意書きを、利用者へ見せる一覧に直す。
 *
 * 同じ種類は1行にまとめ、件数を添える。並びは受け取った順（最初に出た種類が先頭）で、
 * 数の多い順に並べ替えない。**起きた順が読み筋**で、並べ替えると原因と結果が離れる。
 */
export function describeSyncWarnings(warnings: string[]): SyncWarningNotice[] {
  const noticeByKey = new Map<string, SyncWarningNotice>()

  for (const warning of warnings) {
    const rule = RULES.find((candidate) => candidate.pattern.test(warning))
    // 言い換えられないものは、原文ごとに1行。知らない注意を握りつぶさない
    const key = rule ? rule.key : `raw:${warning}`
    const existing = noticeByKey.get(key)
    if (existing) {
      existing.count += 1
      existing.originals.push(warning)
      continue
    }
    const match = rule ? warning.match(rule.pattern) : null
    noticeByKey.set(key, {
      key,
      message: rule && match ? rule.describe(match) : warning,
      count: 1,
      translated: rule !== undefined && match !== null,
      originals: [warning],
      severity: rule ? rule.severity : "warning",
    })
  }

  return [...noticeByKey.values()]
}
