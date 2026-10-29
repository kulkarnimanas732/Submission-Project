import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester
} from './agents';
import { buildOrchestratorPrompt } from './prompts';
import { getMcpServersConfig } from './config/mcp.config';
import {
  ReviewReportSchema,
  ReviewReportJSONSchema,
  type ReviewReport
} from './types/report-types';
import { ReviewError, ErrorCodes } from './utils/error-handler';
import { logger } from './utils/logger';
import { deduplicateFileReviews } from './utils/deduplicate-file-reviews';

export interface OrchestratorOptions {
  model?: string;
  cwd?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
}

export class CodeReviewOrchestrator {
  private readonly model: string;
  private readonly cwd: string;
  private readonly maxTurns: number;
  private readonly maxBudgetUsd?: number;

  constructor(options: OrchestratorOptions = {}) {
    this.model = options.model || process.env.ANTHROPIC_MODEL || '';
    this.cwd = options.cwd || process.env.PROJECT_ROOT || process.cwd();
    this.maxTurns = options.maxTurns ?? 30;
    this.maxBudgetUsd = options.maxBudgetUsd;
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    if (!this.model) {
      throw new ReviewError(
        'ANTHROPIC_MODEL is required.',
        ErrorCodes.INVALID_CONFIG
      );
    }

    if (!owner.trim() || !repo.trim() || !Number.isInteger(prNumber) || prNumber < 1) {
      throw new ReviewError(
        'A valid repository owner, repository name, and positive PR number are required.',
        ErrorCodes.INVALID_CONFIG
      );
    }

    const startedAt = Date.now();
    const analyzedAt = new Date().toISOString();

    logger.info('Starting pull request review', { owner, repo, prNumber });

    const options: Options = {
      model: this.model,
      cwd: this.cwd,
      maxTurns: this.maxTurns,
      ...(this.maxBudgetUsd !== undefined
        ? { maxBudgetUsd: this.maxBudgetUsd }
        : {}),
      mcpServers: getMcpServersConfig(),
      agents: {
        'code-quality-analyzer': codeQualityAnalyzer,
        'test-coverage-analyzer': testCoverageAnalyzer,
        'refactoring-suggester': refactoringSuggester
      },
      tools: { type: 'preset', preset: 'claude_code' },
      allowedTools: [
        'Read',
        'Grep',
        'Glob',
        'Task',
        'mcp__github__get_pull_request',
        'mcp__github__get_pull_request_files',
        'mcp__github__get_file_contents',
        'mcp__eslint__lint-files'
      ],
      outputFormat: {
        type: 'json_schema',
        schema: ReviewReportJSONSchema
      },
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: buildOrchestratorPrompt(owner, repo, prNumber)
      }
    };

    const prompt = `
Review GitHub pull request ${owner}/${repo}#${prNumber}.

First retrieve the pull request and its changed files using the available GitHub MCP tools.
If retrieval fails, stop and report the failure instead of inventing file contents.
Inspect the actual changes and relevant tests. Delegate code quality, test coverage,
and refactoring analysis to the three registered subagents.

Build a complete ReviewReport containing:
- pullRequest: owner, repo, number
- fileReviews: exactly one entry per unique analyzed changed file path, with codeQuality,
  testCoverage, and refactorings matching their respective schemas
- Never include duplicate fileReviews entries for the same file path. Combine the agents'
  findings for that file into its single entry, preserving distinct, evidence-supported findings.
- summary: totalFiles, overallScore, criticalIssues, highPriorityTests,
  refactoringOpportunities
- recommendations: priority, category, description, files
- metadata: analyzedAt, duration, agentVersions

Use only evidence from retrieved repository and pull request data.
Do not claim coverage was measured unless measurement data is available.
Return the result using the required structured output schema.
`;

    try {
      let resultMessage: SDKResultMessage | undefined;

      for await (const message of query({ prompt, options })) {
        if (message.type === 'result') {
          resultMessage = message;
        }
      }

      if (!resultMessage) {
        throw new ReviewError(
          'Claude returned no final result.',
          ErrorCodes.AGENT_FAILED
        );
      }

      if (resultMessage.subtype !== 'success' || resultMessage.is_error) {
        throw new ReviewError(
          `Claude review failed: ${resultMessage.subtype}`,
          ErrorCodes.AGENT_FAILED,
          { errors: 'errors' in resultMessage ? resultMessage.errors : [] }
        );
      }

      const structuredOutput = resultMessage.structured_output;

      if (!structuredOutput || typeof structuredOutput !== 'object') {
        throw new ReviewError(
          'Claude did not return structured report data.',
          ErrorCodes.STRUCTURED_OUTPUT_FAILED
        );
      }

      const parsed = ReviewReportSchema.safeParse(structuredOutput);

      if (!parsed.success) {
        throw new ReviewError(
          'The generated report does not match ReviewReportSchema.',
          ErrorCodes.VALIDATION_FAILED,
          { issues: parsed.error.issues }
        );
      }

      const report = parsed.data;

      // Ensure each normalized file path appears only once.
      report.fileReviews = deduplicateFileReviews(report.fileReviews);

      // Recalculate summary counts from detailed findings.
      report.summary.totalFiles = report.fileReviews.length;

      report.summary.criticalIssues = report.fileReviews.reduce(
        (total, review) =>
          total +
          review.codeQuality.issues.filter(
            (issue) => issue.severity === 'critical'
          ).length,
        0
      );

      report.summary.highPriorityTests = report.fileReviews.reduce(
        (total, review) =>
          total +
          review.testCoverage.untestedPaths.filter(
            (item) => item.priority === 'high'
          ).length,
        0
      );

      report.summary.refactoringOpportunities = report.fileReviews.reduce(
        (total, review) => total + review.refactorings.suggestions.length,
        0
      );

      // Ensure metadata reflects this execution and the requested PR.
      report.pullRequest = { owner, repo, number: prNumber };
      report.metadata.analyzedAt = analyzedAt;
      report.metadata.duration = Date.now() - startedAt;
      report.metadata.agentVersions = {
        'code-quality-analyzer': '1.0.0',
        'test-coverage-analyzer': '1.0.0',
        'refactoring-suggester': '1.0.0',
        model: this.model
      };

      logger.info('Pull request review completed', {
        owner,
        repo,
        prNumber,
        totalFiles: report.summary.totalFiles,
        duration: report.metadata.duration
      });

      return report;
    } catch (error) {
      logger.error('Pull request review failed', {
        owner,
        repo,
        prNumber,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof ReviewError) {
        throw error;
      }

      throw new ReviewError(
        error instanceof Error ? error.message : String(error),
        ErrorCodes.AGENT_FAILED,
        { owner, repo, prNumber }
      );
    }
  }
}
