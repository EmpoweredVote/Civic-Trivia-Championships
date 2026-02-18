CREATE SCHEMA "civic_trivia";
--> statement-breakpoint
CREATE TABLE "civic_trivia"."collection_questions" (
	"collection_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_questions_collection_id_question_id_pk" PRIMARY KEY("collection_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "civic_trivia"."collection_topics" (
	"collection_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_topics_collection_id_topic_id_pk" PRIMARY KEY("collection_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "civic_trivia"."collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"locale_code" text NOT NULL,
	"locale_name" text NOT NULL,
	"icon_identifier" text NOT NULL,
	"theme_color" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "civic_trivia"."questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"text" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_answer" integer NOT NULL,
	"explanation" text NOT NULL,
	"difficulty" text NOT NULL,
	"topic_id" integer NOT NULL,
	"subcategory" text,
	"source" jsonb NOT NULL,
	"learning_content" jsonb,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "check_difficulty" CHECK (difficulty IN ('easy', 'medium', 'hard')),
	CONSTRAINT "check_correct_answer" CHECK (correct_answer >= 0 AND correct_answer <= 3)
);
--> statement-breakpoint
CREATE TABLE "civic_trivia"."topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "civic_trivia"."collection_questions" ADD CONSTRAINT "collection_questions_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "civic_trivia"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civic_trivia"."collection_questions" ADD CONSTRAINT "collection_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "civic_trivia"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civic_trivia"."collection_topics" ADD CONSTRAINT "collection_topics_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "civic_trivia"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civic_trivia"."collection_topics" ADD CONSTRAINT "collection_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "civic_trivia"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civic_trivia"."questions" ADD CONSTRAINT "questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "civic_trivia"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_collection_questions_collection" ON "civic_trivia"."collection_questions" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_collection_questions_question" ON "civic_trivia"."collection_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_collection_topics_collection" ON "civic_trivia"."collection_topics" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_collection_topics_topic" ON "civic_trivia"."collection_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_collections_active_sort" ON "civic_trivia"."collections" USING btree ("is_active","sort_order") WHERE "civic_trivia"."collections"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_questions_topic_id" ON "civic_trivia"."questions" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_questions_learning_content" ON "civic_trivia"."questions" USING gin ("learning_content" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "idx_questions_expires_at" ON "civic_trivia"."questions" USING btree ("expires_at") WHERE "civic_trivia"."questions"."expires_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_topics_slug" ON "civic_trivia"."topics" USING btree ("slug");