const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');
  
  try {
      // 1. Clean up
      await prisma.$transaction([
        prisma.saleItem.deleteMany(),
        prisma.sale.deleteMany(),
        prisma.inventoryLog.deleteMany(),
        prisma.product.deleteMany(),
        prisma.user.deleteMany(),
        prisma.shop.deleteMany(),
      ]);

      console.log('Cleaned up database');

      // 2. Create Master Admin (System Owner)
      const masterPassword = await bcrypt.hash('admin123', 10);
      const master = await prisma.user.create({
        data: {
          username: 'admin',
          password: masterPassword,
          name: 'Master Admin',
          role: 'MASTER',
          shopId: null 
        }
      });
      console.log('Created Master:', master.username);

      // 3. Create a Demo Shop
      const shop = await prisma.shop.create({
        data: {
          name: 'Downtown Store',
          address: '123 Main St'
        }
      });
      console.log('Created Shop:', shop.name);

      // 4. Create Shop Admin (Owner of this shop)
      const managerPassword = await bcrypt.hash('123', 10);
      const manager = await prisma.user.create({
        data: {
          username: 'manager',
          password: managerPassword,
          name: 'Shop Manager',
          role: 'ADMIN',
          shopId: shop.id
        }
      });
      console.log('Created Manager:', manager.username);

      // 5. Create Cashier
      const cashierPassword = await bcrypt.hash('123', 10);
      const cashier = await prisma.user.create({
        data: {
          username: 'cashier',
          password: cashierPassword,
          name: 'Jane Doe',
          role: 'CASHIER',
          shopId: shop.id
        }
      });
      console.log('Created Cashier:', cashier.username);
      console.log('Seeding completed successfully.');

  } catch (e) {
      console.error('Seeding failed:', e);
      process.exit(1);
  } finally {
      await prisma.$disconnect();
  }
}

main();
