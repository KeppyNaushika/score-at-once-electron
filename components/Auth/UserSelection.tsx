'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Plus, Settings } from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string
  username: string
  name: string
  role: string
}

export default function UserSelection() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { quickLogin } = useAuth()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const result = await window.electronAPI.fetchUsers()
      setUsers(result || [])
    } catch (error) {
      console.error('Failed to load users:', error)
      toast.error('ユーザー一覧の読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUserSelect = async (user: User) => {
    await quickLogin(user)
  }

  const handleCreateUser = () => {
    // TODO: Show create user modal
    toast.info('新規ユーザー作成機能は後で実装予定です')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">一括採点システム</h1>
          <p className="text-xl text-gray-600">ユーザーを選択して開始してください</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {users.map((user) => (
            <Card 
              key={user.id}
              className="hover:shadow-lg transition-all duration-200 cursor-pointer group hover:scale-105"
              onClick={() => handleUserSelect(user)}
            >
              <CardContent className="p-6 text-center">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:from-blue-600 group-hover:to-purple-700 transition-all duration-200">
                  <User className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{user.name}</h3>
                <p className="text-gray-600 mb-1">{user.username}</p>
                <p className="text-sm text-gray-500 capitalize">{user.role || '教師'}</p>
                <Button 
                  className="mt-4 w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUserSelect(user)
                  }}
                >
                  採点を開始
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Add new user card */}
          <Card 
            className="hover:shadow-lg transition-all duration-200 cursor-pointer group hover:scale-105 border-dashed border-2 border-gray-300"
            onClick={handleCreateUser}
          >
            <CardContent className="p-6 text-center">
              <div className="mx-auto w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4 group-hover:bg-gray-300 transition-all duration-200">
                <Plus className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">新しいユーザー</h3>
              <p className="text-gray-500 mb-4">ユーザーを追加</p>
              <Button 
                variant="outline"
                className="mt-4 w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCreateUser()
                }}
              >
                追加
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button 
            variant="ghost" 
            className="text-gray-600 hover:text-gray-800"
            onClick={() => toast.info('システム設定機能は後で実装予定です')}
          >
            <Settings className="w-4 h-4 mr-2" />
            システム設定
          </Button>
        </div>
      </div>
    </div>
  )
}