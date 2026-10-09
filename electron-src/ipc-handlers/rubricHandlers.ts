/**
 * ルーブリック採点（教員の層）の IPC（docs/vlm-grading-design.md §4・§11）。
 *
 * 項目の作成・変更・削除、採点方式の変更、適用の付け外し（まとめて）、項目から計算した点の
 * 書き込み、点を計算し直す材料の取得、重なった助言の決まりと助言の朱書きの読み書き。**点の計算は renderer** で、main は元データを返して
 * 受け取った結果を書くだけ。
 *
 * 操作者は認証ストアから決める（renderer から利用者 id を受け取らない）。
 */

import type { ScoringMethod } from "../../src/types/rubric.types"
import { measureCropRegionInk } from "../lib/aiGrading/sendingImageInspection"
import { getAbsolutePathFromSharedFiles } from "../lib/dataManager"
import { getCurrentActorUserId } from "../lib/prisma/auditActor"
import {
  deleteRubricAdviceCombination,
  getRubricAdviceSource,
  listRubricAdviceCombinations,
  type RubricAdviceSyncInput,
  saveRubricAdviceCombination,
  type SaveRubricAdviceCombinationInput,
  syncRubricAdviceAnnotations,
} from "../lib/prisma/rubricAdvice"
import {
  getRubricRecalculationSource,
  listRubricApplicationsByCropRegion,
  setRubricApplications,
  type SetRubricApplicationsInput,
} from "../lib/prisma/rubricApplication"
import {
  createRubricItem,
  type CreateRubricItemData,
  deleteRubricItem,
  listRubricItemsByCropRegion,
  listRubricItemsByExam,
  setCropRegionScoringMethod,
  updateRubricItem,
  type UpdateRubricItemData,
} from "../lib/prisma/rubricItem"
import {
  type RubricScoreWrite,
  writeRubricScores,
} from "../lib/prisma/rubricScoreWrite"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 操作者（ログイン中の教員）。ログインしていなければ投げる */
function requireActorUserId(): string {
  const actorUserId = getCurrentActorUserId()
  if (!actorUserId) throw new Error("ログインしていません")
  return actorUserId
}

/** ルーブリック項目・採点方式・適用・項目から計算した点の IPC チャンネル */
export const rubricHandlers = {
  // ── 項目 ───────────────────────────────────────────────────
  /** 設問の項目を並び順に全部（どの教員が作ったものも。作成者付き） */
  "rubric:listItems": async (cropRegionId: string) =>
    listRubricItemsByCropRegion(cropRegionId),

  /** 試験の全設問の項目 */
  "rubric:listItemsByExam": async (examId: string) =>
    listRubricItemsByExam(examId),

  "rubric:createItem": async (data: CreateRubricItemData) =>
    createRubricItem(data, requireActorUserId()),

  "rubric:updateItem": async (
    rubricItemId: string,
    data: UpdateRubricItemData
  ) => updateRubricItem(rubricItemId, data, requireActorUserId()),

  /** 項目を消す（適用もカスケードで消える）。点の計算し直しは消す前に読んだ材料で行う */
  "rubric:deleteItem": async (rubricItemId: string) =>
    deleteRubricItem(rubricItemId, requireActorUserId()),

  /** 設問の採点方式（points / deduction / addition）を変える */
  "rubric:setScoringMethod": async (
    cropRegionId: string,
    scoringMethod: ScoringMethod
  ) =>
    setCropRegionScoringMethod(
      cropRegionId,
      scoringMethod,
      requireActorUserId()
    ),

  // ── 適用 ───────────────────────────────────────────────────
  /** 設問の適用を全部（採点者を問わない。誰のものかは採点行と突き合わせて絞る） */
  "rubric:listApplications": async (cropRegionId: string) =>
    listRubricApplicationsByCropRegion(cropRegionId),

  /** 自分の採点行に項目をまとめて当てる・外す。付け外ししたマスの採点行（適用付き）を返す */
  "rubric:setApplications": async (input: SetRubricApplicationsInput) =>
    setRubricApplications(input, requireActorUserId()),

  // ── 点 ─────────────────────────────────────────────────────
  /** 点を計算し直す材料（設問・項目・適用のある全採点者の採点行と適用） */
  "rubric:getRecalculationSource": async (cropRegionId: string) =>
    getRubricRecalculationSource(cropRegionId),

  /** 項目から計算した点をまとめて書く（他の採点者の行も。上書きの印は外す） */
  "rubric:writeScores": async (writes: RubricScoreWrite[]) =>
    writeRubricScores(writes, requireActorUserId()),

  // ── 助言と朱書き（§4-7・§9） ─────────────────────────────────
  /** 設問の重なった助言の決まり（項目付き） */
  "rubric:listAdviceCombinations": async (cropRegionId: string) =>
    listRubricAdviceCombinations(cropRegionId),

  /** 重なった助言の決まりを保存する（同じ項目の集合の決まりがあれば書き換える） */
  "rubric:saveAdviceCombination": async (
    input: SaveRubricAdviceCombinationInput
  ) => saveRubricAdviceCombination(input, requireActorUserId()),

  /** 重なった助言の決まりを消す（未決定に戻す） */
  "rubric:deleteAdviceCombination": async (combinationId: string) =>
    deleteRubricAdviceCombination(combinationId, requireActorUserId()),

  /** 助言の朱書きを作り直す材料（項目・決まり・適用か助言の朱書きのある全採点者の採点行） */
  "rubric:getAdviceSource": async (cropRegionId: string) =>
    getRubricAdviceSource(cropRegionId),

  /** 助言の朱書きの差分を書く（印の付いた朱書きにしか触らない） */
  "rubric:syncAdviceAnnotations": async (input: RubricAdviceSyncInput) =>
    syncRubricAdviceAnnotations(input, requireActorUserId()),

  /**
   * 設問のある答案すべての占有グリッド（朱書きを手書きに重ねない位置を探すのに使う。§8・§9）。
   * 画像は外へ送らない。答案画像1枚につき、この設問の枠1つぶんの結果が返る
   */
  "rubric:measureInk": async (cropRegionId: string) =>
    measureCropRegionInk(cropRegionId, getAbsolutePathFromSharedFiles),
} satisfies HandlerMap
