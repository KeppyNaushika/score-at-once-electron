import { ArrowRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/** プロセス全体の流れ（7ステップの一覧図） */
export function ProcessOverview() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>プロセス全体の流れ</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 text-sm">
          <div className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">
            1. テキスト準備
          </div>
          <ArrowRight size={16} className="my-1 text-gray-400" />
          <div className="rounded-full bg-green-100 px-3 py-1 text-green-800">
            2. Markdown→HTML
          </div>
          <ArrowRight size={16} className="my-1 text-gray-400" />
          <div className="rounded-full bg-purple-100 px-3 py-1 text-purple-800">
            3. MathJax処理
          </div>
          <ArrowRight size={16} className="my-1 text-gray-400" />
          <div className="rounded-full bg-yellow-100 px-3 py-1 text-yellow-800">
            4. スタイル調整
          </div>
          <ArrowRight size={16} className="my-1 text-gray-400" />
          <div className="rounded-full bg-orange-100 px-3 py-1 text-orange-800">
            5. サイズ測定
          </div>
          <ArrowRight size={16} className="my-1 text-gray-400" />
          <div className="rounded-full bg-red-100 px-3 py-1 text-red-800">
            6. SVG作成
          </div>
          <ArrowRight size={16} className="my-1 text-gray-400" />
          <div className="rounded-full bg-gray-100 px-3 py-1 text-gray-800">
            7. Canvas描画
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>
            このプロセスにより、MathJax記法で書かれた数式が高品質なCanvas画像として描画され、
            採点システムで答案画像上に重ね合わせて表示できるようになります。
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
