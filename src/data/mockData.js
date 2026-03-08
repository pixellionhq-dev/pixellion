export const BOARD_SIZE = 80;

export const stats = {
    totalPixelsSold: 14_832,
    totalBuyers: 347,
    currentPixelPrice: 100,
    mostExpensivePixel: { price: 1_249.99, owner: 'Tesla', coords: '(40, 40)' },
    mostClicksToday: { brand: 'Spotify', clicks: 12_480 },
    newestBuyer: { brand: 'Notion', joinedAgo: '2 hours ago' },
    mostPixelsOwned: { brand: 'Apple', count: 1_024 },
};

export const leaderboard = [
    { rank: 1, brand: 'Apple', pixels: 1024, country: 'US', flag: '🇺🇸', color: '#0a0a0a' },
    { rank: 2, brand: 'Google', pixels: 896, country: 'US', flag: '🇺🇸', color: '#4285f4' },
    { rank: 3, brand: 'Samsung', pixels: 780, country: 'KR', flag: '🇰🇷', color: '#1428a0' },
    { rank: 4, brand: 'Microsoft', pixels: 650, country: 'US', flag: '🇺🇸', color: '#00a4ef' },
    { rank: 5, brand: 'Tesla', pixels: 512, country: 'US', flag: '🇺🇸', color: '#cc0000' },
    { rank: 6, brand: 'Spotify', pixels: 480, country: 'SE', flag: '🇸🇪', color: '#1db954' },
    { rank: 7, brand: 'Netflix', pixels: 420, country: 'US', flag: '🇺🇸', color: '#e50914' },
    { rank: 8, brand: 'Stripe', pixels: 384, country: 'US', flag: '🇺🇸', color: '#635bff' },
    { rank: 9, brand: 'Figma', pixels: 320, country: 'US', flag: '🇺🇸', color: '#f24e1e' },
    { rank: 10, brand: 'Shopify', pixels: 256, country: 'CA', flag: '🇨🇦', color: '#96bf48' },
];

export const buyers = [
    { brand: 'Apple', pixels: 1024, country: 'US', flag: '🇺🇸', color: '#0a0a0a', clicks: 45_200, joined: 'Jan 2024' },
    { brand: 'Google', pixels: 896, country: 'US', flag: '🇺🇸', color: '#4285f4', clicks: 38_100, joined: 'Jan 2024' },
    { brand: 'Samsung', pixels: 780, country: 'KR', flag: '🇰🇷', color: '#1428a0', clicks: 29_400, joined: 'Feb 2024' },
    { brand: 'Microsoft', pixels: 650, country: 'US', flag: '🇺🇸', color: '#00a4ef', clicks: 22_800, joined: 'Feb 2024' },
    { brand: 'Tesla', pixels: 512, country: 'US', flag: '🇺🇸', color: '#cc0000', clicks: 31_500, joined: 'Jan 2024' },
    { brand: 'Spotify', pixels: 480, country: 'SE', flag: '🇸🇪', color: '#1db954', clicks: 18_200, joined: 'Mar 2024' },
    { brand: 'Netflix', pixels: 420, country: 'US', flag: '🇺🇸', color: '#e50914', clicks: 27_600, joined: 'Feb 2024' },
    { brand: 'Stripe', pixels: 384, country: 'US', flag: '🇺🇸', color: '#635bff', clicks: 15_400, joined: 'Mar 2024' },
    { brand: 'Figma', pixels: 320, country: 'US', flag: '🇺🇸', color: '#f24e1e', clicks: 12_900, joined: 'Apr 2024' },
    { brand: 'Shopify', pixels: 256, country: 'CA', flag: '🇨🇦', color: '#96bf48', clicks: 11_100, joined: 'Mar 2024' },
    { brand: 'Notion', pixels: 210, country: 'US', flag: '🇺🇸', color: '#0a0a0a', clicks: 8_700, joined: 'May 2024' },
    { brand: 'Linear', pixels: 196, country: 'US', flag: '🇺🇸', color: '#5e6ad2', clicks: 7_500, joined: 'Apr 2024' },
    { brand: 'Vercel', pixels: 180, country: 'US', flag: '🇺🇸', color: '#0a0a0a', clicks: 9_200, joined: 'Apr 2024' },
    { brand: 'Revolut', pixels: 168, country: 'GB', flag: '🇬🇧', color: '#0075eb', clicks: 6_800, joined: 'May 2024' },
    { brand: 'Klarna', pixels: 144, country: 'SE', flag: '🇸🇪', color: '#ffb3c7', clicks: 5_400, joined: 'Jun 2024' },
    { brand: 'Wise', pixels: 128, country: 'GB', flag: '🇬🇧', color: '#9fe870', clicks: 4_900, joined: 'Jun 2024' },
    { brand: 'Canva', pixels: 112, country: 'AU', flag: '🇦🇺', color: '#00c4cc', clicks: 3_600, joined: 'Jul 2024' },
    { brand: 'Atlassian', pixels: 96, country: 'AU', flag: '🇦🇺', color: '#0052cc', clicks: 2_800, joined: 'Jul 2024' },
];

// Generate pixel ownership map
const pixelOwners = new Map();
function seedPixels() {
    const ownedBrands = [
        { brand: 'Apple', color: '#0a0a0a', country: 'US', clicks: 45200, startX: 10, startY: 10, w: 32, h: 32 },
        { brand: 'Google', color: '#4285f4', country: 'US', clicks: 38100, startX: 44, startY: 5, w: 28, h: 32 },
        { brand: 'Samsung', color: '#1428a0', country: 'KR', clicks: 29400, startX: 5, startY: 45, w: 26, h: 30 },
        { brand: 'Tesla', color: '#cc0000', country: 'US', clicks: 31500, startX: 34, startY: 42, w: 16, h: 32 },
        { brand: 'Spotify', color: '#1db954', country: 'SE', clicks: 18200, startX: 52, startY: 40, w: 24, h: 20 },
        { brand: 'Stripe', color: '#635bff', country: 'US', clicks: 15400, startX: 55, startY: 62, w: 16, h: 14 },
        { brand: 'Netflix', color: '#e50914', country: 'US', clicks: 27600, startX: 2, startY: 2, w: 6, h: 6 },
    ];

    ownedBrands.forEach(({ brand, color, country, clicks, startX, startY, w, h }) => {
        for (let y = startY; y < Math.min(startY + h, BOARD_SIZE); y++) {
            for (let x = startX; x < Math.min(startX + w, BOARD_SIZE); x++) {
                pixelOwners.set(`${x},${y}`, { brand, color, country, clicks });
            }
        }
    });
}
seedPixels();

export function getPixelOwner(x, y) {
    return pixelOwners.get(`${x},${y}`) || null;
}

export const countries = ['All', 'US', 'KR', 'SE', 'CA', 'GB', 'AU'];
