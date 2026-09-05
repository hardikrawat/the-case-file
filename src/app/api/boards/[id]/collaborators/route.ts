import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boardCollaborators, users, boards, notifications } from '@/lib/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import { getBoardAccess } from '@/lib/auth-checks';
import { checkRateLimit } from '@/lib/rate-limit';

const addCollaboratorSchema = z.object({
    userId: z.string().optional(),
    userEmail: z.string().email().optional(),
    role: z.enum(['viewer', 'editor']).default('viewer'),
}).refine((data) => data.userId || data.userEmail, {
    message: 'Either userId or userEmail is required',
});

const patchCollaboratorSchema = z.object({
    collaboratorId: z.string().optional(),
    userId: z.string().optional(),
    role: z.enum(['viewer', 'editor']),
}).refine((data) => data.collaboratorId || data.userId, {
    message: 'Either collaboratorId or userId is required',
});

// GET /api/boards/[id]/collaborators
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await checkRateLimit(`collaborators:${session.user.id}`, 30, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
        }

        const access = await getBoardAccess(params.id, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }
        if (!access.canView) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch active (non-soft-deleted) external collaborators
        const collaborators = await db.select({
            id: boardCollaborators.id,
            userId: boardCollaborators.userId,
            role: boardCollaborators.role,
            addedAt: boardCollaborators.addedAt,
            userName: users.name,
            userEmail: users.email,
            userImage: users.image,
        })
            .from(boardCollaborators)
            .leftJoin(users, eq(boardCollaborators.userId, users.id))
            .where(
                and(
                    eq(boardCollaborators.boardId, params.id),
                    isNull(boardCollaborators.deletedAt)
                )
            );

        // Fetch owner details to include in the live member roster
        const ownerDetails = await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
        })
            .from(users)
            .where(eq(users.id, access.board.userId))
            .limit(1);

        const ownerUser = ownerDetails[0];
        const fullRoster = [
            {
                id: `owner-${access.board.userId}`,
                userId: access.board.userId,
                role: 'owner' as const,
                addedAt: access.board.createdAt || new Date(),
                userName: ownerUser?.name || 'Lead Detective (Owner)',
                userEmail: ownerUser?.email || null,
                userImage: ownerUser?.image || null,
                isLeadOwner: true,
            },
            ...collaborators.map((c) => ({ ...c, isLeadOwner: false })),
        ];

        return NextResponse.json(fullRoster);
    } catch (error) {
        console.error('Get collaborators error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/boards/[id]/collaborators
export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await checkRateLimit(`collaborators:${session.user.id}`, 30, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
        }

        const access = await getBoardAccess(params.id, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }
        if (!access.isOwner) {
            return NextResponse.json({ error: 'Forbidden: Only board owner can add collaborators' }, { status: 403 });
        }

        const body = await req.json();
        const validationResult = addCollaboratorSchema.safeParse(body);
        if (!validationResult.success) {
            const errors = validationResult.error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
            }));
            return NextResponse.json({ error: 'Invalid input', details: errors }, { status: 400 });
        }

        const { userId, userEmail, role } = validationResult.data;

        let targetUserId = userId?.trim();
        let targetUserEmail = userEmail?.trim();

        // If targetUserId given, check if user exists
        if (targetUserId) {
            const foundById = await db.select({ id: users.id, email: users.email })
                .from(users)
                .where(eq(users.id, targetUserId))
                .limit(1);

            if (foundById.length === 0) {
                return NextResponse.json({ error: 'Detective not found with this User ID' }, { status: 404 });
            }
            targetUserEmail = foundById[0].email;
        } else if (targetUserEmail) {
            const foundByEmail = await db.select({ id: users.id })
                .from(users)
                .where(eq(users.email, targetUserEmail))
                .limit(1);

            if (foundByEmail.length === 0) {
                return NextResponse.json({ error: 'User not found with this email' }, { status: 404 });
            }
            targetUserId = foundByEmail[0].id;
        }

        if (!targetUserId) {
            return NextResponse.json({ error: 'User ID could not be determined' }, { status: 400 });
        }

        // Check if target is already board owner
        if (targetUserId === access.board.userId) {
            return NextResponse.json({ error: 'User is the board owner' }, { status: 400 });
        }

        // Check existing record (including soft-deleted)
        const existing = await db.select()
            .from(boardCollaborators)
            .where(
                and(
                    eq(boardCollaborators.boardId, params.id),
                    eq(boardCollaborators.userId, targetUserId)
                )
            )
            .limit(1);

        let collaboratorResult;

        if (existing.length > 0) {
            const record = existing[0];
            if (!record.deletedAt) {
                return NextResponse.json({ error: 'User is already an active collaborator' }, { status: 400 });
            }

            // Reactivate soft-deleted collaborator
            const reactivated = await db.update(boardCollaborators)
                .set({
                    role,
                    addedAt: new Date(),
                    deletedAt: null,
                })
                .where(eq(boardCollaborators.id, record.id))
                .returning();
            collaboratorResult = reactivated[0];
        } else {
            // Insert new collaborator
            const created = await db.insert(boardCollaborators).values({
                id: createId(),
                boardId: params.id,
                userId: targetUserId,
                role,
                addedAt: new Date(),
                deletedAt: null,
            }).returning();
            collaboratorResult = created[0];
        }

        // Dispatch notification to invited detective
        try {
            await db.insert(notifications).values({
                id: createId(),
                recipientId: targetUserId,
                actorId: session.user.id,
                type: 'collaborator_added',
                referenceId: params.id,
                referenceType: 'board',
                message: `You have been granted ${role} clearance on case file "${access.board.title}".`,
                isRead: false,
                createdAt: new Date(),
            });
        } catch (notifErr) {
            console.warn('Failed to dispatch collaborator notification:', notifErr);
        }

        return NextResponse.json(collaboratorResult, { status: 201 });
    } catch (error) {
        console.error('Add collaborator error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/boards/[id]/collaborators
export async function PATCH(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await checkRateLimit(`collaborators:${session.user.id}`, 30, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
        }

        const access = await getBoardAccess(params.id, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }
        if (!access.isOwner) {
            return NextResponse.json({ error: 'Forbidden: Only board owner can update collaborator roles' }, { status: 403 });
        }

        const body = await req.json();
        const validationResult = patchCollaboratorSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input', details: validationResult.error.issues }, { status: 400 });
        }

        const { collaboratorId, userId, role } = validationResult.data;

        const condition = collaboratorId
            ? and(eq(boardCollaborators.id, collaboratorId), eq(boardCollaborators.boardId, params.id), isNull(boardCollaborators.deletedAt))
            : and(eq(boardCollaborators.userId, userId!), eq(boardCollaborators.boardId, params.id), isNull(boardCollaborators.deletedAt));

        const updated = await db.update(boardCollaborators)
            .set({ role })
            .where(condition)
            .returning();

        if (updated.length === 0) {
            return NextResponse.json({ error: 'Active collaborator not found' }, { status: 404 });
        }

        // Notify collaborator of clearance change
        try {
            await db.insert(notifications).values({
                id: createId(),
                recipientId: updated[0].userId,
                actorId: session.user.id,
                type: 'role_updated',
                referenceId: params.id,
                referenceType: 'board',
                message: `Your clearance on "${access.board.title}" was updated to ${role}.`,
                isRead: false,
                createdAt: new Date(),
            });
        } catch (notifErr) {
            console.warn('Failed to dispatch role update notification:', notifErr);
        }

        return NextResponse.json(updated[0], { status: 200 });
    } catch (error) {
        console.error('Update collaborator error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/boards/[id]/collaborators
// Soft-delete safeguards (deletedAt) protecting collaborator records against data loss
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

        const rateLimit = await checkRateLimit(`collaborators:${session.user.id}`, 30, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
        }

        const access = await getBoardAccess(params.id, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }
        if (!access.isOwner) {
            return NextResponse.json({ error: 'Forbidden: Only board owner can remove collaborators' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        let collaboratorId = searchParams.get('collaboratorId');
        let userId = searchParams.get('userId');

        // Fallback to body if not in query params
        if (!collaboratorId && !userId) {
            try {
                const body = await req.json();
                collaboratorId = body.collaboratorId;
                userId = body.userId;
            } catch {
                // Ignore body parse failure
            }
        }

        if (!collaboratorId && !userId) {
            return NextResponse.json({ error: 'collaboratorId or userId parameter is required' }, { status: 400 });
        }

        const condition = collaboratorId
            ? and(eq(boardCollaborators.id, collaboratorId), eq(boardCollaborators.boardId, params.id), isNull(boardCollaborators.deletedAt))
            : and(eq(boardCollaborators.userId, userId!), eq(boardCollaborators.boardId, params.id), isNull(boardCollaborators.deletedAt));

        // Soft-delete safeguard: set deletedAt timestamp instead of destroying record
        const softDeleted = await db.update(boardCollaborators)
            .set({ deletedAt: new Date() })
            .where(condition)
            .returning();

        if (softDeleted.length === 0) {
            return NextResponse.json({ error: 'Active collaborator not found' }, { status: 404 });
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Collaborator clearance revoked (safely archived)',
            collaboratorId: softDeleted[0].id
        }, { status: 200 });
    } catch (error) {
        console.error('Delete collaborator error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
