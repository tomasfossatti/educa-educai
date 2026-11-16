-- CreateTable
CREATE TABLE "LmsExtensionLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "codeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "keyHash" TEXT,
    "linkedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsExtensionLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LmsExtensionLink_userId_key" ON "LmsExtensionLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LmsExtensionLink_codeHash_key" ON "LmsExtensionLink"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "LmsExtensionLink_keyHash_key" ON "LmsExtensionLink"("keyHash");

-- AddForeignKey
ALTER TABLE "LmsExtensionLink" ADD CONSTRAINT "LmsExtensionLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
