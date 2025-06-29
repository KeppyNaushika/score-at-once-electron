"use client"

import React from "react"
import {
  Users,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb,
  Keyboard,
  Settings,
  Upload,
  FileImage,
} from "lucide-react"
import { HelpSection, StepItem, TipItem, ShortcutItem, Badge } from "./common/HelpComponents"
import { UploadHelpContent, TemplateHelpContent } from "./page-specific"

// 01-upload ページ用 - moved to page-specific/UploadHelpContent.tsx
export { UploadHelpContent }

// 02-template ページ用 - moved to page-specific/TemplateHelpContent.tsx
export { TemplateHelpContent }

// 03-region-info ページ用
export function RegionInfoHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Settings className="h-6 w-6 text-indigo-600" />
          領域情報編集 - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          作成した採点領域に詳細な情報を設定します。正確な設定が効率的で正確な採点を可能にします。
        </p>
      </div>

      <HelpSection
        icon={<Settings className="h-5 w-5 text-blue-600" />}
        title="基本的な編集手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="領域タイプ選択"
            description="ドロップダウンから適切な領域タイプ（設問、氏名欄、学籍番号欄など）を選択"
          />
          <StepItem
            number={2}
            title="設問番号入力"
            description="設問領域の場合、設問番号（例：1、2-1、3-a）を入力"
          />
          <StepItem
            number={3}
            title="配点設定"
            description="その設問の満点を数値で入力（例：10、5、2.5）"
            isImportant
          />
          <StepItem
            number={4}
            title="ラベル入力"
            description="採点時に表示される分かりやすい名前を入力"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Info className="h-5 w-5 text-green-600" />}
        title="領域タイプの詳細説明"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h4 className="font-medium text-green-700">採点対象領域</h4>
            <div className="space-y-3 text-sm">
              <div className="border-l-4 border-green-500 pl-3">
                <p>
                  <strong>設問 (QUESTION):</strong>
                </p>
                <p className="text-muted-foreground">
                  採点が必要な解答領域。設問番号と配点の設定が必須です。
                </p>
                <p className="text-xs text-green-600">
                  例: 設問番号「1」、配点「10」、ラベル「問1 計算問題」
                </p>
              </div>

              <div className="border-l-4 border-blue-500 pl-3">
                <p>
                  <strong>小計 (SUBTOTAL):</strong>
                </p>
                <p className="text-muted-foreground">
                  複数設問の部分点合計を表示する領域。
                </p>
                <p className="text-xs text-blue-600">
                  例: ラベル「第1部 小計」
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-3">
                <p>
                  <strong>合計点 (TOTAL):</strong>
                </p>
                <p className="text-muted-foreground">
                  全体の合計点を表示する領域。
                </p>
                <p className="text-xs text-purple-600">
                  例: ラベル「総合計点」
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-orange-700">識別情報領域</h4>
            <div className="space-y-3 text-sm">
              <div className="border-l-4 border-orange-500 pl-3">
                <p>
                  <strong>氏名欄 (NAME):</strong>
                </p>
                <p className="text-muted-foreground">
                  学生の氏名が記入される領域。答案の照合に使用。
                </p>
                <p className="text-xs text-orange-600">
                  例: ラベル「受験者氏名」
                </p>
              </div>

              <div className="border-l-4 border-red-500 pl-3">
                <p>
                  <strong>学籍番号欄 (STUDENT_ID):</strong>
                </p>
                <p className="text-muted-foreground">
                  学籍番号が記入される領域。自動照合の主要な手がかり。
                </p>
                <p className="text-xs text-red-600">例: ラベル「学籍番号」</p>
              </div>

              <div className="border-l-4 border-gray-500 pl-3">
                <p>
                  <strong>その他 (OTHER):</strong>
                </p>
                <p className="text-muted-foreground">
                  クラス名、受験番号など、その他の情報領域。
                </p>
                <p className="text-xs text-gray-600">例: ラベル「クラス名」</p>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効果的な設定のベストプラクティス"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>設問番号の命名規則:</strong>
            一貫した命名規則を使用しましょう。例：「1」「2-1」「2-2」「3-a」「3-b」など。
            階層構造が分かりやすく、後の集計作業も効率的になります。
          </TipItem>

          <TipItem type="info">
            <strong>配点設定のコツ:</strong>
            小数点も使用可能です（例：2.5点、1.5点）。配点の合計が試験全体の満点と一致するか、
            設定完了後に必ず確認してください。不一致があると集計に問題が生じる可能性があります。
          </TipItem>

          <TipItem type="warning">
            <strong>ラベルの重要性:</strong>
            ラベルは採点時に表示される重要な情報です。採点者が迷わないよう、
            「問1 方程式」「問2-1
            グラフ作成」のように内容が分かりやすい名前を付けましょう。
          </TipItem>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-indigo-600" />}
        title="効率的な編集操作"
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium">キーボードナビゲーション</h4>
            <div className="space-y-2">
              <ShortcutItem keys="Tab" description="次のフィールドに移動" />
              <ShortcutItem
                keys="Shift + Tab"
                description="前のフィールドに移動"
              />
              <ShortcutItem
                keys="Enter"
                description="編集を確定して次の行に移動"
              />
              <ShortcutItem keys="Esc" description="編集をキャンセル" />
            </div>
          </div>

          <div>
            <h4 className="mb-2 font-medium">便利な編集機能</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
                <span>
                  <strong>行のドラッグ:</strong>{" "}
                  行の左端をドラッグして順序を変更できます
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-green-500"></div>
                <span>
                  <strong>自動保存:</strong> 変更は1秒後に自動的に保存されます
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-purple-500"></div>
                <span>
                  <strong>一括入力:</strong>{" "}
                  同じタイプの領域は一度に設定できます
                </span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        title="よくある間違いと対処法"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h4 className="mb-2 font-medium text-red-800">❌ 設問番号の重複</h4>
            <p className="text-sm text-red-700">
              同じ設問番号を複数の領域に設定すると、採点時に混乱が生じます。
              各設問番号は一意になるように設定してください。
            </p>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <h4 className="mb-2 font-medium text-orange-800">
              ⚠️ 配点の設定漏れ
            </h4>
            <p className="text-sm text-orange-700">
              設問タイプの領域には必ず配点を設定してください。
              配点が0や空白の場合、その問題は採点対象から除外されます。
            </p>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <h4 className="mb-2 font-medium text-yellow-800">
              💡 ラベルの統一性
            </h4>
            <p className="text-sm text-yellow-700">
              同じような問題のラベルは統一感を持たせましょう。
              「問1」「問2」より「問1 計算」「問2
              証明」の方が採点時に分かりやすくなります。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="設定完了前の最終チェック"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-3 font-medium">✅ 設定完了チェックリスト</h4>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <div>□ 全ての設問領域にタイプを設定</div>
                <div>□ 設問番号に重複がない</div>
                <div>□ 全ての設問に配点を設定</div>
                <div>□ 配点の合計が満点と一致</div>
              </div>
              <div className="space-y-1">
                <div>□ ラベルが分かりやすい</div>
                <div>□ 氏名欄・学籍番号欄を設定</div>
                <div>□ 領域の順序が適切</div>
                <div>□ 全ページの設定が完了</div>
              </div>
            </div>
          </div>

          <TipItem type="success">
            全ての領域情報の設定が完了したら、「次へ:
            受験生徒管理」ボタンで次のステップに進みます。
            設定内容は自動保存されているので、いつでも戻って修正可能です。
          </TipItem>
        </div>
      </HelpSection>
    </div>
  )
}

