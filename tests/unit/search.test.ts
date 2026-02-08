import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchDatabase } from '@/lib/search';
import { db } from '@/lib/db';

describe('Search Functionality', () => {
    const mockBoard = {
        id: 'board-1',
        title: 'Test Investigation',
        userId: 'test-user',
        userName: 'Test User',
        isPublic: true,
        thumbnail: null,
        createdAt: new Date(),
    };

    const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: null,
    };

    describe('searchDatabase', () => {
        it('should search boards by title', async () => {
            // Mock boards query
            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnThis(),
                leftJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([mockBoard]),
            } as any);

            // Mock users query
            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([]),
            } as any);

            const results = await searchDatabase('investigation', 'test-user');
            expect(Array.isArray(results.boards)).toBe(true);
            expect(results.boards).toHaveLength(1);
            expect(results.boards[0].title).toBe('Test Investigation');
        });

        it('should return empty results for no matches', async () => {
            // Mock boards query (empty)
            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnThis(),
                leftJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([]),
            } as any);

            // Mock users query (empty)
            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([]),
            } as any);

            const results = await searchDatabase('xyz123nonex', 'test-user');
            expect(results.boards.length).toBe(0);
            expect(results.users.length).toBe(0);
        });

        it('should search users by name', async () => {
            // Mock boards query (empty)
            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnThis(),
                leftJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([]),
            } as any);

            // Mock users query (match)
            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([mockUser]),
            } as any);

            const results = await searchDatabase('test', 'test-user');
            expect(Array.isArray(results.users)).toBe(true);
            expect(results.users).toHaveLength(1);
            expect(results.users[0].name).toBe('Test User');
        });

        it('should filter private boards from other users', async () => {
            const privateBoard = { ...mockBoard, isPublic: false, userId: 'other-user' };

            // Mock boards query to return a private board from another user
            // The SQL query itself might filter this, but our function also has a filter check provided the DB returns it.
            // Since we are mocking the DB return, let's verify the JS filter logic which is:
            // board.isPublic || board.userId === userId
            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnThis(),
                leftJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([privateBoard]),
            } as any);

            // Mock users query
            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([]),
            } as any);

            const results = await searchDatabase('private', 'other-user-viewer'); // searching as a different user

            // The function in search.ts does:
            // const filteredBoards = boardResults.filter(
            //    board => board.isPublic || board.userId === userId
            // );

            // Expected: 0 because privateBoard is not public and userId mismatch
            const privateBoards = results.boards.filter(b => !b.isPublic);
            expect(results.boards.length).toBe(0);
        });
    });
});
