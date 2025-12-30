"use client"

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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useState } from "react"

interface ClassModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (classData: {
    name: string
    classCode?: string
    grade?: number
    description?: string
    isVisible?: boolean
  }) => void
  classToEdit?: {
    id: string
    name: string
    classCode?: string | null
    grade?: number | null
    description?: string | null
    isVisible?: boolean | null
  } | null
}

// 学級種別と教科フィールドは削除し、表示/非表示のみで管理

export default function ClassModal({
  isOpen,
  onClose,
  onSave,
  classToEdit,
}: ClassModalProps) {
  const [name, setName] = useState("")
  const [classCode, setClassCode] = useState("")
  const [grade, setGrade] = useState<number | undefined>(undefined)
  const [description, setDescription] = useState("")
  const [isVisible, setIsVisible] = useState(true)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (cancelled) {
        return
      }

      if (classToEdit) {
        setName(classToEdit.name)
        setClassCode(classToEdit.classCode ?? "")
        setGrade(classToEdit.grade ?? undefined)
        setDescription(classToEdit.description ?? "")
        setIsVisible(classToEdit.isVisible ?? true)
      } else {
        setName("")
        setClassCode("")
        setGrade(undefined)
        setDescription("")
        setIsVisible(true)
      }
      setErrors({})
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [classToEdit, isOpen])

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!name.trim()) {
      newErrors.name = "学級名は必須です。"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) {
      return
    }

    onSave({
      name: name.trim(),
      classCode: classCode.trim() || undefined,
      grade: grade === undefined ? undefined : Number(grade),
      description: description.trim() || undefined,
      isVisible,
    })
  }

  // isSubjectClass の判定は削除

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {classToEdit ? "学級情報を編集" : "新しい学級を作成"}
          </DialogTitle>
          <DialogDescription>
            学級の詳細情報を入力してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* 学級名 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="className" className="text-right">
              学級名
            </Label>
            <div className="col-span-3">
              <Input
                id="className"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 1年A組、数学基礎クラス"
                autoFocus
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>
          </div>

          {/* クラスコード */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="classCode" className="text-right">
              クラスコード
            </Label>
            <div className="col-span-3">
              <Input
                id="classCode"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                placeholder="例: E1、M2、1A (任意)"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                生徒の所属表示で使用される短縮表記
              </p>
            </div>
          </div>

          {/* 表示設定 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isVisible" className="text-right">
              表示設定
            </Label>
            <div className="col-span-3 flex items-center space-x-2">
              <Switch
                id="isVisible"
                checked={isVisible}
                onCheckedChange={setIsVisible}
              />
              <Label htmlFor="isVisible" className="text-sm">
                {isVisible ? "表示" : "非表示"}
              </Label>
              {!isVisible && (
                <span className="text-muted-foreground text-xs">
                  （非表示の学級は生徒一覧やインポートで使用されません）
                </span>
              )}
            </div>
          </div>

          {/* 学年 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="grade" className="text-right">
              学年
            </Label>
            <div className="col-span-3">
              <Input
                id="grade"
                type="number"
                value={grade === undefined ? "" : grade.toString()}
                onChange={(e) =>
                  setGrade(
                    e.target.value === "" ? undefined : parseInt(e.target.value)
                  )
                }
                placeholder="例: 1 (任意)"
                min="1"
                max="6"
              />
            </div>
          </div>

          {/* 説明 */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="classDescription" className="pt-2 text-right">
              説明
            </Label>
            <div className="col-span-3">
              <Textarea
                id="classDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="学級の説明・特徴など（任意）"
                rows={3}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
