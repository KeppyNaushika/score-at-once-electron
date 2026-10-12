import { OptionField } from "@/components/common/ReportOptionControls"
import { Input } from "@/components/ui/input"
import { useEditingInput } from "@/hooks/useEditingInput"
import { parseClampedNumber } from "@/lib/clampedNumber"
import type { TableColumns } from "@/types/individualReport.types"
import { toTableColumns } from "@/types/individualReport.types"

interface TableLayoutFieldsProps {
  tableColumns: TableColumns
  fontSize: number
  onTableColumnsChange: (tableColumns: TableColumns) => void
  onFontSizeChange: (fontSize: number) => void
}

/** 個人票の表（設問の表・小計点の表）の列数と文字の大きさ */
export function TableLayoutFields({
  tableColumns,
  fontSize,
  onTableColumnsChange,
  onFontSizeChange,
}: TableLayoutFieldsProps) {
  const editing = useEditingInput()

  return (
    <>
      <OptionField label="列数">
        <Input
          type="number"
          min={1}
          max={10}
          className="h-6 flex-1 text-xs"
          {...editing("tableColumns", String(tableColumns), (text) => {
            const columns = parseClampedNumber(text, {
              min: 1,
              max: 10,
              integer: true,
            })
            if (columns !== null) onTableColumnsChange(toTableColumns(columns))
          })}
        />
      </OptionField>
      <OptionField label="文字">
        <Input
          type="number"
          min={1}
          className="h-6 flex-1 text-xs"
          {...editing("fontSize", String(fontSize), (text) => {
            const clampedFontSize = parseClampedNumber(text, { min: 1 })
            if (clampedFontSize !== null) onFontSizeChange(clampedFontSize)
          })}
        />
        <span className="text-xs text-muted-foreground">px</span>
      </OptionField>
    </>
  )
}
