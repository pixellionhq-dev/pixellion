/*
  Warnings:

  - You are about to drop the column `logo_url` on the `buyers` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `buyers` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `buyers` table. All the data in the column will be lost.
  - Added the required column `purchase_id` to the `pixels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brand_name` to the `purchases` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "buyers" DROP COLUMN "logo_url",
DROP COLUMN "name",
DROP COLUMN "url";

-- AlterTable
ALTER TABLE "pixels" ADD COLUMN     "purchase_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "brand_name" TEXT NOT NULL,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "url" TEXT;

-- CreateIndex
CREATE INDEX "pixels_purchase_id_idx" ON "pixels"("purchase_id");

-- AddForeignKey
ALTER TABLE "pixels" ADD CONSTRAINT "pixels_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
