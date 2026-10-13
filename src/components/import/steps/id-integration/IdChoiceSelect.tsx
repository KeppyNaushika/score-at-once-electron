"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { IdChoice } from "@/types/examArchive.types"
import { isIdChoice } from "@/types/examArchive.types"

interface IdChoiceSelectProps {
  idChoice: IdChoice
  onIdChoiceChange: (idChoice: IdChoice) => void
}

/**
 * 同一として扱うときに、どちらの ID に合わせるかを選ぶ
 */
export function IdChoiceSelect({
  idChoice,
  onIdChoiceChange,
}: IdChoiceSelectProps) {
  const handleValueChange = (value: string) => {
    if (!isIdChoice(value)) return
    onIdChoiceChange(value)
  }

  return (
    <Select value={idChoice} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="use_existing_id">このPCのIDを使う</SelectItem>
        <SelectItem value="use_import_id">ファイルのIDを使う</SelectItem>
      </SelectContent>
    </Select>
  )
}
