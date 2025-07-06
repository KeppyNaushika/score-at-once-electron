import type { LayoutRegionWithDetails } from "@/types/electron"

type UseKeyboardNavigationProps = {
  filteredRegions: LayoutRegionWithDetails[]
}

export const useKeyboardNavigation = ({ filteredRegions }: UseKeyboardNavigationProps) => {
  const handleKeyDown = (
    e: React.KeyboardEvent,
    rowIndex: number,
    fieldName: string,
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      // Move to next row, same field
      const nextRowIndex = rowIndex + 1
      if (nextRowIndex < filteredRegions.length) {
        const nextInput = document.querySelector(
          `[data-row="${nextRowIndex}"][data-field="${fieldName}"]`,
        ) as HTMLInputElement
        if (nextInput) {
          nextInput.focus()
          nextInput.select()
        }
      }
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault()
      // Move to previous row, same field
      const prevRowIndex = rowIndex - 1
      if (prevRowIndex >= 0) {
        const prevInput = document.querySelector(
          `[data-row="${prevRowIndex}"][data-field="${fieldName}"]`,
        ) as HTMLInputElement
        if (prevInput) {
          prevInput.focus()
          prevInput.select()
        }
      }
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault()
      // Move to next field in same row
      const fieldOrder = ["label", "points"]
      const currentFieldIndex = fieldOrder.indexOf(fieldName)
      if (currentFieldIndex < fieldOrder.length - 1) {
        const nextField = fieldOrder[currentFieldIndex + 1]
        const nextInput = document.querySelector(
          `[data-row="${rowIndex}"][data-field="${nextField}"]`,
        ) as HTMLInputElement
        if (nextInput && !nextInput.disabled) {
          nextInput.focus()
          nextInput.select()
        }
      } else {
        // Move to first field of next row
        const nextRowIndex = rowIndex + 1
        if (nextRowIndex < filteredRegions.length) {
          const nextInput = document.querySelector(
            `[data-row="${nextRowIndex}"][data-field="label"]`,
          ) as HTMLInputElement
          if (nextInput) {
            nextInput.focus()
            nextInput.select()
          }
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault()
      // Move to previous field in same row
      const fieldOrder = ["label", "points"]
      const currentFieldIndex = fieldOrder.indexOf(fieldName)
      if (currentFieldIndex > 0) {
        const prevField = fieldOrder[currentFieldIndex - 1]
        const prevInput = document.querySelector(
          `[data-row="${rowIndex}"][data-field="${prevField}"]`,
        ) as HTMLInputElement
        if (prevInput) {
          prevInput.focus()
          prevInput.select()
        }
      } else {
        // Move to last field of previous row
        const prevRowIndex = rowIndex - 1
        if (prevRowIndex >= 0) {
          const prevInput = document.querySelector(
            `[data-row="${prevRowIndex}"][data-field="points"]`,
          ) as HTMLInputElement
          if (prevInput && !prevInput.disabled) {
            prevInput.focus()
            prevInput.select()
          } else {
            // Fall back to label
            const labelInput = document.querySelector(
              `[data-row="${prevRowIndex}"][data-field="label"]`,
            ) as HTMLInputElement
            if (labelInput) {
              labelInput.focus()
              labelInput.select()
            }
          }
        }
      }
    }
  }

  return { handleKeyDown }
}