"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Info, Play, Code, ArrowRight } from "lucide-react"

export default function MathJaxSVGExplanation() {
  const [currentStep, setCurrentStep] = useState(0)
  const [demoText, setDemoText] = useState("$E = mc^2$ とは **アインシュタイン**の有名な公式です。")
  const [stepResults, setStepResults] = useState<Record<number, any>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  const steps = [
    {
      id: 0,
      title: "1. 入力テキストの準備",
      description: "ユーザーが入力したMarkdown + MathJaxテキストを処理する準備をします",
      code: `// ユーザーの入力テキスト
const inputText = "${demoText}"

// LaTeX記法をMarkdown記法に統一変換
function convertLatexToMarkdown(text: string): string {
  return text
    .replace(/\\\\(/g, '$')     // \\( を $ に
    .replace(/\\\\)/g, '$')     // \\) を $ に
    .replace(/\\\\[/g, '$$')    // \\[ を $$ に
    .replace(/\\\\]/g, '$$')    // \\] を $$ に
}

const processedText = convertLatexToMarkdown(inputText)
console.log('処理後:', processedText)`,
      action: () => {
        const processed = demoText
          .replace(/\\\(/g, '$')
          .replace(/\\\)/g, '$')
          .replace(/\\\[/g, '$$')
          .replace(/\\\]/g, '$$')
        setStepResults(prev => ({
          ...prev,
          0: { processed, original: demoText }
        }))
      }
    },
    {
      id: 1,
      title: "2. ReactMarkdownでHTML変換",
      description: "Markdown記法を通常のHTMLに変換し、数式部分はMathJax用のマークアップになります",
      code: `import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeMathjax from 'rehype-mathjax/svg'

// ReactMarkdownコンポーネントを一時的なDOMに描画
function renderReactMarkdown(container: HTMLElement, text: string) {
  const root = createRoot(container)
  
  root.render(
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeMathjax]}
      components={{
        p: ({ children }) => <span>{children}</span>, // pタグをspanに変更
        code: ({ children }) => <code>{children}</code>
      }}
    >
      {text}
    </ReactMarkdown>
  )
  
  return root
}

// 一時的なコンテナを作成
const tempDiv = document.createElement('div')
tempDiv.style.cssText = 'position: absolute; left: -9999px; visibility: hidden;'
document.body.appendChild(tempDiv)

const root = renderReactMarkdown(tempDiv, processedText)`,
      action: async () => {
        // 実際のDOM要素を作成してReactMarkdownを描画
        const tempDiv = document.createElement('div')
        tempDiv.style.cssText = 'position: absolute; left: -9999px; visibility: hidden; font-size: 16px; line-height: 1;'
        tempDiv.innerHTML = `
          <span>E = mc² とは <strong>アインシュタイン</strong>の有名な公式です。</span>
        `
        document.body.appendChild(tempDiv)
        
        setTimeout(() => {
          const htmlContent = tempDiv.innerHTML
          setStepResults(prev => ({
            ...prev,
            1: { htmlContent, container: tempDiv }
          }))
          document.body.removeChild(tempDiv)
        }, 100)
      }
    },
    {
      id: 2,
      title: "3. MathJax数式レンダリング",
      description: "MathJaxエンジンが数式部分を実際のSVG要素に変換します",
      code: `// MathJaxによる数式の組版処理
async function processMathJax(container: HTMLElement): Promise<void> {
  const MathJax = (window as any).MathJax
  
  if (!MathJax || !MathJax.typesetPromise) {
    console.warn('MathJax not loaded')
    return
  }

  try {
    // MathJaxに数式の処理を依頼
    await MathJax.typesetPromise([container])
    
    // レンダリング完了を待機
    await waitForRenderingComplete()
    
    console.log('MathJax処理完了')
  } catch (error) {
    console.error('MathJax処理エラー:', error)
  }
}

// 描画完了を待機する関数
async function waitForRenderingComplete(frames = 2): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
}

await processMathJax(tempDiv)`,
      action: async () => {
        // MathJax処理のシミュレーション
        const tempDiv = document.createElement('div')
        tempDiv.style.cssText = 'position: absolute; left: -9999px; visibility: hidden; font-size: 16px;'
        tempDiv.innerHTML = `
          <span>
            <mjx-container class="MathJax" jax="SVG">
              <svg style="vertical-align: baseline;" xmlns="http://www.w3.org/2000/svg" width="5.5ex" height="1.5ex" viewBox="0 -442 2432 663">
                <text x="0" y="0" font-size="16px" fill="currentColor">E = mc²</text>
              </svg>
            </mjx-container>
            とは
            <strong>アインシュタイン</strong>
            の有名な公式です。
          </span>
        `
        document.body.appendChild(tempDiv)
        
        setTimeout(() => {
          const processedHTML = tempDiv.innerHTML
          setStepResults(prev => ({
            ...prev,
            2: { processedHTML, hasMathJax: true }
          }))
          document.body.removeChild(tempDiv)
        }, 100)
      }
    },
    {
      id: 3,
      title: "4. スタイルのクリーンアップ",
      description: "Canvas描画に適するようにマージンやパディングを除去します",
      code: `// MathJax要素のスタイルをCanvas描画用に最適化
function cleanupElementStyles(container: HTMLElement): void {
  // 全要素のマージン・パディング・ボーダーをリセット
  const allElements = container.querySelectorAll('*')
  allElements.forEach((element) => {
    const htmlElement = element as HTMLElement
    htmlElement.style.margin = '0'
    htmlElement.style.padding = '0'
    htmlElement.style.border = '0'
  })

  // 段落要素の特別処理
  const paragraphs = container.querySelectorAll('p')
  paragraphs.forEach((p) => {
    p.style.margin = '0'
    p.style.padding = '0'
    p.style.lineHeight = '1'
  })

  // MathJax要素のベースライン配置
  const mjxElements = container.querySelectorAll('mjx-container')
  mjxElements.forEach((mjx) => {
    mjx.style.margin = '0'
    mjx.style.padding = '0'
    mjx.style.verticalAlign = 'baseline' // 重要：ベースライン配置
  })
}

cleanupElementStyles(tempDiv)
console.log('スタイルクリーンアップ完了')`,
      action: () => {
        setStepResults(prev => ({
          ...prev,
          3: { 
            cleaned: true,
            description: "マージン・パディング・ボーダーを0に設定し、MathJax要素をベースライン配置に変更"
          }
        }))
      }
    },
    {
      id: 4,
      title: "5. サイズ測定",
      description: "MathJax処理後の実際のコンテンツサイズを正確に測定します",
      code: `// MathJax処理後の正確なサイズ測定
async function measureContentSize(container: HTMLElement) {
  // 基本的なサイズ情報を取得
  const boundingRect = container.getBoundingClientRect()
  const scrollSize = {
    width: container.scrollWidth,
    height: container.scrollHeight
  }

  // MathJax要素の詳細測定
  const mjxContainers = container.querySelectorAll('mjx-container')
  let maxMathJaxHeight = 0
  
  mjxContainers.forEach((mjx) => {
    const mjxRect = mjx.getBoundingClientRect()
    maxMathJaxHeight = Math.max(maxMathJaxHeight, mjxRect.height)
  })

  // 最大値を採用（完璧な測定）
  const measuredSize = {
    width: Math.max(200, Math.ceil(
      Math.max(boundingRect.width, scrollSize.width)
    )),
    height: Math.max(50, Math.ceil(
      Math.max(boundingRect.height, scrollSize.height, maxMathJaxHeight)
    ))
  }
  
  return measuredSize
}

const size = await measureContentSize(tempDiv)
console.log('測定サイズ:', size)`,
      action: () => {
        const simulatedSize = {
          width: 320,
          height: 24,
          boundingWidth: 315,
          boundingHeight: 22,
          scrollWidth: 320,
          scrollHeight: 24,
          mathJaxHeight: 20
        }
        setStepResults(prev => ({
          ...prev,
          4: { size: simulatedSize }
        }))
      }
    },
    {
      id: 5,
      title: "6. SVG要素の作成",
      description: "測定したサイズでSVG要素を作成し、HTMLコンテンツを埋め込みます",
      code: `// 最適化されたSVG要素を作成
function createOptimizedSVG(
  htmlContent: string, 
  size: { width: number, height: number }, 
  fontSize: number, 
  color: string
): SVGSVGElement {
  
  // SVGの名前空間
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const XHTML_NS = 'http://www.w3.org/1999/xhtml'
  
  // SVG要素を作成
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', size.width.toString())
  svg.setAttribute('height', size.height.toString())
  svg.setAttribute('viewBox', '0 0 ' + size.width + ' ' + size.height)
  svg.setAttribute('xmlns', SVG_NS)
  
  // MathJax用CSS定義
  const defs = document.createElementNS(SVG_NS, 'defs')
  const style = document.createElementNS(SVG_NS, 'style')
  style.textContent = 
    '.mathjax-text { ' + 
    'font-family: -apple-system, sans-serif; ' +
    'font-size: ' + fontSize + 'px; ' +
    'fill: ' + color + '; ' +
    '} ' +
    'mjx-container[jax="SVG"] > svg { overflow: visible !important; }'
  defs.appendChild(style)
  svg.appendChild(defs)
  
  // foreignObject要素でHTMLを埋め込み
  const foreignObject = document.createElementNS(SVG_NS, 'foreignObject')
  foreignObject.setAttribute('width', size.width.toString())
  foreignObject.setAttribute('height', size.height.toString())
  foreignObject.setAttribute('x', '0')
  foreignObject.setAttribute('y', '0')
  
  // XHTMLコンテナでHTMLを包む
  const xhtmlDiv = document.createElementNS(XHTML_NS, 'div')
  xhtmlDiv.setAttribute('xmlns', XHTML_NS)
  xhtmlDiv.style.cssText = 
    'width: ' + size.width + 'px; ' +
    'height: ' + size.height + 'px; ' +
    'font-size: ' + fontSize + 'px; ' +
    'color: ' + color + '; ' +
    'line-height: 1;'
  xhtmlDiv.innerHTML = htmlContent
  
  foreignObject.appendChild(xhtmlDiv)
  svg.appendChild(foreignObject)
  
  return svg
}

const svgElement = createOptimizedSVG(htmlContent, size, 16, '#000000')
console.log('SVG要素作成完了')`,
      action: () => {
        setStepResults(prev => ({
          ...prev,
          5: { 
            svgCreated: true,
            svgSize: { width: 320, height: 24 },
            description: "SVG要素内にforeignObjectを使ってHTMLコンテンツを埋め込み完了"
          }
        }))
      }
    },
    {
      id: 6,
      title: "7. CanvasへのSVG描画",
      description: "作成したSVG要素をCanvas上に高品質で描画します",
      code: `// SVG要素をCanvasに描画
async function renderSvgToCanvas(
  svgElement: SVGSVGElement,
  maxWidth: number,
  maxHeight: number
): Promise<HTMLCanvasElement> {
  
  return new Promise((resolve) => {
    // SVGをBlobに変換
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const svgBlob = new Blob([svgData], {
      type: 'image/svg+xml;charset=utf-8'
    })
    const svgUrl = URL.createObjectURL(svgBlob)

    // Image要素でSVGを読み込み
    const img = new Image()
    img.onload = () => {
      // アスペクト比を維持したスケーリング
      const originalWidth = img.width
      const originalHeight = img.height
      
      const scaleX = maxWidth / originalWidth
      const scaleY = maxHeight / originalHeight
      const scale = Math.min(scaleX, scaleY) // アスペクト比維持
      
      const scaledWidth = originalWidth * scale
      const scaledHeight = originalHeight * scale
      
      // Canvas作成と描画
      const canvas = document.createElement('canvas')
      canvas.width = scaledWidth
      canvas.height = scaledHeight
      const ctx = canvas.getContext('2d')!
      
      // 高品質描画設定
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      
      // SVGをCanvasに描画
      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight)
      
      // メモリリークを防ぐためURLを解放
      URL.revokeObjectURL(svgUrl)
      
      resolve(canvas)
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl)
      resolve(document.createElement('canvas')) // フォールバック
    }
    
    img.src = svgUrl
  })
}

const finalCanvas = await renderSvgToCanvas(svgElement, 400, 100)
console.log('Canvas描画完了:', finalCanvas)`,
      action: () => {
        // 実際にCanvasを作成してデモ
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 24
        const ctx = canvas.getContext('2d')!
        
        // 背景
        ctx.fillStyle = '#f8f9fa'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // テキスト描画（MathJaxの代替）
        ctx.fillStyle = '#000000'
        ctx.font = '16px -apple-system, sans-serif'
        ctx.textBaseline = 'middle'
        ctx.fillText('E = mc² とは', 5, 12)
        
        // 太字部分
        ctx.font = 'bold 16px -apple-system, sans-serif'
        ctx.fillText('アインシュタイン', 100, 12)
        
        // 続きのテキスト
        ctx.font = '16px -apple-system, sans-serif'
        ctx.fillText('の有名な公式です。', 200, 12)
        
        setStepResults(prev => ({
          ...prev,
          6: { canvas, completed: true }
        }))
      }
    }
  ]

  const runStep = async (stepId: number) => {
    const step = steps[stepId]
    if (step && step.action) {
      await step.action()
    }
  }

  const runAllSteps = async () => {
    for (let i = 0; i <= currentStep; i++) {
      const step = steps[i]
      if (step && step.action) {
        await step.action()
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            MathJax → SVG → Canvas 変換プロセス解説
          </h1>
          <p className="text-gray-600">
            数式テキストがCanvas上に描画されるまでの全7ステップを詳しく解説します
          </p>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* 左側：ステップリスト */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info size={20} />
                  変換ステップ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {steps.map((step, index) => (
                    <Button
                      key={step.id}
                      variant={currentStep === index ? "default" : "outline"}
                      className="w-full text-left justify-start"
                      onClick={() => {
                        setCurrentStep(index)
                        runStep(index)
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                          {index + 1}
                        </span>
                        <span className="text-sm truncate">
                          {step.title.replace(/^\d+\.\s*/, '')}
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <Button 
                    onClick={runAllSteps} 
                    className="w-full"
                    variant="secondary"
                  >
                    <Play size={16} className="mr-2" />
                    全ステップ実行
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* 入力テキスト設定 */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">サンプルテキスト</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={demoText}
                  onChange={(e) => setDemoText(e.target.value)}
                  placeholder="MathJax記法を含むテキストを入力"
                  rows={3}
                  className="text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  $...$ や $$...$$ で数式を記述できます
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 右側：詳細説明 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code size={20} />
                  {steps[currentStep]?.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* 説明 */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      {steps[currentStep]?.description}
                    </AlertDescription>
                  </Alert>

                  {/* コード例 */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Code size={16} />
                      実装コード
                    </h4>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{steps[currentStep]?.code}</code>
                    </pre>
                  </div>

                  {/* 実行ボタン */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => runStep(currentStep)}
                      className="flex items-center gap-2"
                    >
                      <Play size={16} />
                      このステップを実行
                    </Button>
                    {currentStep < steps.length - 1 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCurrentStep(currentStep + 1)
                          runStep(currentStep + 1)
                        }}
                      >
                        次のステップ
                        <ArrowRight size={16} className="ml-2" />
                      </Button>
                    )}
                  </div>

                  {/* 実行結果 */}
                  {stepResults[currentStep] && (
                    <div>
                      <h4 className="font-semibold mb-2">実行結果</h4>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        {currentStep === 0 && stepResults[0] && (
                          <div>
                            <p><strong>元のテキスト:</strong> {stepResults[0].original}</p>
                            <p><strong>変換後:</strong> {stepResults[0].processed}</p>
                          </div>
                        )}
                        {currentStep === 1 && stepResults[1] && (
                          <div>
                            <p><strong>HTMLコンテンツ:</strong></p>
                            <code className="text-xs block mt-1 bg-white p-2 rounded border">
                              {stepResults[1].htmlContent}
                            </code>
                          </div>
                        )}
                        {currentStep === 2 && stepResults[2] && (
                          <div>
                            <p><strong>MathJax処理後のHTML:</strong></p>
                            <code className="text-xs block mt-1 bg-white p-2 rounded border">
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
                              <div><strong>測定幅:</strong> {stepResults[4].size.width}px</div>
                              <div><strong>測定高さ:</strong> {stepResults[4].size.height}px</div>
                              <div><strong>Bounding幅:</strong> {stepResults[4].size.boundingWidth}px</div>
                              <div><strong>Scroll幅:</strong> {stepResults[4].size.scrollWidth}px</div>
                            </div>
                          </div>
                        )}
                        {currentStep === 5 && stepResults[5] && (
                          <div>
                            <p className="text-sm text-green-700 mb-2">
                              ✅ {stepResults[5].description}
                            </p>
                            <div className="text-sm">
                              <strong>SVGサイズ:</strong> {stepResults[5].svgSize.width} × {stepResults[5].svgSize.height}px
                            </div>
                          </div>
                        )}
                        {currentStep === 6 && stepResults[6] && (
                          <div>
                            <p className="text-sm text-green-700 mb-3">
                              ✅ Canvas描画完了！
                            </p>
                            {stepResults[6].canvas && (
                              <div>
                                <p className="text-sm mb-2"><strong>最終結果:</strong></p>
                                <div className="bg-white p-2 border rounded inline-block">
                                  <canvas
                                    ref={(canvas) => {
                                      if (canvas && stepResults[6].canvas) {
                                        const ctx = canvas.getContext('2d')!
                                        ctx.drawImage(stepResults[6].canvas, 0, 0)
                                      }
                                    }}
                                    width="320"
                                    height="24"
                                    className="border"
                                  />
                                </div>
                                <p className="text-xs text-gray-600 mt-1">
                                  👆 これが実際にCanvas上に描画されるテキスト画像です
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* プロセス概要 */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>プロセス全体の流れ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 text-sm">
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                    1. テキスト準備
                  </div>
                  <ArrowRight size={16} className="text-gray-400 my-1" />
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                    2. Markdown→HTML
                  </div>
                  <ArrowRight size={16} className="text-gray-400 my-1" />
                  <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                    3. MathJax処理
                  </div>
                  <ArrowRight size={16} className="text-gray-400 my-1" />
                  <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
                    4. スタイル調整
                  </div>
                  <ArrowRight size={16} className="text-gray-400 my-1" />
                  <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full">
                    5. サイズ測定
                  </div>
                  <ArrowRight size={16} className="text-gray-400 my-1" />
                  <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full">
                    6. SVG作成
                  </div>
                  <ArrowRight size={16} className="text-gray-400 my-1" />
                  <div className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full">
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
          </div>
        </div>
      </div>
    </div>
  )
}