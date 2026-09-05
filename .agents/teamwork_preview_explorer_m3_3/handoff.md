# Handoff Report: Milestone 3 Explorer 3 — Mounting Orphaned Panels & API Wiring (F22 - F25)

**Agent**: `teamwork_preview_explorer_m3_3`  
**Milestone**: Milestone 3 (Canvas Board & Orphaned Panels Wiring)  
**Parent**: Sub-Orchestrator M3 (`9fbe4361-8197-45dd-97fb-cda3d97e6796`)  
**Scope**: Features 22, 23, 24, 25 (CommentsPanel, CollaboratorsPanel, VersionHistory, ExportModal & backend endpoint wiring)  
**Date**: 2026-09-04T22:00:00+05:30  

---

## 1. Observation

### 1.1 UI Mounting & Control State in `Board.tsx`
- **File**: `src/components/Board.tsx` (Lines 284–435)
  - `Board.tsx` imports and mounts `BoardSettingsModal` (line 284) and `ContributionModal` (line 289), but has **zero** imports or JSX mounting for `CommentsPanel`, `CollaboratorsPanel`, `VersionHistory`, or `ExportModal`.
  - In `src/components/Board.tsx` (lines 326–403), the top action bar contains buttons for `Refresh`, `Save`, `Fork`, `Suggest Changes` / `Review Suggestions`, `Settings`, and `Share`. There are no buttons to toggle Comments, Collaborators, Version History, or Export.
  - In `tests/e2e/helpers/canvas-helpers.ts` (lines 76–89), `openPanel` expects:
    ```typescript
    const panelBtnMap: Record<string, string> = {
        comments: 'button[aria-label="Toggle Comments"], button:has-text("Comments"), [data-testid="toggle-comments"]',
        collaborators: 'button[aria-label="Collaborators"], button:has-text("Team"), [data-testid="toggle-collaborators"]',
        history: 'button[aria-label="Version History"], button:has-text("History"), [data-testid="toggle-history"]',
        export: 'button[aria-label="Export Board"], button:has-text("Export"), [data-testid="toggle-export"]',
    };
    ```
  - In `tests/e2e/tier1/panels.spec.ts`:
    - Line 140: `page.locator('button:has-text("Comments"), button[title="Comments"], [data-testid="toggle-comments"]')` (without `.first()`, enforcing Playwright strict mode: exactly 1 matching element).
    - Line 166: `page.locator('button:has-text("Collaborators"), button:has-text("Team"), button[title="Collaborators"], [data-testid="toggle-collaborators"]')` (strict mode: exactly 1 matching element).
    - Line 262: `page.locator('button:has-text("History"), button[title="Version History"], [data-testid="toggle-history"]')` (strict mode: exactly 1 matching element).
    - Line 366: `page.locator('button:has-text("Export"), button[title="Export Board"], button[title="Export JSON"], [data-testid="toggle-export"]').first()`
    - Line 425–426: `page.locator('button:has-text("PNG"), [data-testid="export-png"]')` and `page.locator('button:has-text("PDF"), [data-testid="export-pdf"]')`.

### 1.2 Orphaned Panels Internal Structure
- **`src/components/CommentsPanel.tsx`** (Lines 20–79):
  - Manages internal state `const [isOpen, setIsOpen] = useState(false)`.
  - When `!isOpen`, returns a fixed floating button:
    ```tsx
    <button onClick={() => { setIsOpen(true); loadComments(); }} className="fixed bottom-6 right-6 ...">
        💬 Comments
    </button>
    ```
    If `Board.tsx` mounts a top-bar button with text "Comments" while `CommentsPanel` also renders its floating button with text "Comments", Playwright strict mode will throw a violation error (`strict mode violation: locator resolved to 2 elements`).
  - Does not accept controlled `isOpen` or `onClose` props.
- **`src/components/CollaboratorsPanel.tsx`** (Lines 21–106):
  - Manages internal state `const [isOpen, setIsOpen] = useState(false)` and renders a fixed floating button with text `Team` (`<Users className="w-4 h-4" /> Team`) at `bottom-40 right-6`.
  - In `handleRemove` (line 70): calls `fetch('/api/boards/${boardId}/collaborators/${collaboratorId}', { method: 'DELETE' })`.
  - Does not provide a role modification handler (`PATCH`) for existing collaborators.
  - Does not accept controlled `isOpen` or `onClose` props.
- **`src/components/VersionHistory.tsx`** (Lines 18–58):
  - Manages internal state `const [isOpen, setIsOpen] = useState(false)` and renders a fixed floating button at `bottom-24 right-6` with text `History`.
  - In `handleRestore` (lines 37–42): calls `onRestore?.(version.content)`. `onRestore` is not wired to `Board.tsx`.
  - Does not accept controlled `isOpen` or `onClose` props.
- **`src/components/ExportModal.tsx`** (Lines 8–132):
  - Accepts `isOpen`, `onClose`, `boardId`, `boardData`, `boardElement`.
  - Formats: JSON, PNG, PDF.
  - Format buttons lack `data-testid="export-png"` and `data-testid="export-pdf"` attributes expected by `panels.spec.ts` (lines 425–426).
  - In `src/lib/export.ts` (lines 72–79): `exportBoard` throws `Error('Element required for PNG export')` and `Error('Element required for PDF export')` if `element` is undefined.
  - In `src/lib/export.ts` (lines 13–17): `exportToJSON` does not structure the payload with the standardized dossier schema expected by `tests/e2e/tier4/export-roundtrip.spec.ts` (`version: '1.0'`, `caseTitle`, `nodes`, `edges`).

### 1.3 Comments API Endpoint (`src/app/api/comments/route.ts`)
- **Lines 49–60**:
  ```typescript
  const results = await db.select()
      .from(comments)
      .where(and(...conditions))
      .orderBy(comments.createdAt);
  ```
  `GET` queries `comments` table directly without joining `users`. `userName` and `userImage` are missing from the response payload, causing `tests/e2e/tier1/panels.spec.ts` (T1-COMM-01) assertions to fail.
