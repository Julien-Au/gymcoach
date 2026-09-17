import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createGymCoachMcpServer, GYMCOACH_MCP_INSTRUCTIONS } from './server';

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
    expect(byName.has('list_gyms')).toBe(true);
    expect(byName.has('get_gym_inventory')).toBe(true);
    expect(byName.has('get_gym_equipment_image')).toBe(true);
    expect(byName.has('update_gym_free_weights')).toBe(true);
    expect(byName.has('upsert_gym_equipment')).toBe(true);
    expect(byName.has('set_gym_equipment_image')).toBe(true);
    expect(byName.has('get_training_context')).toBe(true);
    expect(byName.has('create_program')).toBe(true);
    expect(byName.has('update_program_exercise')).toBe(true);
    expect(byName.get('list_gyms')?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get('get_gym_inventory')?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get('get_gym_equipment_image')?.annotations?.readOnlyHint).toBe(true);
    for (const name of [
      'update_gym_free_weights',
      'upsert_gym_equipment',
      'set_gym_equipment_image',
    ]) {
      expect(byName.get(name)?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
    expect(byName.get('upsert_gym_equipment')?.inputSchema).toMatchObject({
      required: expect.arrayContaining(['confirmed', 'gymId', 'name', 'equipmentType']),
    });
    expect(byName.get('update_gym_free_weights')?.inputSchema).toMatchObject({
      required: expect.arrayContaining(['confirmed']),
    });
    expect(byName.get('set_gym_equipment_image')?.inputSchema).toMatchObject({
      required: expect.arrayContaining(['confirmed', 'equipmentId']),
    });
    expect(byName.get('get_training_context')?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get('remove_program_exercise')?.annotations?.destructiveHint).toBe(true);

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