// 04-students ページ用
export function StudentsHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Users className="h-6 w-6 text-green-600" />
          受験生徒管理 - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          このプロジェクトで採点する生徒を確認し、受験状態を適切に管理します。正確な生徒管理が効率的な採点作業の基盤となります。
        </p>
      </div>

      <HelpSection
        icon={<Users className="h-5 w-5 text-blue-600" />}
        title="受験状態の管理"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="受験状態の確認"
            description="各生徒の現在の受験状態（受験・見込・欠席）を確認します"
          />
          <StepItem
            number={2}
            title="状態の変更"
            description="ドロップダウンメニューから適切な受験状態を選択します"
            isImportant
          />
          <StepItem
            number={3}
            title="一括操作"
            description="複数の生徒を選択して一括で状態変更や削除を実行できます"
          />
          <StepItem
            number={4}
            title="生徒の追加"
            description="新しい生徒を個別に追加、またはExcelファイルから一括インポート"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Info className="h-5 w-5 text-indigo-600" />}
        title="受験状態の詳細説明"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="mb-2 font-medium text-green-700">
              受験 (participating)
            </h4>
            <p className="text-muted-foreground mb-2 text-sm">
              試験を受験し、答案の提出が期待される生徒です。
            </p>
            <div className="text-xs text-green-600">
              <p>• 答案アップロード時の照合対象</p>
              <p>• 採点作業の対象となる</p>
              <p>• 成績集計に含まれる</p>
            </div>
          </div>

          <div className="border-l-4 border-yellow-500 pl-4">
            <h4 className="mb-2 font-medium text-yellow-700">
              見込 (expected)
            </h4>
            <p className="text-muted-foreground mb-2 text-sm">
              当初欠席だったが、後日受験した生徒です。追試・再試験などが該当します。
            </p>
            <div className="text-xs text-yellow-600">
              <p>• 採点は通常通り実施される</p>
              <p>• 平均点等の統計計算からは除外</p>
              <p>• 個人の成績記録には反映される</p>
            </div>
          </div>

          <div className="border-l-4 border-red-500 pl-4">
            <h4 className="mb-2 font-medium text-red-700">欠席 (absent)</h4>
            <p className="text-muted-foreground mb-2 text-sm">
              試験を欠席し、答案の提出がない生徒です。
            </p>
            <div className="text-xs text-red-600">
              <p>• 答案照合の対象外</p>
              <p>• 採点作業から除外</p>
              <p>• 欠席として記録される</p>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Upload className="h-5 w-5 text-purple-600" />}
        title="生徒の追加方法"
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium text-purple-700">個別追加</h4>
            <p className="text-muted-foreground mb-3 text-sm">
              「生徒を追加」ボタンから、個別に生徒情報を入力して追加できます。
            </p>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <p className="text-sm text-purple-800">
                <strong>必須項目:</strong> 氏名、ふりがな、学籍番号
                <br />
                <strong>オプション:</strong> 出席番号、入学年度
              </p>
            </div>
          </div>

          <div>
            <h4 className="mb-2 font-medium text-green-700">
              Excel一括インポート
            </h4>
            <p className="text-muted-foreground mb-3 text-sm">
              「生徒インポート」ボタンから、Excelファイルで複数の生徒を一括追加できます。
            </p>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="mb-2 text-sm text-green-800">
                <strong>対応形式:</strong>
              </p>
              <ul className="space-y-1 text-xs text-green-700">
                <li>• Excel (.xlsx, .xls) ファイル</li>
                <li>• CSV (.csv) ファイル</li>
                <li>• 1行目はヘッダー行として認識</li>
                <li>• 学籍番号列は必須</li>
              </ul>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効率的な生徒管理のコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>出席番号の活用:</strong>
            出席番号を設定しておくと、生徒一覧が番号順に並び、管理が容易になります。
            また、答案アップロード時の照合精度も向上します。
          </TipItem>

          <TipItem type="info">
            <strong>学級単位での管理:</strong>
            複数の学級が対象の場合、学級ごとに表示が分かれています。
            学級ごとに受験状態を確認し、必要に応じて調整してください。
          </TipItem>

          <TipItem type="warning">
            <strong>欠席者の事前設定:</strong>
            事前に欠席が確定している生徒は「欠席」に設定しておくことで、
            答案アップロード時に「該当する生徒が見つからない」というエラーを防げます。
          </TipItem>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-orange-600" />}
        title="一括操作機能"
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium">複数選択操作</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
                <span>
                  <strong>チェックボックス選択:</strong>{" "}
                  対象の生徒にチェックを入れて選択
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-green-500"></div>
                <span>
                  <strong>全選択/全解除:</strong>{" "}
                  ヘッダーのチェックボックスで一括選択
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-red-500"></div>
                <span>
                  <strong>一括削除:</strong> 選択した生徒をまとめて削除可能
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <h4 className="mb-2 font-medium text-orange-800">
              ⚠️ 削除時の注意
            </h4>
            <p className="text-sm text-orange-700">
              生徒を削除する前に、その生徒に関連する採点データがあるかチェックされます。
              採点済みのデータがある場合は、影響範囲が表示されるので、慎重に判断してください。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="次のステップへの準備"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-3 font-medium">✅ 生徒管理完了チェックリスト</h4>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <div>□ 全ての受験生徒を登録</div>
                <div>□ 受験状態を適切に設定</div>
                <div>□ 出席番号を設定（推奨）</div>
                <div>□ 学籍番号の重複をチェック</div>
              </div>
              <div className="space-y-1">
                <div>□ 欠席者を「欠席」に設定</div>
                <div>□ 後日受験済み生徒を「見込」に設定</div>
                <div>□ 氏名・ふりがなを確認</div>
                <div>□ 不要な生徒を削除</div>
              </div>
            </div>
          </div>

          <TipItem type="success">
            生徒管理が完了したら、「次へ:
            答案アップロード」ボタンで次のステップに進みます。
            生徒情報は後からでも変更できるので、必要に応じて戻って調整してください。
          </TipItem>
        </div>
      </HelpSection>
    </div>
  )
}

