const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  try {
    // デフォルトユーザーの作成
    const defaultUser = await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        name: '管理者',
        role: 'admin',
        passcodeType: 'none'
      }
    })
    console.log('✅ Default user created:', defaultUser.name)

    // サンプル学級の作成
    const sampleClass = await prisma.class.upsert({
      where: { name: 'サンプル学級' },
      update: {},
      create: {
        name: 'サンプル学級',
        classCode: 'SAMPLE01',
        grade: 1,
        description: 'システム動作確認用のサンプル学級です',
        isVisible: true
      }
    })
    console.log('✅ Sample class created:', sampleClass.name)

    // サンプル生徒の作成
    const sampleStudents = [
      {
        studentId: 'STU001',
        lastName: '山田',
        firstName: '太郎',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'タロウ',
        enrollmentYear: new Date().getFullYear()
      },
      {
        studentId: 'STU002',
        lastName: '佐藤',
        firstName: '花子',
        lastNameKana: 'サトウ',
        firstNameKana: 'ハナコ',
        enrollmentYear: new Date().getFullYear()
      },
      {
        studentId: 'STU003',
        lastName: '田中',
        firstName: '次郎',
        lastNameKana: 'タナカ',
        firstNameKana: 'ジロウ',
        enrollmentYear: new Date().getFullYear()
      }
    ]

    for (const [index, studentData] of sampleStudents.entries()) {
      const student = await prisma.student.upsert({
        where: { studentId: studentData.studentId },
        update: {},
        create: studentData
      })

      // 学級への所属を作成
      await prisma.studentClassMembership.upsert({
        where: {
          studentId_classId_startDate: {
            studentId: student.id,
            classId: sampleClass.id,
            startDate: new Date()
          }
        },
        update: {},
        create: {
          studentId: student.id,
          classId: sampleClass.id,
          attendanceNumber: index + 1,
          startDate: new Date()
        }
      })
      
      console.log(`✅ Sample student created: ${student.lastName} ${student.firstName}`)
    }

    // サンプル小計グループの作成
    const mathSubtotalGroup = await prisma.subtotalGroup.upsert({
      where: { name: '数学小計グループ' },
      update: {},
      create: {
        name: '数学小計グループ'
      }
    })
    console.log('✅ Math subtotal group created:', mathSubtotalGroup.name)

    // サンプル小計項目の作成
    const mathSubtotals = [
      { name: '計算問題', order: 1 },
      { name: '文章題', order: 2 },
      { name: '図形問題', order: 3 }
    ]

    for (const subtotalData of mathSubtotals) {
      await prisma.subtotal.upsert({
        where: {
          subtotalGroupId_name: {
            subtotalGroupId: mathSubtotalGroup.id,
            name: subtotalData.name
          }
        },
        update: {},
        create: {
          ...subtotalData,
          subtotalGroupId: mathSubtotalGroup.id
        }
      })
      console.log(`✅ Math subtotal created: ${subtotalData.name}`)
    }

    // 国語小計グループの作成
    const japaneseSubtotalGroup = await prisma.subtotalGroup.upsert({
      where: { name: '国語小計グループ' },
      update: {},
      create: {
        name: '国語小計グループ'
      }
    })
    console.log('✅ Japanese subtotal group created:', japaneseSubtotalGroup.name)

    // 国語小計項目の作成
    const japaneseSubtotals = [
      { name: '漢字・語句', order: 1 },
      { name: '読解問題', order: 2 },
      { name: '作文・記述', order: 3 }
    ]

    for (const subtotalData of japaneseSubtotals) {
      await prisma.subtotal.upsert({
        where: {
          subtotalGroupId_name: {
            subtotalGroupId: japaneseSubtotalGroup.id,
            name: subtotalData.name
          }
        },
        update: {},
        create: {
          ...subtotalData,
          subtotalGroupId: japaneseSubtotalGroup.id
        }
      })
      console.log(`✅ Japanese subtotal created: ${subtotalData.name}`)
    }

    console.log('🎉 Database seed completed successfully!')

  } catch (error) {
    console.error('❌ Error during database seed:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed script failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })