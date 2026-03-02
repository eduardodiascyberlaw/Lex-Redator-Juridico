-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'intake',
    "client_name" TEXT NOT NULL,
    "client_nationality" TEXT,
    "facts_summary" TEXT NOT NULL,
    "facts_detailed" JSONB,
    "documents_ref" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "legal_area" TEXT,
    "action_type" TEXT,
    "jurisdiction" TEXT,
    "applicable_rights" JSONB,
    "triage_reasoning" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "agent_order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input" JSONB,
    "output" JSONB,
    "reasoning" TEXT,
    "tokens_used" INTEGER,
    "duration_ms" INTEGER,
    "error_msg" TEXT,
    "model" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_docs" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "file_path" TEXT,
    "sources_used" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_runs_case_id_idx" ON "agent_runs"("case_id");

-- CreateIndex
CREATE INDEX "agent_runs_agent_name_idx" ON "agent_runs"("agent_name");

-- CreateIndex
CREATE INDEX "generated_docs_case_id_idx" ON "generated_docs"("case_id");

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_docs" ADD CONSTRAINT "generated_docs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
