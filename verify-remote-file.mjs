import 'dotenv/config';
import { Client } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

const client = new Client({ name: 'source-verifier', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: {
    ...process.env,
    ...(process.env.GITHUB_TOKEN
      ? { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN }
      : {})
  }
});

try {
  await client.connect(transport);
  const result = await client.callTool({
    name: 'get_file_contents',
    arguments: {
      owner: 'udacity',
      repo: 'cd14715-simple-todo-app',
      path: 'fixtures/clean-code.ts'
    }
  });

  for (const item of result.content ?? []) {
    if (item.type === 'text') console.log(item.text);
  }
} catch (error) {
  console.error('Source retrieval failed:', error.message);
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
