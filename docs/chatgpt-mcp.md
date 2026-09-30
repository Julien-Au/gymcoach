# GymCoach MCP and ChatGPT

GymCoach exposes a Streamable HTTP MCP endpoint at `/mcp`. It lets external AI
agents read the trainee context and, with an explicitly write-enabled token,
create or edit training programs.

## Connect ChatGPT

1. Sign in to GymCoach and open **Settings -> ChatGPT and MCP**.
2. Create a connection. Leave write access enabled only when ChatGPT should be
   allowed to change saved programs.
3. Copy the connector URL immediately. Its secret token is shown only once.
4. In ChatGPT Developer Mode, create a custom connector and paste the URL.
5. Select **No authentication**. The private query token in the URL is the
   authentication credential for this personal deployment.

The public URL must use HTTPS. A local or LAN URL is not suitable for ChatGPT.

## Security model

- Raw tokens are never stored; PostgreSQL contains only their SHA-256 hashes.
- Tokens belong to one GymCoach user and can be revoked from Settings.
- Read-only tokens cannot call program-writing tools.
- Every write tool requires an explicit `confirmed: true` argument and is
  annotated as changing saved data.
- The agent never receives direct database, filesystem or shell access.
- The connector URL carries the token as a query string, so treat the URL
  itself as a secret: query strings routinely end up in reverse-proxy and
  access logs and in browser history. Disable or scrub query-string logging
  on any proxy in front of GymCoach, and prefer the `Authorization: Bearer`
  or `X-GymCoach-Token` header (both are supported) for MCP clients that can
  send headers.

For a shared or publicly distributed ChatGPT app, replace personal query-token
authentication with OAuth before submission.

## MCP capabilities

Resources:

- `gymcoach://instructions/agent`

Prompts:

- `build-training-program`

Read tools:

- `get_training_context`
- `list_exercises`
- `list_gyms`
- `get_gym_inventory` (shared free weights and physical equipment; per-exercise
  coverage only with `includeExerciseCoverage: true`)
- `get_gym_equipment_image`
- `list_programs`
- `get_program`

Write tools:

- `update_gym_free_weights` (replaces the supplied lists; returns the previous ones)
- `upsert_gym_equipment` (overwrites an existing item's fields and exercise links;
  returns the previous values)
- `set_gym_equipment_image` (uploaded JPEG/PNG/WebP bytes or clear; external image
  URLs are not accepted through MCP)
- `create_program`
- `update_program_metadata`
- `add_workout` (append a session, cardio included, to an existing program)
- `add_program_exercise`
- `update_program_exercise`
- `remove_program_exercise`
- `activate_program`

## Health check

`GET /mcp/health` returns `401` without a token and `200` for an active token.