// 05-answer-sheets ページ用
export function AnswerSheetsHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Upload className="h-6 w-6 text-blue-600" />
          生徒解答アップロード - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          答案画像をアップロードし、高度なグリッド管理機能で効率的に生徒と答案の対応付けを行います。「新規追加」と「現在の対応状況」の2つのタブで統一された高機能インターフェースを提供します。
        </p>
      </div>

      <HelpSection
        icon={<Upload className="h-5 w-5 text-green-600" />}
        title="基本的なアップロード手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="ファイルアップロード"
            description="「新規追加」タブで答案画像ファイル（PNG、JPEG、PDF）をドラッグ&ドロップまたはクリックして選択します"
          />
          <StepItem
            number={2}
            title="配置戦略選択"
            description="「ページ優先」または「生徒優先」から適切な自動配置戦略を選択します"
            isImportant
          />
          <StepItem
            number={3}
            title="グリッドで対応付け"
            description="生徒×ページのグリッドテーブルで答案ファイルと生徒の対応を確認・手動調整します"
          />
          <StepItem
            number={4}
            title="一括アップロード"
            description="配置完了後、「アップロード」ボタンで一括処理し、データベースに保存します"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Info className="h-5 w-5 text-indigo-600" />}
        title="統一されたタブインターフェース"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-3 font-medium text-green-700">
              新規追加タブ
            </h4>
            <div className="space-y-2 text-sm">
              <div className="rounded border border-green-200 bg-green-50 p-2">
                <p className="font-medium text-green-800">
                  ファイルアップロード
                </p>
                <p className="text-xs text-green-600">ドラッグ&ドロップまたはクリックでファイル選択</p>
              </div>
              <div className="rounded border border-blue-200 bg-blue-50 p-2">
                <p className="font-medium text-blue-800">自動配置処理</p>
                <p className="text-xs text-blue-600">ページ優先/生徒優先戦略での配置</p>
              </div>
              <div className="rounded border border-purple-200 bg-purple-50 p-2">
                <p className="font-medium text-purple-800">グリッド管理</p>
                <p className="text-xs text-purple-600">高機能テーブルでの配置調整</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-medium text-orange-700">
              現在の対応状況タブ
            </h4>
            <div className="space-y-2 text-sm">
              <div className="rounded border border-orange-200 bg-orange-50 p-2">
                <p className="font-medium text-orange-800">
                  既存答案表示
                </p>
                <p className="text-xs text-orange-600">アップロード済み答案の表示・管理</p>
              </div>
              <div className="rounded border border-red-200 bg-red-50 p-2">
                <p className="font-medium text-red-800">同一グリッド機能</p>
                <p className="text-xs text-red-600">新規追加と同じ高機能インターフェース</p>
              </div>
              <div className="rounded border border-cyan-200 bg-cyan-50 p-2">
                <p className="font-medium text-cyan-800">画像プレビュー</p>
                <p className="text-xs text-cyan-600">答案画像の氏名欄・全体表示切り替え</p>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-purple-600" />}
        title="配置戦略と自動配置"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-3 font-medium text-green-700">
              配置戦略の種類
            </h4>
            <div className="space-y-2 text-sm">
              <div className="rounded border border-green-200 bg-green-50 p-2">
                <p className="font-medium text-green-800">
                  ページ優先配置
                </p>
                <p className="text-xs text-green-600">1ページ目全員 → 2ページ目全員の順で配置</p>
              </div>
              <div className="rounded border border-blue-200 bg-blue-50 p-2">
                <p className="font-medium text-blue-800">生徒優先配置</p>
                <p className="text-xs text-blue-600">生徒A全ページ → 生徒B全ページの順で配置</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-medium text-orange-700">
              高度なグリッド操作
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-green-500"></div>
                <span>
                  <strong>自動配置:</strong> 選択戦略に基づく最適配置
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
                <span>
                  <strong>ドラッグ&ドロップ:</strong> 直感的な手動調整
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-purple-500"></div>
                <span>
                  <strong>無効化制御:</strong> 生徒・ページ・セル単位の制御
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-yellow-500"></div>
                <span>
                  <strong>自動順延:</strong> 無効化時の自動ファイル再配置
                </span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<FileImage className="h-5 w-5 text-purple-600" />}
        title="グリッド管理の詳細"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-3 font-medium text-green-700">セル状態の管理</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-green-500"></div>
                <span>
                  <strong>有効セル:</strong> ファイル配置可能な状態
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-gray-500"></div>
                <span>
                  <strong>無効セル:</strong> 配置対象外（自動順延）
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
                <span>
                  <strong>配置済み:</strong> ファイルが配置されたセル
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-medium text-orange-700">操作のポイント</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-purple-500"></div>
                <span>
                  <strong>行・列単位:</strong> 生徒またはページ全体を一括制御
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-yellow-500"></div>
                <span>
                  <strong>個別制御:</strong> 特定のセルのみ無効化
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-red-500"></div>
                <span>
                  <strong>リアルタイム:</strong> 変更時に即座に再配置実行
                </span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効率的な答案管理のコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>統一インターフェースの活用:</strong>
            新規追加と現在の対応状況で同じグリッド機能を使用できるため、
            一度操作を覚えれば両方のタブで効率的に作業できます。
            ドラッグ&ドロップ、無効化制御、配置戦略など全機能が共通です。
          </TipItem>

          <TipItem type="info">
            <strong>Base64セキュア表示:</strong>
            個人情報を含む答案画像は、publicフォルダではなくElectron APIを通じて
            Base64形式で安全に表示されます。プライバシー保護と高いセキュリティを両立しています。
          </TipItem>

          <TipItem type="warning">
            <strong>プレビュー機能の活用:</strong>
            グリッド内で氏名欄表示と全体表示を切り替えできます。
            生徒の特定には氏名欄表示、答案内容の確認には全体表示を使い分けると効率的です。
          </TipItem>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-orange-600" />}
        title="高度なグリッド管理機能"
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium">配置制御の詳細機能</h4>
            <div className="space-y-3">
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="mb-2 text-sm text-green-800">
                  <strong>3層制御システム:</strong>
                </p>
                <ol className="space-y-1 text-xs text-green-700">
                  <li>1. <strong>生徒レベル:</strong> 行全体の有効/無効切り替え</li>
                  <li>2. <strong>ページレベル:</strong> 列全体の有効/無効切り替え</li>
                  <li>3. <strong>セルレベル:</strong> 個別セルの有効/無効切り替え</li>
                  <li>4. <strong>自動順延:</strong> 無効化されたセルをスキップして自動配置</li>
                </ol>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 font-medium">ドラッグ&ドロップ操作</h4>
            <p className="text-muted-foreground mb-2 text-sm">
              グリッド内でファイルを直感的に移動・配置できます。
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
                <span>
                  <strong>セル間移動:</strong> ファイルを異なるセルに直接移動
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-purple-500"></div>
                <span>
                  <strong>配置制約:</strong> 無効化されたセルには配置不可
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-green-500"></div>
                <span>
                  <strong>リアルタイム反映:</strong> 変更は即座にプレビューに反映
                </span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        title="よくある問題と解決方法"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h4 className="mb-2 font-medium text-red-800">
              ❌ グリッド表示の問題
            </h4>
            <ul className="space-y-1 text-sm text-red-700">
              <li>• 「現在の対応状況」タブで画像が表示されない → ファイルパスの確認が必要</li>
              <li>• Base64変換に失敗している → 元ファイルの存在・権限を確認</li>
              <li>• ドラッグ&ドロップが機能しない → 対象セルが無効化されている可能性</li>
              <li>• 自動配置が期待通りにならない → 配置戦略の選択を確認</li>
            </ul>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <h4 className="mb-2 font-medium text-orange-800">
              ⚠️ パフォーマンスの最適化
            </h4>
            <p className="text-sm text-orange-700">
              大量の答案（100枚超）を扱う場合は、グリッドの表示が重くなることがあります。
              その場合は段階的にアップロードするか、不要な生徒・ページを無効化して表示を軽量化してください。
            </p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h4 className="mb-2 font-medium text-blue-800">
              💡 効率的な運用のコツ
            </h4>
            <p className="text-sm text-blue-700">
              新規追加で基本的な配置を完了してから、現在の対応状況タブで細かい調整を行うと効率的です。
              両タブで同じグリッド機能が使えるため、作業を分割して進められます。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="採点開始前の最終確認"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-3 font-medium">
              ✅ 答案管理完了チェックリスト
            </h4>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <div>□ 全ての受験者の答案を配置</div>
                <div>□ グリッド表示で画像が正常に表示</div>
                <div>□ 欠席者のセルが適切に無効化</div>
                <div>□ ドラッグ&ドロップ調整が完了</div>
              </div>
              <div className="space-y-1">
                <div>□ 現在の対応状況タブで最終確認</div>
                <div>□ プレビューモードで画像品質確認</div>
                <div>□ 統計情報（配置済み/未配置）が適切</div>
                <div>□ アップロード処理が完了</div>
              </div>
            </div>
          </div>

          <TipItem type="success">
            統一されたグリッド管理システムにより、新規追加から最終確認まで
            一貫したインターフェースで効率的に作業できます。「次へ: 採点開始」ボタンで
            採点作業に進み、高度な採点機能をご活用ください。
          </TipItem>
        </div>
      </HelpSection>
    </div>
  )
}

