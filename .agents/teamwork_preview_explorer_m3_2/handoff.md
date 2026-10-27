# Investigation & Implementation Blueprint: Board State Isolation (F20) & Optimistic Locking / Auto-Save (F21)

**Agent**: `teamwork_preview_explorer_m3_2` (Explorer 2, Milestone 3)  
**Parent**: Sub-Orchestrator M3 (`9fbe4361-8197-45dd-97fb-cda3d97e6796`)  
**Scope**: Feature 20 (Board State Isolation & Unpolluted Preferences) & Feature 21 (Optimistic Locking & Debounced Auto-Save with 409 Conflict Handling)

---

## 1. Observation

Direct observations from codebase inspection, schema analysis, and test suite specifications:

### 1.1 `src/store/useStore.ts`: Global Persistence Pollution & Missing Board Lifecycle
- **Lines 145-154 (`partialize` configuration)**:
  ```typescript
  partialize: (state) => ({
      nodes: state.nodes,
      edges: state.edges,
      theme: state.theme,
      activeColor: state.activeColor,
      boardTitle: state.boardTitle,
      isPublic: state.isPublic,
      parentId: state.parentId,
  }),
  ```
  `nodes`, `edges`, `boardTitle`, `isPublic`, and `parentId` are explicitly persisted to `localStorage` under key `'case-file-storage'`.
- **Lines 17-41 (`RFState` type definition)**:
  `RFState` completely lacks:
  - `boardId: string | null` (tracking the active board identity)
  - `boardVersion: number` (tracking the active board optimistic lock version)
  - `loadBoard(boardId: string, initialNodes: Node[], initialEdges: Edge[], metadata?: ...)` (atomic board state reinitialization)
  - `resetBoard()` (store purge on route transition or unmount)
  - `deleteEdge(id: string)` (synchronizing edge removal when red yarn is cut)
- **Lines 43-75 (`safeStorage`)**:
  `safeStorage.setItem` throws `TypeError: Cannot read properties of undefined (reading 'setItem')` in non-browser / headless testing contexts because it checks only `typeof window === 'undefined'` but not `typeof localStorage === 'undefined'`.

### 1.2 `src/app/(authenticated)/board/[id]/page.tsx` & `src/components/Board.tsx`: Stale Evidence Leak & 800ms Latency
- **`page.tsx` Lines 51-55**:
  ```tsx
  return (
      <main className="h-full w-full overflow-hidden">
          <Board />
      </main>
  );
  ```
  The page renders `<Board />` without passing initial state or props.
- **`Board.tsx` Lines 92-126 (`fetchBoard` & `useEffect`)**:
  ```tsx
  const fetchBoard = useCallback(async () => {
      setIsBoardLoading(true);
      try {
          const res = await fetch(`/api/boards/${boardId}`);
          if (res.ok) {
              const data = await res.json();
              if (data.content) {
                  setNodes(data.content.nodes || []);
                  setEdges(data.content.edges || []);
              }
              setBoardMetadata(data.title, data.isPublic, data.parentId);
              setBoardOwnerId(data.userId);
              ...
          }
      } catch (error) {
          console.error('Failed to load board:', error);
      } finally {
          setTimeout(() => setIsBoardLoading(false), 800);
      }
  }, [boardId, session?.user?.id, setNodes, setEdges, setBoardMetadata]);

  useEffect(() => {
      if (boardId) {
          fetchBoard();
      }
  }, [boardId, fetchBoard]);
  ```
  - When switching between boards (e.g. from Board Alpha to Board Beta), `nodes` in Zustand store are NOT cleared upon route change.
  - An artificial delay of 800ms (`setTimeout(() => setIsBoardLoading(false), 800)`) delays canvas updates.
  - If `data.content` is null, empty, or lacks a `nodes` key, `setNodes` is never called, leaving the previous board's clues rendered on screen.
  - No cleanup function is returned in `useEffect` on unmount.

