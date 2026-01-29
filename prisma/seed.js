const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log("Starting seed...")
  
  // 1. Clean up
  try {
    await prisma.saleItem.deleteMany()
    await prisma.sale.deleteMany()
    await prisma.inventoryLog.deleteMany()
    await prisma.product.deleteMany()
    await prisma.user.deleteMany()
    await prisma.shop.deleteMany()
    console.log("Cleaned up database.")
  } catch (e) {
    console.log("Cleanup failed (maybe empty db):", e.message)
  }

  // 2. Create Master Admin (System Owner)
  const masterPassword = await bcrypt.hash('admin123', 10)
  const master = await prisma.user.create({
    data: {
      username: 'admin',
      password: masterPassword,
      name: 'Master Admin',
      role: 'MASTER',
      shopId: null // Masters don't belong to a specific shop
    }
  })
  console.log("Created Master Admin.")

  // 3. Create a Demo Shop
  const shop = await prisma.shop.create({
    data: {
      name: 'Downtown Store',
      address: '123 Main St'
    }
  })
  console.log("Created Shop:", shop.name)

  // 4. Create Shop Admin (Owner of this shop)
  const managerPassword = await bcrypt.hash('123', 10)
  await prisma.user.create({
    data: {
      username: 'manager',
      password: managerPassword,
      name: 'Shop Manager',
      role: 'ADMIN',
      shopId: shop.id
    }
  })
  console.log("Created Shop Manager.")

  // 5. Create Cashier
  const cashierPassword = await bcrypt.hash('123', 10)
  await prisma.user.create({
    data: {
      username: 'cashier',
      password: cashierPassword,
      name: 'Jane Doe',
      role: 'CASHIER',
      shopId: shop.id
    }
  })
  console.log("Created Cashier.")

  console.log("Seeding finished.")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
