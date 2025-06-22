"use client"

import React, { useState, useEffect } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ClassModalV2Props {
  isOpen: boolean
  onClose: () => void
  onSave: (classData: {
    name: string
    classCode?: string
    grade?: number
    description?: string
    subject?: string
    isVisible?: boolean
  }) => void
  classToEdit?: {
    id: string
    name: string
    classCode?: string | null
    grade?: number | null
    description?: string | null
    subject?: string | null
    isVisible?: boolean | null
  } | null
}

// 学級種別は削除し、表示/非表示のみで管理

const commonSubjects = [
  "国語", "数学", "英語", "理科", "社会", "体育", "音楽", "美術", "技術・家庭", "道徳"
]

export default function ClassModalV2({
  isOpen,
  onClose,
  onSave,
  classToEdit,
}: ClassModalV2Props) {
  const [name, setName] = useState("")
  const [classCode, setClassCode] = useState("")
  const [grade, setGrade] = useState<number | undefined>(undefined)
  const [description, setDescription] = useState("")
  const [subject, setSubject] = useState("")
  const [isVisible, setIsVisible] = useState(true)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (classToEdit) {
      setName(classToEdit.name)
      setClassCode(classToEdit.classCode ?? "")
      setGrade(classToEdit.grade ?? undefined)
      setDescription(classToEdit.description ?? "")
      setSubject(classToEdit.subject ?? "")
      setIsVisible(classToEdit.isVisible ?? true)
    } else {
      setName("")
      setClassCode("")
      setGrade(undefined)
      setDescription("")
      setSubject("")
      setIsVisible(true)
    }
    setErrors({})
  }, [classToEdit, isOpen])

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!name.trim()) {
      newErrors.name = "学級名は必須です。"
    }

    // 教科名のバリデーションは任意とする

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
      subject: subject.trim() || undefined,
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
              <p className="mt-1 text-xs text-muted-foreground">
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
                <span className="text-xs text-muted-foreground">
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
                    e.target.value === "" ? undefined : parseInt(e.target.value),
                  )
                }
                placeholder="例: 1 (任意)"
                min="1"
                max="6"
              />
            </div>
          </div>

          {/* 教科名 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subject" className="text-right">
              教科名
            </Label>
            <div className="col-span-3">
              <div className="space-y-2">
                <Select 
                  value={subject} 
                  onValueChange={setSubject}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="教科を選択または入力" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonSubjects.map((subj) => (
                      <SelectItem key={subj} value={subj}>
                        {subj}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="教科名を入力（任意）"
                />
              </div>
              {errors.subject && (
                <p className="mt-1 text-sm text-red-500">{errors.subject}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                教科を指定すると教科別クラスとして管理されます
              </p>
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