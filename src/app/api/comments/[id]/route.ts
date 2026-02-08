import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { comments } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateCommentSchema = z.object({
    content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
});

// PUT /api/comments/[id]
export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();

        // Validate with Zod
        const validationResult = updateCommentSchema.safeParse(body);
        if (!validationResult.success) {
            const errors = validationResult.error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message
            }));
            return NextResponse.json(
                { error: 'Invalid input', details: errors },
                { status: 400 }
            );
        }

        const { content } = validationResult.data;

        // Verify ownership
        const existingComment = await db.select()
            .from(comments)
            .where(eq(comments.id, params.id))
            .limit(1);

        if (existingComment.length === 0) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        if (existingComment[0].userId !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const updated = await db.update(comments)
            .set({
                content,
                updatedAt: new Date(),
            })
            .where(eq(comments.id, params.id))
            .returning();

        return NextResponse.json(updated[0]);
    } catch (error) {
        console.error('Update comment error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/comments/[id]
export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership
        const existingComment = await db.select()
            .from(comments)
            .where(eq(comments.id, params.id))
            .limit(1);

        if (existingComment.length === 0) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        if (existingComment[0].userId !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await db.delete(comments).where(eq(comments.id, params.id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete comment error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
