import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createGymCoachMcpServer,
  GYMCOACH_MCP_INSTRUCTIONS,
  GYMCOACH_MCP_TOOL_NAMES,
} from './server';

const openServers: Array<ReturnType<typeof createGymCoachMcpServer>> = [];
const openClients: Client[] = [];

afterEach(async () => {
  await Promise.allSettled(openClients.splice(0).map((client) => client.close()));
  await Promise.allSettled(openServers.splice(0).map((server) => server.close()));
});

describe('GymCoach MCP server', () => {
  it('advertises agent instructions, resources, prompts and safe tool annotations', async () => {
    const server = createGymCoachMcpServer({
      principal: { tokenId: 'token-1', userId: 'user-1', canWrite: true },
      baseUrl: 'https://gymcoach.example',
    });
    const client = new Client({ name: 'gymcoach-test', version: '1.0.0' });
    openServers.push(server);
    openClients.push(client);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const byName = new Map(tools.tools.map((tool) => [tool.name, tool]));
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual(
      [...GYMCOACH_MCP_TOOL_NAMES].sort(),
    );
    expect(byName.has('get_training_context')).toBe(true);
    expect(byName.has('create_program')).toBe(true);
    expect(byName.has('update_program_exercise')).toBe(true);
    expect(byName.get('get_mcp_capability_index')?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get('get_training_context')?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get('remove_program_exercise')?.annotations?.destructiveHint).toBe(true);

    const capabilityIndex = await client.callTool({ name: 'get_mcp_capability_index' });
    const capabilityContent = capabilityIndex.content as Array<{ type: string; text?: string }>;
    const capabilityText = capabilityContent.find((item) => item.type === 'text');
    expect(capabilityText?.text ? JSON.parse(capabilityText.text) : null).toMatchObject({
      capabilities: {
        allTools: GYMCOACH_MCP_TOOL_NAMES,
        discovery: { tools: ['get_mcp_capability_index'] },
        trainingContext: { tools: ['get_training_context'] },
        exerciseCatalog: { tools: ['list_exercises'] },
        programs: {
          read: ['list_programs', 'get_program'],
          write: [
            'create_program',
            'update_program_metadata',
            'add_program_exercise',
            'update_program_exercise',
            'remove_program_exercise',
            'activate_program',
          ],
        },
      },
    });

    const resources = await client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toContain(
      'gymcoach://instructions/agent',
    );
    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain('build-training-program');

    const instructions = await client.readResource({ uri: 'gymcoach://instructions/agent' });
    expect(instructions.contents[0]).toMatchObject({ text: GYMCOACH_MCP_INSTRUCTIONS });
  });
});