- **Line 14**:
  ```typescript
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  ```
  `content` is not trimmed. When given whitespace `'   '` or `'\n\t  \n'`, Zod considers length >= 1 valid, failing `tests/e2e/tier2/boundary.spec.ts` (T2-BOUND-02: `Empty & Whitespace Comments Rejection` expecting 400).
- **Lines 110–121**:
  `POST` inserts the comment and returns 201, but does **not** invoke `awardPoints(session.user.id, 'comment_posted')`, failing `tests/e2e/tier1/panels.spec.ts` (T1-COMM-02: `POST /api/comments Awards Reputation Points`).

### 1.4 Collaborators API Endpoint (`src/app/api/boards/[id]/collaborators/route.ts`)
- **Lines 11–14**:
  ```typescript
  const addCollaboratorSchema = z.object({
      userId: z.string().min(1, 'User ID is required'),
      role: z.enum(['viewer', 'editor', 'owner']).default('viewer'),
  });
  ```
  `POST` requires `userId`. It does not accept `userEmail`. However, `CollaboratorsPanel.tsx` (line 50) and `PROJECT.md` Contract specify accepting `{ userEmail: string, role: string }` or `{ userId: string, role: string }`, and resolving `userEmail` via `db.select().from(users).where(eq(users.email, userEmail))`.
- **Route Handlers**:
  `src/app/api/boards/[id]/collaborators/route.ts` only exports `GET` and `POST`. It contains **no** `DELETE` and **no** `PATCH` handlers, causing `T1-COL-03` (`PATCH /api/boards/[id]/collaborators`) and `T1-COL-04` (`DELETE /api/boards/[id]/collaborators`) to return 405 Method Not Allowed.

### 1.5 Version History API Endpoint (`src/app/api/boards/[id]/versions/route.ts`)
- **Line 40**:
  ```typescript
  const versions = await db.select()
      .from(boardVersions)
      .where(eq(boardVersions.boardId, params.id))
      .orderBy(boardVersions.createdAt);
  ```
  Ascending order puts the oldest version first. However, `VersionHistory.tsx` (lines 99–105) treats `index === 0` as the "Latest" version.
- **Save Snapshot Integration in `src/app/api/boards/[id]/route.ts`**:
  In `PUT /api/boards/[id]`, when board `content` is updated, no snapshot is written to `boardVersions`, and the board `version` column is not checked for optimistic concurrency conflict (409).

---

## 2. Logic Chain

1. **Strict-Mode Locator Collision Prevention**:
   - `panels.spec.ts` queries `page.locator('button:has-text("Comments"), button[title="Comments"], [data-testid="toggle-comments"]')` without `.first()`.
   - If `CommentsPanel` renders its own button while `Board.tsx` also renders a button matching "Comments", Playwright throws strict mode violation.
   - Therefore, `CommentsPanel`, `CollaboratorsPanel`, and `VersionHistory` must become controlled components that accept `isOpen` and `onClose` props. When `isOpen` is false, they render `null`. The single authoritative toggle button for each panel must live in `Board.tsx`'s top action bar with exact attributes `title`, `aria-label`, and `data-testid`.

2. **Comments Author Metadata Join**:
   - `T1-COMM-01` expects `{ id, boardId, content, userId, userName }` from `GET /api/comments`.
   - In `schema.ts`, `users` table has columns `id`, `name`, `image`.
   - By performing `db.select({ id: comments.id, boardId: comments.boardId, nodeId: comments.nodeId, userId: comments.userId, content: comments.content, parentId: comments.parentId, isAnonymous: comments.isAnonymous, createdAt: comments.createdAt, updatedAt: comments.updatedAt, userName: users.name, userImage: users.image }).from(comments).leftJoin(users, eq(comments.userId, users.id))`, the API directly supplies author details.
   - For anonymous comments (`isAnonymous === true`), mask `userName = 'Anonymous Detective'` and `userImage = null` so privacy is protected while fulfilling the contract.

3. **Reputation Awarding on Comment Creation**:
   - `reputation.ts` defines action `'comment_posted'` with delta `+2`.
   - Calling `await awardPoints(session.user.id, 'comment_posted')` inside `POST /api/comments` after inserting the comment fulfills `T1-COMM-02`.

4. **Whitespace Validation**:
   - `T2-BOUND-02` tests `['', '    ', '\n\t  \n']` expecting 400 Bad Request.
   - Updating `content: z.string().trim().min(1, 'Content is required').max(5000, 'Content too long')` strips leading/trailing whitespace before `.min(1)` check, guaranteeing that whitespace-only comments trigger a Zod 400 validation error.

5. **Collaborator Lookup, Role Modification & Deletion**:
   - To satisfy `T1-COL-02` and `CollaboratorsPanel.tsx`, `POST` must check if `userEmail` is provided. If so, lookup user ID in `users` table (`WHERE email = userEmail`). Return 404 if not found.
   - To satisfy `T1-COL-03` and RBAC tests, `PATCH /api/boards/[id]/collaborators` must verify caller `isOwner`, accept `{ collaboratorId?: string, userId?: string, role: 'viewer' | 'editor' }`, update `boardCollaborators.role`, and return 200.
   - To satisfy `T1-COL-04`, `DELETE /api/boards/[id]/collaborators` must verify caller `isOwner`, accept `?collaboratorId=<id>` or `?userId=<id>`, delete from `boardCollaborators`, and return 200.

6. **Version Snapshots, Chronology & Restore Workflow**:
   - Changing `GET /api/boards/[id]/versions` to `.orderBy(desc(boardVersions.createdAt))` orders versions newest-first so `index === 0` corresponds to "Latest".
   - In `Board.tsx`, `handleRestoreVersion` sets store nodes and edges and persists them via `PUT /api/boards/${boardId}`, fulfilling `T1-VER-04`.
   - In `src/app/api/boards/[id]/route.ts`, `PUT` updates `version = (access.board.version || 1) + 1` and inserts a snapshot into `boardVersions`, maintaining historical records automatically.

