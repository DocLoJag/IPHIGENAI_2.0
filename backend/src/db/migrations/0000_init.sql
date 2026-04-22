CREATE TYPE "public"."activity_kind" AS ENUM('review', 'guided-reading', 'quick-test', 'analysis', 'writing', 'exercise-set', 'reading');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('student', 'tutor');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."topic_state" AS ENUM('consolidated', 'working-on', 'fresh', 'to-review', 'behind');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'tutor', 'admin');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"subject" text NOT NULL,
	"title" text NOT NULL,
	"kicker" text,
	"estimated_minutes" integer,
	"prepared_by" text,
	"prepared_at" timestamp with time zone,
	"priority" integer DEFAULT 100 NOT NULL,
	"linked_session_id" text,
	"scheduled_for" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"subject" text,
	"topic" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"created_by" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"subject" text,
	"description" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"preview" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "completions" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"subject" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer,
	"outcome" text,
	"source_session_id" text,
	"source_activity_id" text
);
--> statement-breakpoint
CREATE TABLE "exercise_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"exercise_id" text NOT NULL,
	"student_id" text NOT NULL,
	"choice_id" text,
	"correct" boolean,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"feedback_text" text
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"idx" integer NOT NULL,
	"of_total" integer NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"prompt" text NOT NULL,
	"formula" text,
	"choices" jsonb NOT NULL,
	"correct_choice_id" text,
	"hint" text
);
--> statement-breakpoint
CREATE TABLE "job_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job_name" text NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"payload" jsonb,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"from_user" text NOT NULL,
	"kind" "message_kind" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"text" text NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"focus" text,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_touched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"elapsed_minutes" integer DEFAULT 0 NOT NULL,
	"resume_blurb" text,
	"next_exercise_id" text
);
--> statement-breakpoint
CREATE TABLE "students" (
	"user_id" text PRIMARY KEY NOT NULL,
	"grade" text,
	"school" text,
	"tutor_id" text
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"participants" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_edges" (
	"student_id" text NOT NULL,
	"node_a" text NOT NULL,
	"node_b" text NOT NULL,
	CONSTRAINT "topic_edges_student_id_node_a_node_b_pk" PRIMARY KEY("student_id","node_a","node_b")
);
--> statement-breakpoint
CREATE TABLE "topic_nodes" (
	"id" text NOT NULL,
	"student_id" text NOT NULL,
	"label" text NOT NULL,
	"subject" text,
	"state" "topic_state" NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"r" real DEFAULT 6 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_nodes_student_id_id_pk" PRIMARY KEY("student_id","id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "user_role" NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text,
	"avatar_initial" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_prepared_by_users_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_linked_session_id_sessions_id_fk" FOREIGN KEY ("linked_session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_threads" ADD CONSTRAINT "ai_threads_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_source_session_id_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_source_activity_id_activities_id_fk" FOREIGN KEY ("source_activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_from_user_users_id_fk" FOREIGN KEY ("from_user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_edges" ADD CONSTRAINT "topic_edges_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_nodes" ADD CONSTRAINT "topic_nodes_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_student_visible" ON "activities" USING btree ("student_id","scheduled_for","completed_at","dismissed_at");--> statement-breakpoint
CREATE INDEX "artifacts_student_subject" ON "artifacts" USING btree ("student_id","subject");--> statement-breakpoint
CREATE INDEX "completions_student_recent" ON "completions" USING btree ("student_id","completed_at");--> statement-breakpoint
CREATE INDEX "messages_thread_time" ON "messages" USING btree ("thread_id","at");--> statement-breakpoint
CREATE INDEX "sessions_student_status" ON "sessions" USING btree ("student_id","status","last_touched_at");