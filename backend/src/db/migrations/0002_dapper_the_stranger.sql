CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "activity_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"source_session_id" text,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"subject" text NOT NULL,
	"title" text NOT NULL,
	"kicker" text,
	"estimated_minutes" integer,
	"priority" integer DEFAULT 100 NOT NULL,
	"scheduled_for" timestamp with time zone,
	"rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"created_activity_id" text,
	"rejection_reason" text
);
--> statement-breakpoint
ALTER TABLE "activity_proposals" ADD CONSTRAINT "activity_proposals_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_proposals" ADD CONSTRAINT "activity_proposals_source_session_id_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_proposals" ADD CONSTRAINT "activity_proposals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_proposals" ADD CONSTRAINT "activity_proposals_created_activity_id_activities_id_fk" FOREIGN KEY ("created_activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_proposals_student_status" ON "activity_proposals" USING btree ("student_id","status","created_at");--> statement-breakpoint
CREATE INDEX "activity_proposals_status_recent" ON "activity_proposals" USING btree ("status","created_at");