7. **Courtroom Dossier Export**:
   - `T1-EXP-01` and `T4-EXP` expect `ExportModal` to offer JSON, PNG, PDF.
   - Adding `data-testid="export-json"`, `data-testid="export-png"`, and `data-testid="export-pdf"` to format selector buttons ensures instant recognition by tests.
   - In `src/lib/export.ts`, fallback `element = element || (document.querySelector('.react-flow') as HTMLElement) || document.body` prevents "Element required" runtime exceptions.
   - Formatting JSON export as `{ version: '1.0', exportedAt: string, caseTitle: string, nodes: Node[], edges: Edge[] }` fulfills courtroom dossier roundtrip portability (`tests/e2e/tier4/export-roundtrip.spec.ts`).

---

## 3. Caveats

1. **Vitest Mock in `tests/integration/comments.test.ts`**:
   - In `tests/integration/comments.test.ts` line 24, `vi.mock('@/lib/db')` does not currently include `leftJoin`.
   - When the worker updates `GET /api/comments/route.ts` to call `.leftJoin(users, ...)`, running `npm run test:unit tests/integration/comments.test.ts` will fail unless `leftJoin: vi.fn().mockReturnThis()` is added to the Vitest mock in that test file.
2. **Mutual Exclusion of Drawer Panels**:
   - `CommentsPanel` and `CollaboratorsPanel` both sit at `fixed bottom-6 right-6 w-96`. To avoid overlapping panels, opening one panel should automatically close any other open side panel.
3. **Canvas Element Fallback for Headless Browsers**:
   - In headless Chromium, `document.querySelector('.react-flow')` is guaranteed to be in the DOM once `waitForBoardReady` resolves. Attaching a container `ref` in `Board.tsx` is still best practice for direct DOM node reference.

---

## 4. Conclusion & Implementation Blueprint

### File 1: `src/components/CommentsPanel.tsx`
Replace the entire component with controlled props and user join display:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Comment {
    id: string;
    userId: string;
    content: string;
    createdAt: string | Date;
    userName?: string | null;
    userImage?: string | null;
    parentId?: string | null;
    nodeId?: string | null;
}

interface CommentsUIProps {
    boardId: string;
    nodeId?: string | null;
    isOpen?: boolean;
    onClose?: () => void;
}

