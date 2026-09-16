import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { detectiveSessions } from '@/lib/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  messages: z.array(z.record(z.string(), z.unknown())),
  boardSnapshot: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = sessionSchema.parse(body);

    if (validatedData.sessionId) {
      // Update existing session
      const [updatedSession] = await db
        .update(detectiveSessions)
        .set({
          messages: validatedData.messages,
          boardSnapshot: validatedData.boardSnapshot,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(detectiveSessions.id, validatedData.sessionId),
            eq(detectiveSessions.userId, session.user.id)
          )
        )
        .returning();

      if (!updatedSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({ session: updatedSession });
    } else {
      // Create new session
      const [newSession] = await db
        .insert(detectiveSessions)
        .values({
          id: createId(),
          boardId: validatedData.boardId,
          userId: session.user.id,
          messages: validatedData.messages,
          boardSnapshot: validatedData.boardSnapshot,
        })
        .returning();

      return NextResponse.json({ session: newSession });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Failed to save detective session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
