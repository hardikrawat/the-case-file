
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

        // Return user data along with reputation stats
        return NextResponse.json({
            ...user,
            reputationPoints: user.reputation?.points || 0,
            boardsCreated: user.reputation?.boardsCreated || 0,
            contributionsAccepted: user.reputation?.contributionsAccepted || 0,
        });

    } catch (error) {
        console.error("[ME_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
