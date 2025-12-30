const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcrypt")

const prisma = new PrismaClient()

async function createTestUser() {
  try {
    const passwordHash = await bcrypt.hash("password123", 10)

    const user = await prisma.user.create({
      data: {
        username: "test_teacher",
        passwordHash,
        name: "テスト先生",
        role: "teacher",
      },
    })

    console.log("テストユーザーを作成しました:")
    console.log("ユーザー名: test_teacher")
    console.log("パスワード: password123")
    console.log("氏名:", user.name)
    console.log("ID:", user.id)
  } catch (error) {
    if (error.code === "P2002") {
      console.log('ユーザー名 "test_teacher" は既に使用されています')
    } else {
      console.error("エラー:", error)
    }
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser()
