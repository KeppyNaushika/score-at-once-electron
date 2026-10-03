import { useCallback, useState } from "react"

import type {
  GradingMode,
  MasterAnswerDisplayMode,
  MasterAnswerKeyBehavior,
} from "@/components/exams/07-score-at-once/types"

import { useMasterAnswerHoldRelease } from "./useMasterAnswerHoldRelease"

interface UseMasterAnswerVisibilityOptions {
  masterAnswerDisplayMode: MasterAnswerDisplayMode
  masterAnswerKeyBehavior: MasterAnswerKeyBehavior
  gradingMode: GradingMode
}

/** 模範解答を重ねて見せるかどうか（トグル／押している間だけ） */
export function useMasterAnswerVisibility({
  masterAnswerDisplayMode,
  masterAnswerKeyBehavior,
  gradingMode,
}: UseMasterAnswerVisibilityOptions) {
  /** 模範解答表示状態（toggle/hold-to-show制御） */
  const [masterAnswerVisible, setMasterAnswerVisible] = useState(false)

  /** 模範解答表示トグル */
  const handleToggleMasterAnswer = useCallback(() => {
    if (masterAnswerDisplayMode === "off") return
    if (masterAnswerKeyBehavior === "toggle") {
      setMasterAnswerVisible((prev) => !prev)
    } else {
      // hold-to-show: keydownでon（keyupはネイティブイベントで処理）
      setMasterAnswerVisible(true)
    }
  }, [masterAnswerDisplayMode, masterAnswerKeyBehavior])

  /** 模範解答を直接表示/非表示（hold-to-show用） */
  const handleMasterAnswerShow = useCallback(() => {
    setMasterAnswerVisible(true)
  }, [])
  const handleMasterAnswerHide = useCallback(() => {
    setMasterAnswerVisible(false)
  }, [])

  /** hold-to-show用: キーを離したら模範解答を隠す（押した側と同じ条件で守る） */
  useMasterAnswerHoldRelease({
    masterAnswerKeyBehavior,
    gradingMode,
    onRelease: handleMasterAnswerHide,
  })

  return {
    masterAnswerVisible,
    handleToggleMasterAnswer,
    handleMasterAnswerShow,
    handleMasterAnswerHide,
  }
}
