const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function test() {
  console.log('Testing Prisma and Bcrypt...');
  const prisma = new PrismaClient();
  try {
    const count = await prisma.user.count();
    console.log('User count:', count);
    
    const hash = await bcrypt.hash('test', 10);
    console.log('Bcrypt hash:', hash);
    console.log('Test Passed');
  } catch (e) {
    console.error('Test Failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
