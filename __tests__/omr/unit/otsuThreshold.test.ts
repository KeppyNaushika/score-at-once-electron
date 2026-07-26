/**
 * 大津の二値化法 テスト
 *
 * 既知の2峰分布で境界が谷に落ちること、単峰・サンプル不足では
 * 自動決定を諦められる（null / 2群が近い）ことを検証する。
 */

import { describe, expect, it } from "vitest"

import {
  computeOtsuFromHistogram,
  computeOtsuThreshold,
  type OtsuOptions,
} from "../../../src/lib/omr/otsuThreshold"

/** 呼び出し側が自動決定を採用する最小の塗りつぶし率差（reevaluateResults と同値） */
const MIN_FILL_RATIO_SEPARATION = 0.25

/** 呼び出し側が自動決定を採用する最小の輝度差（markRecognizer と同値） */
const MIN_LUMINANCE_SEPARATION = 60

/** 塗りつぶし率用のビン設定（1%刻み） */
const RATIO_OPTIONS: OtsuOptions = { min: 0, max: 1, bins: 100 }

/** 輝度用のビン設定（8bitグレースケール） */
const LUMINANCE_OPTIONS: OtsuOptions = { min: 0, max: 256, bins: 256 }

/** 指定値を count 個並べた配列を作る */
function repeat(value: number, count: number): number[] {
  return Array.from({ length: count }, () => value)
}

describe("computeOtsuThreshold", () => {
  it("2峰分布の谷に境界を置く", () => {
    // 0.05付近（未マーク）と0.9付近（マーク）の2群
    const values = [
      ...repeat(0.03, 30),
      ...repeat(0.06, 30),
      ...repeat(0.88, 20),
      ...repeat(0.93, 20),
    ]

    const otsu = computeOtsuThreshold(values, RATIO_OPTIONS)

    expect(otsu).not.toBeNull()
    expect(otsu!.threshold).toBeGreaterThan(0.06)
    expect(otsu!.threshold).toBeLessThan(0.88)
    expect(otsu!.meanDistance).toBeGreaterThan(MIN_FILL_RATIO_SEPARATION)
  })

  it("単峰分布では2群が離れず、呼び出し側が採用を拒める", () => {
    // 全員未マーク（白紙に近い）— 2クラスに割る意味がない
    const values = [
      ...repeat(0.01, 40),
      ...repeat(0.02, 40),
      ...repeat(0.03, 40),
    ]

    const otsu = computeOtsuThreshold(values, RATIO_OPTIONS)

    // 大津法は単峰でも境界を返す。密集した1群を割っただけかは平均値の差で分かる
    expect(otsu).not.toBeNull()
    expect(otsu!.meanDistance).toBeLessThan(MIN_FILL_RATIO_SEPARATION)
  })

  it("サンプル数が不足していれば null", () => {
    const otsu = computeOtsuThreshold([0.1, 0.9, 0.95], RATIO_OPTIONS)

    expect(otsu).toBeNull()
  })

  it("全て同一値なら null（分割点が無い）", () => {
    const otsu = computeOtsuThreshold(repeat(0.5, 50), RATIO_OPTIONS)

    expect(otsu).toBeNull()
  })

  it("範囲外の値は母集団から除外される", () => {
    // 範囲内のサンプルが MIN_SAMPLES 未満になるので null
    const otsu = computeOtsuThreshold(
      [...repeat(-5, 50), ...repeat(20, 50), 0.4, 0.6],
      RATIO_OPTIONS
    )

    expect(otsu).toBeNull()
  })

  it("母数が増えても境界が求まる（最大ギャップ探索との違い）", () => {
    // 中間帯が値で埋まり「隙間」が消えた状態。ギャップ探索なら諦めるケース
    const values = [
      ...repeat(0.02, 200),
      ...repeat(0.05, 200),
      ...Array.from({ length: 60 }, (_, i) => 0.2 + i * 0.005),
      ...repeat(0.85, 200),
      ...repeat(0.92, 200),
    ]

    const otsu = computeOtsuThreshold(values, RATIO_OPTIONS)

    expect(otsu).not.toBeNull()
    expect(otsu!.meanDistance).toBeGreaterThan(MIN_FILL_RATIO_SEPARATION)
    expect(otsu!.threshold).toBeGreaterThan(0.05)
    expect(otsu!.threshold).toBeLessThan(0.85)
  })
})

describe("computeOtsuFromHistogram", () => {
  it("白背景＋黒マークの輝度分布から境界を求める", () => {
    const histogram = new Array<number>(256).fill(0)
    // 紙の白（240付近）と鉛筆の黒（40付近）
    histogram[240] = 800
    histogram[245] = 600
    histogram[40] = 300
    histogram[35] = 200

    const otsu = computeOtsuFromHistogram(histogram, LUMINANCE_OPTIONS)

    expect(otsu).not.toBeNull()
    // 空ビンが続く区間の端ではなく中央に置く（黒40と白240の中間あたり）
    expect(otsu!.threshold).toBeGreaterThan(100)
    expect(otsu!.threshold).toBeLessThan(180)
    expect(otsu!.meanDistance).toBeGreaterThan(MIN_LUMINANCE_SEPARATION)
  })

  it("別の分割が同値になっても平均しない（境界が山の中に落ちない）", () => {
    // 等間隔・等量の3つの山。bin0で割ってもbin2で割ってもクラス間分散が完全に等しい。
    // 同値を無条件に平均すると境界が真ん中の山(bin2)の中へ落ちて何も分離しなくなる
    const histogram = [10, 0, 10, 0, 10]
    const options: OtsuOptions = { min: 0, max: 5, bins: 5 }

    const otsu = computeOtsuFromHistogram(histogram, options)

    expect(otsu).not.toBeNull()
    // 最初の分割（bin0）＋直後の空ビン(bin1)の中央。真ん中の山の手前で切れる
    expect(otsu!.threshold).toBeGreaterThan(1)
    expect(otsu!.threshold).toBeLessThan(2)
  })

  it("空のヒストグラムは null", () => {
    const otsu = computeOtsuFromHistogram(
      new Array<number>(256).fill(0),
      LUMINANCE_OPTIONS
    )

    expect(otsu).toBeNull()
  })
})
