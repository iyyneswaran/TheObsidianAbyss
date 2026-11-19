-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('COINS', 'GEMS');

-- CreateEnum
CREATE TYPE "LedgerReason" AS ENUM ('RUN_VICTORY_COINS', 'RUN_VICTORY_GEMS', 'RUN_DEFEAT_COINS', 'QUEST_REWARD', 'STORE_PURCHASE');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('VICTORY', 'DEFEAT');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('SURVIVED', 'DEAD', 'FORFEITED');

-- CreateTable
CREATE TABLE "PlayerAccount" (
    "id" UUID NOT NULL,
    "username" VARCHAR(24) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" UUID NOT NULL,
    "accountId" UUID,
    "guestId" UUID,
    "displayName" VARCHAR(24) NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "victories" INTEGER NOT NULL DEFAULT 0,
    "defeats" INTEGER NOT NULL DEFAULT 0,
    "monsters" INTEGER NOT NULL DEFAULT 0,
    "damage" BIGINT NOT NULL DEFAULT 0,
    "healing" BIGINT NOT NULL DEFAULT 0,
    "mitigation" BIGINT NOT NULL DEFAULT 0,
    "wizard" VARCHAR(12) NOT NULL DEFAULT 'fire',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSession" (
    "tokenHash" CHAR(64) NOT NULL,
    "accountId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PlayerSession_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "profileId" UUID NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "gems" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "LedgerReason" NOT NULL,
    "source" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunResult" (
    "id" UUID NOT NULL,
    "partyId" VARCHAR(24) NOT NULL,
    "outcome" "Outcome" NOT NULL,
    "rosterSize" INTEGER NOT NULL,
    "rewardVersion" INTEGER NOT NULL,
    "qualifies" BOOLEAN NOT NULL,
    "monsters" INTEGER NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3) NOT NULL,
    "settledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunParticipant" (
    "runId" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "profileId" UUID,
    "wizard" VARCHAR(12) NOT NULL,
    "status" "ParticipantStatus" NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "damage" INTEGER NOT NULL,
    "healing" INTEGER NOT NULL,
    "mitigation" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "gems" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,

    CONSTRAINT "RunParticipant_pkey" PRIMARY KEY ("runId","slot")
);

-- CreateTable
CREATE TABLE "OwnedAbility" (
    "profileId" UUID NOT NULL,
    "abilityId" VARCHAR(48) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnedAbility_pkey" PRIMARY KEY ("profileId","abilityId")
);

-- CreateTable
CREATE TABLE "EquippedLoadout" (
    "profileId" UUID NOT NULL,
    "wizard" VARCHAR(12) NOT NULL,
    "skill3" VARCHAR(48),
    "ultimate" VARCHAR(48),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "EquippedLoadout_pkey" PRIMARY KEY ("profileId","wizard")
);

-- CreateTable
CREATE TABLE "StorePurchase" (
    "profileId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "abilityId" VARCHAR(48) NOT NULL,
    "currency" "Currency" NOT NULL,
    "price" INTEGER NOT NULL,
    "ledgerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorePurchase_pkey" PRIMARY KEY ("profileId","requestKey")
);

-- CreateTable
CREATE TABLE "QuestProgress" (
    "profileId" UUID NOT NULL,
    "instanceId" VARCHAR(64) NOT NULL,
    "progress" INTEGER NOT NULL,
    "deadline" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("profileId","instanceId")
);

-- CreateTable
CREATE TABLE "QuestClaim" (
    "profileId" UUID NOT NULL,
    "instanceId" VARCHAR(64) NOT NULL,
    "ledgerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestClaim_pkey" PRIMARY KEY ("profileId","instanceId")
);

