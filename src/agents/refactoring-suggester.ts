import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Suggests focused refactoring improvements for readability, maintainability, and simpler code while preserving behavior.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'sonnet',
  tools: ['Read', 'Grep', 'Glob'],
};
