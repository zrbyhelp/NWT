import type { NextRequest } from "next/server";
import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { AiConfigError } from "@/lib/ai/config-types";
import { authRequiredCode, isAuthRequiredError } from "@/lib/auth-types";
import { streamConversationMessage } from "@/lib/home-workspace";

type StreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; conversation: Awaited<ReturnType<typeof streamConversationMessage>> }
  | { type: "error"; message: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const body = (await request.json()) as { content?: unknown; locale?: unknown };
  const content = typeof body.content === "string" ? body.content : "";
  const locale = resolveLocale(body.locale);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: StreamEvent) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      try {
        const conversation = await streamConversationMessage(conversationId, content, locale, (delta) => {
          send({ type: "delta", content: delta });
        });

        send({ type: "done", conversation });
      } catch (error) {
        send({ type: "error", message: resolveStreamErrorCode(error) });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}

function resolveStreamErrorCode(error: unknown) {
  if (isAuthRequiredError(error)) {
    return authRequiredCode;
  }

  if (error instanceof AiConfigError) {
    return error.code;
  }

  return "stream-failed";
}

function resolveLocale(locale: unknown): Locale {
  return routing.locales.includes(locale as Locale) ? (locale as Locale) : routing.defaultLocale;
}
