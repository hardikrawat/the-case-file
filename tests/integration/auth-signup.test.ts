import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/signup/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import * as passwordLib from '@/lib/password';
import * as authUtils from '@/lib/auth-utils';

// Mock Next.js modules
vi.mock('next/server', () => ({
    NextRequest: vi.fn(),
    NextResponse: {
        json: vi.fn((data, init) => ({ data, status: init?.status || 200 })),
    },
}));

// Mock DB
vi.mock('@/lib/db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue({}),
    },
}));

// Mock password lib
vi.mock('@/lib/password', () => ({
    hashPassword: vi.fn().mockResolvedValue('hashed_password'),
}));

// Mock auth utils
vi.mock('@/lib/auth-utils', () => ({
    createVerificationToken: vi.fn().mockResolvedValue('verification_token'),
}));

// Mock cuid
vi.mock('@paralleldrive/cuid2', () => ({
    createId: vi.fn().mockReturnValue('user_id_123'),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 3600000 }),
}));

describe('POST /api/auth/signup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createRequest = (body: any) => ({
        json: async () => body,
        headers: {
            get: vi.fn().mockReturnValue('127.0.0.1'),
        },
    } as unknown as NextRequest);

    it('should create a new user successfully', async () => {
        const req = createRequest({
            name: 'Test User',
            email: 'test@example.com',
            password: 'StrongPassword123!',
        });

        const response = await POST(req) as any;

        expect(response.status).toBe(201);
        expect(response.data.success).toBe(true);
        expect(response.data.userId).toBe('user_id_123');
        expect(db.insert).toHaveBeenCalled();
        expect(authUtils.createVerificationToken).toHaveBeenCalledWith('user_id_123');
    });

    it('should return 400 if fields are missing', async () => {
        const req = createRequest({
            name: 'Test User',
            // Missing email and password
        });

        const response = await POST(req) as any;

        expect(response.status).toBe(400);
        expect(response.data.error).toContain('Invalid input');
    });

    it('should return 400 for invalid email', async () => {
        const req = createRequest({
            name: 'Test User',
            email: 'invalid-email',
            password: 'StrongPassword123!',
        });

        const response = await POST(req) as any;

        expect(response.status).toBe(400);
        expect(response.data.error).toContain('Invalid input');
    });

    it('should return 400 for weak password', async () => {
        const req = createRequest({
            name: 'Test User',
            email: 'test@example.com',
            password: '123',
        });

        const response = await POST(req) as any;

        expect(response.status).toBe(400);
        expect(response.data.error).toContain('Invalid input');
    });

    it('should return 409 if user already exists', async () => {
        // Mock existing user
        vi.mocked(db.select).mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'existing' }]),
        } as any);

        const req = createRequest({
            name: 'Test User',
            email: 'existing@example.com',
            password: 'StrongPassword123!',
        });

        const response = await POST(req) as any;

        expect(response.status).toBe(409);
        expect(response.data.error).toContain('already registered');
    });

    it('should return 500 on server error', async () => {
        vi.mocked(db.select).mockImplementationOnce(() => {
            throw new Error('DB Error');
        });

        const req = createRequest({
            name: 'Test User',
            email: 'test@example.com',
            password: 'StrongPassword123!',
        });

        const response = await POST(req) as any;

        expect(response.status).toBe(500);
        expect(response.data.error).toContain('Internal server error');
    });
});
