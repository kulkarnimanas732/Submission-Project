import { describe, expect, it } from 'vitest';
import { deduplicateFileReviews } from '../src/utils/deduplicate-file-reviews';
import type { ReviewReport } from '../src/types/report-types';

function makeReview(file: string, line: number): ReviewReport['fileReviews'][number] {
  return {
    file,
    codeQuality: {
      file,
      issues: [{
        line,
        severity: 'low',
        category: 'maintainability',
        description: `Issue at line ${line}`,
        suggestion: 'Improve this code'
      }],
      overallScore: 80,
      summary: 'Quality review'
    },
    testCoverage: {
      file,
      hasTests: false,
      testFiles: [],
      untestedPaths: [],
      coverageEstimate: 50,
      summary: 'Coverage estimate is unmeasured'
    },
    refactorings: {
      file,
      suggestions: [],
      summary: 'No refactorings'
    }
  };
}

describe('deduplicateFileReviews', () => {
  it('merges duplicate paths and preserves distinct issues', () => {
    const result = deduplicateFileReviews([
      makeReview('fixtures/clean-code.ts', 10),
      makeReview('./fixtures/clean-code.ts', 20),
      makeReview('src/example.ts', 5)
    ]);

    expect(result).toHaveLength(2);

    const fixture = result.find(
      review => review.file === 'fixtures/clean-code.ts'
    );

    expect(fixture?.codeQuality.issues.map(issue => issue.line)).toEqual([10, 20]);
    expect(fixture?.codeQuality.overallScore).toBe(80);
  });

  it('returns an empty array for no reviews', () => {
    expect(deduplicateFileReviews([])).toEqual([]);
  });
});
