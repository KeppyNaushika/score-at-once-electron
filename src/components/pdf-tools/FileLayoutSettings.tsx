"use client"

import { RotateCw } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type ImportedFile, ROTATION_DEGREES } from "@/types/pdfTools.types"

import NUpSelects from "./NUpSelects"

interface FileLayoutSettingsProps {
  file: ImportedFile
  onFileUpdated: (file: ImportedFile) => void
  disabled?: boolean
}

/**
 * ファイルの N-up（1面のページ数・並べ方）と回転の既定を選ぶ欄。
 *
 * 左のファイル欄と交互挿入の欄の両方に置く。交互挿入では1回に入れるページ数を
 * N に合わせると面と他のファイルが交互になるので、N を隣に見せたい。2か所で同じ
 * ファイルの設定を書き換えるので、選択肢と変換を1か所にまとめてずれないようにする。
 *
 * 行×列と用紙の縦横は選ばせない。ページの縦横（回転後）から、ページが最も大きく
 * 収まる方を書き出すときに決める。
 */
export default function FileLayoutSettings({
  file,
  onFileUpdated,
  disabled,
}: FileLayoutSettingsProps) {
  return (
    <>
      <NUpSelects
        nUp={file.nUp}
        onNUpChange={(nUp) => onFileUpdated({ ...file, nUp })}
        disabled={disabled}
        accessibleNames={{
          pagesPerSheet: "1面のページ数",
          slotOrder: "面の中の並べ方",
        }}
      />

      <Select
        value={String(file.rotation)}
        onValueChange={(value) => {
          const rotation = ROTATION_DEGREES.find(
            (option) => String(option) === value
          )
          if (rotation === undefined) return
          onFileUpdated({ ...file, rotation })
        }}
        disabled={disabled}
      >
        {/* 回転は幅を決め打ちしない（決め打ちでは角度の桁数しだいで「0°」が切れた） */}
        <SelectTrigger size="sm" aria-label="ページの回転">
          <RotateCw className="mr-1 h-3 w-3" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROTATION_DEGREES.map((rotation) => (
            <SelectItem key={rotation} value={String(rotation)}>
              {rotation}°
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
