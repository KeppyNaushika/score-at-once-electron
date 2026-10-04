import type { StepResult } from "./types"

/** 実行したステップの結果表示（ステップごとに中身が異なる） */
export function StepResultView({
  currentStep,
  stepResults,
}: {
  currentStep: number
  stepResults: Record<number, StepResult>
}) {
  return (
    <div>
      <h4 className="mb-2 font-semibold">実行結果</h4>
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        {currentStep === 0 && stepResults[0] && (
          <div>
            <p>
              <strong>元のテキスト:</strong> {stepResults[0].original}
            </p>
            <p>
              <strong>変換後:</strong> {stepResults[0].processed}
            </p>
          </div>
        )}
        {currentStep === 1 && stepResults[1] && (
          <div>
            <p>
              <strong>HTMLコンテンツ:</strong>
            </p>
            <code className="mt-1 block rounded border bg-white p-2 text-xs">
              {stepResults[1].htmlContent}
            </code>
          </div>
        )}
        {currentStep === 2 && stepResults[2] && (
          <div>
            <p>
              <strong>MathJax処理後のHTML:</strong>
            </p>
            <code className="mt-1 block rounded border bg-white p-2 text-xs">
              {stepResults[2].processedHTML}
            </code>
            <p className="mt-2 text-sm text-green-700">
              ✅ MathJax要素（mjx-container）が生成されました
            </p>
          </div>
        )}
        {currentStep === 3 && stepResults[3] && (
          <div>
            <p className="text-sm text-green-700">
              ✅ {stepResults[3].description}
            </p>
          </div>
        )}
        {currentStep === 4 && stepResults[4] && (
          <div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <strong>測定幅:</strong> {stepResults[4].size?.width}px
              </div>
              <div>
                <strong>測定高さ:</strong> {stepResults[4].size?.height}px
              </div>
              <div>
                <strong>Bounding幅:</strong>{" "}
                {stepResults[4].size?.boundingWidth}px
              </div>
              <div>
                <strong>Scroll幅:</strong> {stepResults[4].size?.scrollWidth}px
              </div>
            </div>
          </div>
        )}
        {currentStep === 5 && stepResults[5] && (
          <div>
            <p className="mb-2 text-sm text-green-700">
              ✅ {stepResults[5].description}
            </p>
            <div className="text-sm">
              <strong>SVGサイズ:</strong> {stepResults[5].svgSize?.width} ×{" "}
              {stepResults[5].svgSize?.height}px
            </div>
          </div>
        )}
        {currentStep === 6 && stepResults[6] && (
          <div>
            <p className="mb-3 text-sm text-green-700">✅ Canvas描画完了！</p>
            {stepResults[6].canvas && (
              <div>
                <p className="mb-2 text-sm">
                  <strong>最終結果:</strong>
                </p>
                <div className="inline-block rounded border bg-white p-2">
                  <canvas
                    ref={(canvas) => {
                      if (canvas && stepResults[6].canvas) {
                        // 2D コンテキストが取れないときは描かずに枠だけ残す
                        const ctx = canvas.getContext("2d")
                        ctx?.drawImage(stepResults[6].canvas, 0, 0)
                      }
                    }}
                    width="320"
                    height="24"
                    className="border"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  👆 これが実際にCanvas上に描画されるテキスト画像です
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
