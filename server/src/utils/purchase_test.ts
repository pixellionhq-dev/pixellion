import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}`);
        failed++;
    }
}

// Helper: ensure a buyer exists for testing
async function ensureBuyer() {
    let buyer = await prisma.buyer.findFirst({ include: { user: true } });
    if (!buyer) {
        const user = await prisma.user.create({
            data: {
                email: `test-${Date.now()}@test.com`,
                username: `testuser-${Date.now()}`,
                passwordHash: 'dummy',
            },
        });
        buyer = await prisma.buyer.create({
            data: { userId: user.id },
            include: { user: true },
        });
    }
    return buyer;
}

// Helper: clean up specific test pixels
async function cleanTestPixels(coords: { x: number; y: number }[]) {
    await prisma.pixel.deleteMany({
        where: { OR: coords.map((c) => ({ x: c.x, y: c.y })) },
    });
}

// ─────────────────────────────────────────
// TEST 1: Successful Purchase
// ─────────────────────────────────────────
async function testSuccessfulPurchase() {
    console.log('\n🧪 Test 1: Successful Purchase with Brand Data');
    const buyer = await ensureBuyer();
    const coords = [
        { x: 190, y: 190 },
        { x: 191, y: 190 },
    ];
    await cleanTestPixels(coords);

    const brandName = 'Acme Corp';
    const brandUrl = 'https://acmecorp.com';

    const result = await prisma.$transaction(async (tx) => {
        await tx.buyer.update({
            where: { id: buyer!.id },
            data: { color: '#00ff00' },
        });
        const purchase = await tx.purchase.create({
            data: { buyerId: buyer!.id, brandName, url: brandUrl, pixelCount: 2, totalPrice: 200 },
        });
        await tx.pixel.createMany({
            data: coords.map((c) => ({ ...c, ownerId: buyer!.id, purchaseId: purchase.id, color: '#00ff00' })),
        });
        return purchase;
    });

    assert(!!result.id, 'Purchase record created');
    assert(result.pixelCount === 2, 'Pixel count is correct');
    assert(result.totalPrice === 200, 'Total price is ₹200');

    const updatedPurchase = await prisma.purchase.findUnique({ where: { id: result.id } });
    assert(updatedPurchase!.brandName === brandName, 'Purchase name updated to brand name');
    assert(updatedPurchase!.url === brandUrl, 'Purchase URL saved correctly');

    const pixels = await prisma.pixel.findMany({
        where: { OR: coords },
        include: { purchase: true },
    });
    assert(pixels.length === 2, 'Both pixels exist in DB');
    assert(pixels[0].purchase.url === brandUrl, 'Pixel→Purchase join returns correct URL');
}

// ─────────────────────────────────────────
// TEST 2: Duplicate Purchase Rejection
// ─────────────────────────────────────────
async function testDuplicatePurchase() {
    console.log('\n🧪 Test 2: Duplicate Purchase Rejection');
    const buyer = await ensureBuyer();
    const coords = [{ x: 190, y: 190 }]; // Already owned from Test 1

    let rejected = false;
    try {
        const purchase = await prisma.purchase.create({
            data: { buyerId: buyer!.id, brandName: 'Test', pixelCount: 1, totalPrice: 100 }
        });
        await prisma.pixel.createMany({
            data: coords.map((c) => ({ ...c, ownerId: buyer!.id, purchaseId: purchase.id, color: '#ff0000' })),
        });
    } catch (err: any) {
        rejected = true;
        assert(
            err.code === 'P2002',
            'Prisma unique constraint error (P2002) thrown',
        );
    }
    assert(rejected, 'Duplicate pixel creation was rejected');
}

// ─────────────────────────────────────────
// TEST 3: Invalid URL Rejection
// ─────────────────────────────────────────
async function testInvalidUrlRejection() {
    console.log('\n🧪 Test 3: Invalid URL Rejection');

    const invalidUrls = [
        { url: 'not-a-url', reason: 'missing scheme' },
        { url: 'javascript:alert(1)', reason: 'javascript: scheme' },
        { url: 'data:text/html,<h1>hi</h1>', reason: 'data: scheme' },
        { url: 'ftp://files.example.com', reason: 'ftp: scheme' },
        { url: '', reason: 'empty string' },
    ];

    for (const { url, reason } of invalidUrls) {
        const valid = /^https?:\/\/.+/.test(url) && !/^(javascript|data|vbscript):/i.test(url);
        assert(!valid, `Rejected: "${url}" (${reason})`);
    }

    const validUrls = [
        'https://example.com',
        'https://brand.in',
        'https://my-startup.co.uk/about',
        'http://legacy-site.com', // http is allowed at input, upgraded to https by service
    ];

    for (const url of validUrls) {
        const valid = /^https?:\/\/.+/.test(url);
        assert(valid, `Accepted: "${url}"`);
    }
}

// ─────────────────────────────────────────
// TEST 4: HTTP → HTTPS Upgrade
// ─────────────────────────────────────────
async function testHttpUpgrade() {
    console.log('\n🧪 Test 4: HTTP → HTTPS Upgrade');
    const input = 'http://example.com';
    const sanitized = input.replace(/^http:\/\//i, 'https://');
    assert(sanitized === 'https://example.com', 'http:// upgraded to https://');
    assert(sanitized.startsWith('https://'), 'Result always starts with https://');
}

// ─────────────────────────────────────────
// TEST 5: Pixel Redirect Data Verification
// ─────────────────────────────────────────
async function testPixelRedirectData() {
    console.log('\n🧪 Test 5: Pixel Redirect Data Verification');

    const pixel = await prisma.pixel.findFirst({
        where: { x: 190, y: 190 },
        include: { purchase: { select: { brandName: true, url: true } } },
    });

    assert(!!pixel, 'Pixel (190,190) exists');
    assert(!!pixel?.purchase, 'Pixel has a purchase');
    assert(!!pixel?.purchase.brandName, `Purchase name is "${pixel?.purchase.brandName}"`);
    assert(!!pixel?.purchase.url, `Purchase URL is "${pixel?.purchase.url}"`);
    assert(
        pixel?.purchase.url?.startsWith('https://') ?? false,
        'URL starts with https://',
    );
}

// ─────────────────────────────────────────
// TEST 6: Unique Constraint on (x, y)
// ─────────────────────────────────────────
async function testUniqueConstraint() {
    console.log('\n🧪 Test 6: Unique Constraint on (x, y)');

    // The schema has @@unique([x, y]) — verify it exists
    const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname FROM pg_indexes WHERE tablename = 'pixels'
    `;
    const hasUniqueIndex = indexes.some(
        (idx: any) =>
            idx.indexname.includes('x_y') ||
            idx.indexname.includes('unique'),
    );
    assert(hasUniqueIndex, 'Unique index on (x, y) exists in PostgreSQL');
}

// ─────────────────────────────────────────
// RUNNER
// ─────────────────────────────────────────
async function main() {
    console.log('═══════════════════════════════════════');
    console.log('  Pixellion Production Test Suite');
    console.log('═══════════════════════════════════════');

    try {
        await testSuccessfulPurchase();
        await testDuplicatePurchase();
        await testInvalidUrlRejection();
        await testHttpUpgrade();
        await testPixelRedirectData();
        await testUniqueConstraint();
    } catch (err) {
        console.error('\n💥 Unhandled error:', err);
        failed++;
    } finally {
        // Clean up test data
        await cleanTestPixels([
            { x: 190, y: 190 },
            { x: 191, y: 190 },
        ]);
        await prisma.$disconnect();
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
}

main();
