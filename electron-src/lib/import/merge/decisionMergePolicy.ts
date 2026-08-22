/**
 * 確定レイヤーのマージ競合解決ポリシー（convention-as-code）
 *
 * 「確定」性データ（権限保持者が下す最終結果）のマージ競合解決は LWW（Last-Write-Wins）
 * で一本化する。これは ScoreDecision・CompoundAnswerScore など確定レイヤーすべてに
 * 共通の一貫方針であり、個別に別戦略を持ち込まないこと。
 *
 * 【軸の分離 — 重要】
 * - 「どう解決するか」= 常に LWW（このモジュール）。
 * - 「誰が確定を書けるか」= 権限(authority)の話で、競合解決とは独立した別レイヤー。
 *   現状は OWNER のみだが、将来 OWNER 以外にも付与可能にする想定。権限制御を足すときも
 *   競合解決ポリシー（LWW）は変えないこと。
 *
 * cf. 取り込み（アーカイブ）の値の扱いは importValuePolicy に一本化されている。
 *     人が選んだ操作（上書きする / 統合する / 別で追加する）で決まり、「統合する」の
 *     ときの判定にこの isNewerByLww を使う。同期の LWW と同じ物差し。
 */

/**
 * 取り込み側（アーカイブ）の確定が既存ローカルの確定より新しいか（LWW判定）。
 *
 * 真なら取り込み側で上書きすべき。等しい/古い場合は既存を維持する。
 *
 * @param incomingTimestamp - 取り込み側の更新時刻（ScoreDecision.decidedAt 等）
 * @param existingTimestamp - 既存ローカルの更新時刻
 */
export function isNewerByLww(
  incomingTimestamp: Date,
  existingTimestamp: Date
): boolean {
  return incomingTimestamp.getTime() > existingTimestamp.getTime()
}
