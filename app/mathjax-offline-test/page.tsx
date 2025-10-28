"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * MathJaxオフライン動作テストページ
 *
 * このページでは以下をテスト:
 * - MathJaxの初期化確認
 * - 基本的な数式のレンダリング
 * - インライン数式とディスプレイ数式
 * - 複雑な数式のサポート状況
 * - オフライン環境での完全動作
 */
export default function MathJaxOfflineTestPage() {
  const [mathJaxReady, setMathJaxReady] = useState(false)
  const [renderCount, setRenderCount] = useState(0)

  const triggerMathJaxRender = useCallback(async () => {
    const MathJax = (window as any).MathJax
    if (MathJax && MathJax.typesetPromise) {
      try {
        await MathJax.typesetPromise([document.body])
        setRenderCount((prev) => prev + 1)
        console.log("MathJaxレンダリング完了")
      } catch (error) {
        console.error("MathJaxレンダリングエラー:", error)
      }
    }
  }, [])

  useEffect(() => {
    // MathJax初期化の確認
    const checkMathJax = () => {
      if ((window as any).mathJaxReady) {
        setMathJaxReady(true)
        triggerMathJaxRender()
      }
    }

    // MathJax初期化完了イベントをリッスン
    const handleMathJaxReady = () => {
      setMathJaxReady(true)
      triggerMathJaxRender()
    }

    // 既に初期化済みかチェック
    checkMathJax()

    // イベントリスナー設定
    window.addEventListener("mathjax-ready", handleMathJaxReady)

    return () => {
      window.removeEventListener("mathjax-ready", handleMathJaxReady)
    }
  }, [triggerMathJaxRender])

  const forceRerender = () => {
    if (mathJaxReady) {
      triggerMathJaxRender()
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <h1 className="mb-4 text-3xl font-bold">
          MathJax オフライン動作テスト
        </h1>

        <div className="mb-6 rounded-lg bg-gray-100 p-4">
          <h2 className="mb-2 text-lg font-semibold">動作状況</h2>
          <div className="space-y-2">
            <div className="flex items-center">
              <div
                className={`mr-2 h-3 w-3 rounded-full ${mathJaxReady ? "bg-green-500" : "bg-red-500"}`}
              ></div>
              <span>
                MathJax初期化: {mathJaxReady ? "✅ 完了" : "❌ 未完了"}
              </span>
            </div>
            <div className="flex items-center">
              <div className="mr-2 h-3 w-3 rounded-full bg-blue-500"></div>
              <span>レンダリング回数: {renderCount}</span>
            </div>
          </div>
          <button
            onClick={forceRerender}
            disabled={!mathJaxReady}
            className="mt-3 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-400"
          >
            再レンダリング
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-xl font-semibold">基本的なインライン数式</h2>
          <div className="rounded-lg border bg-white p-4">
            <p
              dangerouslySetInnerHTML={{
                __html: "円周率は $\\pi \\approx 3.14159$ です。",
              }}
            ></p>
            <p
              dangerouslySetInnerHTML={{
                __html: "オイラーの公式: $e^{i\\pi} + 1 = 0$",
              }}
            ></p>
            <p
              dangerouslySetInnerHTML={{
                __html: "平方根: $\\sqrt{2} \\approx 1.414$",
              }}
            ></p>
            <p
              dangerouslySetInnerHTML={{
                __html: "分数: $\\frac{1}{2} + \\frac{1}{3} = \\frac{5}{6}$",
              }}
            ></p>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">ディスプレイ数式</h2>
          <div className="rounded-lg border bg-white p-4">
            <p>二次方程式の解の公式:</p>
            <div
              dangerouslySetInnerHTML={{
                __html: "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$",
              }}
            ></div>

            <p className="mt-4">ベイズの定理:</p>
            <div
              dangerouslySetInnerHTML={{
                __html: "$$P(A|B) = \\frac{P(B|A) \\cdot P(A)}{P(B)}$$",
              }}
            ></div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">複雑な数式</h2>
          <div className="rounded-lg border bg-white p-4">
            <p>ガンマ関数:</p>
            <div
              dangerouslySetInnerHTML={{
                __html: "$$\\Gamma(z) = \\int_0^{\\infty} t^{z-1} e^{-t} dt$$",
              }}
            ></div>

            <p className="mt-4">フーリエ変換:</p>
            <div
              dangerouslySetInnerHTML={{
                __html:
                  "$$\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x) e^{-2\\pi i x \\xi} dx$$",
              }}
            ></div>

            <p className="mt-4">行列の表記:</p>
            <div
              dangerouslySetInnerHTML={{
                __html: `$$\\begin{pmatrix}
            a & b \\\\
            c & d
            \\end{pmatrix}
            \\begin{pmatrix}
            x \\\\
            y
            \\end{pmatrix}
            =
            \\begin{pmatrix}
            ax + by \\\\
            cx + dy
            \\end{pmatrix}$$`,
              }}
            ></div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">数学記号のテスト</h2>
          <div className="rounded-lg border bg-white p-4">
            <p
              dangerouslySetInnerHTML={{
                __html:
                  "ギリシャ文字: $\\alpha, \\beta, \\gamma, \\delta, \\theta, \\lambda, \\mu, \\pi, \\sigma, \\omega$",
              }}
            ></p>
            <p
              dangerouslySetInnerHTML={{
                __html:
                  "演算子: $\\sum, \\prod, \\int, \\oint, \\nabla, \\partial, \\infty$",
              }}
            ></p>
            <p
              dangerouslySetInnerHTML={{
                __html:
                  "関係演算子: $\\leq, \\geq, \\neq, \\approx, \\equiv, \\propto$",
              }}
            ></p>
            <p
              dangerouslySetInnerHTML={{
                __html:
                  "集合記号: $\\in, \\notin, \\subset, \\supset, \\cap, \\cup, \\emptyset$",
              }}
            ></p>
            <p
              dangerouslySetInnerHTML={{
                __html:
                  "矢印: $\\rightarrow, \\leftarrow, \\leftrightarrow, \\Rightarrow, \\Leftarrow$",
              }}
            ></p>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">化学式（LaTeX記法）</h2>
          <div className="rounded-lg border bg-white p-4">
            <p
              dangerouslySetInnerHTML={{ __html: "水: $\\text{H}_2\\text{O}$" }}
            ></p>
            <p
              dangerouslySetInnerHTML={{
                __html: "硫酸: $\\text{H}_2\\text{SO}_4$",
              }}
            ></p>
            <p
              dangerouslySetInnerHTML={{
                __html:
                  "化学反応式: $\\text{CH}_4 + 2\\text{O}_2 \\rightarrow \\text{CO}_2 + 2\\text{H}_2\\text{O}$",
              }}
            ></p>
          </div>
        </section>
      </div>

      <div className="mt-8 border-l-4 border-blue-500 bg-blue-50 p-4">
        <h3 className="text-lg font-semibold">オフライン動作テストについて</h3>
        <p className="mt-2">
          このページでMathJaxが正常にレンダリングされていれば、オフライン環境でも完全に動作します。
          全ての数式が適切に表示され、「MathJax初期化: ✅
          完了」と表示されていることを確認してください。
        </p>
      </div>
    </div>
  )
}
