import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/detective/sessions/route';
import { auth } from '@/auth';
import { db } from '@/lib/db';

// Mock Next.js server modules
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({ data, status: init?.status || 200 })),
  },
}));

// Mock auth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      detectiveSessions: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    delete: vi.fn().mockReturnThis(),
  },
}));

// Mock cuid
vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn().mockReturnValue('session-cuid-123'),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

describe('/api/detective/sessions API', () => {
  const mockUser = { id: 'user-det-1', name: 'Sherlock' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (url: string, method: string = 'GET', body?: unknown) => ({
    url,
    method,
    json: async () => body,
  } as unknown as Request);

  describe('GET /api/detective/sessions', () => {
    it('should return 401 if unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as any);
      const req = createRequest('http://localhost:3000/api/detective/sessions?boardId=board-1');
      const res = await GET(req) as any;
      expect(res.status).toBe(401);
      expect(res.data.error).toBe('Unauthorized');
    });

    it('should return 400 if boardId is omitted', async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      const req = createRequest('http://localhost:3000/api/detective/sessions');
      const res = await GET(req) as any;
      expect(res.status).toBe(400);
      expect(res.data.error).toBe('boardId is required');
    });

    it('should fetch sessions including builderState and lastAnalysis', async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      const mockSessions = [
        {
          id: 'sess-1',
          boardId: 'board-1',
          userId: 'user-det-1',
          messages: [{ id: 'm1', role: 'user', content: 'Hello' }],
          lastAnalysis: { summary: 'Analysis summary', confidenceScore: 85 },
          builderState: { statement: 'Mystery at manor', mode: 'replace', density: 'balanced' },
          updatedAt: new Date(),
        },
      ];
      vi.mocked(db.query.detectiveSessions.findMany).mockResolvedValue(mockSessions as any);

      const req = createRequest('http://localhost:3000/api/detective/sessions?boardId=board-1');
      const res = await GET(req) as any;

      expect(res.status).toBe(200);
      expect(res.data.sessions).toHaveLength(1);
      expect(res.data.sessions[0].builderState.statement).toBe('Mystery at manor');
      expect(res.data.sessions[0].lastAnalysis.summary).toBe('Analysis summary');
    });
  });

  describe('POST /api/detective/sessions', () => {
    it('should return 401 if unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as any);
      const req = createRequest('http://localhost:3000/api/detective/sessions', 'POST', { boardId: 'board-1' });
      const res = await POST(req) as any;
      expect(res.status).toBe(401);
    });

    it('should create new session with builderState and lastAnalysis when none exists', async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      vi.mocked(db.query.detectiveSessions.findFirst).mockResolvedValue(null as any);

      const createdSession = {
        id: 'session-cuid-123',
        boardId: 'board-1',
        userId: 'user-det-1',
        messages: [],
        lastAnalysis: { summary: 'Fresh intelligence' },
        builderState: { statement: 'New case report', density: 'comprehensive' },
      };
      vi.mocked((db as any).returning).mockResolvedValue([createdSession] as any);

      const payload = {
        boardId: 'board-1',
        lastAnalysis: { summary: 'Fresh intelligence' },
        builderState: { statement: 'New case report', density: 'comprehensive' },
      };

      const req = createRequest('http://localhost:3000/api/detective/sessions', 'POST', payload);
      const res = await POST(req) as any;

      expect(res.status).toBe(200);
      expect(res.data.session.id).toBe('session-cuid-123');
      expect(res.data.session.builderState.statement).toBe('New case report');
      expect(res.data.session.lastAnalysis.summary).toBe('Fresh intelligence');
    });

    it('should atomically update existing session for board without creating duplicate', async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      const existing = {
        id: 'existing-sess-1',
        boardId: 'board-1',
        userId: 'user-det-1',
        messages: [{ id: 'msg-1' }],
        lastAnalysis: null,
        builderState: null,
      };
      vi.mocked(db.query.detectiveSessions.findFirst).mockResolvedValue(existing as any);

      const updated = {
        ...existing,
        lastAnalysis: { summary: 'Updated intelligence' },
        builderState: { statement: 'Updated narrative' },
      };
      vi.mocked((db as any).returning).mockResolvedValue([updated] as any);

      const payload = {
        boardId: 'board-1',
        lastAnalysis: { summary: 'Updated intelligence' },
        builderState: { statement: 'Updated narrative' },
      };

      const req = createRequest('http://localhost:3000/api/detective/sessions', 'POST', payload);
      const res = await POST(req) as any;

      expect(res.status).toBe(200);
      expect(res.data.session.id).toBe('existing-sess-1');
      expect(res.data.session.builderState.statement).toBe('Updated narrative');
    });

    it('should prevent cross-board leakage when sessionId from Board A is sent for Board B', async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      
      const boardBSession = {
        id: 'board-b-sess',
        boardId: 'board-b',
        userId: 'user-det-1',
      };

      vi.mocked(db.query.detectiveSessions.findFirst)
        .mockResolvedValueOnce(null as any) // sessionId check fails because boardId mismatch
        .mockResolvedValueOnce(boardBSession as any); // fallback finds Board B session

      const updated = {
        ...boardBSession,
        builderState: { statement: 'Board B narrative' },
      };
      vi.mocked((db as any).returning).mockResolvedValue([updated] as any);

      const payload = {
        boardId: 'board-b',
        sessionId: 'board-a-sess', // stale sessionId from Board A!
        builderState: { statement: 'Board B narrative' },
      };

      const req = createRequest('http://localhost:3000/api/detective/sessions', 'POST', payload);
      const res = await POST(req) as any;

      expect(res.status).toBe(200);
      // Correctly targets Board B's session, NOT Board A
      expect(res.data.session.id).toBe('board-b-sess');
    });
  });

  describe('DELETE /api/detective/sessions', () => {
    it('should clear only messages when clearMessagesOnly=true is passed', async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      const req = createRequest('http://localhost:3000/api/detective/sessions?boardId=board-1&clearMessagesOnly=true', 'DELETE');
      const res = await DELETE(req) as any;

      expect(res.status).toBe(200);
      expect(res.data.clearedMessages).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it('should delete full session when clearMessagesOnly is not set', async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      const req = createRequest('http://localhost:3000/api/detective/sessions?sessionId=sess-1', 'DELETE');
      const res = await DELETE(req) as any;

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });
  });
});
