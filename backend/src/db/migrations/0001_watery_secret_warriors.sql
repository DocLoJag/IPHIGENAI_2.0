CREATE TABLE "tutor_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"tutor_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutor_notes" ADD CONSTRAINT "tutor_notes_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_notes" ADD CONSTRAINT "tutor_notes_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutor_notes_student_recent" ON "tutor_notes" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "tutor_notes_tutor_student" ON "tutor_notes" USING btree ("tutor_id","student_id");