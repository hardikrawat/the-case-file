import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { notifications, users } from '@/lib/schema';
import { eq, desc, and } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(`notifications:get:${session.user.id}`, 60, 60000);
    if (!rateLimit.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const userNotifications = await db.select({
            id: notifications.id,
            type: notifications.type,
            referenceId: notifications.referenceId,
            referenceType: notifications.referenceType,
            message: notifications.message,
            isRead: notifications.isRead,
            createdAt: notifications.createdAt,
            actorName: users.name,
            actorImage: users.image,
        })
            .from(notifications)
            .leftJoin(users, eq(notifications.actorId, users.id))
            .where(eq(notifications.recipientId, session.user.id))
            .orderBy(desc(notifications.createdAt))
            .limit(30);

        const unreadCount = userNotifications.filter(n => !n.isRead).length;

        return NextResponse.json({
            notifications: userNotifications,
            unreadCount,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const notificationId = searchParams.get('id');

        if (notificationId) {
            // Mark single notification as read
            await db.update(notifications)
                .set({ isRead: true })
                .where(and(
                    eq(notifications.id, notificationId),
                    eq(notifications.recipientId, session.user.id)
                ));
        } else {
            // Mark all notifications for user as read
            await db.update(notifications)
                .set({ isRead: true })
                .where(eq(notifications.recipientId, session.user.id));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating notifications:', error);
        return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
    }
}
