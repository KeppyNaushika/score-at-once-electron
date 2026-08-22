"use client"

import { CopyPlus } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { ImportAction } from "@/types/importAction.types"
import { isImportAction } from "@/types/importAction.types"

/**
 * 取り込みの方針を選ぶ（取り込みの最初に1回だけ）
 *
 * **ここで選んだ操作が、取り込む全てのレコードの全ての値に効く。** 項目ごとに
 * 「このPC／ファイル／新しい方」を選ぶ段は無い（1回の取り込みに複数の規則が混ざる
 * 原因だったので畳んだ）。
 *
 * **最終確認（ChangePreview）が一覧にするのは生徒・学級・小計グループだけ**で、
 * 模範解答ページと採点枠は出ない。一覧をテーブル全部へ広げない代わりに、値が黙って
 * 失われる唯一の操作である「上書きする」を選んだときに、そこを名指しで警告する。
 *
 * 試験・生徒どちらの取り込みでも同じ3択なので、ウィザードをまたいで共有する。
 */

/** 選択肢の見出しと説明（並び順＝画面の並び順） */
const IMPORT_ACTION_CHOICES: Array<{
  action: ImportAction
  title: string
  description: string
}> = [
  {
    action: "overwrite",
    title: "上書きする",
    description:
      "重なったものは、読み込んだ内容で置き換えます。書かれた日時は見ません。いまこれが正しい、と言い切るときに選びます。",
  },
  {
    action: "merge",
    title: "統合する",
    description:
      "重なったものは、後に書かれた方を採ります。2台のパソコンで進めた続きを合わせるときに選びます。",
  },
  {
    action: "separate",
    title: "別で追加する",
    description:
      "このパソコンにあるものには手を触れず、もう1つとして追加します（試験名が重なるときは「(2)」が付きます）。",
  },
]

interface ImportActionChoiceProps {
  action: ImportAction
  onChange: (action: ImportAction) => void
  /** 重なっている相手の名前（試験名など）。分かっているときだけ添える */
  overlapLabel?: string
  /** 「別で追加する」を選べるか（生徒・学級だけの取り込みでは別物にできない） */
  allowSeparate?: boolean
}

export function ImportActionChoice({
  action,
  onChange,
  overlapLabel,
  allowSeparate = true,
}: ImportActionChoiceProps) {
  const choices = allowSeparate
    ? IMPORT_ACTION_CHOICES
    : IMPORT_ACTION_CHOICES.filter((choice) => choice.action !== "separate")

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <CopyPlus className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {overlapLabel
              ? `同じ試験「${overlapLabel}」がこのパソコンにもあります。`
              : "このパソコンにもあるものが読み込まれます。"}
            <br />
            どう取り込むか選んでください。
          </p>
        </div>

        <RadioGroup
          value={action}
          onValueChange={(value) => {
            if (isImportAction(value)) onChange(value)
          }}
          className="gap-3"
        >
          {choices.map((choice) => (
            <div key={choice.action} className="flex items-start gap-3">
              <RadioGroupItem
                value={choice.action}
                id={`import-action-${choice.action}`}
              />
              <Label
                htmlFor={`import-action-${choice.action}`}
                className="flex flex-col items-start gap-1 font-normal"
              >
                <span className="font-medium">{choice.title}</span>
                <span className="text-xs text-muted-foreground">
                  {choice.description}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>

        <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
          この選択は、試験・生徒・学級・小計・採点など、読み込む全てのものに同じように効きます。最後の確認画面が一覧にするのは、生徒・学級・小計グループだけです。
        </p>

        {/*
          上書きだけは、一覧に出ないところまで値が置き換わる。**全テーブルを列挙する
          画面は読まれず、読まれない一覧は見せたことにならない**ので、危険な1つだけを
          名指しで書く。上書き以外は既存の値を消さない（統合は後に書かれた方、
          別で追加はこのパソコンのものに触らない）ので、選んだときだけ出す。
        */}
        {action === "overwrite" && (
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
            「上書きする」では、一覧に出ないものも置き換わります。とくに模範解答ページ（ページ番号・用紙サイズ・画像）と採点枠（位置・設問番号・配点・ラベルなど）の値は、このパソコンで直したぶんが読み込んだ内容に戻ります。
          </p>
        )}
      </CardContent>
    </Card>
  )
}