### 1.3 `src/components/Board.tsx`: Manual Save Only, No Version Sent, No 409 Handling
- **Lines 151-172 (`handleSave`)**:
  ```tsx
  const handleSave = async () => {
      if (!boardId) return;
      setSaving(true);
      try {
          const content = { nodes, edges };
          const res = await fetch(`/api/boards/${boardId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content }),
          });

          if (res.ok) {
              setLastSaved(new Date());
          } else {
              console.error('Failed to save');
          }
      } catch (error) {
          console.error('Save error:', error);
      } finally {
          setSaving(false);
      }
  };
  ```
  - **No auto-save**: The only saving mechanism is clicking the manual Save button (`line 335`). Detectives risk losing evidence if closing or navigating away without clicking Save.
  - **No optimistic locking sent**: The request body is `{ content }`; it never includes the current `version`.
  - **No 409 Conflict handling**: When `res.ok` is false, it logs to `console.error` with no user-visible toast or banner.
  - **Crude save status**: State is limited to boolean `saving` and `lastSaved: Date | null`; there is no state tracking for `'unsaved'`, `'conflict'`, or `'error'`.

### 1.4 `src/app/api/boards/[id]/route.ts`: Missing Optimistic Concurrency Check & Bump
- **Lines 23-57 (`PUT` handler)**:
  ```ts
  const { content, title, isPublic, thumbnail } = await req.json();

  const access = await getBoardAccess(id, session.user.id);
  ...
  const updateData: Record<string, unknown> = {
      content: content,
      updatedAt: new Date(),
  };

  if (title) updateData.title = title;
  if (isPublic !== undefined) updateData.isPublic = isPublic;
  if (thumbnail) updateData.thumbnail = thumbnail;

  await db.update(boards)
      .set(updateData)
      .where(and(eq(boards.id, id), isNull(boards.deletedAt)));

  return NextResponse.json({ success: true });
  ```
  - `version` parameter is ignored from incoming JSON.
  - Server never compares client version against `access.board.version`.
  - Server never returns HTTP `409 Conflict`.
  - Server never increments `version` in `updateData`.
  - Response does not return the updated `version`.

### 1.5 Database Schema & Test Suite Mandates
- **`src/lib/schema.ts` (Line 72)**:
  `boards.version` is defined as `integer('version').default(1).notNull()`.
- **`tests/e2e/tier1/canvas.spec.ts` (Lines 261-304, `T1-STORE-01`)**:
  Asserts that visiting Board Alpha with clue `'ALPHA UNIQUE CLUE'`, then navigating to Board Beta (`content: { nodes: [], edges: [] }`), must NOT display `'ALPHA UNIQUE CLUE'` and `.react-flow__node` must have count `0`.
- **`tests/e2e/tier4/versions-conflict.spec.ts` (Lines 137-157, `Step 5`)**:
  Tests collaborator concurrent edit with `version: board?.version`, asserting `expect([200, 409]).toContain(collabUpdate.status)`.
- **`TEST_INFRA.md` (Line 136, `T1-STORE-02`)**:
  "Optimistic Locking & Auto-Save: `PUT /api/boards/[id]` increments the board `version`. Submitting an update with a stale version number returns `409 Conflict`."

---

## 2. Logic Chain

Step-by-step causal deduction connecting observations to the required remediation:

1. **Root Cause of Cross-Board Contamination (F20)**:
   - **Step 1.1**: `useStore.ts` persists `nodes` and `edges` into `localStorage['case-file-storage']` (Obs 1.1).
   - **Step 1.2**: On page load, Zustand rehydrates whatever clues were left in `localStorage`, displaying them regardless of which board URL is opened.
   - **Step 1.3**: When navigating from Board A to Board B, `Board.tsx` does not clear `nodes` or `edges` prior to `fetchBoard` resolving (Obs 1.2). During the network fetch and the 800ms artificial delay, Board A's nodes remain rendered on screen.
   - **Step 1.4**: If Board B is an empty investigation (`content: { nodes: [], edges: [] }` or `content: null`), `data.content.nodes` is empty or undefined. In the current code, `if (data.content)` either sets nodes late or skips it entirely, causing `T1-STORE-01` to fail.
   - **Deduction**: `useStore.ts` must purge `nodes` and `edges` from `localStorage` entirely, retaining only user preferences (`theme`, `activeColor`, `connectMode`). `useStore.ts` must expose `loadBoard()` and `resetBoard()`. `Board.tsx` must call `resetBoard()` immediately upon route parameter change and unmount.

2. **Root Cause of Silent Overwrite & Data Loss (F21)**:
   - **Step 2.1**: Detectives have no auto-save mechanism; any work between manual saves is lost on unexpected navigation or tab closure (Obs 1.3).
   - **Step 2.2**: When saving, `Board.tsx` does not transmit `version` to `PUT /api/boards/[id]` (Obs 1.3).
   - **Step 2.3**: In `route.ts`, `boards.version` is neither validated nor incremented (Obs 1.4). If two detectives (or two browser windows) edit the same board concurrently, the last write silently overwrites the previous write without warning.
   - **Step 2.4**: Neither `route.ts` nor `Board.tsx` implements HTTP 409 Conflict handling, violating `T1-STORE-02` and `T4.4`.
   - **Deduction**:
     - `PUT /api/boards/[id]` must check `version`. If the client provides a `version` that differs from the DB record, it must reject the request with HTTP 409 Conflict.
     - On successful update, `PUT /api/boards/[id]` must increment `version = currentVersion + 1` and return `{ success: true, version: nextVersion }`.
     - `Board.tsx` must implement a 2000ms debounced auto-save hook listening to canvas changes (`nodes`, `edges`), tracking state (`'saved' | 'saving' | 'unsaved' | 'conflict' | 'error'`).
     - On HTTP 409 Conflict, `Board.tsx` must pause auto-save, display an actionable Conflict Alert Banner, and offer "Reload Latest" and "Review / Merge" resolution actions.

---

## 3. Caveats

1. **Initial Mount Auto-Save Suppression**:
   When `loadBoard` sets the initial nodes and edges from the server, this state update must NOT trigger the auto-save effect. If not guarded, opening a board would immediately fire a redundant `PUT` request and increment the board's version number before any user modification occurred. A ref (`isLoadedRef = useRef(false)`) and snapshot comparison (`lastSavedSnapshotRef`) must guard against initial triggers.
2. **Backward Compatibility for Unversioned API Callers**:
   Some existing test suites (e.g. `collaboration-rbac.spec.ts` line 141) call `PUT /api/boards/[id]` with payload `{ content: { ... } }` without supplying a `version` field. The API must support both versioned (optimistic lock enforced) and unversioned requests. If `version` is undefined, the update succeeds and increments `boards.version` automatically. If `version` is supplied as a number, strict equality against `access.board.version` is enforced.
3. **Legacy `localStorage` Purge Defense**:
   Detectives or test runners who previously opened boards may have stale `nodes` and `edges` sitting inside their browser's `localStorage['case-file-storage']`. To prevent this legacy data from polluting the new architecture, `onRehydrateStorage` in `useStore.ts` must defensively overwrite `state.nodes = []` and `state.edges = []`.
4. **Environment Safety in `safeStorage`**:
   In headless or Vitest environments, `localStorage` can be partially mocked or undefined. `safeStorage` must check `typeof window === 'undefined' || typeof localStorage === 'undefined'`.
5. **No Caveats Beyond Above**: All contracts align with `PROJECT.md`, `TEST_INFRA.md`, and `SCOPE.md`.

---

## 4. Conclusion & Complete Implementation Plan

To eliminate localStorage pollution, guarantee strict per-board isolation, and establish optimistic locking with auto-save, the Worker must execute the following file-by-file changes:

### 4.1 File 1: `src/store/useStore.ts` (Feature 20 & 19)

#### A. Updated `RFState` Interface:
```typescript
type RFState = {
    // Ephemeral Board State (NOT persisted)
    boardId: string | null;
    boardVersion: number;
    nodes: Node[];
    edges: Edge[];
    boardTitle: string;
    parentId: string | null;
    isPublic: boolean;
    sourceNodeId: string | null;

    // Ephemeral Board Lifecycle Actions
    loadBoard: (
        boardId: string,
        initialNodes?: Node[],
        initialEdges?: Edge[],
        metadata?: {
            title?: string;
            isPublic?: boolean;
            parentId?: string | null;
            version?: number;
        }
    ) => void;
    resetBoard: () => void;
    setBoardVersion: (version: number) => void;
    setBoardMetadata: (title: string, isPublic: boolean, parentId: string | null) => void;
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    addNode: (node: Node) => void;
    updateNode: (id: string, data: unknown) => void;
    updateNodeData: (id: string, data: unknown) => void;
    deleteNode: (id: string) => void;
    deleteEdge: (id: string) => void; // Feature 19 / cut string sync
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    setSourceNodeId: (id: string | null) => void;

    // Persisted User Preferences (Stored in localStorage)
    theme: string;
    setTheme: (theme: string) => void;
    activeColor: string;
    setActiveColor: (color: string) => void;
    connectMode: boolean;
    toggleConnectMode: () => void;
};
```

#### B. Safe Storage & Defensive Rehydration:
```typescript
const safeStorage = {
    getItem: (name: string) => {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
        try {
            const data = localStorage.getItem(name);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('SafeStorage: Failed to get item', e);
            return null;
        }
    },
    setItem: (name: string, value: unknown) => {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(name, JSON.stringify(value));
        } catch (e) {
            console.warn('SafeStorage: Save failed', e);
        }
    },
    removeItem: (name: string) => {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
        try {
            localStorage.removeItem(name);
        } catch (e) {
            console.warn('SafeStorage: Remove failed', e);
        }
    },
};
```

#### C. Store Implementation with Preference-Only `partialize`:
```typescript
const useStore = create<RFState>()(
    persist(
        (set, get) => ({
            // Default Board State
            boardId: null,
            boardVersion: 1,
            nodes: [],
            edges: [],
            boardTitle: 'Untitled Case',
            isPublic: false,
            parentId: null,
            sourceNodeId: null,

            // Board Lifecycle Methods
            loadBoard: (boardId, initialNodes = [], initialEdges = [], metadata) => {
                set({
                    boardId,
                    nodes: initialNodes,
                    edges: initialEdges,
                    boardTitle: metadata?.title ?? 'Untitled Case',
                    isPublic: metadata?.isPublic ?? false,
                    parentId: metadata?.parentId ?? null,
                    boardVersion: metadata?.version ?? 1,
                    sourceNodeId: null,
                });
            },

            resetBoard: () => {
                set({
                    boardId: null,
                    nodes: [],
                    edges: [],
                    boardTitle: 'Untitled Case',
                    isPublic: false,
                    parentId: null,
                    boardVersion: 1,
                    sourceNodeId: null,
                });
            },

            setBoardVersion: (boardVersion) => set({ boardVersion }),

            setBoardMetadata: (title, isPublic, parentId) =>
                set({ boardTitle: title, isPublic, parentId }),

            setNodes: (nodes) => set({ nodes }),
            setEdges: (edges) => set({ edges }),

            addNode: (node) => set({ nodes: [...get().nodes, node] }),

            updateNodeData: (id, data) => {
                set({
                    nodes: get().nodes.map((node) =>
                        node.id === id ? { ...node, data: { ...node.data, ...(data as object) } } : node
                    ),
                });
            },

            updateNode: (id, data) => {
                set({
                    nodes: get().nodes.map((node) =>
                        node.id === id ? { ...node, data: { ...node.data, ...(data as object) } } : node
                    ),
                });
            },

            deleteNode: (id) => {
                set({
                    nodes: get().nodes.filter((node) => node.id !== id),
                    edges: get().edges.filter(
                        (edge) => edge.source !== id && edge.target !== id
                    ),
                });
            },

            deleteEdge: (id) => {
                set({
                    edges: get().edges.filter((edge) => edge.id !== id),
                });
            },

            onNodesChange: (changes: NodeChange[]) => {
                set({ nodes: applyNodeChanges(changes, get().nodes) });
            },

            onEdgesChange: (changes: EdgeChange[]) => {
                set({ edges: applyEdgeChanges(changes, get().edges) });
            },

            onConnect: (connection: Connection) => {
                set({
                    edges: addEdge({ ...connection, type: 'string', animated: false }, get().edges),
                });
            },

            // User Preferences (Persisted)
            theme: 'theme-cork',
            setTheme: (theme) => set({ theme }),

            activeColor: '#fef3c7',
            setActiveColor: (activeColor) => set({ activeColor }),

            connectMode: false,
            toggleConnectMode: () => set({ connectMode: !get().connectMode, sourceNodeId: null }),
            setSourceNodeId: (sourceNodeId) => set({ sourceNodeId }),
        }),
        {
            name: 'case-file-storage',
            storage: safeStorage as never,
            partialize: (state) => ({
                // STRICTLY PREFERENCES ONLY
                theme: state.theme,
                activeColor: state.activeColor,
                connectMode: state.connectMode,
            }),
            onRehydrateStorage: () => (state) => {
                // Defensive: Ensure legacy storage never pollutes canvas elements
                if (state) {
                    state.nodes = [];
                    state.edges = [];
                    state.boardId = null;
                    state.boardVersion = 1;
                }
            },
        }
    )
);
```

---

### 4.2 File 2: `src/app/api/boards/[id]/route.ts` (Feature 21 Optimistic Locking)

#### Exact `PUT` Handler Implementation:
```typescript
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
        const body = await req.json();
        const { content, title, isPublic, thumbnail, version: clientVersion } = body;

        // 1. Fetch board access and ensure active (not soft-deleted)
        const access = await getBoardAccess(id, session.user.id);

        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        // 2. Check Permissions
        if (!access.canEdit) {
            return NextResponse.json({ error: 'Forbidden: You do not have permission to edit this board' }, { status: 403 });
        }

        // Only owner can change board visibility
        if (isPublic !== undefined && !access.isOwner) {
            return NextResponse.json({ error: 'Forbidden: Only board owner can change visibility' }, { status: 403 });
        }

        // 3. Optimistic Concurrency Check
        const currentVersion = typeof access.board.version === 'number' ? access.board.version : 1;
        if (clientVersion !== undefined && clientVersion !== null) {
            if (typeof clientVersion === 'number' && clientVersion !== currentVersion) {
                return NextResponse.json(
                    {
                        error: 'Conflict: Board has been modified by another session',
                        currentVersion,
                        expectedVersion: clientVersion,
                    },
                    { status: 409 }
                );
            }
        }

        // 4. Increment Version
        const nextVersion = currentVersion + 1;
        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
            version: nextVersion,
        };

        if (content !== undefined) updateData.content = content;
        if (title !== undefined) updateData.title = title;
        if (isPublic !== undefined) updateData.isPublic = isPublic;
        if (thumbnail !== undefined) updateData.thumbnail = thumbnail;

        // Atomic update with version lock
        await db.update(boards)
            .set(updateData)
            .where(and(
                eq(boards.id, id),
                isNull(boards.deletedAt),
                typeof clientVersion === 'number' ? eq(boards.version, clientVersion) : undefined
            ));

        return NextResponse.json({
            success: true,
            version: nextVersion,
        });
    } catch (error) {
        console.error('Error saving board:', error);
        return NextResponse.json({ error: 'Failed to save board' }, { status: 500 });
    }
}
```

---

### 4.3 File 3: `src/components/Board.tsx` (Board Lifecycle, Debounced Auto-Save & 409 UI)

#### A. State Tracking & Refs:
```typescript
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error';

