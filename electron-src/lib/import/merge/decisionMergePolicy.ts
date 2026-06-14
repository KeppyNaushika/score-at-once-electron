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
 * cf. 採点者の「提案」レイヤー（QuestionScore）の競合解決は scoringConflictResolver.ts。
 *     提案レイヤーはユーザーが選んだ戦略（existing/import/newer_wins）に従うが、
 *     確定レイヤーは常に LWW。両者を混同しないこと。
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
