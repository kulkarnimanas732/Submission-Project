import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CodeReviewOrchestrator } from './orchestrator';
import { ReportGenerator } from './utils/report-generator';
import { logger } from './utils/logger';

dotenv.config();

async function main(): Promise<void> {
  const [owner, repo, prStr, ...extraArgs] = process.argv.slice(2);

  if (
    !owner?.trim() ||
    !repo?.trim() ||
    !prStr ||
    extraArgs.length > 0 ||
    !/^[1-9]\d*$/.test(prStr)
  ) {
    console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
    process.exitCode = 1;
    return;
  }

  const prNumber = Number(prStr);

  if (!Number.isSafeInteger(prNumber)) {
    console.error('Error: PR number must be a valid positive integer.');
    process.exitCode = 1;
    return;
  }

  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasAwsCredentials = Boolean(
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  );

  if (hasAwsCredentials) {
    if (!process.env.AWS_REGION) {
      console.error('Error: AWS_REGION is required when using AWS Bedrock.');
      process.exitCode = 1;
      return;
    }
    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicKey) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.error(
      'Error: Configure ANTHROPIC_API_KEY or AWS_ACCESS_KEY_ID, ' +
      'AWS_SECRET_ACCESS_KEY, and AWS_REGION in your environment.'
    );
    process.exitCode = 1;
    return;
  }

  const model = process.env.ANTHROPIC_MODEL;

  if (!model?.trim()) {
    console.error('Error: ANTHROPIC_MODEL must be set in your environment.');
    process.exitCode = 1;
    return;
  }

  try {
    const orchestrator = new CodeReviewOrchestrator({
      model,
      cwd: process.env.PROJECT_ROOT || process.cwd()
    });

    console.log(`Reviewing ${owner}/${repo}#${prNumber}...`);

    const report = await orchestrator.reviewPullRequest(
      owner,
      repo,
      prNumber
    );

    const generator = new ReportGenerator();
    const outputDir = path.resolve(process.cwd(), 'reports');
    await mkdir(outputDir, { recursive: true });

    const baseName = `${owner}-${repo}-pr-${prNumber}`;

    const outputs: Array<{ extension: string; content: string }> = [
      {
        extension: 'json',
        content: generator.generateJSONReport(report)
      },
      {
        extension: 'md',
        content: generator.generateMarkdownReport(report)
      },
      {
        extension: 'html',
        content: generator.generateHTMLReport(report)
      }
    ];

    for (const output of outputs) {
      const filePath = path.join(
        outputDir,
        `${baseName}.${output.extension}`
      );
      await writeFile(filePath, output.content, 'utf8');
      console.log(`Saved: ${filePath}`);
    }

    console.log(
      `Review complete. Files reviewed: ${report.summary.totalFiles}; ` +
      `overall score: ${report.summary.overallScore}/100`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('CLI review failed', { owner, repo, prNumber, error: message });
    console.error(`Review failed: ${message}`);
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Unexpected application error:', error);
  process.exitCode = 1;
});
