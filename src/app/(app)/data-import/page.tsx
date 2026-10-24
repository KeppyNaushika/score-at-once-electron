"use client"

import { FolderInput } from "lucide-react"

import { ArchiveImportScreens } from "@/components/archive-import/ArchiveImportScreens"
import { useArchiveImportLauncher } from "@/components/archive-import/hooks/useArchiveImportLauncher"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { useIsWebRuntime } from "@/hooks/useIsWebRuntime"

/** 読み込めるファイルの種類（拡張子 → 中身）。web 版では統合アーカイブだけ */
const FILE_KINDS: {
  extension: string
  description: string
  desktopOnly: boolean
}[] = [
  {
    extension: ".sao",
    description:
      "統合アーカイブ。試験・資料・成績算出・解答用紙と、それに関わる生徒・学級などをまとめたもの（データ書き出しで作る今の形式）",
    desktopOnly: false,
  },
  {
    extension: ".score",
    description: "試験（旧形式）",
    desktopOnly: true,
  },
  {
    extension: ".students",
    description: "生徒・学級（旧形式）",
    desktopOnly: true,
  },
  {
    extension: ".coursework",
    description: "試験外成績資料（旧形式）",
    desktopOnly: true,
  },
  {
    extension: ".grade",
    description: "成績算出（旧形式）",
    desktopOnly: true,
  },
  {
    extension: ".asb",
    description: "解答用紙（旧形式。確かめる画面を挟まずに取り込みます）",
    desktopOnly: true,
  },
  {
    extension: ".hsz・.dat",
    description: "他のアプリの試験のファイル",
    desktopOnly: true,
  },
]

/**
 * データ読み込み。データ書き出しと対になるページで、ファイルを1つ選ぶと拡張子で取り込み画面へ
 * 振り分ける。中身は試験・資料・成績算出・解答用紙・生徒の一覧の「取り込み」と同じ
 * （`useArchiveImportLauncher`）。
 */
export default function DataImportPage() {
  const launcher = useArchiveImportLauncher()
  const isWebRuntime = useIsWebRuntime()
  const fileKinds = FILE_KINDS.filter(
    (fileKind) => !isWebRuntime || !fileKind.desktopOnly
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="データ読み込み"
        subtitle="書き出したファイルを、このPCのデータに取り込みます。"
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ファイルを選ぶ</CardTitle>
              <p className="text-sm text-muted-foreground">
                選んだファイルの種類に合わせて、取り込みの画面が開きます。
              </p>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => void launcher.start()}
                disabled={launcher.isOpening}
                className="gap-2"
              >
                {launcher.isOpening ? (
                  <Spinner className="size-4" />
                ) : (
                  <FolderInput className="size-4" />
                )}
                {launcher.isOpening
                  ? "開いています..."
                  : "ファイルを選んで読み込む"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">読み込めるファイル</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {fileKinds.map((fileKind) => (
                  <div key={fileKind.extension} className="flex gap-3">
                    <dt className="w-24 shrink-0 font-mono">
                      {fileKind.extension}
                    </dt>
                    <dd className="text-muted-foreground">
                      {fileKind.description}
                    </dd>
                  </div>
                ))}
              </dl>
              {isWebRuntime && (
                <p className="mt-3 text-sm text-muted-foreground">
                  旧形式と他のアプリのファイルは、デスクトップ版で取り込んでから統合アーカイブに書き出してください。
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">取り込みのしかた</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                このPCに同じものがあれば（同じ PC
                で作ったデータなど）、同じものとして取り込みます。値をどう扱うか（上書きする・新しい方を残す・別で追加する）は、取り込みの画面で選べます。
              </p>
              <p>
                同じものが無い生徒・学級などは、番号や名前で該当した候補を出します。このPCのものと紐づけるか、新しく登録するかを選べます。紐づけるときは、どちらの
                id に合わせるかも選べます。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <ArchiveImportScreens launcher={launcher} />
    </div>
  )
}