export function CommentsPanel({ boardId, nodeId, isOpen = false, onClose }: CommentsUIProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const loadComments = useCallback(async () => {
        try {
            const url = nodeId
                ? `/api/comments?boardId=${boardId}&nodeId=${nodeId}`
                : `/api/comments?boardId=${boardId}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setComments(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Failed to load comments:', error);
        }
    }, [boardId, nodeId]);

    useEffect(() => {
        if (isOpen) {
            loadComments();
        }
    }, [isOpen, loadComments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newComment.trim();
        if (!trimmed) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boardId,
                    nodeId: nodeId || null,
                    content: trimmed,
                }),
            });

            if (response.ok) {
                setNewComment('');
                toast.success('Comment posted (+2 Rep)');
                await loadComments();
            } else {
                const err = await response.json();
                toast.error(err.error || 'Failed to post comment');
            }
        } catch (error) {
            console.error('Failed to post comment:', error);
            toast.error('Network error posting comment');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            data-testid="comments-panel"
            className="fixed bottom-6 right-6 w-96 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[580px]"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-800 bg-stone-900/90">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-amber-500" />
                    <h3 className="font-semibold text-stone-200">
                        {nodeId ? 'Node Comments' : 'Board Comments'}
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    className="text-stone-400 hover:text-stone-200 transition-colors p-1 rounded"
                    title="Close Comments"
                    aria-label="Close Comments"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-950/50">
                {comments.length === 0 ? (
                    <div className="text-center py-12">
                        <MessageSquare className="w-10 h-10 text-stone-700 mx-auto mb-2 opacity-50" />
                        <p className="text-stone-500 text-sm">No comments yet</p>
                        <p className="text-stone-600 text-xs mt-1">Leave an investigative observation</p>
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="bg-stone-800/60 border border-stone-700/50 rounded-lg p-3">
                            <div className="flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-500 flex items-center justify-center text-stone-950 font-bold text-xs shrink-0">
                                    {(comment.userName || 'D')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-amber-400 truncate">
                                            {comment.userName || 'Detective'}
                                        </p>
                                        <span className="text-[10px] text-stone-500 shrink-0">
                                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-stone-200 mt-1 whitespace-pre-wrap break-words">
                                        {comment.content}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New Comment Form */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-stone-800 bg-stone-900">
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add an investigative comment..."
                    className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-200 placeholder-stone-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                    rows={2}
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading || !newComment.trim()}
                    className="mt-2 w-full py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                >
                    <Send className="w-4 h-4" />
                    {isLoading ? 'Posting...' : 'Post Comment'}
                </button>
            </form>
        </div>
    );
}
```

---

### File 2: `src/components/CollaboratorsPanel.tsx`
Update to controlled component, wire `PATCH` role modification and `DELETE ?collaboratorId=...`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, X, Plus, Shield, Eye, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Collaborator {
    id: string;
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    addedAt: Date | string;
    userName: string | null;
    userEmail: string | null;
}

interface CollaboratorsProps {
    boardId: string;
    isOwner: boolean;
    isOpen?: boolean;
    onClose?: () => void;
}

export function CollaboratorsPanel({ boardId, isOwner, isOpen = false, onClose }: CollaboratorsProps) {
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<'editor' | 'viewer'>('viewer');

    const loadCollaborators = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/boards/${boardId}/collaborators`);
            if (response.ok) {
                const data = await response.json();
                setCollaborators(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Failed to load collaborators:', error);
        } finally {
            setIsLoading(false);
        }
    }, [boardId]);

    useEffect(() => {
        if (isOpen) {
            loadCollaborators();
        }
    }, [isOpen, loadCollaborators]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = newEmail.trim();
        if (!trimmedEmail) return;

        try {
            const response = await fetch(`/api/boards/${boardId}/collaborators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userEmail: trimmedEmail, role: newRole }),
            });

            if (response.ok) {
                toast.success('Collaborator added!');
                setNewEmail('');
                await loadCollaborators();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to add collaborator');
            }
        } catch {
            toast.error('An error occurred');
        }
    };

    const handleRoleChange = async (collaboratorId: string, role: 'viewer' | 'editor') => {
        try {
            const response = await fetch(`/api/boards/${boardId}/collaborators`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ collaboratorId, role }),
            });

            if (response.ok) {
                toast.success('Role updated');
                await loadCollaborators();
            } else {
                const err = await response.json();
                toast.error(err.error || 'Failed to update role');
            }
        } catch {
            toast.error('Failed to update collaborator role');
        }
    };

    const handleRemove = async (collaboratorId: string, userId?: string) => {
        if (!confirm('Remove this collaborator?')) return;

        try {
            const query = userId
                ? `collaboratorId=${collaboratorId}&userId=${userId}`
                : `collaboratorId=${collaboratorId}`;

            const response = await fetch(`/api/boards/${boardId}/collaborators?${query}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Collaborator removed');
                await loadCollaborators();
            } else {
                const err = await response.json();
                toast.error(err.error || 'Failed to remove collaborator');
            }
        } catch {
            toast.error('Failed to remove collaborator');
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'owner': return <Shield className="w-4 h-4 text-amber-500" />;
            case 'editor': return <Edit className="w-4 h-4 text-blue-500" />;
            case 'viewer': return <Eye className="w-4 h-4 text-green-500" />;
            default: return null;
        }
    };

    if (!isOpen) return null;

    return (
        <div
            data-testid="collaborators-panel"
            className="fixed bottom-6 right-6 w-96 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden max-h-[600px] flex flex-col z-50"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-800 bg-stone-900/90">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" />
                    <h3 className="font-semibold text-stone-200">Collaborators</h3>
                </div>
                <button
                    onClick={onClose}
                    className="text-stone-400 hover:text-stone-200 transition-colors p-1 rounded"
                    title="Close Collaborators"
                    aria-label="Close Collaborators"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Add Collaborator (Owner Only) */}
            {isOwner && (
                <form onSubmit={handleAdd} className="p-4 border-b border-stone-800 bg-stone-950/50">
                    <label className="block text-xs font-medium text-stone-400 mb-2">
                        Add Collaborator by Email
                    </label>
                    <div className="flex gap-2 mb-2">
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="colleague@precinct.gov"
                            className="flex-1 px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-200 placeholder-stone-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as 'editor' | 'viewer')}
                            className="px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={!newEmail.trim()}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" />
                        Add Collaborator
                    </button>
                </form>
            )}

            {/* Collaborators List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isLoading ? (
                    <p className="text-center text-stone-500 text-sm py-8">Loading collaborators...</p>
                ) : collaborators.length === 0 ? (
                    <p className="text-center text-stone-500 text-sm py-8">No external collaborators yet</p>
                ) : (
                    collaborators.map((collab) => (
                        <div
                            key={collab.id}
                            className="flex items-center gap-3 p-3 bg-stone-800/50 border border-stone-700/40 rounded-lg"
                        >
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-600 to-amber-500 flex items-center justify-center text-stone-950 font-bold text-xs shrink-0">
                                {(collab.userName || collab.userEmail || 'D')[0].toUpperCase()}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-stone-200 truncate">
                                    {collab.userName || collab.userEmail}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {getRoleIcon(collab.role)}
                                    {isOwner && collab.role !== 'owner' ? (
                                        <select
                                            value={collab.role}
                                            onChange={(e) => handleRoleChange(collab.id, e.target.value as 'viewer' | 'editor')}
                                            className="text-xs bg-stone-900 border border-stone-700 text-stone-300 rounded px-1 py-0.5 focus:outline-none"
                                        >
                                            <option value="viewer">Viewer</option>
                                            <option value="editor">Editor</option>
                                        </select>
                                    ) : (
                                        <span className="text-xs text-stone-400 capitalize">
                                            {collab.role}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            {isOwner && collab.role !== 'owner' && (
                                <button
                                    onClick={() => handleRemove(collab.id, collab.userId)}
                                    className="text-stone-500 hover:text-red-400 transition-colors p-1"
                                    title="Remove Collaborator"
                                    aria-label="Remove Collaborator"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Info */}
            <div className="p-3 border-t border-stone-800 bg-stone-900">
                <p className="text-xs text-stone-500">
                    {isOwner ? '👑 You can manage case access' : '👁️ View-only team access'}
                </p>
            </div>
        </div>
    );
}
```

---

### File 3: `src/components/VersionHistory.tsx`
Update to controlled component with newest-first display and restore handler:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, History, Clock, RotateCcw } from 'lucide-react';

interface Version {
    id: string;
    content: Record<string, unknown> | string;
    createdAt: Date | string;
    createdBy: string;
}

interface VersionHistoryProps {
    boardId: string;
    isOpen?: boolean;
    onClose?: () => void;
    onRestore?: (content: Record<string, unknown> | string) => void;
}

export function VersionHistory({ boardId, isOpen = false, onClose, onRestore }: VersionHistoryProps) {
    const [versions, setVersions] = useState<Version[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

    const loadVersions = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/boards/${boardId}/versions`);
            if (response.ok) {
                const data = await response.json();
                setVersions(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Failed to load versions:', error);
        } finally {
            setIsLoading(false);
        }
    }, [boardId]);

    useEffect(() => {
        if (isOpen) {
            loadVersions();
        }
    }, [isOpen, loadVersions]);

    const handleRestore = (version: Version) => {
        if (confirm('Restore this snapshot? Canvas state will be reverted to this point.')) {
            onRestore?.(version.content);
            onClose?.();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            data-testid="version-history-panel"
            className="fixed inset-y-0 right-0 w-96 bg-stone-900 border-l border-stone-700 shadow-2xl overflow-hidden flex flex-col z-50"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-800 bg-stone-900/90">
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-500" />
                    <h3 className="font-semibold text-stone-200">Version History</h3>
                </div>
                <button
                    onClick={onClose}
                    className="text-stone-400 hover:text-stone-200 transition-colors p-1 rounded"
                    title="Close Version History"
                    aria-label="Close Version History"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Versions List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-stone-950/50">
                {isLoading ? (
                    <p className="text-center text-stone-500 py-8">Loading investigation versions...</p>
                ) : versions.length === 0 ? (
                    <div className="text-center py-12">
                        <Clock className="w-12 h-12 text-stone-700 mx-auto mb-3" />
                        <p className="text-stone-500 text-sm">No version history yet</p>
                        <p className="text-stone-600 text-xs mt-1">Snapshots are saved automatically on board save</p>
                    </div>
                ) : (
                    versions.map((version, index) => (
                        <div
                            key={version.id}
                            className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                selectedVersion?.id === version.id
                                    ? 'bg-amber-500/10 border-amber-500/50'
                                    : 'bg-stone-800/50 border-stone-700 hover:border-stone-600'
                            }`}
                            onClick={() => setSelectedVersion(version)}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-stone-400">
                                        #{versions.length - index}
                                    </span>
                                    {index === 0 && (
                                        <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-medium">
                                            Latest
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-stone-500">
                                    {new Date(version.createdAt).toLocaleString()}
                                </span>
                            </div>

                            {selectedVersion?.id === version.id && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRestore(version);
                                    }}
                                    className="w-full mt-2 py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Restore This Version
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Info Footer */}
            <div className="p-3 border-t border-stone-800 bg-stone-900">
                <p className="text-xs text-stone-500">
                    💡 Versions are created automatically when changes are saved
                </p>
            </div>
        </div>
    );
}
```

---

### File 4: `src/components/ExportModal.tsx`
Add `data-testid="export-json"`, `data-testid="export-png"`, `data-testid="export-pdf"`:

```tsx
'use client';

import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { exportBoard } from '@/lib/export';
import { toast } from 'sonner';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    boardId: string;
    boardData: Record<string, unknown>;
    boardElement?: HTMLElement;
}

