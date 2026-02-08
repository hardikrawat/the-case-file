import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boards, users } from '@/lib/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { title, isPublic, content, parentId } = body;

        const boardId = createId();

        await db.insert(boards).values({
            id: boardId,
            userId: session.user.id,
            parentId: parentId || null,
            title: title || 'Untitled Case',
            isPublic: isPublic || false,
            content: content || {},
            thumbnail: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return NextResponse.json({ id: boardId }, { status: 201 });
    } catch (error) {
        console.error('Error creating board:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET() {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userBoards = await db.select({
            id: boards.id,
            title: boards.title,
            isPublic: boards.isPublic,
            thumbnail: boards.thumbnail,
            stars: boards.stars,
            views: boards.views,
            createdAt: boards.createdAt,
            updatedAt: boards.updatedAt,
            parentId: boards.parentId,
            author: {
                name: users.name,
                image: users.image,
            }
        }).from(boards).leftJoin(users, eq(boards.userId, users.id)).where(eq(boards.userId, session.user.id)).orderBy(boards.updatedAt);
        return NextResponse.json(userBoards);
    } catch (error) {
        console.error('Error fetching boards:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

