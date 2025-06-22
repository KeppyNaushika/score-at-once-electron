"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import AnswerDisplayViewer from "@/components/grading/AnswerDisplayViewer"
import ProjectProgressCard from "@/components/grading/ProjectProgressCard"
import ScoreComparisonModal from "@/components/grading/ScoreComparisonModal"
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  FileText,
  Keyboard,
  Settings,
  Save,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// 採点状態の型定義
type ScoringStatus = "ungraded" | "correct" | "incorrect" | "partial" | "pending" | "final"

// 採点データの型定義
interface ScoringData {
  id?: string
  questionId: string
  score: number
  maxScore: number
  status: ScoringStatus
  comment: string
  scoredByUserId: string
  version: number
  updatedAt: Date
}

// 答案の型定義
interface AnswerSheet {
  id: string
  studentId: string
  projectId: string
  imagePath: string
  pageNumber: number
  status: "uploaded" | "processing" | "ready" | "graded"
  student: {
    id: string
    studentId: string
    lastName: string
    firstName: string
  }
}

// 設問領域の型定義
interface QuestionRegion {
  id: string
  label: string
  questionNumber: string
  points: number
  x: number
  y: number
  width: number
  height: number
}

// キーボードショートカットの設定
const DEFAULT_SHORTCUTS = {
  correct: 'c',
  incorrect: 'x',
  partial: 'p',
  pending: 'h',
  nextQuestion: 'ArrowRight',
  prevQuestion: 'ArrowLeft',
  nextStudent: 'ArrowDown',
  prevStudent: 'ArrowUp',
  save: 'ctrl+s',
  zoomIn: '=',
  zoomOut: '-',
  resetZoom: '0',
  fullView: 'f',
}

