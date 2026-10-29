import 'dotenv/config';
import { Client } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

const servers = [
  {
    name: 'github',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: process.env.GITHUB_TOKEN
      ? { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN }
      : {}
  },
  {
    name: 'eslint',
    command: 'npx',
    args: ['-y', '@eslint/mcp@0.1.0'],
    env: {}
  }
];

for (const server of servers) {
  const client = new Client({
    name: 'mcp-diagnostic',
    version: '1.0.0'
  });

  let transport;

  try {
    console.log(`\nChecking ${server.name} MCP server...`);

    transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      env: { ...process.env, ...server.env }
    });

    await client.connect(transport);

    const result = await client.listTools();

    console.log(`Tools exposed by ${server.name}:`);
    for (const tool of result.tools) {
      console.log(`- ${tool.name}`);
    }
  } catch (error) {
    console.log(`${server.name} diagnostic failed: ${error.message}`);
  } finally {
    try {
      await client.close();
    } catch {}
  }
}