const Board = () => {
    const params = useParams();
    const router = useRouter();
    const boardId = params?.id as string;
    const { data: session } = useSession();
    const { user: userProfile, rank } = useUser();

    // Auto-Save & Version State
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [conflictInfo, setConflictInfo] = useState<{ message: string; serverVersion?: number } | null>(null);
    const currentVersionRef = useRef<number>(1);
    const isLoadedRef = useRef<boolean>(false);
    const lastSavedSnapshotRef = useRef<string>('');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isSavingRef = useRef<boolean>(false);
```

#### B. Immediate Store Reset & Lifecycle Hook:
```typescript
    // Fetch Board from server
    const fetchBoard = useCallback(async () => {
        setIsBoardLoading(true);
        try {
            const res = await fetch(`/api/boards/${boardId}`);
            if (res.ok) {
                const data = await res.json();
                const content = data.content || {};
                const loadedNodes = Array.isArray(content.nodes) ? content.nodes : [];
                const loadedEdges = Array.isArray(content.edges) ? content.edges : [];
                const boardVer = typeof data.version === 'number' ? data.version : 1;

                // Atomically load board into Zustand store
                useStore.getState().loadBoard(boardId, loadedNodes, loadedEdges, {
                    title: data.title || 'Untitled Case',
                    isPublic: Boolean(data.isPublic),
                    parentId: data.parentId || null,
                    version: boardVer,
                });

                currentVersionRef.current = boardVer;
                lastSavedSnapshotRef.current = JSON.stringify({ nodes: loadedNodes, edges: loadedEdges });
                setBoardOwnerId(data.userId);
                setSaveStatus('saved');
                setConflictInfo(null);
                isLoadedRef.current = true;

                // Fetch pending notifications if owner
                if (session?.user?.id === data.userId) {
                    const contribRes = await fetch(`/api/contributions?boardId=${boardId}`);
                    if (contribRes.ok) {
                        const contribs = await contribRes.json();
                        setPendingContributionCount(
                            (contribs as Record<string, unknown>[]).filter((c) => c.status === 'open').length
                        );
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load board:', error);
            toast.error('Failed to load board');
        } finally {
            setIsBoardLoading(false);
        }
    }, [boardId, session?.user?.id]);

    // Board Route Lifecycle: Reset on boardId change and on unmount
    useEffect(() => {
        if (!boardId) return;

        // Immediately purge store to guarantee zero cross-board evidence leak
        useStore.getState().resetBoard();
        isLoadedRef.current = false;
        setIsBoardLoading(true);
        setSaveStatus('saved');
        setConflictInfo(null);

        fetchBoard();

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            useStore.getState().resetBoard();
            isLoadedRef.current = false;
        };
    }, [boardId, fetchBoard]);
```

#### C. Debounced Auto-Save & Manual Save Handler:
```typescript
    const performSave = useCallback(
        async (isManual = false) => {
            if (!boardId || isReadOnly) return;
            if (isSavingRef.current) return;

            const currentSnapshot = JSON.stringify({ nodes, edges });
            // If auto-save and nothing changed since last save, skip
            if (!isManual && currentSnapshot === lastSavedSnapshotRef.current) {
                return;
            }

            isSavingRef.current = true;
            setSaving(true);
            setSaveStatus('saving');

            try {
                const versionToSend = currentVersionRef.current;
                const res = await fetch(`/api/boards/${boardId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: { nodes, edges },
                        version: versionToSend,
                    }),
                });

                if (res.status === 200) {
                    const data = await res.json();
                    const newVersion = data.version ?? versionToSend + 1;
                    currentVersionRef.current = newVersion;
                    useStore.getState().setBoardVersion(newVersion);
                    lastSavedSnapshotRef.current = currentSnapshot;
                    setLastSaved(new Date());
                    setSaveStatus('saved');
                    setConflictInfo(null);
                } else if (res.status === 409) {
                    const errData = await res.json();
                    setSaveStatus('conflict');
                    setConflictInfo({
                        message: errData.error || 'This case has been modified by another detective.',
                        serverVersion: errData.currentVersion,
                    });
                    toast.error('Conflict detected: This case has been modified by another detective.', {
                        duration: 8000,
                    });
                } else {
                    setSaveStatus('error');
                    toast.error('Failed to save case file');
                }
            } catch (error) {
                console.error('Save error:', error);
                setSaveStatus('error');
            } finally {
                isSavingRef.current = false;
                setSaving(false);
            }
        },
        [boardId, isReadOnly, nodes, edges]
    );

    // Debounced Auto-Save Trigger (2 seconds after last change)
    useEffect(() => {
        if (!isLoadedRef.current || isReadOnly || !boardId) return;

        const currentSnapshot = JSON.stringify({ nodes, edges });
        if (currentSnapshot === lastSavedSnapshotRef.current) return;

        setSaveStatus('unsaved');

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            performSave(false);
        }, 2000);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [nodes, edges, isReadOnly, boardId, performSave]);
```

#### D. Conflict Banner & Status Indicator in Top Bar:
```tsx
{/* 409 Conflict Banner */}
{saveStatus === 'conflict' && conflictInfo && (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-950/95 text-red-100 px-6 py-4 rounded-xl shadow-2xl border border-red-700 backdrop-blur-md flex items-center gap-6 max-w-xl animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
            <div className="flex flex-col">
                <span className="font-bold text-sm tracking-wide text-red-200">
                    CASE EVIDENCE CONFLICT (409)
                </span>
                <span className="text-xs text-red-300/80">
                    {conflictInfo.message} Auto-save paused to prevent overwriting evidence.
                </span>
            </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
            <button
                onClick={() => {
                    setConflictInfo(null);
                    fetchBoard();
                }}
                className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded font-mono text-xs uppercase tracking-wider transition-colors border border-red-600"
            >
                Reload Latest
            </button>
            <button
                onClick={() => setIsContributionsOpen(true)}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded font-mono text-xs uppercase tracking-wider transition-colors border border-stone-600"
            >
                Review / Merge
            </button>
        </div>
    </div>
)}

{/* Top Bar Save Status */}
{!isReadOnly && (
    <div className="bg-panel/10 backdrop-blur-md border border-panel-border/20 rounded-lg p-1 flex items-center gap-1 text-xs font-mono mr-2">
        {saveStatus === 'saving' ? (
            <div className="flex items-center gap-2 px-2">
                <ProgressBar isIndeterminate label="Saving Evidence..." className="max-w-[140px]" />
            </div>
        ) : saveStatus === 'conflict' ? (
            <span className="flex items-center gap-1 px-2 text-red-400 font-bold">
                <AlertTriangle className="w-3 h-3 text-red-400" /> Conflict (409)
            </span>
        ) : saveStatus === 'error' ? (
            <span className="flex items-center gap-1 px-2 text-red-400">Save Error</span>
        ) : saveStatus === 'saved' && lastSaved ? (
            <span className="flex items-center gap-1 px-2 text-green-400">
                <Check className="w-3 h-3" /> Saved {lastSaved.toLocaleTimeString()}
            </span>
        ) : (
            <span className="px-2 text-panel-foreground/60">Unsaved changes</span>
        )}
    </div>
)}
```

---

## 5. Verification Method

### 5.1 Automated Test Execution

1. **Unit Test Suite for Store Isolation & Board Lifecycle**:
   Run Vitest across the store suite:
   ```bash
   npm run test:unit src/store/useStore.test.ts
   ```
   *Expected Result*: 100% tests pass without `SafeStorage` TypeError warnings. Verify `loadBoard`, `resetBoard`, `deleteEdge`, and preference-only persistence.

2. **Integration Verification of Optimistic Locking (`PUT /api/boards/[id]`)**:
   Add test suite `tests/integration/board-optimistic-locking.test.ts` validating:
   - Valid update with correct `version` returns HTTP `200` with `version: 2`.
   - Stale update with mismatched `version` returns HTTP `409` Conflict.
   - Unversioned update succeeds and increments version.
   - Soft-deleted board returns HTTP `404`.
   Run with:
   ```bash
   npx vitest run tests/integration/board-optimistic-locking.test.ts
   ```

3. **E2E Tier 1 Cross-Board Isolation Verification (`T1-STORE-01`)**:
   ```bash
   npx playwright test tests/e2e/tier1/canvas.spec.ts -g "T1-STORE-01"
   ```
   *Expected Result*: Navigates between Board Alpha (`ALPHA UNIQUE CLUE`) and empty Board Beta; verifies zero stale nodes or residual text appear on Board Beta.

4. **E2E Tier 4 Version Conflict & Optimistic Locking Verification (`T4.4`)**:
   ```bash
   npx playwright test tests/e2e/tier4/versions-conflict.spec.ts
   ```
   *Expected Result*: Step 5 confirms `expect([200, 409]).toContain(collabUpdate.status)` succeeds against live cloud Turso DB.

### 5.2 Manual Inspection Checklist for Reviewers & Workers

1. Open DevTools Application tab -> Local Storage -> Inspect `case-file-storage`.
   *Pass Condition*: Only `{"state":{"theme":"...","activeColor":"...","connectMode":false},"version":0}` exists. No `nodes`, `edges`, or `boardTitle` are present.
2. In browser tab A, open a case board. In tab B, open the same case board. Edit and save in tab B. In tab A, make an edit.
   *Pass Condition*: Tab A detects version conflict on save attempt, displays red "CASE EVIDENCE CONFLICT (409)" banner, halts auto-save, and clicking "Reload Latest" fetches the newest changes.
3. Rapidly navigate between two boards with distinct nodes.
   *Pass Condition*: Zero visual flicker of the previous board's clues on the new board.

### 5.3 Invalidation Conditions
- If `localStorage.getItem('case-file-storage')` contains a `nodes` or `edges` array, F20 is violated.
- If `PUT /api/boards/[id]` returns `200` when given `version: 99999` (stale), F21 is violated.
- If switching from a populated board to an empty board displays any `.react-flow__node`, F20 is violated.
