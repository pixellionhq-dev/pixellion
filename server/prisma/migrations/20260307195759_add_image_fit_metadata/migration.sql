-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "fit_mode" TEXT NOT NULL DEFAULT 'cover',
ADD COLUMN     "image_height" INTEGER,
ADD COLUMN     "image_width" INTEGER;
