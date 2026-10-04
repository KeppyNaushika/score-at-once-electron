import { XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { useDialogAutoFocus } from "@/hooks/useDialogAutoFocus"

const TAG_COLOR_PRESETS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
]

/** タグの作成・編集（`tag` が null なら作成） */
export function TagModal({
  open,
  tag,
  onClose,
  onSave,
}: {
  open: boolean
  tag: TagWithAllRelations | null
  onClose: () => void
  onSave: (name: string, color: string | null) => Promise<void>
}) {
  // 呼び出し側は閉じている間このコンポーネントをマウントしないため、
  // 開くたびに対象タグの値からフォームが始まる。
  const [name, setName] = useState(tag?.name ?? "")
  const [color, setColor] = useState<string | null>(tag?.color ?? null)
  const { inputRef: nameInputRef, onOpenAutoFocus } = useDialogAutoFocus(open)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("タグ名を入力してください")
      return
    }
    await onSave(name.trim(), color)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm" onOpenAutoFocus={onOpenAutoFocus}>
        <DialogHeader>
          <DialogTitle>{tag ? "タグを編集" : "新規タグ作成"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">タグ名</Label>
            <Input
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void handleSave()
                }
              }}
              className="col-span-3"
              placeholder="例: 数学"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">色</Label>
            <div className="col-span-3 flex items-center gap-2">
              {color ? (
                <>
                  <ColorPicker
                    value={color}
                    onChange={setColor}
                    presets={TAG_COLOR_PRESETS}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setColor(null)}
                  >
                    <XIcon className="mr-1 h-3 w-3" />
                    色なし
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setColor(TAG_COLOR_PRESETS[5])}
                >
                  色を設定
                </Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={() => void handleSave()}>
            {tag ? "保存" : "作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