-- CreateTable
CREATE TABLE "ProcessedGameEvent" (
    "id" VARCHAR(100) NOT NULL,
    "runId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedGameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogEntry" (
    "id" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "CatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAccount_username_key" ON "PlayerAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_accountId_key" ON "PlayerProfile"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_guestId_key" ON "PlayerProfile"("guestId");

-- CreateIndex
CREATE INDEX "PlayerSession_accountId_expiresAt_idx" ON "PlayerSession"("accountId", "expiresAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_profileId_createdAt_idx" ON "WalletTransaction"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_profileId_currency_reason_source_key" ON "WalletTransaction"("profileId", "currency", "reason", "source");

-- CreateIndex
CREATE INDEX "RunParticipant_profileId_runId_idx" ON "RunParticipant"("profileId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "RunParticipant_runId_profileId_key" ON "RunParticipant"("runId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "StorePurchase_ledgerId_key" ON "StorePurchase"("ledgerId");

-- CreateIndex
CREATE UNIQUE INDEX "StorePurchase_profileId_abilityId_key" ON "StorePurchase"("profileId", "abilityId");

-- CreateIndex
CREATE INDEX "QuestProgress_profileId_deadline_idx" ON "QuestProgress"("profileId", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "QuestClaim_ledgerId_key" ON "QuestClaim"("ledgerId");

-- CreateIndex
CREATE INDEX "ProcessedGameEvent_runId_idx" ON "ProcessedGameEvent"("runId");

-- CreateIndex
CREATE INDEX "ProcessedGameEvent_profileId_createdAt_idx" ON "ProcessedGameEvent"("profileId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PlayerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSession" ADD CONSTRAINT "PlayerSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PlayerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunParticipant" ADD CONSTRAINT "RunParticipant_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RunResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunParticipant" ADD CONSTRAINT "RunParticipant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnedAbility" ADD CONSTRAINT "OwnedAbility_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquippedLoadout" ADD CONSTRAINT "EquippedLoadout_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePurchase" ADD CONSTRAINT "StorePurchase_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePurchase" ADD CONSTRAINT "StorePurchase_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "WalletTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestClaim" ADD CONSTRAINT "QuestClaim_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestClaim" ADD CONSTRAINT "QuestClaim_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "WalletTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedGameEvent" ADD CONSTRAINT "ProcessedGameEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlayerProfile"
  ADD CONSTRAINT "profile_one_identity" CHECK (("accountId" IS NULL) <> ("guestId" IS NULL)),
  ADD CONSTRAINT "profile_nonnegative_totals" CHECK ("xp" >= 0 AND "victories" >= 0 AND "defeats" >= 0 AND "monsters" >= 0 AND "damage" >= 0 AND "healing" >= 0 AND "mitigation" >= 0);
ALTER TABLE "Wallet"
  ADD CONSTRAINT "wallet_nonnegative" CHECK ("coins" >= 0 AND "gems" >= 0);
ALTER TABLE "WalletTransaction"
  ADD CONSTRAINT "ledger_amount_reason" CHECK (
    ("reason" = 'STORE_PURCHASE' AND "amount" < 0)
    OR ("reason" = 'RUN_VICTORY_GEMS' AND "currency" = 'GEMS' AND "amount" > 0)
    OR ("reason" IN ('RUN_VICTORY_COINS', 'RUN_DEFEAT_COINS', 'QUEST_REWARD') AND "currency" = 'COINS' AND "amount" > 0)
  );
ALTER TABLE "RunResult"
  ADD CONSTRAINT "run_valid_roster" CHECK ("rosterSize" BETWEEN 1 AND 4 AND "endedAt" >= "startedAt");
ALTER TABLE "RunParticipant"
  ADD CONSTRAINT "participant_valid_rewards" CHECK ("slot" BETWEEN 0 AND 3 AND "coins" >= 0 AND "gems" >= 0 AND "xp" >= 0 AND ("eligible" OR ("coins" = 0 AND "gems" = 0 AND "xp" = 0)));
ALTER TABLE "QuestProgress"
  ADD CONSTRAINT "quest_nonnegative_progress" CHECK ("progress" >= 0);
