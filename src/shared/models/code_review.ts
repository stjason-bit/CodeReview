import { and, count, desc, eq } from 'drizzle-orm';

import {
  codeReviewFile,
  codeReviewFinding,
  codeReviewJob,
  codeReviewReport,
} from '@/config/db/schema';
import { db } from '@/core/db';
import { CodeReviewFindingStatus } from '@/extensions/code-review/types';

export type CodeReviewJob = typeof codeReviewJob.$inferSelect;
export type NewCodeReviewJob = typeof codeReviewJob.$inferInsert;
export type UpdateCodeReviewJob = Partial<
  Omit<NewCodeReviewJob, 'id' | 'createdAt'>
>;

export type CodeReviewFile = typeof codeReviewFile.$inferSelect;
export type NewCodeReviewFile = typeof codeReviewFile.$inferInsert;

export type CodeReviewFinding = typeof codeReviewFinding.$inferSelect;
export type NewCodeReviewFinding = typeof codeReviewFinding.$inferInsert;

export type CodeReviewReport = typeof codeReviewReport.$inferSelect;
export type NewCodeReviewReport = typeof codeReviewReport.$inferInsert;

export async function createCodeReviewJob(
  newJob: NewCodeReviewJob
): Promise<CodeReviewJob> {
  const [result] = await db().insert(codeReviewJob).values(newJob).returning();

  return result;
}

export async function updateCodeReviewJob(
  id: string,
  updateJob: UpdateCodeReviewJob
): Promise<CodeReviewJob> {
  const [result] = await db()
    .update(codeReviewJob)
    .set(updateJob)
    .where(eq(codeReviewJob.id, id))
    .returning();

  return result;
}

export async function findCodeReviewJobById(
  id: string
): Promise<CodeReviewJob> {
  const [result] = await db()
    .select()
    .from(codeReviewJob)
    .where(eq(codeReviewJob.id, id));

  return result;
}

export async function getCodeReviewJobs({
  userId,
  page = 1,
  limit = 20,
}: {
  userId?: string;
  page?: number;
  limit?: number;
}): Promise<CodeReviewJob[]> {
  return db()
    .select()
    .from(codeReviewJob)
    .where(userId ? eq(codeReviewJob.userId, userId) : undefined)
    .orderBy(desc(codeReviewJob.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
}

export async function getCodeReviewJobsCount({
  userId,
}: {
  userId?: string;
}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(codeReviewJob)
    .where(userId ? eq(codeReviewJob.userId, userId) : undefined);

  return result?.count || 0;
}

export async function createCodeReviewFiles(
  files: NewCodeReviewFile[]
): Promise<CodeReviewFile[]> {
  if (files.length === 0) {
    return [];
  }

  return db().insert(codeReviewFile).values(files).returning();
}

export async function getCodeReviewFiles({
  jobId,
}: {
  jobId: string;
}): Promise<CodeReviewFile[]> {
  return db()
    .select()
    .from(codeReviewFile)
    .where(eq(codeReviewFile.jobId, jobId));
}

export async function createCodeReviewFindings(
  findings: NewCodeReviewFinding[]
): Promise<CodeReviewFinding[]> {
  if (findings.length === 0) {
    return [];
  }

  return db().insert(codeReviewFinding).values(findings).returning();
}

export async function getCodeReviewFindings({
  jobId,
  status,
}: {
  jobId: string;
  status?: CodeReviewFindingStatus;
}): Promise<CodeReviewFinding[]> {
  return db()
    .select()
    .from(codeReviewFinding)
    .where(
      and(
        eq(codeReviewFinding.jobId, jobId),
        status ? eq(codeReviewFinding.status, status) : undefined
      )
    )
    .orderBy(desc(codeReviewFinding.createdAt));
}

export async function updateCodeReviewFindingStatus(
  id: string,
  status: CodeReviewFindingStatus
): Promise<CodeReviewFinding> {
  const [result] = await db()
    .update(codeReviewFinding)
    .set({ status })
    .where(eq(codeReviewFinding.id, id))
    .returning();

  return result;
}

export async function createCodeReviewReport(
  report: NewCodeReviewReport
): Promise<CodeReviewReport> {
  const [result] = await db()
    .insert(codeReviewReport)
    .values(report)
    .returning();

  return result;
}

export async function findCodeReviewReportByJobId(
  jobId: string
): Promise<CodeReviewReport> {
  const [result] = await db()
    .select()
    .from(codeReviewReport)
    .where(eq(codeReviewReport.jobId, jobId));

  return result;
}