export function ExportModal({ isOpen, onClose, boardData, boardElement }: ExportModalProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [format, setFormat] = useState<'json' | 'png' | 'pdf'>('json');

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const title = (boardData.title as string) || 'case-file';
            const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.${format}`;

            const targetElement = boardElement || (document.querySelector('.react-flow') as HTMLElement) || document.body;
            await exportBoard(format, boardData, targetElement, filename);
            toast.success(`Exported as ${format.toUpperCase()}`);
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-stone-900 border border-stone-700 rounded-xl shadow-2xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-stone-200">Export Board</h2>
                    <button
                        onClick={onClose}
                        className="text-stone-400 hover:text-stone-200 transition-colors p-1"
                        title="Close Export"
                        aria-label="Close Export"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Format Selection */}
                <div className="space-y-3 mb-6">
                    <label className="block text-sm font-medium text-stone-300 mb-2">
                        Export Format
                    </label>

                    <button
                        type="button"
                        data-testid="export-json"
                        onClick={() => setFormat('json')}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                            format === 'json'
                                ? 'border-amber-500 bg-amber-500/10'
                                : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">📄</div>
                            <div className="flex-1">
                                <p className="font-semibold text-stone-200">JSON</p>
                                <p className="text-xs text-stone-400 mt-1">
                                    Full investigation dossier for backup or re-import
                                </p>
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        data-testid="export-png"
                        onClick={() => setFormat('png')}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                            format === 'png'
                                ? 'border-amber-500 bg-amber-500/10'
                                : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">🖼️</div>
                            <div className="flex-1">
                                <p className="font-semibold text-stone-200">PNG Image</p>
                                <p className="text-xs text-stone-400 mt-1">
                                    High-resolution snapshot of canvas evidence
                                </p>
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        data-testid="export-pdf"
                        onClick={() => setFormat('pdf')}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                            format === 'pdf'
                                ? 'border-amber-500 bg-amber-500/10'
                                : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">📑</div>
                            <div className="flex-1">
                                <p className="font-semibold text-stone-200">PDF Document</p>
                                <p className="text-xs text-stone-400 mt-1">
                                    Printable courtroom investigation dossier
                                </p>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Export Button */}
                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    data-testid="export-submit-button"
                    className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <Download className="w-5 h-5" />
                    {isExporting ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
                </button>
            </div>
        </div>
    );
}
```

---

### File 5: `src/lib/export.ts`
Provide element fallback and courtroom dossier JSON format:

```typescript
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

export interface ExportOptions {
    format: 'json' | 'png' | 'pdf';
    filename?: string;
}

/**
 * Export board to standardized JSON dossier
 */
export async function exportToJSON(boardData: Record<string, unknown>, filename?: string): Promise<void> {
    const rawContent = (boardData.content as Record<string, unknown>) || {};
    const nodes = boardData.nodes || rawContent.nodes || [];
    const edges = boardData.edges || rawContent.edges || [];
    const caseTitle = (boardData.title as string) || 'Untitled Case';

    const dossier = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        caseTitle,
        nodes,
        edges,
    };

    const jsonString = JSON.stringify(dossier, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    saveAs(blob, filename || `${caseTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.json`);
}

/**
 * Export board to PNG screenshot
 */
export async function exportToPNG(element?: HTMLElement, filename?: string): Promise<void> {
    const target = element || (document.querySelector('.react-flow') as HTMLElement) || document.body;
    const canvas = await html2canvas(target, {
        backgroundColor: '#1c1917',
        scale: 2,
        logging: false,
        useCORS: true,
    });

    canvas.toBlob((blob) => {
        if (blob) {
            saveAs(blob, filename || `case-file-${Date.now()}.png`);
        }
    });
}

/**
 * Export board to PDF dossier
 */
export async function exportToPDF(element?: HTMLElement, filename?: string): Promise<void> {
    const target = element || (document.querySelector('.react-flow') as HTMLElement) || document.body;
    const canvas = await html2canvas(target, {
        backgroundColor: '#1c1917',
        scale: 2,
        logging: false,
        useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(filename || `case-dossier-${Date.now()}.pdf`);
}

/**
 * Main export dispatcher
 */
export async function exportBoard(
    format: 'json' | 'png' | 'pdf',
    boardData: Record<string, unknown>,
    element?: HTMLElement,
    filename?: string
): Promise<void> {
    switch (format) {
        case 'json':
            await exportToJSON(boardData, filename);
            break;
        case 'png':
            await exportToPNG(element, filename);
            break;
        case 'pdf':
            await exportToPDF(element, filename);
            break;
    }
}
```

---

### File 6: `src/components/Board.tsx`
Add imports, state, toggle action buttons in top bar, and mount all 4 panels:

1. **Imports**:
```tsx
import { MessageSquare, Users, History, Download } from 'lucide-react';
import { CommentsPanel } from '@/components/CommentsPanel';
import { CollaboratorsPanel } from '@/components/CollaboratorsPanel';
import { VersionHistory } from '@/components/VersionHistory';
import { ExportModal } from '@/components/ExportModal';
```

2. **State & Ref**:
```tsx
const boardContainerRef = React.useRef<HTMLDivElement>(null);
const [isCommentsOpen, setIsCommentsOpen] = useState(false);
const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
const [isHistoryOpen, setIsHistoryOpen] = useState(false);
const [isExportOpen, setIsExportOpen] = useState(false);
```

3. **Restore Version Callback**:
```tsx
const handleRestoreVersion = async (content: Record<string, unknown> | string) => {
    try {
        let parsed = content;
        if (typeof content === 'string') {
            try { parsed = JSON.parse(content); } catch { /* ignore */ }
        }
        if (parsed && typeof parsed === 'object') {
            const boardContent = parsed as { nodes?: Node[]; edges?: Edge[] };
            if (boardContent.nodes) setNodes(boardContent.nodes);
            if (boardContent.edges) setEdges(boardContent.edges);

            const res = await fetch(`/api/boards/${boardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: boardContent }),
            });
            if (res.ok) {
                toast.success('Board rolled back to snapshot');
            }
        }
    } catch (err) {
        console.error('Failed to restore version:', err);
        toast.error('Failed to restore snapshot');
    }
};
```

4. **Top Bar Actions**:
Insert toggle buttons before the closing `</div>` of Top Bar Actions (around line 403):
```tsx
{/* Comments Toggle */}
<button
    onClick={() => {
        setIsCommentsOpen(!isCommentsOpen);
        setIsCollaboratorsOpen(false);
        setIsHistoryOpen(false);
    }}
    className={`p-2 rounded-lg border transition-colors flex items-center gap-1.5 ${
        isCommentsOpen
            ? 'bg-amber-600 text-stone-950 border-amber-500 font-bold'
            : 'bg-sidebar-accent/10 hover:bg-sidebar-accent/20 text-sidebar-foreground border-sidebar-accent/20'
    }`}
    title="Comments"
    aria-label="Toggle Comments"
    data-testid="toggle-comments"
