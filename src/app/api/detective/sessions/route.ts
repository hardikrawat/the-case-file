import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { detectiveSessions } from '@/lib/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkRateLimit(`${session.user.id}:sessions_get`, 30, 60000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('boardId');

    if (!boardId) {
      return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
    }

    const sessions = await db.query.detectiveSessions.findMany({
      where: and(
        eq(detectiveSessions.boardId, boardId),
        eq(detectiveSessions.userId, session.user.id)
      ),
      orderBy: [desc(detectiveSessions.updatedAt)],
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Failed to fetch detective sessions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

const sessionSchema = z.object({
  boardId: z.string(),
  sessionId: z.string().optional(),
  messages: z.array(z.record(z.string(), z.unknown())).optional(),
  boardSnapshot: z.record(z.string(), z.unknown()).optional(),
  lastAnalysis: z.record(z.string(), z.unknown()).optional().nullable(),
  builderState: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkRateLimit(`${session.user.id}:sessions_post`, 20, 60000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const validatedData = sessionSchema.parse(body);

    // 1. Check for existing session matching sessionId AND boardId AND userId (prevents cross-board leaks)
    let existingSession = null;
    if (validatedData.sessionId) {
      existingSession = await db.query.detectiveSessions.findFirst({
        where: and(
          eq(detectiveSessions.id, validatedData.sessionId),
          eq(detectiveSessions.boardId, validatedData.boardId),
          eq(detectiveSessions.userId, session.user.id)
        ),
      });
    }

    // 2. Fallback: if no valid sessionId was supplied (or it belonged to another board),
    // find existing session row for this board and user to avoid duplicate sessions
    if (!existingSession) {
      existingSession = await db.query.detectiveSessions.findFirst({
        where: and(
          eq(detectiveSessions.boardId, validatedData.boardId),
          eq(detectiveSessions.userId, session.user.id)
        ),
        orderBy: [desc(detectiveSessions.updatedAt)],
      });
    }

    if (existingSession) {
      // Update existing session
      const [updatedSession] = await db
        .update(detectiveSessions)
        .set({
          ...(validatedData.messages !== undefined ? { messages: validatedData.messages } : {}),
          ...(validatedData.boardSnapshot !== undefined ? { boardSnapshot: validatedData.boardSnapshot } : {}),
          ...(validatedData.lastAnalysis !== undefined ? { lastAnalysis: validatedData.lastAnalysis } : {}),
          ...(validatedData.builderState !== undefined ? { builderState: validatedData.builderState } : {}),
          updatedAt: new Date(),
        })
        .where(eq(detectiveSessions.id, existingSession.id))
        .returning();

      if (updatedSession) {
        return NextResponse.json({ session: updatedSession });
      }
    }

    // 3. Create new session if none exists yet for this board
    const [newSession] = await db
      .insert(detectiveSessions)
      .values({
        id: createId(),
        boardId: validatedData.boardId,
        userId: session.user.id,
        messages: validatedData.messages || [],
        boardSnapshot: validatedData.boardSnapshot,
        lastAnalysis: validatedData.lastAnalysis,
        builderState: validatedData.builderState,
      })
      .returning();

    return NextResponse.json({ session: newSession });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Failed to save detective session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkRateLimit(`${session.user.id}:sessions_delete`, 10, 60000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('boardId');
    const sessionId = searchParams.get('sessionId');
    const clearMessagesOnly = searchParams.get('clearMessagesOnly') === 'true';

    if (!boardId && !sessionId) {
      return NextResponse.json({ error: 'boardId or sessionId is required' }, { status: 400 });
    }

    if (clearMessagesOnly) {
      // Only clear messages, preserving lastAnalysis and builderState
      if (sessionId) {
        await db
          .update(detectiveSessions)
          .set({ messages: [], updatedAt: new Date() })
          .where(
            and(
              eq(detectiveSessions.id, sessionId),
              eq(detectiveSessions.userId, session.user.id)
            )
          );
      } else if (boardId) {
        await db
          .update(detectiveSessions)
          .set({ messages: [], updatedAt: new Date() })
          .where(
            and(
              eq(detectiveSessions.boardId, boardId),
              eq(detectiveSessions.userId, session.user.id)
            )
          );
      }
      return NextResponse.json({ success: true, clearedMessages: true });
    }

    if (sessionId) {
      await db
        .delete(detectiveSessions)
        .where(
          and(
            eq(detectiveSessions.id, sessionId),
            eq(detectiveSessions.userId, session.user.id)
          )
        );
    } else if (boardId) {
      await db
        .delete(detectiveSessions)
        .where(
          and(
            eq(detectiveSessions.boardId, boardId),
            eq(detectiveSessions.userId, session.user.id)
          )
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete detective session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
