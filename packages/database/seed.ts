import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // 店舗作成
  const shop = await prisma.shop.upsert({
    where: { id: 'shop-demo' },
    update: {},
    create: {
      id: 'shop-demo',
      name: '山田自動車整備工場',
      slug: 'shop-demo',
      address: '東京都渋谷区代々木1-1-1',
      phone: '03-1234-5678',
      email: 'info@yamada-garage.example.com',
      openTime: '08:00',
      closeTime: '20:00',
      taxRegistrationNo: 'T0000000000001',
    },
  })

  console.log(`✅ Shop: ${shop.name}`)

  // 管理者ユーザー
  const adminPassword = await bcrypt.hash('admin1234', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      shopId: shop.id,
      email: 'admin@example.com',
      passwordHash: adminPassword,
      name: '山田 太郎',
      role: UserRole.ADMIN,
    },
  })

  console.log(`✅ Admin: ${admin.email}`)

  // 受付ユーザー
  const receptionistPassword = await bcrypt.hash('reception1234', 12)
  const receptionist = await prisma.user.upsert({
    where: { email: 'reception@example.com' },
    update: {},
    create: {
      shopId: shop.id,
      email: 'reception@example.com',
      passwordHash: receptionistPassword,
      name: '鈴木 花子',
      role: UserRole.RECEPTIONIST,
    },
  })

  console.log(`✅ Receptionist: ${receptionist.email}`)

  // 整備士ユーザー × 3
  const mechanicColors = ['#3B82F6', '#10B981', '#F59E0B']
  const mechanicData = [
    { name: '田中 一郎', email: 'mechanic1@example.com' },
    { name: '佐藤 次郎', email: 'mechanic2@example.com' },
    { name: '渡辺 三郎', email: 'mechanic3@example.com' },
  ]

  const mechanics = []
  for (let i = 0; i < mechanicData.length; i++) {
    const pw = await bcrypt.hash('mechanic1234', 12)
    const user = await prisma.user.upsert({
      where: { email: mechanicData[i].email },
      update: {},
      create: {
        shopId: shop.id,
        email: mechanicData[i].email,
        passwordHash: pw,
        name: mechanicData[i].name,
        role: UserRole.MECHANIC,
      },
    })
    const mechanic = await prisma.mechanic.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        shopId: shop.id,
        userId: user.id,
        name: mechanicData[i].name,
        color: mechanicColors[i],
      },
    })
    mechanics.push(mechanic)
  }

  console.log(`✅ Mechanics: ${mechanics.length}名`)

  // 整備メニュー
  const serviceData = [
    { name: '車検', durationMin: 180, basePrice: 80000 },
    { name: '12ヶ月点検', durationMin: 90, basePrice: 15000 },
    { name: '6ヶ月点検', durationMin: 60, basePrice: 8000 },
    { name: 'オイル交換', durationMin: 30, basePrice: 4000 },
    { name: 'タイヤ交換（4本）', durationMin: 60, basePrice: 10000 },
    { name: 'バッテリー交換', durationMin: 30, basePrice: 8000 },
    { name: 'エアコン点検・補充', durationMin: 45, basePrice: 5000 },
    { name: 'ブレーキパッド交換', durationMin: 60, basePrice: 20000 },
  ]

  for (const s of serviceData) {
    await prisma.service.upsert({
      where: { id: `service-${s.name}` },
      update: {},
      create: {
        id: `service-${s.name}`,
        shopId: shop.id,
        name: s.name,
        durationMin: s.durationMin,
        basePrice: s.basePrice,
      },
    })
  }

  console.log(`✅ Services: ${serviceData.length}件`)

  // サンプル顧客
  const customer = await prisma.customer.upsert({
    where: { id: 'customer-demo' },
    update: {},
    create: {
      id: 'customer-demo',
      shopId: shop.id,
      name: '東京 一郎',
      kana: 'トウキョウ イチロウ',
      phone: '090-1234-5678',
      email: 'customer@example.com',
    },
  })

  // サンプル車両
  await prisma.vehicle.upsert({
    where: { id: 'vehicle-demo' },
    update: {},
    create: {
      id: 'vehicle-demo',
      shopId: shop.id,
      customerId: customer.id,
      plateNumber: '品川 500 あ 1234',
      make: 'トヨタ',
      model: 'プリウス',
      year: 2020,
      color: 'ホワイト',
      inspectionDate: new Date('2027-03-31'),
      lastMileage: 45000,
    },
  })

  // セルフ予約トークン（デモ用）
  await prisma.reservationToken.upsert({
    where: { id: 'token-demo' },
    update: {},
    create: {
      id: 'token-demo',
      shopId: shop.id,
      token: 'demo-public-token',
      label: 'ホームページ用',
    },
  })

  console.log('✅ Sample customer, vehicle, and booking token created')
  console.log('')
  console.log('─────────────────────────────────────')
  console.log('🎉 Seed complete!')
  console.log('  admin@example.com / admin1234')
  console.log('  reception@example.com / reception1234')
  console.log('  mechanic1@example.com / mechanic1234')
  console.log('─────────────────────────────────────')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
