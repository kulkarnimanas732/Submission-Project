import type { Options } from '@anthropic-ai/claude-agent-sdk';

/**
 * Build MCP configuration at call time so dotenv-loaded values are available.
 */
export function getMcpServersConfig(): NonNullable<Options['mcpServers']> {
  return {
    github: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: process.env.GITHUB_TOKEN
        ? {
            GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN
          }
        : {}
    },
    eslint: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@eslint/mcp@0.1.0'],
      env: {}
    }
  };
}
