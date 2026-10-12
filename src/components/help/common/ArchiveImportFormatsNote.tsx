"use client"

import { useIsWebRuntime } from "@/hooks/useIsWebRuntime"

/**
 * 一覧のヘルプで「読み込み」が受け付ける形式を添える括弧書き。web 版は .sao しか
 * 読み込めないので、それ以外はデスクトップ版で .sao にしてから持ち込むよう案内する
 */
export function ArchiveImportFormatsNote({
  legacyFormats,
}: {
  /** .sao のほかにデスクトップ版で選べる形式（例: 「.score」） */
  legacyFormats: string
}) {
  const isWebRuntime = useIsWebRuntime()
  return isWebRuntime
    ? `（web 版で選べるのは .sao だけです。以前の ${legacyFormats} は、デスクトップ版で読み込んでから .sao に書き出してください）`
    : `（.sao のほか、以前の ${legacyFormats} も選べます）`
}
