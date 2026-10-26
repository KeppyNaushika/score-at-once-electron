/**
 * 同期の注意書きの言い換えが、**利用者に意味の伝わる形**になり、かつ
 * **知らない注意を握りつぶさない**こと。
 *
 * ライブラリ（sqlite-nas-sync）の `SyncResult.warnings` は、組み込む側の開発者へ向けた
 * 言葉で書かれている。`warnings` の説明には「アプリケーションの利用者に見える場所へ
 * 出すこと」とあるので、出さない選択肢は無い。出すなら読める形にする。
 *
 * ここで固定するのは次の3つ:
 *
 * - **技術の言葉を利用者に見せない。** 表の名前・`clientId`・`lamport` をそのまま出さない
 * - **知らない注意はそのまま出す。** 対応表はライブラリが増えれば必ず追い越される。
 *   知らないものを黙って捨てると、利用者にも開発者にも届かなくなる
 * - **同じ注意は1行にまとめる。** 行ごとに並べると他の注意が埋もれる
 *
 * 入力の文面は `~/dev/sqlite-nas-sync/src` の `warnings.push(...)` から写したもの。
 */

import { describe, expect, it } from "vitest"

import {
  describeSyncWarnings,
  newlyAppearedWarnings,
} from "@/lib/shared/syncWarningMessages"

