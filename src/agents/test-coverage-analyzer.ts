import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts';

export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Reviews source code and available test files to identify missing tests, untested paths, and important edge cases.',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  model: 'sonnet',
  tools: ['Read', 'Grep', 'Glob'],
};
