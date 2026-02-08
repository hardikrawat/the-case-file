import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiscoverPage from '@/app/page';
import { db } from '@/lib/db';

// Mock DB
vi.mock('@/lib/db', () => ({
    db: {
        query: {
            boards: {
                findMany: vi.fn(),
            },
            userReputation: {
                findMany: vi.fn(),
            },
        },
    },
}));

// Mock NextAuth Server
vi.mock('@/auth', () => ({
    auth: vi.fn(() => Promise.resolve(null)),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
}));

// Mock NextAuth Client (for components inside)
vi.mock('next-auth/react', () => ({
    useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
    SessionProvider: ({ children }: any) => <>{children}</>,
}));

// Mock Link matches next/link usage
vi.mock('next/link', () => ({
    default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Search: () => <div data-testid="search-icon" />,
    Flame: () => <div data-testid="flame-icon" />,
    Clock: () => <div data-testid="clock-icon" />,
    Award: () => <div data-testid="award-icon" />,
    Fingerprint: () => <div data-testid="fingerprint-icon" />,
}));


describe('DiscoverPage', () => {
    it('should render empty state correctly', async () => {
        (db.query.boards.findMany as any).mockResolvedValue([]);
        (db.query.userReputation.findMany as any).mockResolvedValue([]);

        const ui = await DiscoverPage();
        render(ui);

        // Expect specific text
        expect(screen.getByText('THE CASE FILE')).toBeInTheDocument();
        expect(screen.getByText('Sign In to Start')).toBeInTheDocument();
    });

    it('should render public boards and top detectives', async () => {
        const mockBoards = [
            { id: '1', title: 'Board One', createdAt: new Date(), isPublic: true },
            { id: '2', title: 'Board Two', createdAt: new Date(), isPublic: true },
        ];
        const mockDetectives = [
            { userId: 'u1', points: 100, user: { name: 'Sherlock' } },
            { userId: 'u2', points: 80, user: { name: 'Watson' } },
        ];

        (db.query.boards.findMany as any).mockResolvedValue(mockBoards);
        (db.query.userReputation.findMany as any).mockResolvedValue(mockDetectives);

        const ui = await DiscoverPage();
        render(ui);

        expect(screen.getByText('Board One')).toBeInTheDocument();
        expect(screen.getByText('Board Two')).toBeInTheDocument();
        expect(screen.getByText('Sherlock')).toBeInTheDocument();
        expect(screen.getByText('Watson')).toBeInTheDocument();
    });
});
