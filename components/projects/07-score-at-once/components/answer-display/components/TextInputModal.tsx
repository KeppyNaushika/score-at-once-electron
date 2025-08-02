"use client"

import { useCallback } from "react"

interface TextInputModalProps {
  show: boolean
  position: { x: number; y: number }
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export function TextInputModal({
  show,
  position,
  value,
  onValueChange,
  onSubmit,
  onCancel,
}: TextInputModalProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        onSubmit()
      } else if (e.key === "Escape") {
        onCancel()
      }
    },
    [onSubmit, onCancel],
  )

  if (!show) return null

  return (
    <div
      className="absolute z-10 rounded border border-gray-300 bg-white p-2 shadow-lg"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="テキストを入力..."
        className="w-40 rounded border px-2 py-1 text-sm"
        autoFocus
      />
    </div>
  )
}