export default function GradingPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  
  // 状態管理
  const [loading, setLoading] = useState(true)
  const [answerSheets, setAnswerSheets] = useState<AnswerSheet[]>([])
  const [questionRegions, setQuestionRegions] = useState<QuestionRegion[]>([])
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [scoringData, setScoringData] = useState<Record<string, ScoringData>>({})
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [showScoreComparison, setShowScoreComparison] = useState(false)
  const [imageZoom, setImageZoom] = useState(1.0)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [viewMode, setViewMode] = useState<'question' | 'full'>('question') // 設問拡大 or 全体表示
  
  // Refs
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // 現在の答案と設問
  const currentAnswerSheet = answerSheets[currentStudentIndex]
  const currentQuestion = questionRegions[currentQuestionIndex]
  
  // データの初期読み込み
  useEffect(() => {
    const initializeGradingData = async () => {
      setLoading(true)
      try {
        // 答案データを取得
        const answersResult = await window.electronAPI.getAnswerSheetsForProject(projectId)
        if (!answersResult.success) {
          throw new Error(answersResult.error || 'Failed to fetch answer sheets')
        }
        
        // レイアウト領域（設問）データを取得
        const regionsResult = await window.electronAPI.getLayoutRegions(projectId)
        if (!regionsResult.success) {
          throw new Error(regionsResult.error || 'Failed to fetch layout regions')
        }
        
        // 設問領域のみをフィルタリング
        const questionRegions = regionsResult.regions.filter(
          (region: any) => region.type === 'QUESTION_ANSWER' && region.questionNumber
        ).map((region: any) => ({
          id: region.id,
          label: region.label,
          questionNumber: region.questionNumber,
          points: region.points || 0,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
        }))
        
        // 既存の採点データを取得
        const existingScores = await loadExistingScoringData(projectId)
        
        setAnswerSheets(answersResult.answerSheets || [])
        setQuestionRegions(questionRegions)
        setScoringData(existingScores)
      } catch (error) {
        console.error('Failed to initialize grading data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    initializeGradingData()
  }, [projectId])
  
  // 既存の採点データを読み込む関数
  const loadExistingScoringData = async (projectId: string): Promise<Record<string, ScoringData>> => {
    try {
      const result = await window.electronAPI.getQuestionScoresForProject(projectId)
      if (!result.success) return {}
      
      const scoringData: Record<string, ScoringData> = {}
      result.scores?.forEach((score: any) => {
        const key = `${score.answerSheetId}-${score.layoutRegionId}`
        scoringData[key] = {
          id: score.id,
          questionId: score.layoutRegionId,
          score: score.score || 0,
          maxScore: score.maxScore || 0,
          status: score.status as ScoringStatus,
          comment: score.comment || '',
          scoredByUserId: score.scoredByUserId,
          version: score.scoreVersion || 0,
          updatedAt: new Date(score.updatedAt),
        }
      })
      
      return scoringData
    } catch (error) {
      console.error('Failed to load existing scoring data:', error)
      return {}
    }
  }
  
  // キーボードイベントハンドラー
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Ctrl+S: 保存
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault()
      handleSaveScoring()
      return
    }
    
    // 入力フィールドがフォーカスされている場合はスキップ
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }
    
    switch (event.key) {
      case DEFAULT_SHORTCUTS.correct:
        handleSetScore('correct')
        break
      case DEFAULT_SHORTCUTS.incorrect:
        handleSetScore('incorrect')
        break
      case DEFAULT_SHORTCUTS.partial:
        handleSetScore('partial')
        break
      case DEFAULT_SHORTCUTS.pending:
        handleSetScore('pending')
        break
      case 'ArrowRight':
        handleNextQuestion()
        break
      case 'ArrowLeft':
        handlePrevQuestion()
        break
      case 'ArrowDown':
        handleNextStudent()
        break
      case 'ArrowUp':
        handlePrevStudent()
        break
      case DEFAULT_SHORTCUTS.zoomIn:
        handleZoomIn()
        break
      case DEFAULT_SHORTCUTS.zoomOut:
        handleZoomOut()
        break
      case DEFAULT_SHORTCUTS.resetZoom:
        handleResetZoom()
        break
      case DEFAULT_SHORTCUTS.fullView:
        toggleViewMode()
        break
    }
  }, [currentStudentIndex, currentQuestionIndex, answerSheets.length, questionRegions.length])
  
  // キーボードイベントリスナーの設定
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])
  
  // ナビゲーション関数
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questionRegions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }
  
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }
  
  const handleNextStudent = () => {
    if (currentStudentIndex < answerSheets.length - 1) {
      setCurrentStudentIndex(currentStudentIndex + 1)
    }
  }
  
  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setCurrentStudentIndex(currentStudentIndex - 1)
    }
  }
  
  // 採点処理関数
  const handleSetScore = (type: 'correct' | 'incorrect' | 'partial' | 'pending') => {
    if (!currentAnswerSheet || !currentQuestion) return
    
    const key = `${currentAnswerSheet.id}-${currentQuestion.id}`
    const currentScore = scoringData[key]
    
    let newScore = 0
    let status: ScoringStatus = type
    
    switch (type) {
      case 'correct':
        newScore = currentQuestion.points
        status = 'correct'
        break
      case 'incorrect':
        newScore = 0
        status = 'incorrect'
        break
      case 'partial':
        // 部分点の場合は入力ダイアログを表示（簡易実装）
        const inputScore = prompt(`部分点を入力してください (0-${currentQuestion.points}):`, 
          currentScore?.score.toString() || '0')
        if (inputScore === null) return
        const parsedScore = parseInt(inputScore)
        if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > currentQuestion.points) {
          alert('無効な点数です')
          return
        }
        newScore = parsedScore
        status = 'partial'
        break
      case 'pending':
        newScore = currentScore?.score || 0
        status = 'pending'
        break
    }
    
    const newScoringData = {
      ...currentScore,
      questionId: currentQuestion.id,
      score: newScore,
      maxScore: currentQuestion.points,
      status,
      comment: currentScore?.comment || '',
      scoredByUserId: 'current-user', // TODO: 認証システムと連携
      version: (currentScore?.version || 0) + 1,
      updatedAt: new Date(),
    }
    
    setScoringData(prev => ({
      ...prev,
      [key]: newScoringData
    }))
  }
  
  // 画像表示関連の関数
  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev * 1.2, 5.0))
  }
  
  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev / 1.2, 0.1))
  }
  
  const handleResetZoom = () => {
    setImageZoom(1.0)
    setImagePosition({ x: 0, y: 0 })
  }
  
  const toggleViewMode = () => {
    setViewMode(prev => prev === 'question' ? 'full' : 'question')
    handleResetZoom()
  }
  
  // 採点データ保存
  const handleSaveScoring = async () => {
    try {
      const currentScoringKey = currentAnswerSheet && currentQuestion 
        ? `${currentAnswerSheet.id}-${currentQuestion.id}` 
        : null
      
      if (!currentScoringKey || !scoringData[currentScoringKey]) {
        console.log('No scoring data to save')
        return
      }
      
      const scoreData = scoringData[currentScoringKey]
      
      if (scoreData.id) {
        // 既存データの更新
        const result = await window.electronAPI.updateQuestionScore(
          scoreData.id, 
          {
            score: scoreData.score,
            maxScore: scoreData.maxScore,
            status: scoreData.status,
            comment: scoreData.comment,
          },
          scoreData.version
        )
        
        if (result.success) {
          // バージョンを更新
          setScoringData(prev => ({
            ...prev,
            [currentScoringKey]: {
              ...scoreData,
              version: result.score.scoreVersion,
              updatedAt: new Date(result.score.updatedAt),
            }
          }))
          console.log('Score updated successfully')
        } else {
          console.error('Failed to update score:', result.error)
        }
      } else {
        // 新規データの作成
        const result = await window.electronAPI.createQuestionScore({
          answerSheetId: currentAnswerSheet!.id,
          layoutRegionId: currentQuestion!.id,
          score: scoreData.score,
          maxScore: scoreData.maxScore,
          status: scoreData.status,
          comment: scoreData.comment,
          scoredByUserId: scoreData.scoredByUserId,
        })
        
        if (result.success) {
          // 新しいIDとバージョンで更新
          setScoringData(prev => ({
            ...prev,
            [currentScoringKey]: {
              ...scoreData,
              id: result.score.id,
              version: result.score.scoreVersion,
              updatedAt: new Date(result.score.updatedAt),
            }
          }))
          console.log('Score created successfully')
        } else {
          console.error('Failed to create score:', result.error)
        }
      }
    } catch (error) {
      console.error('Failed to save scoring data:', error)
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    )
  }
  
  if (answerSheets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">答案がありません</h2>
          <p className="text-muted-foreground mb-4">
            採点を開始するには、まず答案をアップロードしてください。
          </p>
          <Button onClick={() => router.push(`/projects/${projectId}/answer-sheets`)}>
            答案管理へ移動
          </Button>
        </div>
      </div>
    )
  }
  
  if (questionRegions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Settings className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">採点領域が設定されていません</h2>
          <p className="text-muted-foreground mb-4">
            採点を開始するには、まず採点領域を設定してください。
          </p>
          <Button onClick={() => router.push(`/projects/${projectId}/score/template`)}>
            採点領域設定へ移動
          </Button>
        </div>
      </div>
    )
  }
  
  const currentScoringKey = currentAnswerSheet && currentQuestion 
    ? `${currentAnswerSheet.id}-${currentQuestion.id}` 
    : null
  const currentScoring = currentScoringKey ? scoringData[currentScoringKey] : null
  
  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/projects/${projectId}/score`)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              戻る
            </Button>
            <div>
              <h1 className="text-lg font-semibold">採点画面</h1>
              <p className="text-sm text-muted-foreground">
                {currentAnswerSheet?.student.lastName} {currentAnswerSheet?.student.firstName} - 
                設問{currentQuestion?.questionNumber} ({currentQuestion?.points}点)
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Dialog open={showKeyboardHelp} onOpenChange={setShowKeyboardHelp}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Keyboard className="h-4 w-4 mr-1" />
                  ショートカット
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>キーボードショートカット</DialogTitle>
                  <DialogDescription>
                    効率的な採点のためのキーボード操作
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">採点操作</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>C: 正答</div>
                      <div>X: 誤答</div>
                      <div>P: 部分点</div>
                      <div>H: 保留</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">ナビゲーション</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>→: 次の設問</div>
                      <div>←: 前の設問</div>
                      <div>↓: 次の生徒</div>
                      <div>↑: 前の生徒</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">表示操作</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>+/=: 拡大</div>
                      <div>-: 縮小</div>
                      <div>0: リセット</div>
                      <div>F: 全体/部分切替</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">その他</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Ctrl+S: 保存</div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button onClick={handleSaveScoring} size="sm" variant="default">
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      </div>
      
      {/* メインコンテンツエリア */}
      <div className="flex-1 flex">
        {/* 答案表示エリア */}
        <div className="flex-1 relative">
          {currentAnswerSheet ? (
            <AnswerDisplayViewer
              answerSheet={currentAnswerSheet}
              currentQuestion={currentQuestion}
              viewMode={viewMode}
              zoom={imageZoom}
              position={imagePosition}
              onZoomChange={setImageZoom}
              onPositionChange={setImagePosition}
              onViewModeChange={setViewMode}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">答案が選択されていません</p>
              </div>
            </div>
          )}
        </div>
        
        {/* 採点パレット */}
        <div className="w-80 border-l bg-background">
          <div className="p-4 space-y-4">
            {/* プロジェクト進捗表示 */}
            <ProjectProgressCard projectId={projectId} />
            {/* 生徒・設問ナビゲーション */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">ナビゲーション</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">生徒</span>
                  <div className="flex items-center space-x-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={handlePrevStudent}
                      disabled={currentStudentIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-mono px-2">
                      {currentStudentIndex + 1} / {answerSheets.length}
                    </span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={handleNextStudent}
                      disabled={currentStudentIndex === answerSheets.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">設問</span>
                  <div className="flex items-center space-x-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={handlePrevQuestion}
                      disabled={currentQuestionIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-mono px-2">
                      {currentQuestionIndex + 1} / {questionRegions.length}
                    </span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={handleNextQuestion}
                      disabled={currentQuestionIndex === questionRegions.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* 現在の採点状況 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">現在の採点</CardTitle>
              </CardHeader>
              <CardContent>
                {currentScoring ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">得点</span>
                      <span className="font-medium">
                        {currentScoring.score} / {currentScoring.maxScore}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">状態</span>
                      <span className={`text-sm px-2 py-1 rounded ${
                        currentScoring.status === 'correct' ? 'bg-green-100 text-green-800' :
                        currentScoring.status === 'incorrect' ? 'bg-red-100 text-red-800' :
                        currentScoring.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        currentScoring.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {currentScoring.status === 'correct' ? '正答' :
                         currentScoring.status === 'incorrect' ? '誤答' :
                         currentScoring.status === 'partial' ? '部分点' :
                         currentScoring.status === 'pending' ? '保留' : '未採点'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">未採点</p>
                )}
              </CardContent>
            </Card>
            
            {/* 採点ボタン */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">採点操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  className="w-full justify-start" 
                  variant={currentScoring?.status === 'correct' ? 'default' : 'outline'}
                  onClick={() => handleSetScore('correct')}
                >
                  ⭕ 正答 (C) - {currentQuestion?.points}点
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant={currentScoring?.status === 'incorrect' ? 'destructive' : 'outline'}
                  onClick={() => handleSetScore('incorrect')}
                >
                  ❌ 誤答 (X) - 0点
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant={currentScoring?.status === 'partial' ? 'secondary' : 'outline'}
                  onClick={() => handleSetScore('partial')}
                >
                  🔸 部分点 (P)
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant={currentScoring?.status === 'pending' ? 'secondary' : 'outline'}
                  onClick={() => handleSetScore('pending')}
                >
                  ⏸️ 保留 (H)
                </Button>
              </CardContent>
            </Card>
            
            {/* 複数教員比較ボタン */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">複数教員採点</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => setShowScoreComparison(true)}
                  disabled={!currentAnswerSheet || !currentQuestion}
                >
                  👥 採点結果を比較・決定
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 採点結果比較モーダル */}
      {currentAnswerSheet && currentQuestion && (
        <ScoreComparisonModal
          isOpen={showScoreComparison}
          onClose={() => setShowScoreComparison(false)}
          answerSheetId={currentAnswerSheet.id}
          layoutRegionId={currentQuestion.id}
          questionNumber={currentQuestion.questionNumber}
          maxScore={currentQuestion.points}
          studentName={`${currentAnswerSheet.student.lastName} ${currentAnswerSheet.student.firstName}`}
          onScoreFinalized={() => {
            // 採点データを再読み込み
            loadExistingScoringData(projectId).then(setScoringData)
            setShowScoreComparison(false)
          }}
        />
      )}
    </div>
  )
}