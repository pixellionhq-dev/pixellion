import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BRANDS = [
    { name: 'Apple', country: 'US', flag: '🇺🇸', color: '#0a0a0a', email: 'admin@apple.com' },
    { name: 'Google', country: 'US', flag: '🇺🇸', color: '#4285f4', email: 'admin@google.com' },
    { name: 'Samsung', country: 'KR', flag: '🇰🇷', color: '#1428a0', email: 'admin@samsung.com' },
    { name: 'Microsoft', country: 'US', flag: '🇺🇸', color: '#00a4ef', email: 'admin@microsoft.com' },
    { name: 'Tesla', country: 'US', flag: '🇺🇸', color: '#cc0000', email: 'admin@tesla.com' },
    { name: 'Spotify', country: 'SE', flag: '🇸🇪', color: '#1db954', email: 'admin@spotify.com' },
    { name: 'Netflix', country: 'US', flag: '🇺🇸', color: '#e50914', email: 'admin@netflix.com' },
    { name: 'Stripe', country: 'US', flag: '🇺🇸', color: '#635bff', email: 'admin@stripe.com' },
    { name: 'Figma', country: 'US', flag: '🇺🇸', color: '#f24e1e', email: 'admin@figma.com' },
    { name: 'Shopify', country: 'CA', flag: '🇨🇦', color: '#96bf48', email: 'admin@shopify.com' },
];

// Define pixel blocks for each brand
const PIXEL_BLOCKS: { brand: string; startX: number; startY: number; w: number; h: number }[] = [
    { brand: 'Apple', startX: 20, startY: 20, w: 40, h: 40 },
    { brand: 'Google', startX: 70, startY: 10, w: 35, h: 40 },
    { brand: 'Samsung', startX: 10, startY: 70, w: 35, h: 35 },
    { brand: 'Tesla', startX: 55, startY: 60, w: 25, h: 35 },
    { brand: 'Spotify', startX: 110, startY: 30, w: 30, h: 30 },
    { brand: 'Netflix', startX: 5, startY: 5, w: 12, h: 12 },
    { brand: 'Stripe', startX: 120, startY: 80, w: 25, h: 20 },
    { brand: 'Microsoft', startX: 85, startY: 55, w: 20, h: 30 },
    { brand: 'Figma', startX: 150, startY: 20, w: 20, h: 25 },
    { brand: 'Shopify', startX: 150, startY: 60, w: 22, h: 18 },
];

async function main() {
    console.log('🌱 Seeding database...');

    // Clean existing data
    await prisma.purchase.deleteMany();
    await prisma.pixel.deleteMany();
    await prisma.buyer.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('password123', 12);

    for (const brand of BRANDS) {
        console.log(`  Creating ${brand.name}...`);

        const user = await prisma.user.create({
            data: {
                email: brand.email,
                username: brand.name.toLowerCase(),
                passwordHash,
            },
        });

        const buyer = await prisma.buyer.create({
            data: {
                country: brand.country,
                flag: brand.flag,
                color: brand.color,
                userId: user.id,
            },
        });

        // Pixel ownership generation removed. 
        // Real pixels are only created during actual purchases.
    }

    // Create a demo user for testing
    const demoUser = await prisma.user.create({
        data: {
            email: 'demo@pixellion.com',
            username: 'demo',
            passwordHash,
        },
    });
    await prisma.buyer.create({
        data: {
            country: 'US',
            flag: '🇺🇸',
            color: '#3b82f6',
            userId: demoUser.id,
        },
    });
    console.log('  Created demo user (demo@pixellion.com / password123)');

    const totalPixels = await prisma.pixel.count();
    const totalBuyers = await prisma.buyer.count();
    console.log(`\n✅ Seeding complete: ${totalPixels} pixels, ${totalBuyers} buyers`);
}

main()
    .catch((e) => {
        console.error('Seed error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
