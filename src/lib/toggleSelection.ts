import { isOneOf } from "@/types/stringUnion"

/**
 * 単一選択の ToggleGroup の `onValueChange` に渡す、選択を外させない受け口。
 *
 * Radix は選択中のものをもう一度押すと空文字を渡す（選択を外す）。選択肢のどれかが
 * 必ず選ばれている画面では外させないので、選択肢に無い値（空文字）は捨て、選択肢の
 * 値だけを型を保って `onSelect` へ渡す。
 */
export const ignoreDeselect =
  <TValue extends string>(
    values: readonly TValue[],
    onSelect: (value: TValue) => void
  ) =>
  (value: string): void => {
    if (isOneOf(values, value)) onSelect(value)
  }
