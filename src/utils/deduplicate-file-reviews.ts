import type { ReviewReport } from '../types/report-types';

/**
 * Keep one review entry per normalized file path.
 * Duplicate entries are merged so distinct findings are preserved.
 */
export function deduplicateFileReviews(
  reviews: ReviewReport['fileReviews']
): ReviewReport['fileReviews'] {
  const byPath = new Map<string, ReviewReport['fileReviews'][number]>();

  for (const review of reviews) {
    const key = review.file.replace(/\\/g, '/').replace(/^\.\/+/, '');

    const existing = byPath.get(key);
    if (!existing) {
      byPath.set(key, review);
      continue;
    }

    byPath.set(key, {
      file: existing.file,
      codeQuality: {
        ...existing.codeQuality,
        issues: [
          ...existing.codeQuality.issues,
          ...review.codeQuality.issues.filter(
            issue => !existing.codeQuality.issues.some(
              previous =>
                previous.line === issue.line &&
                previous.category === issue.category &&
                previous.description === issue.description
            )
          )
        ],
        overallScore: Math.min(
          existing.codeQuality.overallScore,
          review.codeQuality.overallScore
        ),
        summary: [existing.codeQuality.summary, review.codeQuality.summary]
          .filter(Boolean)
          .filter((value, index, all) => all.indexOf(value) === index)
          .join(' ')
      },
      testCoverage: {
        ...existing.testCoverage,
        hasTests: existing.testCoverage.hasTests || review.testCoverage.hasTests,
        testFiles: [...new Set([
          ...existing.testCoverage.testFiles,
          ...review.testCoverage.testFiles
        ])],
        untestedPaths: [
          ...existing.testCoverage.untestedPaths,
          ...review.testCoverage.untestedPaths.filter(
            gap => !existing.testCoverage.untestedPaths.some(
              previous =>
                previous.location === gap.location &&
                previous.type === gap.type &&
                previous.suggestedTest === gap.suggestedTest
            )
          )
        ],
        coverageEstimate: Math.min(
          existing.testCoverage.coverageEstimate,
          review.testCoverage.coverageEstimate
        ),
        summary: [existing.testCoverage.summary, review.testCoverage.summary]
          .filter(Boolean)
          .filter((value, index, all) => all.indexOf(value) === index)
          .join(' ')
      },
      refactorings: {
        ...existing.refactorings,
        suggestions: [
          ...existing.refactorings.suggestions,
          ...review.refactorings.suggestions.filter(
            suggestion => !existing.refactorings.suggestions.some(
              previous =>
                previous.location === suggestion.location &&
                previous.type === suggestion.type &&
                previous.description === suggestion.description
            )
          )
        ],
        summary: [existing.refactorings.summary, review.refactorings.summary]
          .filter(Boolean)
          .filter((value, index, all) => all.indexOf(value) === index)
          .join(' ')
      }
    });
  }

  return [...byPath.values()];
}
