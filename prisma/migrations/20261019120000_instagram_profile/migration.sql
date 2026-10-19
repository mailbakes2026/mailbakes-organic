-- CreateTable
CREATE TABLE "IgProfile" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "postsCount" INTEGER NOT NULL,
    "followersCount" INTEGER NOT NULL,
    "followingCount" INTEGER NOT NULL,
    "avatarId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IgHighlight" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "coverId" TEXT,

    CONSTRAINT "IgHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IgMedia" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IgProfile_avatarId_key" ON "IgProfile"("avatarId");

-- CreateIndex
CREATE UNIQUE INDEX "IgHighlight_coverId_key" ON "IgHighlight"("coverId");

-- CreateIndex
CREATE INDEX "IgHighlight_profileId_position_idx" ON "IgHighlight"("profileId", "position");

-- AddForeignKey
ALTER TABLE "IgProfile" ADD CONSTRAINT "IgProfile_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "IgMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IgHighlight" ADD CONSTRAINT "IgHighlight_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "IgProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IgHighlight" ADD CONSTRAINT "IgHighlight_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "IgMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
