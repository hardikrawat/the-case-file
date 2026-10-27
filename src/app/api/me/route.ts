
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await db.query.users.findFirst({
            where: eq(users.email, session.user.email),
            with: {
                reputation: true,
            },
        });

        if (!user) {
            return new NextResponse("User not found", { status: 404 });
        }

        // Exclude passwordHash and any raw password fields
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...safeUser } = user as typeof user & { password_hash?: string };

        // Return user data along with reputation stats
        const rep = user.reputation as unknown as { points: number; boardsCreated: number; contributionsAccepted: number } | null;

        return NextResponse.json({
            ...safeUser,
            reputationPoints: rep?.points || 0,
            boardsCreated: rep?.boardsCreated || 0,
            contributionsAccepted: rep?.contributionsAccepted || 0,
        });

    } catch (error) {
        console.error("[ME_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
