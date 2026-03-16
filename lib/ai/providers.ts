import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Normalized SSE event types emitted by this module
// ---------------------------------------------------------------------------
// data: {"t":"text","v":"..."} — text chunk
// data: {"t":"tool","n":"finalize_assignment","i":{...}} — complete tool call
// data: {"t":"done"} — stream finished
// data: {"t":"error","v":"..."} — error

type NormalizedEvent =
  | { t: 'text';  v: string }
  | { t: 'tool';  n: string; i: unknown }
  | { t: 'done' }
  | { t: 'error'; v: string };

const enc = new TextEncoder();

function sseChunk(event: NormalizedEvent): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(event)}\n\n`);
}

// ---------------------------------------------------------------------------
// finalize_assignment tool definitions (one per API format)
// ---------------------------------------------------------------------------

const FINALIZE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    assignment: {
      type: 'object' as const,
      properties: {
        title:      { type: 'string' },
        brief:      { type: 'string', description: 'markdown' },
        dueDate:    { type: 'string', description: 'ISO 8601' },
        weight:     { type: 'number', minimum: 0, maximum: 100 },
        difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD', 'BOSS'] },
        pointValue: { type: 'integer', minimum: 1 },
        tasks: {
          type: 'array' as const,
          minItems: 1,
          items: {
            type: 'object' as const,
            properties: {
              title:             { type: 'string' },
              taskType:          { type: 'string', enum: ['STUDY', 'RESEARCH', 'WRITING', 'REVIEW', 'QUIZ', 'PRACTICE', 'REFLECTION', 'PEER_REVIEW', 'SOCRATIC'] },
              estimatedMins:     { type: 'integer', minimum: 1 },
              pointValue:        { type: 'integer', minimum: 1 },
              unlocksAfterIndex: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
            },
            required: ['title', 'taskType', 'estimatedMins', 'pointValue', 'unlocksAfterIndex'],
          },
        },
      },
      required: ['title', 'brief', 'dueDate', 'weight', 'difficulty', 'pointValue', 'tasks'],
    },
  },
  required: ['assignment'],
};

const TOOL_DESCRIPTION =
  'Call this when you have gathered all necessary information to generate the assignment. Pass the complete structured assignment as the argument.';

// Anthropic format
const ANTHROPIC_TOOL: Anthropic.Tool = {
  name: 'finalize_assignment',
  description: TOOL_DESCRIPTION,
  input_schema: FINALIZE_INPUT_SCHEMA,
};

// OpenAI-compatible format
const OPENAI_TOOL = {
  type: 'function' as const,
  function: {
    name: 'finalize_assignment',
    description: TOOL_DESCRIPTION,
    parameters: FINALIZE_INPUT_SCHEMA,
  },
};

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface InterviewStreamOptions {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  messages: { role: string; content: string }[];
  systemPrompt: string;
}

/**
 * Returns a ReadableStream that emits normalized SSE events regardless of
 * the underlying provider. The caller should pipe this directly as the HTTP
 * response body.
 */
export function createInterviewStream(options: InterviewStreamOptions): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      try {
        if (options.provider === 'anthropic') {
          await streamAnthropic(options, controller);
        } else {
          await streamOpenAICompat(options, controller);
        }
        controller.enqueue(sseChunk({ t: 'done' }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(sseChunk({ t: 'error', v: msg }));
      }
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// Anthropic provider
// ---------------------------------------------------------------------------

async function streamAnthropic(
  options: InterviewStreamOptions,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const client = new Anthropic({ apiKey: options.apiKey || undefined });

  const stream = client.messages.stream({
    model: options.model,
    max_tokens: 1000,
    system: options.systemPrompt,
    tools: [ANTHROPIC_TOOL],
    messages: options.messages as Anthropic.MessageParam[],
  });

  let toolName = '';
  let toolJson = '';
  let inTool   = false;

  for await (const event of stream) {
    if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
      toolName = event.content_block.name;
      toolJson = '';
      inTool   = true;
    } else if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        controller.enqueue(sseChunk({ t: 'text', v: event.delta.text }));
      } else if (inTool && event.delta.type === 'input_json_delta') {
        toolJson += event.delta.partial_json;
      }
    } else if (event.type === 'content_block_stop' && inTool) {
      inTool = false;
      try {
        controller.enqueue(sseChunk({ t: 'tool', n: toolName, i: JSON.parse(toolJson) }));
      } catch { /* malformed JSON — skip */ }
      toolJson = '';
    }
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider (works with OpenAI, Groq, Together, Mistral, etc.)
// ---------------------------------------------------------------------------

async function streamOpenAICompat(
  options: InterviewStreamOptions,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const base = (options.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 1000,
      stream: true,
      tools: [OPENAI_TOOL],
      tool_choice: 'auto',
      messages: [
        { role: 'system', content: options.systemPrompt },
        ...options.messages,
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => res.status.toString());
    throw new Error(`Provider returned ${res.status}: ${text}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  // Accumulate tool-call arguments across chunks
  const toolCalls: { name: string; args: string }[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') break;

      let data: Record<string, unknown>;
      try { data = JSON.parse(payload); } catch { continue; }

      const choice = (data.choices as Record<string, unknown>[])?.[0];
      if (!choice) continue;

      const delta = choice.delta as Record<string, unknown> | undefined;
      if (!delta) continue;

      // Text chunk
      if (typeof delta.content === 'string' && delta.content) {
        controller.enqueue(sseChunk({ t: 'text', v: delta.content }));
      }

      // Tool call argument accumulation
      const tcs = delta.tool_calls as Record<string, unknown>[] | undefined;
      if (tcs) {
        for (const tc of tcs) {
          const idx = (tc.index as number) ?? 0;
          if (!toolCalls[idx]) toolCalls[idx] = { name: '', args: '' };
          const fn = tc.function as Record<string, string> | undefined;
          if (fn?.name)      toolCalls[idx].name += fn.name;
          if (fn?.arguments) toolCalls[idx].args += fn.arguments;
        }
      }

      // Emit completed tool calls when the model stops to call tools
      if (choice.finish_reason === 'tool_calls') {
        for (const tc of toolCalls) {
          try {
            controller.enqueue(sseChunk({ t: 'tool', n: tc.name, i: JSON.parse(tc.args) }));
          } catch { /* malformed — skip */ }
        }
      }
    }
  }
}
