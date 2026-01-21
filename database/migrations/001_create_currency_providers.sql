-- Migration: Create currency_providers table
-- Created: 2026-01-22 for currency-provider priority feature

CREATE TABLE IF NOT EXISTS "currency_providers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "currency_code" varchar(10) NOT NULL,
    "provider_id" uuid NOT NULL,
    "priority" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT NOW(),
    "updated_at" timestamp with time zone DEFAULT NOW(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "currency_providers_currency_provider_unique" UNIQUE ("currency_code", "provider_id")
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS "currency_providers_currency_idx" ON "currency_providers" ("currency_code");
CREATE INDEX IF NOT EXISTS "currency_providers_provider_idx" ON "currency_providers" ("provider_id");

-- Add foreign key constraints (will fail if tables don't exist, which is fine for fresh setup)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'currencies') THEN
        ALTER TABLE "currency_providers" ADD CONSTRAINT "currency_providers_currency_fk" 
            FOREIGN KEY ("currency_code") REFERENCES "currencies" ("code") ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'providers') THEN
        ALTER TABLE "currency_providers" ADD CONSTRAINT "currency_providers_provider_fk" 
            FOREIGN KEY ("provider_id") REFERENCES "providers" ("id") ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;
