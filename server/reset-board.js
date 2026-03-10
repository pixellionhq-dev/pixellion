/**
 * reset-board.js
 * Clears all pixels and purchases from the database.
 * Users/Buyers accounts are kept intact.
 *
 * Usage:
 *   DATABASE_URL="your-render-postgres-url" node reset-board.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('⏳ Deleting all pixels...');
    const pixelCount = await prisma.pixel.deleteMany({});
    console.log(`✅ Deleted ${pixelCount.count} pixels`);

    console.log('⏳ Deleting all purchases...');
    const purchaseCount = await prisma.purchase.deleteMany({});
    console.log(`✅ Deleted ${purchaseCount.count} purchases`);

    console.log('');
    console.log('🎉 Board reset complete! All users/accounts are still intact.');
    console.log('   New purchases will now upload logos to Cloudflare R2.');
}

main()
    .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