>
    <MessageSquare className="w-5 h-5" />
    <span className="hidden md:inline text-xs font-bold">Comments</span>
</button>

{/* Collaborators Toggle */}
<button
    onClick={() => {
        setIsCollaboratorsOpen(!isCollaboratorsOpen);
        setIsCommentsOpen(false);
        setIsHistoryOpen(false);
    }}
    className={`p-2 rounded-lg border transition-colors flex items-center gap-1.5 ${
        isCollaboratorsOpen
            ? 'bg-amber-600 text-stone-950 border-amber-500 font-bold'
            : 'bg-sidebar-accent/10 hover:bg-sidebar-accent/20 text-sidebar-foreground border-sidebar-accent/20'
    }`}
    title="Collaborators"
    aria-label="Collaborators"
    data-testid="toggle-collaborators"
>
    <Users className="w-5 h-5" />
    <span className="hidden md:inline text-xs font-bold">Team</span>
</button>

{/* Version History Toggle */}
<button
    onClick={() => {
        setIsHistoryOpen(!isHistoryOpen);
        setIsCommentsOpen(false);
        setIsCollaboratorsOpen(false);
    }}
    className={`p-2 rounded-lg border transition-colors flex items-center gap-1.5 ${
        isHistoryOpen
            ? 'bg-amber-600 text-stone-950 border-amber-500 font-bold'
            : 'bg-sidebar-accent/10 hover:bg-sidebar-accent/20 text-sidebar-foreground border-sidebar-accent/20'
    }`}
    title="Version History"
    aria-label="Version History"
    data-testid="toggle-history"
>
    <History className="w-5 h-5" />
    <span className="hidden md:inline text-xs font-bold">History</span>
</button>

{/* Export Modal Toggle */}
<button
    onClick={() => setIsExportOpen(true)}
    className="p-2 bg-sidebar-accent/10 hover:bg-sidebar-accent/20 text-sidebar-foreground rounded-lg border border-sidebar-accent/20 transition-colors flex items-center gap-1.5"
    title="Export Board"
    aria-label="Export Board"
    data-testid="toggle-export"
>
    <Download className="w-5 h-5" />
    <span className="hidden md:inline text-xs font-bold">Export</span>
</button>
```

5. **Mount Components**:
Directly after `<ContributionModal ... />`:
```tsx
<CommentsPanel
    boardId={boardId}
    isOpen={isCommentsOpen}
    onClose={() => setIsCommentsOpen(false)}
/>

<CollaboratorsPanel
    boardId={boardId}
    isOwner={!isReadOnly && session?.user?.id === boardOwnerId}
    isOpen={isCollaboratorsOpen}
    onClose={() => setIsCollaboratorsOpen(false)}
/>

<VersionHistory
    boardId={boardId}
    isOpen={isHistoryOpen}
    onClose={() => setIsHistoryOpen(false)}
    onRestore={handleRestoreVersion}
/>

