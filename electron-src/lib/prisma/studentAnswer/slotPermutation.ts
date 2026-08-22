/**
 * unique を持つ表で、行を「スロット」の間で動かす計画を立てる。
 *
 * ここでいうスロットとは `@@unique` の値そのもの（`StudentAnswerImage` なら
 * `(examPageId, examStudentId)`、`ScoreDecision` なら `(cropRegionId, examStudentId)` の
 * examStudentId 側）で、**1つのスロットには1行しか置けない**。答案配置はこのスロットの
 * 並べ替えなので、素直に書くと「行の unique キーを書き換える」ことになる。
 *
 * ## なぜ計画が要るのか（NAS同期での実測）
 *
 * 端末Aで起きた変更は `_changelog` に1件ずつ載り、端末Bはそれを**1件ずつ**適用する。
 * さらに `sqlite-nas-sync` の `deduplicateEntries` は同じ (表, id) のエントリを
 * **最後の1件へ畳む**ため、1つのトランザクションでの delete → 同一idでの再作成は、
 * 相手には **INSERT 1件** としてしか届かない。相手はそれを主キー衝突として
 * `applyInsert` のケース1（素の UPDATE）で当て、そこがセカンダリ unique に当たると
 * **例外が catch されず取り込みが丸ごと巻き戻る**。`lastSeenId` も進まないので、
 * その相手からの変更は以後**永久に届かない**（2026-08 実測。
 * `__tests__/sync/studentAnswerPlacementSync.test.ts`）。
 *
 * つまり「削除→再作成」は同期を越えられない。そして相手が1件ずつ当てる以上、
 * **入れ替え（輪）を unique キーの書き換えで表現する方法は存在しない** —
 * どの順で当てても途中で必ず2行が同じスロットに乗る。
 *
 * ## 決めた形
 *
 * - 移動先スロットが空くなら **行ごと動かす**（`keyMoves`。id は中身に付いていく）。
 *   相手には素の UPDATE として届き、相手側で衝突しても `applyUpdate` が LWW で畳む。
 * - 空かない輪は **行をスロットに残し、中身だけを前任者から受け取る**
 *   （`payloadCopies`）。unique キーを一度も触らないので、途中の状態が無く、
 *   相手にも「列がいくつか変わった UPDATE」としてしか見えない。
 *
 * unique がある表では、行の同一性はスロットの側にある（「同じスロットの2行は同じもの」
 * だから索引が畳める）。輪でidがスロットに留まるのはその帰結であって、妥協ではない。
 * 逆に `QuestionScore` は unique を持たない＝行そのものが同一性なので、この計画は使わず
 * 行ごと動かす（子の DrawingAnnotation が付いてくる）。
 */

/** 計画を立てる時点で、そのスロットに座っている行 */
export interface SlotOccupant {
  rowId: string
  slot: string
}

interface SlotKeyMove {
  rowId: string
  /** 動かした先のスロット。呼び出し側が列の値へ戻す */
  toSlot: string
}

interface SlotPayloadCopy {
  /** 中身を受け取る行（スロットに留まる） */
  intoRowId: string
  /** 中身の出どころ。**計画を立てた時点の値**を書き込むこと */
  fromRowId: string
}

export interface SlotPermutationPlan {
  /** この順に適用すれば、途中でも2行が同じスロットに乗らない */
  keyMoves: SlotKeyMove[]
  payloadCopies: SlotPayloadCopy[]
}

/**
 * スロットの置換を、unique を壊さない手順へ分解する。
 *
 * @param occupants 対象スロット群に現存する行（削除予定の行は含めないこと）
 * @param destinationBySlot 移動元スロット → 移動先スロット。行が無いスロットを
 *   含んでいてよい（無視する）。移動元と移動先が同じ組は何もしない
 * @throws 2つの移動元が同じ移動先を指している場合（1スロット1行を壊す指示）
 * @throws 同じスロットに2行が座っている場合（unique が既に壊れている）
 * @throws 移動先を占める行が移動元に含まれない場合（置換ではなく上書きになる）
 */
export function planSlotPermutation(
  occupants: SlotOccupant[],
  destinationBySlot: ReadonlyMap<string, string>
): SlotPermutationPlan {
  const claimedDestinations = new Set<string>()
  for (const [fromSlot, toSlot] of destinationBySlot) {
    if (fromSlot === toSlot) continue
    if (claimedDestinations.has(toSlot)) {
      throw new Error(`同じ移動先が2回指定されています: ${toSlot}`)
    }
    claimedDestinations.add(toSlot)
  }

  // 「1スロット1行」はこの分解の土台。Map へ素直に畳むと後から来た行が前の行を
  // 黙って隠し、隠れた行だけが動かないまま残る。壊れた入力はここで止める
  const rowIdBySlot = new Map<string, string>()
  for (const occupant of occupants) {
    if (rowIdBySlot.has(occupant.slot)) {
      throw new Error(`同じスロットに2行が座っています: ${occupant.slot}`)
    }
    rowIdBySlot.set(occupant.slot, occupant.rowId)
  }

  // 行が実在し、かつ実際に動く移動元だけを相手にする
  const pendingSlots = Array.from(destinationBySlot.keys()).filter(
    (fromSlot) =>
      rowIdBySlot.has(fromSlot) && destinationBySlot.get(fromSlot) !== fromSlot
  )

  // 移動先が埋まっているなら、**その占有者も動く側**でなければならない。
  // 動かない行の上へ載せると、行ごとは動かせず（スロットが空かない）中身のコピーへ
  // 落ちるので、占有者の中身が黙って上書きされる ——「A→B, B→B」や、B が
  // `destinationBySlot` に居ない場合がこれ。2つのマスが同じ答案を映し、B の答案は
  // 孤児になり、例外は出ない。**上書きは置換ではない**ので、指示として拒む。
  //
  // ここを通ったあとの形は、移動元集合の上の「出次数1・入次数1以下」の graph に
  // なる（入次数は上の claimedDestinations が担保する）＝ 鎖と輪の直和。
  // 鎖は下の while で末尾から解け、残るのは必ず輪だけになる。
  const movingSlots = new Set(pendingSlots)
  for (const fromSlot of pendingSlots) {
    const toSlot = destinationBySlot.get(fromSlot)!
    if (rowIdBySlot.has(toSlot) && !movingSlots.has(toSlot)) {
      throw new Error(
        `移動先に、移動しない行が座っています: ${toSlot}（上書きはしません）`
      )
    }
  }

  const keyMoves: SlotKeyMove[] = []
  let movedSomething = true
  while (movedSomething) {
    movedSomething = false
    for (let index = pendingSlots.length - 1; index >= 0; index--) {
      const fromSlot = pendingSlots[index]
      const toSlot = destinationBySlot.get(fromSlot)!
      if (rowIdBySlot.has(toSlot)) continue // まだ埋まっている
      const rowId = rowIdBySlot.get(fromSlot)!
      keyMoves.push({ rowId, toSlot })
      rowIdBySlot.delete(fromSlot)
      rowIdBySlot.set(toSlot, rowId)
      pendingSlots.splice(index, 1)
      movedSomething = true
    }
  }

  // 残ったのは輪だけ（上の検査で保証済み）。行は動かさず、中身だけを回す
  const payloadCopies: SlotPayloadCopy[] = pendingSlots.map((fromSlot) => ({
    intoRowId: rowIdBySlot.get(destinationBySlot.get(fromSlot)!)!,
    fromRowId: rowIdBySlot.get(fromSlot)!,
  }))

  return { keyMoves, payloadCopies }
}
