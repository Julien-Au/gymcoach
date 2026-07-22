CREATE TABLE "McpAccessToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "McpAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "McpAccessToken_tokenHash_key" ON "McpAccessToken"("tokenHash");
CREATE INDEX "McpAccessToken_userId_createdAt_idx" ON "McpAccessToken"("userId", "createdAt");

ALTER TABLE "McpAccessToken"
ADD CONSTRAINT "McpAccessToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
