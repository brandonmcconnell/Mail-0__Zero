CREATE TABLE "mail0_subscription_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"message_id" text NOT NULL,
	"received_at" timestamp NOT NULL,
	"subject" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail0_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"sender_email" text NOT NULL,
	"sender_name" text,
	"sender_domain" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"list_unsubscribe_url" text,
	"list_unsubscribe_post" text,
	"last_email_received_at" timestamp NOT NULL,
	"email_count" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_unsubscribed_at" timestamp,
	"auto_archive" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_connection_sender_unique" UNIQUE("connection_id","sender_email")
);
--> statement-breakpoint
ALTER TABLE "mail0_account" DROP CONSTRAINT "mail0_account_user_id_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_connection" DROP CONSTRAINT "mail0_connection_user_id_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_session" DROP CONSTRAINT "mail0_session_user_id_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_user_hotkeys" DROP CONSTRAINT "mail0_user_hotkeys_user_id_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_user_settings" DROP CONSTRAINT "mail0_user_settings_user_id_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_user_settings" ALTER COLUMN "settings" SET DEFAULT '{"language":"en","timezone":"UTC","dynamicContent":false,"externalImages":true,"customPrompt":"","trustedSenders":[],"isOnboarded":false,"colorTheme":"system","zeroSignature":true,"autoRead":true,"defaultEmailAlias":"","categories":[{"id":"Important","name":"Important","searchValue":"is:important NOT is:sent NOT is:draft","order":0,"icon":"Lightning","isDefault":false},{"id":"All Mail","name":"All Mail","searchValue":"NOT is:draft (is:inbox OR (is:sent AND to:me))","order":1,"icon":"Mail","isDefault":true},{"id":"Personal","name":"Personal","searchValue":"is:personal NOT is:sent NOT is:draft","order":2,"icon":"User","isDefault":false},{"id":"Promotions","name":"Promotions","searchValue":"is:promotions NOT is:sent NOT is:draft","order":3,"icon":"Tag","isDefault":false},{"id":"Updates","name":"Updates","searchValue":"is:updates NOT is:sent NOT is:draft","order":4,"icon":"Bell","isDefault":false},{"id":"Unread","name":"Unread","searchValue":"is:unread NOT is:sent NOT is:draft","order":5,"icon":"ScanEye","isDefault":false}],"imageCompression":"medium","animations":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "mail0_subscription_threads" ADD CONSTRAINT "mail0_subscription_threads_subscription_id_mail0_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."mail0_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_subscriptions" ADD CONSTRAINT "mail0_subscriptions_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_subscriptions" ADD CONSTRAINT "mail0_subscriptions_connection_id_mail0_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_threads_subscription_id_idx" ON "mail0_subscription_threads" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_threads_thread_id_idx" ON "mail0_subscription_threads" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "subscription_threads_received_at_idx" ON "mail0_subscription_threads" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "mail0_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_connection_id_idx" ON "mail0_subscriptions" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "subscriptions_sender_email_idx" ON "mail0_subscriptions" USING btree ("sender_email");--> statement-breakpoint
CREATE INDEX "subscriptions_sender_domain_idx" ON "mail0_subscriptions" USING btree ("sender_domain");--> statement-breakpoint
CREATE INDEX "subscriptions_category_idx" ON "mail0_subscriptions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "subscriptions_is_active_idx" ON "mail0_subscriptions" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "mail0_account" ADD CONSTRAINT "mail0_account_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_connection" ADD CONSTRAINT "mail0_connection_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_session" ADD CONSTRAINT "mail0_session_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_summary" ADD CONSTRAINT "mail0_summary_connection_id_mail0_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_user_hotkeys" ADD CONSTRAINT "mail0_user_hotkeys_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_user_settings" ADD CONSTRAINT "mail0_user_settings_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "mail0_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_user_id_idx" ON "mail0_account" USING btree ("provider_id","user_id");--> statement-breakpoint
CREATE INDEX "account_expires_at_idx" ON "mail0_account" USING btree ("access_token_expires_at");--> statement-breakpoint
CREATE INDEX "connection_user_id_idx" ON "mail0_connection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "connection_expires_at_idx" ON "mail0_connection" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "connection_provider_id_idx" ON "mail0_connection" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "early_access_is_early_access_idx" ON "mail0_early_access" USING btree ("is_early_access");--> statement-breakpoint
CREATE INDEX "jwks_created_at_idx" ON "mail0_jwks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "note_user_id_idx" ON "mail0_note" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_thread_id_idx" ON "mail0_note" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "note_user_thread_idx" ON "mail0_note" USING btree ("user_id","thread_id");--> statement-breakpoint
CREATE INDEX "note_is_pinned_idx" ON "mail0_note" USING btree ("is_pinned");--> statement-breakpoint
CREATE INDEX "oauth_access_token_user_id_idx" ON "mail0_oauth_access_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_access_token_client_id_idx" ON "mail0_oauth_access_token" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_access_token_expires_at_idx" ON "mail0_oauth_access_token" USING btree ("access_token_expires_at");--> statement-breakpoint
CREATE INDEX "oauth_application_user_id_idx" ON "mail0_oauth_application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_application_disabled_idx" ON "mail0_oauth_application" USING btree ("disabled");--> statement-breakpoint
CREATE INDEX "oauth_consent_user_id_idx" ON "mail0_oauth_consent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_consent_client_id_idx" ON "mail0_oauth_consent" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_consent_given_idx" ON "mail0_oauth_consent" USING btree ("consent_given");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "mail0_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "mail0_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "summary_connection_id_idx" ON "mail0_summary" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "summary_connection_id_saved_idx" ON "mail0_summary" USING btree ("connection_id","saved");--> statement-breakpoint
CREATE INDEX "summary_saved_idx" ON "mail0_summary" USING btree ("saved");--> statement-breakpoint
CREATE INDEX "user_hotkeys_shortcuts_idx" ON "mail0_user_hotkeys" USING btree ("shortcuts");--> statement-breakpoint
CREATE INDEX "user_settings_settings_idx" ON "mail0_user_settings" USING btree ("settings");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "mail0_verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "mail0_verification" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "writing_style_matrix_style_idx" ON "mail0_writing_style_matrix" USING btree ("style");