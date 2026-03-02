import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";

// ── Types ───────────────────────────────────────────

interface CreateCaseInput {
  clientName: string;
  clientNationality?: string;
  factsSummary: string;
  factsDetailed?: Prisma.InputJsonValue;
  documentsRef?: string;
  urgency?: string;
  createdBy: string;
}

interface UpdateCaseInput {
  clientName?: string;
  clientNationality?: string;
  factsSummary?: string;
  factsDetailed?: Prisma.InputJsonValue;
  documentsRef?: string;
  urgency?: string;
  status?: string;
  legalArea?: string;
  actionType?: string;
  jurisdiction?: string;
  applicableRights?: Prisma.InputJsonValue;
  triageReasoning?: string;
}

interface ListCasesOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

// ── Service ─────────────────────────────────────────

export const createCase = async (input: CreateCaseInput) => {
  return prisma.case.create({
    data: {
      clientName: input.clientName,
      clientNationality: input.clientNationality,
      factsSummary: input.factsSummary,
      factsDetailed: input.factsDetailed ?? undefined,
      documentsRef: input.documentsRef,
      urgency: input.urgency || "normal",
      createdBy: input.createdBy,
    },
  });
};

export const getCaseById = async (id: string) => {
  const caseRecord = await prisma.case.findUnique({
    where: { id },
    include: {
      agentRuns: {
        orderBy: { agentOrder: "asc" },
      },
      generatedDocs: {
        orderBy: { version: "desc" },
      },
    },
  });

  if (!caseRecord) {
    throw new AppError("Caso não encontrado.", 404);
  }

  return caseRecord;
};

export const listCases = async (options: ListCasesOptions = {}) => {
  const { status, limit = 20, offset = 0 } = options;

  const where = status ? { status } : {};

  const [cases, total] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      skip: offset,
      include: {
        _count: {
          select: { agentRuns: true, generatedDocs: true },
        },
      },
    }),
    prisma.case.count({ where }),
  ]);

  return { cases, total, limit, offset };
};

export const updateCase = async (id: string, input: UpdateCaseInput) => {
  // Verify case exists
  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Caso não encontrado.", 404);
  }

  return prisma.case.update({
    where: { id },
    data: {
      ...(input.clientName !== undefined && { clientName: input.clientName }),
      ...(input.clientNationality !== undefined && { clientNationality: input.clientNationality }),
      ...(input.factsSummary !== undefined && { factsSummary: input.factsSummary }),
      ...(input.factsDetailed !== undefined && { factsDetailed: input.factsDetailed }),
      ...(input.documentsRef !== undefined && { documentsRef: input.documentsRef }),
      ...(input.urgency !== undefined && { urgency: input.urgency }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.legalArea !== undefined && { legalArea: input.legalArea }),
      ...(input.actionType !== undefined && { actionType: input.actionType }),
      ...(input.jurisdiction !== undefined && { jurisdiction: input.jurisdiction }),
      ...(input.applicableRights !== undefined && { applicableRights: input.applicableRights }),
      ...(input.triageReasoning !== undefined && { triageReasoning: input.triageReasoning }),
    },
  });
};
