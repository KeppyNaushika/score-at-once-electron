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
 * 同じ形の注意が並ぶことがある。行ごとに並べると、他の注意が埋もれる。まとめるのは
 * **言い換えた本文が同じもの**どうしで、形が同じでも表が違えば別の行にする（表の名前を
 * 本文に含む注意を形だけでまとめると、2つ目からの表の名前が消える）。
 *
 * 置き場が `src/lib/shared/` なのは、renderer（設定画面の一覧・トースト）と
 * main（将来の記録）の両方が同じ言い換えを引けるようにするため。
 * main が押し出してくるのは**原文のまま**で、言い換えはここ1か所で行う。
 */
import { tableLabel } from "./tableLabels"

/** 同じ種類にまとめた、利用者へ見せる1行ぶんの注意。 */
interface SyncWarningNotice {
  /** 同じ注意をまとめるための鍵（形と本文）。React の key にも使う */
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
      "共有フォルダにある、他のPCの同期用ファイルを読み取れませんでした。共有フォルダへのアクセス、同期用ファイルのコピー、またはコピーしたファイルの検査に失敗した場合に表示されます。読み取れなかった同期用ファイルの変更は、今回は取り込まれていません。次回の同期で再度読み取ります。",
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
      "データの参照先との整合性を保てないため、他のPCの変更の一部を反映できませんでした。対象の種類のデータには、一括採点を再起動するまで他のPCの変更が反映されません。一括採点を再起動してください。再起動後も表示される場合は、アーカイブを書き出してバックアップを作成してください。",
  },
  {
    key: "unplaceable",
    pattern: /^Unplaceable ([^:]+):/,
    severity: "warning",
    describe: (match) =>
      `${tableLabel(match[1])}に、まだ画面に表示できていないデータがあります。削除されてはいません。参照先のデータが存在しない場合などに発生します。関連するデータが他のPCから同期されれば、自動で表示されます。`,
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
      "同期に必要な内部データや処理の一部が欠けていました。このPCのデータベースが同期以外の方法で変更された場合や、前回の同期の処理状態が残っている場合などに表示されます。同期機能が自動で修復します。",
  },
  {
    key: "machinery-rebuilt",
    pattern: /^欠けていた同期の仕組みを作り直した/,
    severity: "info",
    describe: () =>
      "同期に必要な内部データや処理の一部が欠けていたため、作り直しました。引き続き同期します。通常は対処の必要はありません。",
  },
  {
    key: "rebuilding-leftover",
    pattern: /^_sns_rebuilding に行が残っている/,
    severity: "warning",
    describe: () =>
      "前回の同期の処理状態が残っています。データの反映中に同期が中断された可能性があります。処理状態が残っている間は、このPCでの変更が他のPCへ同期されません。同期機能が処理状態を自動で修復します。",
  },
  {
    key: "client-id-taken",
    pattern: /同じ clientId を使うクライアントが他にある/,
    severity: "warning",
    describe: () =>
      "このPCと同じ識別番号を使用している一括採点がほかにあります。データの取り違えを防ぐため、今回の同期を中止しました。一括採点を2つ同時に起動した場合や、一括採点のフォルダを同じPC内で複製して両方を使用した場合などに発生することがあります。どちらか一方を終了し、以後は一方だけを使用してください。",
  },
  // 原文に「バックアップから戻されたかどうかを判定できない」を含むため、
  // 復元を検出した警告より先に判定する。
  {
    key: "self-copy-unreadable",
    pattern: /NAS 上の自分のコピー .* が読めない/,
    severity: "warning",
    describe: () =>
      "共有フォルダにある、このPCの同期用ファイルを読み取れませんでした。同期用ファイルのコピー、またはコピーしたファイルの検査に失敗した場合に表示されます。今回は、このPCのデータがバックアップから復元されたかどうかを確認できませんでした。次回の同期で再度確認します。",
  },
  {
    key: "restored-from-backup",
    pattern: /バックアップから戻された/,
    severity: "warning",
    describe: () =>
      "このPCのデータが、以前の状態に戻された形跡があります。戻したあとの同期では、他のPCの変更の方が新しいものとして扱われます。",
  },
  {
    key: "missing-parent-synced",
    pattern: /^同期する表 (\S+) に、親のいない行が (\d+) 件ある/,
    severity: "warning",
    describe: (match) =>
      `${tableLabel(match[1])}に、参照先が存在しないデータが${match[2]}件あります。同期開始前の検査で見つかりました。このまま同期を続けると、該当するデータは表示されなくなります（削除はされません）。アーカイブを書き出してバックアップを作成してください。`,
  },
  {
    key: "missing-parent-unsynced",
    pattern: /^同期しない表 (\S+) に、親のいない行が (\d+) 件ある/,
    severity: "warning",
    describe: (match) =>
      `${tableLabel(match[1])}で、データの一部が破損しています（参照先が存在しないデータが${match[2]}件）。同期開始前の検査で見つかりました。同期機能では、このデータを修復しません。アーカイブを書き出してバックアップを作成してください。`,
  },
  {
    key: "missing-parent-rest-synced",
    pattern: /^ほか (\d+) 表の、同期に関わる行にも親がいない（合計 (\d+) 件）/,
    severity: "warning",
    describe: (match) =>
      `ほかにも、参照先が存在しないデータが${match[1]}種類・合計${match[2]}件あります。同期開始前の検査で見つかりました。このまま同期を続けると、該当するデータは表示されなくなります（削除はされません）。アーカイブを書き出してバックアップを作成してください。`,
  },
  {
    key: "missing-parent-rest-unsynced",
    pattern: /^ほか (\d+) 表にも親のいない行がある（合計 (\d+) 件）/,
    severity: "warning",
    describe: (match) =>
      `ほかにも、${match[1]}種類のデータの一部が破損しています（参照先が存在しないデータが合計${match[2]}件）。同期開始前の検査で見つかりました。同期機能では、このデータを修復しません。アーカイブを書き出してバックアップを作成してください。`,
  },
  {
    key: "future-timestamp",
    pattern: /^同期する表 (\S+) の時刻列 \S+ に大きく未来の値がある/,
    severity: "warning",
    describe: (match) =>
      `${tableLabel(match[1])}に、日時が大きく先の日付になっているデータがあります。どのPCの変更が新しいかを正しく比べられません。各PCの時計が合っているか確認してください。`,
  },
  {
    key: "added-column-not-null",
    pattern: /^同期する表 (\S+) に増えた列 \S+ は NOT NULL/,
    severity: "info",
    describe: (match) =>
      `${tableLabel(match[1])}に増えた項目について、アプリの更新の都合で注意が出ています。動作に影響はありません。`,
  },
]