// 06-score-at-once ページ用
export function ScoringHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <BarChart3 className="h-6 w-6 text-red-600" />
          採点作業 - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          効率的な採点インターフェースで、キーボードショートカットを活用した高速採点が可能です。複数教員での協調採点にも対応しています。
        </p>
      </div>

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-blue-600" />}
        title="基本的な採点手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="答案と設問の確認"
            description="表示された答案画像と採点対象の設問を確認します"
          />
          <StepItem
            number={2}
            title="点数入力"
            description="キーボードの数字キー（0-9）で直接点数を入力します"
            isImportant
          />
          <StepItem
            number={3}
            title="コメント追加（任意）"
            description="?キーを押してコメント入力モードに切り替え、詳細なフィードバックを追加"
          />
          <StepItem
            number={4}
            title="次の答案へ"
            description="Spaceキーまたは矢印キーで次の答案に進みます"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-indigo-600" />}
        title="キーボードショートカット一覧"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-3 font-medium text-blue-700">基本操作</h4>
            <div className="space-y-2">
              <ShortcutItem keys="0-9" description="点数を直接入力" />
              <ShortcutItem keys="Space" description="次の答案に進む" />
              <ShortcutItem keys="Backspace" description="前の答案に戻る" />
              <ShortcutItem keys="Enter" description="入力を確定して次へ" />
              <ShortcutItem keys="?" description="コメント入力モード" />
              <ShortcutItem keys="Esc" description="コメント入力を終了" />
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-medium text-green-700">高度な操作</h4>
            <div className="space-y-2">
              <ShortcutItem keys="Ctrl + S" description="一時保存" />
              <ShortcutItem
                keys="Ctrl + Z"
                description="直前の採点を取り消し"
              />
              <ShortcutItem keys="F" description="満点を入力" />
              <ShortcutItem keys="X" description="0点を入力" />
              <ShortcutItem keys="H" description="配点の半分を入力" />
              <ShortcutItem keys="Tab" description="次の設問に移動" />
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Users className="h-5 w-5 text-purple-600" />}
        title="協調採点機能"
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium text-purple-700">
              複数教員での同時採点
            </h4>
            <p className="text-muted-foreground mb-3 text-sm">
              複数の教員が同時に異なる設問を採点できます。リアルタイムで進捗が共有され、効率的な分業が可能です。
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                <h5 className="mb-2 font-medium text-purple-800">
                  担当設問の分担例
                </h5>
                <ul className="space-y-1 text-xs text-purple-700">
                  <li>• A先生: 問1-3（計算問題）</li>
                  <li>• B先生: 問4-6（記述問題）</li>
                  <li>• C先生: 問7-9（証明問題）</li>
                </ul>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <h5 className="mb-2 font-medium text-green-800">
                  進捗の可視化
                </h5>
                <ul className="space-y-1 text-xs text-green-700">
                  <li>• リアルタイム進捗表示</li>
                  <li>• 設問別完了状況</li>
                  <li>• 教員別作業量の確認</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <h4 className="mb-2 font-medium text-orange-800">
              ⚠️ 競合回避システム
            </h4>
            <p className="text-sm text-orange-700">
              同じ答案を複数の教員が同時に採点しようとした場合、システムが自動的に検出して警告を表示します。
              先に採点を開始した教員が優先され、後から参加した教員には別の答案が割り当てられます。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-yellow-600" />}
        title="採点モードと表示設定"
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium text-yellow-700">
              表示モードの切り替え
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="border-l-4 border-blue-500 pl-3">
                <p>
                  <strong>設問拡大モード:</strong>
                </p>
                <p className="text-muted-foreground text-sm">
                  現在採点中の設問領域を拡大表示
                </p>
                <p className="text-xs text-blue-600">詳細な確認に最適</p>
              </div>
              <div className="border-l-4 border-green-500 pl-3">
                <p>
                  <strong>全体表示モード:</strong>
                </p>
                <p className="text-muted-foreground text-sm">
                  答案全体を表示して文脈を把握
                </p>
                <p className="text-xs text-green-600">記述問題の採点に有効</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 font-medium text-green-700">
              ズーム・パン機能
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
                <span>
                  <strong>マウスホイール:</strong> 答案画像のズームイン・アウト
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-green-500"></div>
                <span>
                  <strong>ドラッグ操作:</strong> 拡大した画像の移動（パン）
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-purple-500"></div>
                <span>
                  <strong>ダブルクリック:</strong> 元のサイズに戻す
                </span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効率的な採点のコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>キーボード中心の操作:</strong>
            マウスをほとんど使わずにキーボードだけで採点を完了できます。
            数字キー、Space、Backspaceの3つのキーを覚えるだけで大幅に効率化されます。
          </TipItem>

          <TipItem type="info">
            <strong>部分点の活用:</strong>
            記述問題では小数点も入力可能です（例：2.5点、7.5点）。
            部分点を適切に付けることで、より正確で公平な評価が可能になります。
          </TipItem>

          <TipItem type="warning">
            <strong>採点基準の統一:</strong>
            複数教員で採点する場合は、事前に採点基準を明確にしておくことが重要です。
            特に記述問題や証明問題では、具体的な部分点の付け方を統一しましょう。
          </TipItem>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Info className="h-5 w-5 text-cyan-600" />}
        title="採点データの管理"
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium">自動保存機能</h4>
            <p className="text-muted-foreground mb-2 text-sm">
              採点データは入力と同時に自動保存されます。ネットワーク障害や予期しない終了があっても、
              最後に入力した点数まで確実に保存されています。
            </p>
          </div>

          <div>
            <h4 className="mb-2 font-medium">採点履歴の確認</h4>
            <p className="text-muted-foreground mb-2 text-sm">
              各答案の採点履歴が記録され、「いつ」「誰が」「何点付けたか」を後から確認できます。
              採点の透明性と品質管理に役立ちます。
            </p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h4 className="mb-2 font-medium text-blue-800">💡 採点の修正</h4>
            <p className="text-sm text-blue-700">
              採点完了後でも点数の修正は可能です。一度採点した答案は「採点済み」として表示され、
              必要に応じて再採点や点数の調整ができます。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="採点完了と次のステップ"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-3 font-medium">✅ 採点完了チェックリスト</h4>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <div>□ 全ての受験者の採点が完了</div>
                <div>□ 未採点の設問がない</div>
                <div>□ 点数の入力漏れがない</div>
                <div>□ 部分点が適切に設定</div>
              </div>
              <div className="space-y-1">
                <div>□ コメントが必要な答案に記入</div>
                <div>□ 複数教員の採点が統一</div>
                <div>□ 特記事項の記録</div>
                <div>□ 最終確認が完了</div>
              </div>
            </div>
          </div>

          <TipItem type="success">
            全ての採点が完了したら、「次へ:
            結果出力」ボタンで結果分析と出力のステップに進みます。
            採点データは自動的に集計され、Excel出力やPDF出力の準備が整います。
          </TipItem>
        </div>
      </HelpSection>
    </div>
  )
}

