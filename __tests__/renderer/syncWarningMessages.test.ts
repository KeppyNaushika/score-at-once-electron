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

import { describeSyncWarnings } from "@/lib/shared/syncWarningMessages"

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

    expect(notice.message).toContain("試験の受験生徒")
    expect(notice.message).not.toContain("ExamStudent")
    // 消えていないことを必ず書く（表に出ないだけで、事実は残っている）
    expect(notice.message).toContain("消えてはいません")
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

    expect(notices.map((notice) => notice.key)).toEqual([
      "rebuild-deferred",
      "remote-unreadable",
    ])
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
    expect(notice.message).toContain("試験の受験生徒")
    expect(notice.message).toContain("5件")
    expect(notice.message).toContain("表示から外れます")
  })

  it("設定の取り違えは、戻した値まで伝える", () => {
    const [notice] = describeSyncWarnings([
      "changelogRetentionDays: -1 is not a usable number of days, falling back to 7.",
    ])

    expect(notice.message).toContain("7日")
    expect(notice.message).not.toContain("changelogRetentionDays")
  })

  it("同じ識別番号のPCが2台ある知らせは、同期を止めたことまで伝える", () => {
    const [notice] = describeSyncWarnings([
      "NAS 上の自分のコピー /nas/sync/a.db の sns.instanceId が X になっている（自分は Y）。" +
        "同じ clientId を使うクライアントが他にあるので、この回の同期を止めた。" +
        "clientId はクライアントごとに別の値にすること",
    ])

    expect(notice.message).toContain("同じ識別番号")
    expect(notice.message).toContain("中止")
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
