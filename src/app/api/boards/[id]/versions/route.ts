import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boardVersions, users } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getBoardAccess } from '@/lib/auth-checks';
import { checkRateLimit } from '@/lib/rate-limit';

import { z } from 'zod';

const createVersionSchema = z.object({
    content: z.union([z.record(z.string(), z.unknown()), z.string()]),
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
    title: z.string().max(120).optional(),
    isManual: z.boolean().optional().default(true),
});

const MAX_VERSION_SIZE_BYTES = 5 * 1024 * 1024; // 5MB payload limit

// GET /api/boards/[id]/versions
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        if (!params.id || typeof params.id !== 'string') {
            return NextResponse.json({ error: 'Valid board ID is required' }, { status: 400 });
        }

        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await checkRateLimit(`versions:${session.user.id}`, 30, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
        }

        // Check if user has access to view versions (owner or collaborator)
        const access = await getBoardAccess(params.id, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        if (!access.canView) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

        // Order descending so index 0 is the newest (Latest) version, joined with author details
        const versions = await db.select({
            id: boardVersions.id,
            boardId: boardVersions.boardId,
            content: boardVersions.content,
            createdBy: boardVersions.createdBy,
            createdAt: boardVersions.createdAt,
            creatorName: users.name,
            creatorImage: users.image,
        })
            .from(boardVersions)
            .leftJoin(users, eq(boardVersions.createdBy, users.id))
            .where(eq(boardVersions.boardId, params.id))
            .orderBy(desc(boardVersions.createdAt))
            .limit(limit)
            .offset(offset);

        const mapped = versions.map((v) => {
            let notes: string | null = null;
            let isManual = false;
            let parsedContent = v.content;
            if (typeof v.content === 'string') {
                try {
                    parsedContent = JSON.parse(v.content);
                } catch {
                    parsedContent = {};
                }
            }
            if (parsedContent && typeof parsedContent === 'object' && '_metadata' in (parsedContent as Record<string, unknown>)) {
                const meta = (parsedContent as Record<string, unknown>)._metadata as Record<string, unknown>;
                notes = typeof meta?.notes === 'string' ? meta.notes : null;
                isManual = Boolean(meta?.isManual);
            }
            return {
                ...v,
                notes,
                isManual,
            };
        });

        return NextResponse.json(mapped);
    } catch (error) {
        console.error('Get versions error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/boards/[id]/versions
export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        if (!params.id || typeof params.id !== 'string') {
            return NextResponse.json({ error: 'Valid board ID is required' }, { status: 400 });
        }

        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await checkRateLimit(`versions:${session.user.id}`, 30, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
        }

        // Check if user can create versions (owner or editor)
        const access = await getBoardAccess(params.id, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        if (!access.canEdit) {
            return NextResponse.json({ error: 'Forbidden: Only owners and editors can create versions' }, { status: 403 });
        }

        const rawBodyText = await req.text();
        if (rawBodyText.length > MAX_VERSION_SIZE_BYTES) {
            return NextResponse.json({ error: 'Version payload exceeds maximum allowed size (5MB)' }, { status: 413 });
        }

        let body: unknown;
        try {
            body = JSON.parse(rawBodyText);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
        }

        const validationResult = createVersionSchema.safeParse(body);
        if (!validationResult.success) {
            const errors = validationResult.error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
            }));
            return NextResponse.json({ error: 'Invalid input', details: errors }, { status: 400 });
        }

        const { content, notes, title, isManual } = validationResult.data;

        let contentObj = content;
        if (typeof content === 'string') {
            try {
                contentObj = JSON.parse(content);
            } catch {
                contentObj = { raw: content };
            }
        }

        // Strip HTML/script tags from notes for stored XSS protection
        const rawNote = (notes || title || '').toString();
        const noteStr = rawNote.replace(/<[^>]*>?/gm, '').trim().slice(0, 500);

        if (noteStr || isManual !== undefined) {
            contentObj = {
                ...(typeof contentObj === 'object' && contentObj !== null ? contentObj : {}),
                _metadata: {
                    notes: noteStr || undefined,
                    isManual: Boolean(isManual),
                }
            };
        }

        const newVersion = await db.insert(boardVersions).values({
            id: createId(),
            boardId: params.id,
            content: contentObj as Record<string, unknown>,
            createdBy: session.user.id,
            createdAt: new Date(),
        }).returning();

        return NextResponse.json({
            ...newVersion[0],
            notes: noteStr || null,
            isManual: Boolean(isManual),
            creatorName: session.user.name,
            creatorImage: session.user.image,
        }, { status: 201 });
    } catch (error) {
        console.error('Create version error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
