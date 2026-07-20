CREATE TABLE "tax_return" (
	"id" text PRIMARY KEY,
	"form" text NOT NULL,
	"tax_year" integer NOT NULL,
	"period" text NOT NULL,
	"filed_on" text NOT NULL,
	"revision" integer NOT NULL,
	"status" text NOT NULL,
	"commodity" text NOT NULL,
	"note" text,
	"source_path" text,
	"source_sha256" text,
	"created_at" text NOT NULL,
	CONSTRAINT "tax_return_form_enum" CHECK ("form" IN ('kr_global_income','kr_vat')),
	CONSTRAINT "tax_return_period_enum" CHECK ("period" IN ('annual','H1_provisional','H1_final','H2_provisional','H2_final')),
	CONSTRAINT "tax_return_status_enum" CHECK ("status" IN ('current','superseded')),
	CONSTRAINT "tax_return_revision_positive" CHECK ("revision" >= 1),
	CONSTRAINT "tax_return_year_range" CHECK ("tax_year" BETWEEN 2000 AND 2100)
);
--> statement-breakpoint
CREATE TABLE "tax_return_line" (
	"return_id" text,
	"column_key" text,
	"line_key" text,
	"value_kind" text NOT NULL,
	"value_scaled" bigint NOT NULL,
	CONSTRAINT "tax_return_line_pk" PRIMARY KEY("return_id","column_key","line_key"),
	CONSTRAINT "tax_return_line_value_kind_enum" CHECK ("value_kind" IN ('amount','rate'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tax_return_unique" ON "tax_return" ("form","tax_year","period","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_return_one_current" ON "tax_return" ("form","tax_year","period") WHERE "status" = 'current';--> statement-breakpoint
CREATE INDEX "tax_return_by_year" ON "tax_return" ("tax_year");--> statement-breakpoint
CREATE INDEX "tax_return_by_form_year" ON "tax_return" ("form","tax_year");--> statement-breakpoint
ALTER TABLE "tax_return" ADD CONSTRAINT "tax_return_commodity_commodity_code_fkey" FOREIGN KEY ("commodity") REFERENCES "commodity"("code");--> statement-breakpoint
ALTER TABLE "tax_return_line" ADD CONSTRAINT "tax_return_line_return_id_tax_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "tax_return"("id") ON DELETE CASCADE;