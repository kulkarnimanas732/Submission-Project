import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts';
import { CodeQualityResultJSONSchema } from '../types/analysis-results';

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Reviews source code for security vulnerabilities, bugs, performance problems, maintainability, style, and best-practice issues.',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  model: 'sonnet',
  tools: ['Read', 'Grep', 'Glob'],
};
