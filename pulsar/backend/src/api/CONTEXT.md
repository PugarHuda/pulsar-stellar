# api/ — Context

## Files
- `sse.ts` — SSE manager: addClient(res), broadcast(eventType, data), clientCount()
- `routes.ts` — Express Router dengan 5 endpoints

## Endpoints
| Method | Path | Handler |
|--------|------|---------|
| GET | /api/events | SSE stream |
| POST | /api/channels | openChannel() |
| GET | /api/channels/:id | getChannel() |
| POST | /api/channels/:id/run | runAgent() |
| POST | /api/channels/:id/settle | settleChannel() |

## SSE event types
- 'step' — agent step completed
- 'task_complete' — all steps done
- 'budget_exhausted' — budget ran out mid-task
- 'error' — error occurred
- 'connected' — initial connection confirmation

## Validation
Input validation menggunakan Zod schemas (OpenChannelSchema, RunTaskSchema)