// 07-export ページ用
export function ExportHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <BarChart3 className="h-6 w-6 text-green-600" />
          結果出力・分析 - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          採点結果の確認、詳細な分析、そして各種形式での出力を行います。多様な出力形式で教育現場のニーズに対応します。
        </p>
      </div>

      <HelpSection
        icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
        title="結果確認と基本分析"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="採点結果の概要確認"
            description="全体の採点状況、平均点、最高点・最低点などの基本統計を確認"
          />
          <StepItem
            number={2}
            title="設問別分析"
            description="各設問の正答率、部分点の分布、難易度の評価を確認"
            isImportant
          />
          <StepItem
            number={3}
            title="個人成績の確認"
            description="各生徒の詳細な得点状況と総合評価を確認"
          />
          <StepItem
            number={4}
            title="出力形式の選択"
            description="Excel、PDF、CSVなど、用途に応じた出力形式を選択"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<FileImage className="h-5 w-5 text-green-600" />}
        title="出力形式の詳細"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="mb-2 font-medium text-green-700">
                Excel形式 (.xlsx)
              </h4>
              <p className="text-muted-foreground mb-2 text-sm">
                成績管理システムとの連携に最適な形式です。
              </p>
              <div className="space-y-1 text-xs text-green-600">
                <p>• 計算式付きテンプレート</p>
                <p>• 平均点・標準偏差の自動計算</p>
                <p>• グラフ・チャートの挿入</p>
                <p>• フィルタリング機能対応</p>
              </div>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="mb-2 font-medium text-blue-700">PDF形式 (.pdf)</h4>
              <p className="text-muted-foreground mb-2 text-sm">
                印刷・配布用の公式文書として使用できます。
              </p>
              <div className="space-y-1 text-xs text-blue-600">
                <p>• 個人成績表（生徒・保護者用）</p>
                <p>• クラス別成績一覧</p>
                <p>• 設問別分析レポート</p>
                <p>• 印刷最適化レイアウト</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="mb-2 font-medium text-purple-700">
                CSV形式 (.csv)
              </h4>
              <p className="text-muted-foreground mb-2 text-sm">
                他システムとのデータ連携に最適です。
              </p>
              <div className="space-y-1 text-xs text-purple-600">
                <p>• 軽量でシンプルなデータ形式</p>
                <p>• データベースインポート対応</p>
                <p>• プログラミング処理に適用</p>
                <p>• UTF-8エンコーディング</p>
              </div>
            </div>

            <div className="border-l-4 border-orange-500 pl-4">
              <h4 className="mb-2 font-medium text-orange-700">
                採点済み答案PDF
              </h4>
              <p className="text-muted-foreground mb-2 text-sm">
                点数とコメントが記入された答案の出力です。
              </p>
              <div className="space-y-1 text-xs text-orange-600">
                <p>• 生徒への返却用</p>
                <p>• 保護者面談資料</p>
                <p>• 授業での解説資料</p>
                <p>• アーカイブ保存用</p>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-indigo-600" />}
        title="詳細分析機能"
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium text-indigo-700">
              統計分析レポート
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div className="rounded border border-blue-200 bg-blue-50 p-2 text-center">
                <p className="font-medium text-blue-800">平均点</p>
                <p className="text-xs text-blue-600">クラス・設問別</p>
              </div>
              <div className="rounded border border-green-200 bg-green-50 p-2 text-center">
                <p className="font-medium text-green-800">標準偏差</p>
                <p className="text-xs text-green-600">ばらつき分析</p>
              </div>
              <div className="rounded border border-purple-200 bg-purple-50 p-2 text-center">
                <p className="font-medium text-purple-800">正答率</p>
                <p className="text-xs text-purple-600">問題別傾向</p>
              </div>
              <div className="rounded border border-orange-200 bg-orange-50 p-2 text-center">
                <p className="font-medium text-orange-800">度数分布</p>
                <p className="text-xs text-orange-600">点数帯分析</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 font-medium text-green-700">問題分析機能</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-green-500"></div>
                <span>
                  <strong>難易度分析:</strong> 正答率から問題の適切性を評価
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
                <span>
                  <strong>識別力分析:</strong> 上位者と下位者の正答率の差を計算
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 rounded-full bg-purple-500"></div>
                <span>
                  <strong>部分点分析:</strong> 部分点の分布と傾向を可視化
                </span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効果的な活用方法"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>教育現場での活用:</strong>
            個人成績表PDFは生徒・保護者への説明資料として、Excel形式は成績処理システムへの
            インポート用として使い分けることで、効率的な成績管理が実現できます。
          </TipItem>

          <TipItem type="info">
            <strong>問題改善への活用:</strong>
            設問別の正答率や部分点分析結果を次回の問題作成に活かすことで、
            より適切な難易度と評価観点を持つ試験問題の作成が可能になります。
          </TipItem>

          <TipItem type="warning">
            <strong>データの保管と管理:</strong>
            出力したファイルには個人情報が含まれているため、適切なセキュリティ対策を講じて
            保管してください。不要になったファイルは確実に削除することを推奨します。
          </TipItem>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Upload className="h-5 w-5 text-cyan-600" />}
        title="カスタム出力設定"
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium">出力項目のカスタマイズ</h4>
            <p className="text-muted-foreground mb-3 text-sm">
              出力する項目や表示形式を詳細にカスタマイズできます。
            </p>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div className="space-y-2">
                <h5 className="font-medium text-cyan-700">含める情報</h5>
                <div className="space-y-1 text-xs">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span>学籍番号・氏名</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span>設問別得点</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span>合計点・順位</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>採点コメント</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <h5 className="font-medium text-cyan-700">表示形式</h5>
                <div className="space-y-1 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="format"
                      className="rounded"
                      defaultChecked
                    />
                    <span>点数表示（例：8/10）</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="format" className="rounded" />
                    <span>パーセント表示（例：80%）</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="format" className="rounded" />
                    <span>評定表示（例：A,B,C）</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="出力完了と保存"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-3 font-medium">✅ 出力前チェックリスト</h4>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <div>□ 採点データに漏れがない</div>
                <div>□ 出力形式を適切に選択</div>
                <div>□ 含める項目を確認</div>
                <div>□ ファイル名を適切に設定</div>
              </div>
              <div className="space-y-1">
                <div>□ 保存先フォルダを確認</div>
                <div>□ 既存ファイルの上書き確認</div>
                <div>□ 個人情報保護の確認</div>
                <div>□ バックアップの作成</div>
              </div>
            </div>
          </div>

          <TipItem type="success">
            出力が完了すると、指定したフォルダにファイルが保存されます。
            重要なデータは複数の場所にバックアップを作成することをお勧めします。
            また、プロジェクトデータはシステム内で保持されるため、後から再出力も可能です。
          </TipItem>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h4 className="mb-2 font-medium text-blue-800">
              🎉 採点プロジェクト完了
            </h4>
            <p className="text-sm text-blue-700">
              お疲れさまでした！一括採点を使用した採点作業が完了しました。
              出力された結果を活用して、より良い教育活動にお役立てください。
            </p>
          </div>
        </div>
      </HelpSection>
    </div>
  )
}
