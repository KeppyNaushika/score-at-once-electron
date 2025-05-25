import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  // TODO: Load and save settings using electronAPI

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-6 text-2xl font-semibold">設定</h1>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>画像前処理設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="setting-threshold">二値化閾値</Label>
              <Input
                type="number"
                id="setting-threshold"
                placeholder="例: 128"
              />
            </div>
            {/* TODO: Add more image processing settings */}
            <Button>保存</Button>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>デフォルト出力先設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full max-w-lg items-center gap-1.5">
              <Label htmlFor="setting-output-excel">Excel出力先フォルダ</Label>
              <div className="flex space-x-2">
                <Input
                  type="text"
                  id="setting-output-excel"
                  placeholder="未設定"
                  readOnly
                />
                <Button variant="outline">選択</Button>
              </div>
            </div>
            <div className="grid w-full max-w-lg items-center gap-1.5">
              <Label htmlFor="setting-output-pdf">PDF出力先フォルダ</Label>
              <div className="flex space-x-2">
                <Input
                  type="text"
                  id="setting-output-pdf"
                  placeholder="未設定"
                  readOnly
                />
                <Button variant="outline">選択</Button>
              </div>
            </div>
            {/* TODO: Add more output settings */}
            <Button>保存</Button>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>キーバインド設定</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              採点操作のキーボードショートカットをカスタマイズする機能をここに実装します。
            </p>
            {/* TODO: Implement keybinding settings UI */}
            <Button className="mt-4">保存</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
