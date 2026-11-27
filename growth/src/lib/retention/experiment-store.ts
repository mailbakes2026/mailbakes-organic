import { prisma, prepareDatabase } from "@/lib/prisma";
import { experimentReady, isExperimentStatus, type ExperimentInput } from "@/lib/retention/experiments";

async function ready() {
  await prepareDatabase();
}

export async function listExperiments() {
  await ready();
  return prisma.flowExperiment.findMany({ orderBy: { updatedAt: "desc" } });
}

export async function createExperiment(input: ExperimentInput, updatedBy: string) {
  const problem = experimentReady(input);
  if (problem) return { ok: false as const, error: problem };
  await ready();
  const row = await prisma.flowExperiment.create({ data: { ...input, updatedBy, source: "manual" } });
  return { ok: true as const, experiment: row };
}

export async function updateExperiment(id: string, patch: Partial<ExperimentInput>, updatedBy: string) {
  await ready();
  const existing = await prisma.flowExperiment.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, error: "That test was not found.", status: 404 };
  const next: ExperimentInput = {
    flowId: patch.flowId ?? existing.flowId,
    flowName: patch.flowName ?? existing.flowName,
    name: patch.name ?? existing.name,
    hypothesis: patch.hypothesis ?? existing.hypothesis,
    variantA: patch.variantA ?? existing.variantA,
    variantB: patch.variantB ?? existing.variantB,
    splitA: patch.splitA ?? existing.splitA,
    status: patch.status ?? (isExperimentStatus(existing.status) ? existing.status : "draft"),
    winner: patch.winner ?? (existing.winner === "a" || existing.winner === "b" ? existing.winner : ""),
    metricName: patch.metricName ?? existing.metricName,
    metricA: patch.metricA ?? existing.metricA,
    metricB: patch.metricB ?? existing.metricB,
    lift: patch.lift ?? existing.lift,
    notes: patch.notes ?? existing.notes,
  };
  const problem = experimentReady(next);
  if (problem) return { ok: false as const, error: problem, status: 400 };
  const row = await prisma.flowExperiment.update({ where: { id }, data: { ...next, updatedBy } });
  return { ok: true as const, experiment: row };
}

export async function deleteExperiment(id: string) {
  await ready();
  const existing = await prisma.flowExperiment.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;
  await prisma.flowExperiment.delete({ where: { id } });
  return true;
}
