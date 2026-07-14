-- Remove retained source-data columns. Statement PDFs and extracted raw text
-- are processed only in memory and are not recoverable after import.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Statement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "errorMessage" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Statement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Statement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Statement" ("accountId", "errorMessage", "fileName", "id", "mimeType", "periodEnd", "periodStart", "status", "uploadedAt", "userId")
SELECT "accountId", "errorMessage", "fileName", "id", "mimeType", "periodEnd", "periodStart", "status", "uploadedAt", "userId"
FROM "Statement";

DROP TABLE "Statement";
ALTER TABLE "new_Statement" RENAME TO "Statement";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