/**
 * ライブラリの注意書きを、利用者へ見せる一覧に直す。
 *
 * 言い換えた本文が同じものは1行にまとめ、件数を添える。並びは受け取った順（最初に
 * 出たものが先頭）で、数の多い順に並べ替えない。**起きた順が読み筋**で、並べ替えると
 * 原因と結果が離れる。
 */
export function describeSyncWarnings(warnings: string[]): SyncWarningNotice[] {
  const noticeByKey = new Map<string, SyncWarningNotice>()

  for (const warning of warnings) {
    const rule = RULES.find((candidate) => candidate.pattern.test(warning))
    const match = rule ? warning.match(rule.pattern) : null
    const translated = rule !== undefined && match !== null
    const message = rule && match ? rule.describe(match) : warning
    // 言い換えられないものは、原文ごとに1行。知らない注意を握りつぶさない
    const key = rule ? `${rule.key}:${message}` : `raw:${warning}`
    const existing = noticeByKey.get(key)
    if (existing) {
      existing.count += 1
      existing.originals.push(warning)
      continue
    }
    noticeByKey.set(key, {
      key,
      message,
      count: 1,
      translated,
      originals: [warning],
      severity: rule ? rule.severity : "warning",
    })
  }

  return [...noticeByKey.values()]
}

/**
 * 今回の同期で**新しく出た**注意（前回の同期には無かったもの）。
 *
 * 同じ注意は原因が続くかぎり同期のたびに出る。毎回知らせると、同期間隔ごとに同じ窓が
 * 積み上がって他の知らせを覆うので、知らせるのは新しく出た回だけにする。
 */
export function newlyAppearedWarnings(
  previousWarnings: string[],
  currentWarnings: string[]
): string[] {
  return currentWarnings.filter(
    (warning) => !previousWarnings.includes(warning)
  )
}
