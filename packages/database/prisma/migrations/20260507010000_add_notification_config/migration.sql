-- CreateTable
CREATE TABLE "notification_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "discord_webhook" TEXT,
    "telegram_bot_token" TEXT,
    "telegram_chat_id" TEXT,
    "webhook_url" TEXT,
    "webhook_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_configs_organization_id_key" ON "notification_configs"("organization_id");

-- AddForeignKey
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
