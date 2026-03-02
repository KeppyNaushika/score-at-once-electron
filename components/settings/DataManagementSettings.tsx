"use client"

import {
  AlertTriangle,
  Database,
  FolderOpen,
  HardDrive,
  Info,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DataManagementSettingsProps {
  className?: string
}

export default function DataManagementSettings({
  className = "",
}: DataManagementSettingsProps) {
  const [dataDirectory, setDataDirectory] = useState<string>("")
  const [dataSize, setDataSize] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDataInfo()
  }, [])

  const loadDataInfo = async () => {
    try {
      setLoading(true)

      // データディレクトリの情報を取得
      const dataInfo = await window.electronAPI.getDataDirectoryInfo()

      if (dataInfo.success) {
        setDataDirectory(dataInfo.directory || "")
        setDataSize(dataInfo.size || 0)
      }
    } catch (error) {
      console.error("Failed to load data info:", error)
    } finally {
      setLoading(false)
    }
  }

  const openDataDirectory = async () => {
    try {
      await window.electronAPI.openDataDirectory()
    } catch (error) {
      console.error("Failed to open data directory:", error)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"

    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const confirmDataDeletion = async () => {
    const confirmed = confirm(
      "すべてのデータを完全に削除しますか？\n\n" +
        "・すべての試験\n" +
        "・すべての答案画像\n" +
        "・すべての採点データ\n" +
        "・データベース\n\n" +
        "この操作は取り消せません。"
    )

    if (confirmed) {
      try {
        const result = await window.electronAPI.deleteAllData()
        if (result.success) {
          alert("すべてのデータが削除されました。")
          await loadDataInfo()
        } else {
          alert("データの削除に失敗しました: " + result.error)
        }
      } catch (error) {
        console.error("Failed to delete data:", error)
        alert("データの削除中にエラーが発生しました。")
      }
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            データ管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 rounded bg-gray-200"></div>
            <div className="h-4 rounded bg-gray-200"></div>
            <div className="h-4 rounded bg-gray-200"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          データ管理
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* データフォルダ情報 */}
        <div className="space-y-4">
          <div>
            <Label>データフォルダ</Label>
            <div className="mt-1 flex gap-2">
              <Input value={dataDirectory} readOnly className="bg-muted" />
              <Button
                variant="outline"
                size="sm"
                onClick={openDataDirectory}
                className="shrink-0"
              >
                <FolderOpen className="mr-1 h-4 w-4" />
                開く
              </Button>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              すべての試験データがここに保存されます
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">使用容量</Label>
              <div className="mt-1 flex items-center gap-2">
                <Database className="text-muted-foreground h-4 w-4" />
                <span className="text-sm">{formatBytes(dataSize)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 共有ドライブ利用の説明 */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>共有ドライブでの利用について</strong>
            <br />
            このアプリケーションを共有ドライブで実行すると、複数のPCから同じデータにアクセスして協調採点が可能です。
            データフォルダはアプリケーションと同じ場所の「data」フォルダに保存されます。
          </AlertDescription>
        </Alert>

        {/* データ削除 */}
        <div className="border-t pt-4">
          <div className="space-y-3">
            <div className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">危険な操作</span>
            </div>

            <Button
              variant="destructive"
              onClick={confirmDataDeletion}
              className="w-full"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              すべてのデータを完全削除
            </Button>

            <p className="text-muted-foreground text-xs">
              ※この操作ですべての試験、答案画像、採点データが削除されます。
              <br />
              削除されたデータは復元できません。
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
