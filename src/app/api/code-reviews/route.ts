import { generateId } from 'ai';

import { extractZipProject } from '@/extensions/code-review/archive';
import {
  getCodeReviewCreditCost,
  getCodeReviewCreditScene,
  normalizeCodeReviewMode,
} from '@/extensions/code-review/credits';
import { EvolinkCodeReviewProvider } from '@/extensions/code-review/evolink';
import { CODE_REVIEW_LIMITS } from '@/extensions/code-review/limits';
import { runCodeReviewJob } from '@/extensions/code-review/runner';
import {
  CodeReviewFindingStatus,
  CodeReviewJobStatus,
} from '@/extensions/code-review/types';
import { respData, respErr, respJson } from '@/shared/lib/resp';
import {
  createCodeReviewFiles,
  createCodeReviewFindings,
  createCodeReviewJob,
  createCodeReviewReport,
  getCodeReviewJobs,
  getCodeReviewJobsCount,
  NewCodeReviewFile,
  NewCodeReviewFinding,
  updateCodeReviewJob,
} from '@/shared/models/code_review';
import { consumeCredits, getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';

export async function GET(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('pageSize') || 20);

    const [jobs, total] = await Promise.all([
      getCodeReviewJobs({ userId: user.id, page, limit }),
      getCodeReviewJobsCount({ userId: user.id }),
    ]);

    return respData({ jobs, total, page, limit });
  } catch (e: any) {
    console.log('get code reviews failed:', e);
    return respErr(`get code reviews failed: ${e.message}`);
  }
}

export async function POST(req: Request) {
  const currentTime = new Date();
  let jobId = '';

  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const mode = normalizeCodeReviewMode(
      String(formData.get('mode') || 'standard')
    );
    const instructions = String(formData.get('instructions') || '');

    if (!(file instanceof File)) {
      return respErr('file is required');
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return respErr('only zip archive is supported');
    }
    if (file.size > CODE_REVIEW_LIMITS.maxArchiveBytes) {
      return respErr('archive is larger than the 25 MB limit');
    }
    if (instructions.length > 4000) {
      return respErr('instructions are too long');
    }

    const creditsCost = getCodeReviewCreditCost(mode);
    const remainingCredits = await getRemainingCredits(user.id);
    if (remainingCredits < creditsCost) {
      return respJson(-1, 'insufficient_credits', {
        error: 'insufficient_credits',
        requiredCredits: creditsCost,
        remainingCredits,
        mode,
        pricingUrl: '/pricing',
      });
    }

    const model = process.env.EVOLINK_CODE_REVIEW_MODEL || 'claude-sonnet-4-6';
    const provider = new EvolinkCodeReviewProvider({
      apiKey: process.env.EVOLINK_API_KEY || '',
      baseUrl: process.env.EVOLINK_BASE_URL || 'https://direct.evolink.ai',
      model,
    });

    const newJobId = generateId().toLowerCase();
    const job = await createCodeReviewJob({
      id: newJobId,
      userId: user.id,
      status: CodeReviewJobStatus.Created,
      mode,
      archiveName: file.name,
      archiveSize: file.size,
      model,
      createdAt: currentTime,
      updatedAt: currentTime,
    });
    jobId = job.id;

    await updateCodeReviewJob(job.id, {
      status: CodeReviewJobStatus.Uploaded,
      updatedAt: new Date(),
    });
    await updateCodeReviewJob(job.id, {
      status: CodeReviewJobStatus.Indexing,
      updatedAt: new Date(),
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const project = await extractZipProject(buffer, file.name);
    const reviewFiles: NewCodeReviewFile[] = project.files.map((item) => ({
      id: generateId().toLowerCase(),
      jobId: job.id,
      path: item.path,
      language: item.language,
      sizeBytes: item.sizeBytes,
      lineCount: item.lineCount,
      hash: item.hash,
      included: true,
      createdAt: new Date(),
    }));
    const ignoredFiles: NewCodeReviewFile[] = project.ignoredFiles.map(
      (item) => ({
        id: generateId().toLowerCase(),
        jobId: job.id,
        path: item.path,
        language: 'text',
        sizeBytes: item.sizeBytes || 0,
        lineCount: 0,
        hash: '',
        included: false,
        ignoredReason: item.reason,
        createdAt: new Date(),
      })
    );
    const savedFiles = await createCodeReviewFiles([
      ...reviewFiles,
      ...ignoredFiles,
    ]);
    const fileIdByPath = new Map(
      savedFiles.map((savedFile) => [savedFile.path, savedFile.id])
    );

    await updateCodeReviewJob(job.id, {
      status: CodeReviewJobStatus.Reviewing,
      fileCount: project.files.length + project.ignoredFiles.length,
      includedFileCount: project.files.length,
      ignoredFileCount: project.ignoredFiles.length,
      updatedAt: new Date(),
    });

    const report = await runCodeReviewJob({
      files: project.files,
      ignoredFiles: project.ignoredFiles,
      mode,
      instructions,
      provider,
      onStage: async (stage) => {
        if (stage === 'synthesizing') {
          await updateCodeReviewJob(job.id, {
            status: CodeReviewJobStatus.Synthesizing,
            updatedAt: new Date(),
          });
        }
      },
    });

    const findings: NewCodeReviewFinding[] = report.findings.map((finding) => ({
      id: generateId().toLowerCase(),
      jobId: job.id,
      fileId: finding.filePath ? fileIdByPath.get(finding.filePath) : undefined,
      title: finding.title,
      severity: finding.severity,
      category: finding.category,
      confidence: finding.confidence,
      status: finding.status || CodeReviewFindingStatus.Open,
      filePath: finding.filePath,
      startLine: finding.startLine,
      endLine: finding.endLine,
      evidence: finding.evidence,
      recommendation: finding.recommendation,
      suggestedFix: finding.suggestedFix,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await createCodeReviewFindings(findings);
    await createCodeReviewReport({
      id: generateId().toLowerCase(),
      jobId: job.id,
      summaryMarkdown: report.markdown,
      reportJson: JSON.stringify(report),
      executiveSummary: report.executiveSummary,
      riskScore: report.riskScore,
      createdAt: new Date(),
    });

    const completedJob = await updateCodeReviewJob(job.id, {
      status: CodeReviewJobStatus.Completed,
      detectedStack: JSON.stringify(report.profile.stack),
      inputTokens: report.usage.inputTokens,
      outputTokens: report.usage.outputTokens,
      completedAt: new Date(),
      updatedAt: new Date(),
    });

    await consumeCredits({
      userId: user.id,
      credits: creditsCost,
      scene: getCodeReviewCreditScene(mode),
      description: `Code review: ${file.name} (${mode})`,
      metadata: JSON.stringify({
        type: 'code-review',
        jobId: job.id,
        mode,
        archiveName: file.name,
        includedFileCount: project.files.length,
        model,
      }),
    });
    const updatedRemainingCredits = await getRemainingCredits(user.id);

    return respData({
      job: completedJob,
      report,
      creditsCost,
      remainingCredits: updatedRemainingCredits,
    });
  } catch (e: any) {
    console.log('create code review failed:', e);
    if (jobId) {
      try {
        await updateCodeReviewJob(jobId, {
          status: CodeReviewJobStatus.Failed,
          errorMessage: e.message,
          updatedAt: new Date(),
        });
      } catch (updateError) {
        console.log('mark code review failed:', updateError);
      }
    }
    return respErr(`create code review failed: ${e.message}`);
  }
}
