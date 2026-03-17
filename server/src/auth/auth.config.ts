export const getJwtConfig = () => ({
    secret: process.env.JWT_SECRET || 'pixellion-jwt-secret-key-change-in-production-2024',
    expiresIn: process.env.JWT_EXPIRES || '7d',
});
