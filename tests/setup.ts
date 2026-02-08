import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        refresh: vi.fn(),
    }),
    useSearchParams: () => ({
        get: vi.fn(),
    }),
    usePathname: () => '',
}));

// Mock NextAuth
vi.mock('@/auth', () => ({
    auth: vi.fn(() => Promise.resolve({
        user: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
        },
    })),
}));

// Global test setup
globalThis.fetch = vi.fn();
