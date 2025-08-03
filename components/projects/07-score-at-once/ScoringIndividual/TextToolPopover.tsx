"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Type } from "lucide-react"
import { useState } from "react"
import { COLOR_PALETTE } from "./constants/drawing-constants"
import type { DrawingTool } from "./types/answer-individual-types"

interface TextToolPopoverProps {
  currentTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  strokeColor: string
  onStrokeColorChange: (color: string) => void
}

export function TextToolPopover({
  currentTool,
  onToolChange,
  strokeColor,
  onStrokeColorChange,
}: TextToolPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleClick = () => {
    if (currentTool === "text") {
      // 既に選択されている場合はPopoverをトグル
      setIsOpen(!isOpen)
    } else {
      // 違うツールの場合はツールを選択
      onToolChange("text")
      setIsOpen(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={currentTool === "text" ? "default" : "ghost"}
          onClick={handleClick}
          title="テキストツール - クリックでテキスト入力"
          style={{
            backgroundColor: currentTool === "text" ? strokeColor : undefined,
            borderColor: currentTool === "text" ? strokeColor : undefined,
          }}
        >
          <Type 
            className="h-4 w-4" 
            style={{ color: currentTool === "text" ? "white" : undefined }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" side="right">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">テキストツール</h4>

          <div className="text-xs text-gray-600">
            ドラッグしてテキストボックスを作成後、テキストを入力してください。
            <br />
            テキストは自動的にボックスサイズに合わせて拡大表示されます。
            <br />
            MathJax記法（$...$）にも対応しています。
          </div>

          {/* カラーパレット */}
          <div>
            <Label className="text-xs">色</Label>
            <div className="mt-1 grid grid-cols-8 gap-1">
              {COLOR_PALETTE.map((color, index) => (
                <button
                  key={index}
                  onClick={() => onStrokeColorChange(color)}
                  className={`h-5 w-5 rounded border transition-transform hover:scale-110 ${
                    strokeColor === color
                      ? "border-2 border-gray-800"
                      : "border-gray-300"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