<ExportModal
    isOpen={isExportOpen}
    onClose={() => setIsExportOpen(false)}
    boardId={boardId}
    boardData={{
        id: boardId,
        title: boardTitle,
        nodes,
        edges,
    }}
    boardElement={boardContainerRef.current || undefined}
/>
```

---

### File 7: `src/app/api/comments/route.ts`
Update schema with `.trim()`, left-join `users` in `GET`, and call `awardPoints` in `POST`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { comments, users } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { getBoardAccess } from '@/lib/auth-checks';
import { awardPoints } from '@/lib/reputation';

const createCommentSchema = z.object({
    boardId: z.string().min(1, 'Board ID is required'),
    nodeId: z.string().optional().nullable(),
    content: z.string().trim().min(1, 'Content is required').max(5000, 'Content too long'),
    parentId: z.string().optional().nullable(),
});

// GET /api/comments?boardId=xxx&nodeId=xxx
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await checkRateLimit(`comments:read:${session.user.id}`, 60, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const boardId = searchParams.get('boardId');
        const nodeId = searchParams.get('nodeId');

        if (!boardId) {
            return NextResponse.json({ error: 'Board ID required' }, { status: 400 });
        }

        // Authorization check
        const access = await getBoardAccess(boardId, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }
        if (!access.canView) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const conditions = [eq(comments.boardId, boardId)];
        if (nodeId) {
            conditions.push(eq(comments.nodeId, nodeId));
        }

        const rawResults = await db.select({
            id: comments.id,
            boardId: comments.boardId,
            nodeId: comments.nodeId,
            userId: comments.userId,
            content: comments.content,
            parentId: comments.parentId,
            isAnonymous: comments.isAnonymous,
            createdAt: comments.createdAt,
            updatedAt: comments.updatedAt,
            userName: users.name,
            userImage: users.image,
        })
            .from(comments)
            .leftJoin(users, eq(comments.userId, users.id))
            .where(and(...conditions))
            .orderBy(comments.createdAt);

        const results = rawResults.map((c) => {
            if (c.isAnonymous) {
                return { ...c, userName: 'Anonymous Detective', userImage: null };
            }
            return c;
        });

        return NextResponse.json(results);
    } catch (error) {
        console.error('Get comments error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/comments
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await checkRateLimit(`comment:${session.user.id}`, 30, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many comments. Please wait.' }, { status: 429 });
        }

        const body = await req.json();
        const validationResult = createCommentSchema.safeParse(body);
        if (!validationResult.success) {
            const errors = validationResult.error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
            }));
            return NextResponse.json({ error: 'Invalid input', details: errors }, { status: 400 });
        }

        const { boardId, nodeId, content, parentId } = validationResult.data;

        const access = await getBoardAccess(boardId, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }
        if (!access.canView) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const newComment = await db.insert(comments).values({
            id: createId(),
            boardId,
            nodeId: nodeId || null,
            userId: session.user.id,
            content,
            parentId: parentId || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        // Award reputation points for comment
        await awardPoints(session.user.id, 'comment_posted');

        return NextResponse.json(newComment[0], { status: 201 });
    } catch (error) {
        console.error('Create comment error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

---

### File 8: `src/app/api/boards/[id]/collaborators/route.ts`
Implement email lookup in `POST`, implement `PATCH`, and implement `DELETE`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boardCollaborators, users } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import { getBoardAccess } from '@/lib/auth-checks';
import { checkRateLimit } from '@/lib/rate-limit';

const addCollaboratorSchema = z.object({
    userId: z.string().optional(),
    userEmail: z.string().email().optional(),
    role: z.enum(['viewer', 'editor', 'owner']).default('viewer'),
}).refine((data) => data.userId || data.userEmail, {
    message: 'Either userId or userEmail is required',
});

const patchCollaboratorSchema = z.object({
    collaboratorId: z.string().optional(),
    userId: z.string().optional(),
    role: z.enum(['viewer', 'editor', 'owner']),
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

        const collaborators = await db.select({
            id: boardCollaborators.id,
            userId: boardCollaborators.userId,
            role: boardCollaborators.role,
            addedAt: boardCollaborators.addedAt,
            userName: users.name,
            userEmail: users.email,
        })
            .from(boardCollaborators)
            .leftJoin(users, eq(boardCollaborators.userId, users.id))
            .where(eq(boardCollaborators.boardId, params.id));

        return NextResponse.json(collaborators);
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

        let targetUserId = userId;
        if (!targetUserId && userEmail) {
            const foundUsers = await db.select({ id: users.id })
                .from(users)
                .where(eq(users.email, userEmail))
                .limit(1);

            if (foundUsers.length === 0) {
                return NextResponse.json({ error: 'User not found with this email' }, { status: 404 });
            }
            targetUserId = foundUsers[0].id;
        }

        if (!targetUserId) {
            return NextResponse.json({ error: 'User ID could not be determined' }, { status: 400 });
        }

        // Check if target is already board owner
        if (targetUserId === access.board.userId) {
            return NextResponse.json({ error: 'User is the board owner' }, { status: 400 });
        }

        // Check duplicate
        const existing = await db.select()
            .from(boardCollaborators)
            .where(
                and(
                    eq(boardCollaborators.boardId, params.id),
                    eq(boardCollaborators.userId, targetUserId)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json({ error: 'User is already a collaborator' }, { status: 400 });
        }

        const newCollaborator = await db.insert(boardCollaborators).values({
            id: createId(),
            boardId: params.id,
            userId: targetUserId,
            role,
            addedAt: new Date(),
        }).returning();

        return NextResponse.json(newCollaborator[0], { status: 201 });
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
            ? and(eq(boardCollaborators.id, collaboratorId), eq(boardCollaborators.boardId, params.id))
            : and(eq(boardCollaborators.userId, userId!), eq(boardCollaborators.boardId, params.id));

        const updated = await db.update(boardCollaborators)
            .set({ role })
            .where(condition)
            .returning();

        if (updated.length === 0) {
            return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 });
        }

        return NextResponse.json(updated[0], { status: 200 });
    } catch (error) {
        console.error('Update collaborator error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/boards/[id]/collaborators
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
            return NextResponse.json({ error: 'collaboratorId or userId query parameter is required' }, { status: 400 });
        }

        const condition = collaboratorId
            ? and(eq(boardCollaborators.id, collaboratorId), eq(boardCollaborators.boardId, params.id))
            : and(eq(boardCollaborators.userId, userId!), eq(boardCollaborators.boardId, params.id));

        const deleted = await db.delete(boardCollaborators)
            .where(condition)
            .returning();

        if (deleted.length === 0) {
            return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Collaborator removed' }, { status: 200 });
    } catch (error) {
        console.error('Delete collaborator error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

---

### File 9: `src/app/api/boards/[id]/versions/route.ts`
Order versions in descending order (`desc(boardVersions.createdAt)`):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boardVersions } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getBoardAccess } from '@/lib/auth-checks';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/boards/[id]/versions
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

        const rateLimit = await checkRateLimit(`versions:${session.user.id}`, 30, 60000);
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

        const versions = await db.select()
            .from(boardVersions)
            .where(eq(boardVersions.boardId, params.id))
            .orderBy(desc(boardVersions.createdAt));

        return NextResponse.json(versions);
    } catch (error) {
        console.error('Get versions error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/boards/[id]/versions
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

        const rateLimit = await checkRateLimit(`versions:${session.user.id}`, 30, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
        }

        const access = await getBoardAccess(params.id, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }
        if (!access.canEdit) {
            return NextResponse.json({ error: 'Forbidden: Only owners and editors can create versions' }, { status: 403 });
        }

        const body = await req.json();
        const { content } = body;
        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }

        const newVersion = await db.insert(boardVersions).values({
            id: createId(),
            boardId: params.id,
            content,
            createdBy: session.user.id,
            createdAt: new Date(),
        }).returning();

        return NextResponse.json(newVersion[0], { status: 201 });
    } catch (error) {
        console.error('Create version error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

---

### File 10: `src/app/api/boards/[id]/route.ts` (PUT Handler)
Add optimistic locking conflict check and automatic snapshot creation on save:

```typescript
// In PUT /api/boards/[id]
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(`boards:update:${session.user.id}`, 60, 60000);
    if (!rateLimit.success) {
        return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
    }

    try {
        const params = await props.params;
        const { id } = params;
        const { content, title, isPublic, thumbnail, version } = await req.json();

        const access = await getBoardAccess(id, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }
        if (!access.canEdit) {
            return NextResponse.json({ error: 'Forbidden: You do not have permission to edit this board' }, { status: 403 });
        }

        if (isPublic !== undefined && !access.isOwner) {
            return NextResponse.json({ error: 'Forbidden: Only board owner can change visibility' }, { status: 403 });
        }

        // Optimistic locking check
        if (version !== undefined && access.board.version !== version) {
            return NextResponse.json(
                { error: 'Conflict: Board has been modified by another user. Please reload.', serverVersion: access.board.version },
                { status: 409 }
            );
        }

        const nextVersion = (access.board.version || 1) + 1;
        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
            version: nextVersion,
        };

        if (content !== undefined) updateData.content = content;
        if (title) updateData.title = title;
        if (isPublic !== undefined) updateData.isPublic = isPublic;
        if (thumbnail) updateData.thumbnail = thumbnail;

        await db.update(boards)
            .set(updateData)
            .where(and(eq(boards.id, id), isNull(boards.deletedAt)));

        // Create automatic version snapshot if content changed
        if (content) {
            await db.insert(boardVersions).values({
                id: createId(),
                boardId: id,
                content,
                createdBy: session.user.id,
                createdAt: new Date(),
            });
        }

        return NextResponse.json({ success: true, version: nextVersion });
    } catch (error) {
        console.error('Error saving board:', error);
        return NextResponse.json({ error: 'Failed to save board' }, { status: 500 });
    }
}
```

---

## 5. Verification Method

### 5.1 Unit / Integration Verification
Execute the integration test suite:
```bash
npx vitest run tests/integration/comments.test.ts
```
*Note: Ensure `leftJoin: vi.fn().mockReturnThis()` is present in `tests/integration/comments.test.ts` line 24.*

### 5.2 Build & Typecheck Verification
Verify compilation and strict typing:
```bash
npm run build
```

### 5.3 End-to-End Test Suite Verification
Run the target Playwright test suites covering Features 22–25:
```bash
# Tier 1 Panels Suite (Comments, Collaborators, Version History, Export Modal)
npx playwright test tests/e2e/tier1/panels.spec.ts

