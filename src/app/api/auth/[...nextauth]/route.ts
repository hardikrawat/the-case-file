import { handlers } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const { GET, POST: NextAuthPOST } = handlers;

export { GET };

export async function POST(req: NextRequest) {
    // 1. Rate Limiting (IP-based) - Prevent brute force
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // Allow 10 login attempts per minute per IP
    const rateLimit = await checkRateLimit(`auth:${ip}`, 10, 60000);

    if (!rateLimit.success) {
        return NextResponse.json(
            { error: 'Too many login attempts. Please try again later.' },
            { status: 429 }
        );
    }

    return NextAuthPOST(req);
}