describe("describeSyncWarnings", () => {
  it("注意が無ければ何も返さない", () => {
    expect(describeSyncWarnings([])).toEqual([])
  })

  it("バージョン違いのPCを、利用者の言葉で伝える", () => {
    const [notice] = describeSyncWarnings([
      "Skipping client abc-123: schema version mismatch (local=20260101_a, remote=20251201_b)",
    ])

    expect(notice.translated).toBe(true)
    expect(notice.message).toContain("バージョンの違う")
    expect(notice.message).toContain("同じバージョンに更新")
    // 内部の識別子は利用者に意味が無い
    expect(notice.message).not.toContain("abc-123")
    expect(notice.message).not.toContain("schema version")
  })

  it("表の名前は日本語の名前に直す", () => {
    const [notice] = describeSyncWarnings([
      "Unplaceable ExamStudent:student-1: 親行がまだ届いていない",
    ])

    expect(notice.message).toContain("受験生徒")
    expect(notice.message).not.toContain("ExamStudent")
    // 消えていないことを必ず書く（表に出ないだけで、事実は残っている）
    expect(notice.message).toContain("削除されてはいません")
  })

  it("同じ種類の注意は1行にまとめて件数を出す", () => {
    const notices = describeSyncWarnings([
      "Unplaceable ExamStudent:a: 理由",
      "Unplaceable ExamStudent:b: 理由",
      "Unplaceable ExamStudent:c: 理由",
    ])

    expect(notices).toHaveLength(1)
    expect(notices[0].count).toBe(3)
    expect(notices[0].originals).toHaveLength(3)
  })

  it("種類が違えば別の行にし、受け取った順に並べる", () => {
    const notices = describeSyncWarnings([
      "Rebuild deferred: アプリケーションが書き込んだ（見送り 1 回目）",
      "Failed to open remote database: other-pc",
    ])

    expect(notices).toHaveLength(2)
    expect(notices[0].key).toMatch(/^rebuild-deferred:/)
    expect(notices[1].key).toMatch(/^remote-unreadable:/)
  })

  it("同じ形でも表が違えば別の行にし、どの表の名前も落とさない", () => {
    const notices = describeSyncWarnings([
      "Unplaceable ExamStudent:a: 理由",
      "Unplaceable Exam:b: 理由",
      "Unplaceable ExamStudent:c: 理由",
    ])

    expect(notices).toHaveLength(2)
    expect(notices[0].message).toContain("受験生徒")
    expect(notices[0].count).toBe(2)
    expect(notices[1].message).not.toContain("受験生徒")
    expect(notices[1].count).toBe(1)
  })

  it("言い換えられない注意は、原文のまま出して黙らない", () => {
    const unknown = "Some future warning the app has never seen"
    const [notice] = describeSyncWarnings([unknown])

    expect(notice.translated).toBe(false)
    expect(notice.message).toBe(unknown)
    // 分からないものは、手当てが要る側に倒す
    expect(notice.severity).toBe("warning")
  })

  it("言い換えられない注意どうしは、原文ごとに別の行にする", () => {
    const notices = describeSyncWarnings([
      "unknown A",
      "unknown B",
      "unknown A",
    ])

    expect(notices).toHaveLength(2)
    expect(notices[0].count).toBe(2)
    expect(notices[1].count).toBe(1)
  })

  it("言い換えても原文を捨てない（詳しい内容として見せられる）", () => {
    const original =
      "同期する表 ExamStudent に、親のいない行が 5 件ある（親は Exam 5件）。" +
      "この状態で同期を始めると、その行はユーザーテーブルから外れます"
    const [notice] = describeSyncWarnings([original])

    expect(notice.originals).toEqual([original])
    expect(notice.message).toContain("受験生徒")
    expect(notice.message).toContain("5件")
    expect(notice.message).toContain("表示されなくなります")
  })

  it("設定の取り違えは、戻した値まで伝える", () => {
    const [notice] = describeSyncWarnings([
      "changelogRetentionDays: -1 is not a usable number of days, falling back to 7.",
    ])

    expect(notice.message).toContain("7日")
    expect(notice.message).not.toContain("changelogRetentionDays")
  })

  it("読み取り失敗は、他のPCの変更の取り込みと復元判定を区別する", () => {
    const [remote, self, restored] = describeSyncWarnings([
      "Failed to open remote database: other-pc",
      "NAS 上の自分のコピー /nas/sync/a.sqlite が読めない。この回は、DB がバックアップから戻されたかどうかを判定できない",
      "手元の lamport (1) が、NAS 上の自分のコピーに記録した値 (2) より小さい。DB がバックアップから戻されたか、外で書き換えられた可能性がある",
    ])

    expect(remote.key).toMatch(/^remote-unreadable:/)
    expect(remote.message).toContain("今回は取り込まれていません")
    expect(self.key).toMatch(/^self-copy-unreadable:/)
    expect(self.message).toContain("復元されたかどうかを確認できませんでした")
    expect(restored.key).toMatch(/^restored-from-backup:/)
    for (const notice of [remote, self]) {
      expect(notice.message).toContain("次回の同期で再度")
      expect(notice.message).not.toContain("対処の必要はありません")
    }
  })

  it("反映対象から除外された場合は、再起動まで反映されないことを伝える", () => {
    const [notice] = describeSyncWarnings([
      "Rebuild failed: 外部キーの違反が残るので、作り直しの対象から外した: ExamStudent",
    ])

    expect(notice.message).toContain("再起動するまで")
    expect(notice.message).toContain("再起動してください")
    expect(notice.message).toContain("バックアップを作成してください")
    expect(notice.message).not.toContain("問い合わせ")
  })

  it("参照先がない残りの表も、同期対象かどうかで影響と対処を書き分ける", () => {
    const notices = describeSyncWarnings([
      "ほか 2 表の、同期に関わる行にも親がいない（合計 7 件）。この状態で同期を始めると、それらの行はユーザーテーブルから外れる（バージョンは残る）",
      "ほか 2 表にも親のいない行がある（合計 7 件）。同期は触らないが、DB がもともと壊れている印なので、あわせて直すこと",
    ])

    expect(notices).toHaveLength(2)
    expect(notices[0].key).toMatch(/^missing-parent-rest-synced:/)
    expect(notices[0].message).toContain("表示されなくなります")
    expect(notices[1].key).toMatch(/^missing-parent-rest-unsynced:/)
    expect(notices[1].message).toContain("修復しません")
    for (const notice of notices) {
      expect(notice.translated).toBe(true)
      expect(notice.message).toContain("2種類")
      expect(notice.message).toContain("合計7件")
      expect(notice.message).toContain("バックアップを作成してください")
    }
  })

  it("識別番号が重複した知らせは、同期の中止と一方だけを使用する対処を伝える", () => {
    const [notice] = describeSyncWarnings([
      "NAS 上の自分のコピー /nas/sync/a.db の sns.instanceId が X になっている（自分は Y）。" +
        "同じ clientId を使うクライアントが他にあるので、この回の同期を止めた。" +
        "clientId はクライアントごとに別の値にすること",
    ])

    expect(notice.message).toContain("同じ識別番号")
    expect(notice.message).toContain("中止")
    expect(notice.message).toContain("同じPC内で複製")
    expect(notice.message).toContain("一方だけを使用してください")
    expect(notice.message).not.toContain("clientId")
    expect(notice.message).not.toContain("instanceId")
  })

  it("報告だけの知らせは、手当ての要るものと重さを分ける", () => {
    const [deferred] = describeSyncWarnings([
      "Rebuild deferred: 書き込み中（見送り 1 回目）",
    ])
    const [failed] = describeSyncWarnings(["Rebuild failed: 外部キーの違反"])

    expect(deferred.severity).toBe("info")
    expect(failed.severity).toBe("warning")
  })
})

describe("newlyAppearedWarnings", () => {
  it("前回の同期に無かった注意だけを返す", () => {
    expect(newlyAppearedWarnings(["A", "B"], ["B", "C"])).toEqual(["C"])
  })

  it("同じ注意が続くあいだは何も返さない", () => {
    expect(newlyAppearedWarnings(["A"], ["A"])).toEqual([])
  })

  it("一度消えた注意がまた出たら、新しく出たものとして返す", () => {
    expect(newlyAppearedWarnings([], ["A"])).toEqual(["A"])
  })
})
