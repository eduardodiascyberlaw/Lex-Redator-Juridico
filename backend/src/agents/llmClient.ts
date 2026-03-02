import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

// ── Client singleton ────────────────────────────────

let client: Anthropic | null = null;

const getClient = (): Anthropic => {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
};

// ── Types ───────────────────────────────────────────

export interface LlmRequest {
  systemPrompt: string;
  userMessage: string;
  model?: "sonnet" | "haiku";
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LlmStreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (fullText: string, usage: { inputTokens: number; outputTokens: number }) => void;
  onError: (error: Error) => void;
}

// ── Helpers ─────────────────────────────────────────

const resolveModel = (profile: "sonnet" | "haiku" = "sonnet"): string => {
  return profile === "haiku"
    ? config.anthropic.modelHaiku
    : config.anthropic.modelSonnet;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Non-streaming request with retry ────────────────

export const callLlm = async (
  request: LlmRequest,
  maxRetries: number = 3
): Promise<LlmResponse> => {
  const anthropic = getClient();
  const model = resolveModel(request.model);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: request.maxTokens || 4096,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userMessage }],
        ...(request.temperature !== undefined && { temperature: request.temperature }),
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const text = textBlock && "text" in textBlock ? textBlock.text : "";

      return {
        text,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on rate limit (429) or server errors (5xx)
      const isRetryable =
        error instanceof Anthropic.RateLimitError ||
        (error instanceof Anthropic.APIError && error.status >= 500);

      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
      console.log(`[LLM] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }

  throw lastError || new Error("LLM call failed after retries");
};

// ── Streaming request ───────────────────────────────

export const streamLlm = async (
  request: LlmRequest,
  callbacks: LlmStreamCallbacks
): Promise<void> => {
  const anthropic = getClient();
  const model = resolveModel(request.model);

  try {
    const stream = anthropic.messages.stream({
      model,
      max_tokens: request.maxTokens || 4096,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userMessage }],
      ...(request.temperature !== undefined && { temperature: request.temperature }),
    });

    let fullText = "";

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullText += event.delta.text;
        callbacks.onChunk(event.delta.text);
      }
    }

    const finalMessage = await stream.finalMessage();
    callbacks.onDone(fullText, {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    });
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
};

// ── JSON-mode helper ────────────────────────────────

export const callLlmJson = async <T>(
  request: LlmRequest,
  maxRetries: number = 3
): Promise<{ data: T; inputTokens: number; outputTokens: number }> => {
  const response = await callLlm(
    {
      ...request,
      systemPrompt: `${request.systemPrompt}\n\nResponde APENAS em JSON válido. Não incluas texto antes ou depois do JSON.`,
    },
    maxRetries
  );

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = response.text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const data = JSON.parse(jsonStr) as T;
  return {
    data,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
};
