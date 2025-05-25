import React, { useState } from "react"
import { useProjects } from "../hooks/useProjects"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { X as XIcon } from "lucide-react"

interface CreateProjectWindowProps {
  onClose: () => void
}

const CreateProjectWindow: React.FC<CreateProjectWindowProps> = ({
  onClose,
}) => {
  const [examName, setExamName] = useState("")
  const [examDate, setExamDate] = useState<Date | null>(null)
  const [description, setDescription] = useState("")
  const [tagTexts, setTagTexts] = useState<string[]>([]) // タグの文字列配列
  const [currentTagInput, setCurrentTagInput] = useState("") // 現在のタグ入力値
  const { createProject } = useProjects() // addProject から createProject に変更

  const handleSubmit = async () => {
    if (!examName.trim()) {
      alert("試験名は必須です。")
      return
    }
    try {
      // createProject の引数の型 CreateProjectProps に合わせる
      await createProject({
        examName: examName.trim(),
        examDate,
        description: description.trim(),
        tagTexts: tagTexts, // subjects から tagTexts に変更
      })
      onClose()
    } catch (error) {
      console.error("Failed to create project:", error)
      // Handle error display to user
    }
  }

  const handleAddTag = () => {
    if (currentTagInput.trim() && !tagTexts.includes(currentTagInput.trim())) {
      setTagTexts([...tagTexts, currentTagInput.trim()])
      setCurrentTagInput("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTagTexts(tagTexts.filter((tag) => tag !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>新規プロジェクト作成</DialogTitle>
          <DialogDescription>
            新しい試験プロジェクトの詳細情報を入力してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="examName" className="text-right">
              試験名
            </Label>
            <Input
              id="examName"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="col-span-3"
              placeholder="例: 2学期中間試験"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="examDate" className="text-right">
              試験日
            </Label>
            <Input
              id="examDate"
              type="date"
              value={examDate ? examDate.toISOString().split("T")[0] : ""}
              onChange={(e) =>
                setExamDate(e.target.value ? new Date(e.target.value) : null)
              }
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="pt-2 text-right">
              説明
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-input placeholder:text-muted-foreground focus-visible:ring-ring col-span-3 min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="プロジェクトの説明（任意）"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="tagTexts" className="pt-2 text-right">
              科目
            </Label>
            <div className="col-span-3">
              <div className="mb-2 flex items-center gap-2">
                <Input
                  id="tagTexts"
                  value={currentTagInput}
                  onChange={(e) => setCurrentTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  className="flex-grow"
                  placeholder="科目を入力してEnter"
                />
                <Button type="button" onClick={handleAddTag} variant="outline">
                  追加
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tagTexts.map((tagText, index) => (
                  <Badge key={index} variant="secondary">
                    {tagText}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tagText)}
                      className="text-secondary-foreground hover:text-destructive ml-1.5 cursor-pointer appearance-none border-none bg-transparent p-0"
                      aria-label={`Remove ${tagText}`}
                    >
                      <XIcon size={14} />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit}>作成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateProjectWindow
