/**
 * 共有モード（同期・beta）の同意文と、同意が「今の同意か」の判定。
 *
 * 文面を改めたら {@link SYNC_CONSENT_VERSION} を上げること。上げると、同意済みのPCも
 * 改めて同意を求められる（版の一致で「今の同意か」を判定するため）。ただし共有モードで
 * 動いているPCの同期は**止めない**。起動のたびに同意を求めるだけにする（勝手に切ると、
 * 採点の途中で他のPCとの行き来が止まり、かえって食い違いを生むので）。
 *
 * main（同意の記録に版を付ける・同意の無い接続を断る）と renderer（同意の画面・判定）の
 * 両方が値で引くので `src/lib/shared/` に置く。
 */

import type { SyncAppConfig } from "@/electron-src/lib/sync/types"

/** 同意文の版。同意の記録（`sync-config.json`）にこの文字列が残り、一致しなければ同意し直す */
export const SYNC_CONSENT_VERSION = "2026-10-26"

/** 同意の1項目。利用者は項目ごとに確かめる（読み飛ばせない形にする） */
interface SyncConsentItem {
  /** 画面の key・テストの手がかりに使う安定した名前 */
  key: string
  title: string
  body: string
}

/**
 * 同意の項目。同期設定の画面に常にある注意事項（`SyncNotes`）も、この項目をそのまま
 * 先頭に出す（同じことを2か所に書かない）。
 *
 * 技術の言葉（版・主キー・親行）は使わない。画面で見えるもの（試験・採点結果）を主語にする。
 */
export const SYNC_CONSENT_ITEMS: readonly SyncConsentItem[] = [
  {
    key: "beta-no-warranty",
    title: "共有モードは beta であり、動作は保証されません",
    body: "共有モードは、共有フォルダを通して、複数のPCで同じデータを使うための機能です。採点を分担するときに使います。まだ beta であり、これから動きが変わることがあり、不具合が残っている可能性もあります。本ソフトウェアは GNU Affero General Public License 第3版（AGPLv3）に基づき提供され、法令で認められる範囲において一切の保証はありません（同ライセンス第15条および第16条）。",
  },
  {
    key: "backup",
    title: "バックアップは、同期とは別にご自身で取ってください",
    body: "採点したデータは、同期とは別に、ご自身でもバックアップを取ってください（アーカイブの書き出し）。共有フォルダにある同期用ファイルは、バックアップではありません。そこからデータを元に戻すことはできません。",
  },
  {
    key: "deletion-propagates",
    title: "あるPCで消したものは、他のPCからも消えます",
    body: "消す前に、他の先生の分も消えてよいか確かめてください。",
  },
  {
    key: "no-undo",
    title: "消したものを元に戻す操作はありません",
    body: "試験を消すと、その試験の採点結果も見られなくなります。同じ名前の試験を作り直しても、前の採点結果は戻りません。元に戻したいときは、消す前に書き出しておいたファイルから取り込み直してください。",
  },
]

/**
 * このPCが、今の版の同意文に同意しているか。
 *
 * 同意はPCごとに取る（あるPCで消したものは他の先生の分も消えるので、つなぐ先生それぞれが
 * 知っておく必要がある）。PCは同期の clientId で見分ける。data を丸ごと別のPCへ写すと
 * 起動時に clientId が振り直される（`ensureClientIdOwnedBy`）ので、写した先では同意し直しになる。
 */
export function isSyncConsentCurrent(
  config: Pick<SyncAppConfig, "clientId" | "syncConsent">
): boolean {
  const { syncConsent } = config
  return (
    syncConsent !== null &&
    config.clientId !== "" &&
    syncConsent.clientId === config.clientId &&
    syncConsent.consentVersion === SYNC_CONSENT_VERSION
  )
}