# Tier 3 Granular RBAC Matrix (Invite, Edit, Snapshot, Delete)
npx playwright test tests/e2e/tier3/collaboration-rbac.spec.ts

# Tier 4 Courtroom Dossier Export & Roundtrip Parity
npx playwright test tests/e2e/tier4/export-roundtrip.spec.ts

# Tier 4 Version Snapshotting, Rollback & 409 Optimistic Lock
npx playwright test tests/e2e/tier4/versions-conflict.spec.ts

# Tier 2 Comment Whitespace Boundary Test
npx playwright test tests/e2e/tier2/boundary.spec.ts -g "T2-BOUND-02"
```

### 5.4 Invalidation Conditions
The verification fails if:
1. `GET /api/comments` returns author objects without `userName` or `userImage`.
2. `POST /api/comments` does not increase detective reputation points in `user_reputation`.
3. Clicking "Comments", "Team", "History", or "Export" buttons on `/board/[id]` fails to render the respective modal/panel.
4. `POST /api/boards/[id]/collaborators` with `{ userEmail: ... }` fails to add collaborator.
5. `PATCH /api/boards/[id]/collaborators` returns 405 instead of updating role.
6. `DELETE /api/boards/[id]/collaborators?collaboratorId=...` returns 405 instead of deleting collaborator.
7. Re-importing exported JSON onto a blank canvas fails byte-for-byte coordinate or node count parity.
