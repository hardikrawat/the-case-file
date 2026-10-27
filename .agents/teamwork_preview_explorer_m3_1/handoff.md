# Milestone 3 Explorer 1 Investigation Report: Canvas Core, LinkNode, Node Deletion & String Cutting (F16, F17, F18, F19)

**Agent**: `teamwork_preview_explorer_m3_1`  
**Working Directory**: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_1`  
**Milestone**: Milestone 3 (Canvas Board & Orphaned Panels Wiring)  
**Parent Agent**: Sub-Orchestrator M3 (`9fbe4361-8197-45dd-97fb-cda3d97e6796`)  
**Timestamp**: 2026-09-04T16:30:00Z  

---

## 1. Observation

### 1.1 F16: Fix Build Blocker (`connectMode`)
- **File**: `src/store/useStore.ts` (lines 31-34, 91-94)
  ```typescript
  31:     connectMode: boolean;
  32:     toggleConnectMode: () => void;
  33:     sourceNodeId: string | null;
  34:     setSourceNodeId: (id: string | null) => void;
  ...
  91:     connectMode: false,
  92:     toggleConnectMode: () => set({ connectMode: !get().connectMode, sourceNodeId: null }),
  93:     sourceNodeId: null,
  94:     setSourceNodeId: (sourceNodeId) => set({ sourceNodeId }),
  ```
- **File**: `src/store/useStore.test.ts` (lines 96, 109, 120)
  When running `npx tsc --noEmit`, the compiler threw:
  ```
  src/store/useStore.test.ts(96,58): error TS2304: Cannot find name 'NodeChange'.
  src/store/useStore.test.ts(109,58): error TS2304: Cannot find name 'EdgeChange'.
  src/store/useStore.test.ts(120,57): error TS2304: Cannot find name 'Connection'.
  ```
  These types are used in test type casts without importing `{ NodeChange, EdgeChange, Connection }` from `'reactflow'`. In addition, `useStore.test.ts` is missing unit tests for `toggleConnectMode()`.
- **File**: `src/components/ui/Toolbar.test.tsx` (line 155)
  When running `npx tsc --noEmit`:
  ```
  src/components/ui/Toolbar.test.tsx(155,17): error TS2684: The 'this' context of type '{ readAsText: Mock<Procedure>; onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null; result: string; }' is not assignable to method's 'this' of type 'FileReader'.
  ```
- **File**: `src/components/Board.test.tsx` (lines 67-83)
  The mocked state in `Board.test.tsx` defines `connectMode: false`, but omits `toggleConnectMode: vi.fn()`.
- **File**: `src/components/ui/Toolbar.tsx` (lines 10-21, 142-185)
  `Toolbar.tsx` does NOT import or use `connectMode` or `toggleConnectMode`. There is no UI button to toggle `connectMode`. As a result, users cannot toggle string connection mode from the toolbar.
- **File**: `src/components/Board.tsx` (lines 64, 128-149, 246, 416)
  `Board.tsx` correctly consumes `connectMode` for cursor styling (`${connectMode ? 'cursor-crosshair' : ''}`), disabling drag-to-connect (`nodesConnectable={!isReadOnly && !connectMode}`), and two-click node connection in `onNodeClick`.

### 1.2 F17: Link Evidence Node Component & Registration
- **Existing Node Components**:
  - `src/components/nodes/StickyNoteNode.tsx` (64x64/256px sticky note with yellow curled paper, architects font, thumb-tack, handles).
  - `src/components/nodes/TextNode.tsx` (clean label annotation, auto-resizing textarea, thumb-tack, handles).
  - `src/components/nodes/ImageNode.tsx` (polaroid frame, exhibit badge, image upload/preview, caption, thumb-tack, handles).
  - `src/components/nodes/ArticleNode.tsx` (newspaper clipping styling with torn edge, headline, preview image fetch via `/api/preview?url=`, external link, thumb-tack, handles).
- **Missing File**:
  - `src/components/nodes/LinkNode.tsx` does NOT exist in `src/components/nodes/`.
- **File**: `src/components/Board.tsx` (lines 34-39)
  ```typescript
  const nodeTypes = {
      sticky: StickyNoteNode,
      image: ImageNode,
      text: TextNode,
      article: ArticleNode,
  };
  ```
  `LinkNode` is completely missing from `nodeTypes` in `Board.tsx`.
- **File**: `src/components/ui/Toolbar.tsx` (lines 167-171)
  ```tsx
  <button onClick={addSticky} className="...">Sticky</button>
  <button onClick={addText} className="...">Text</button>
  <button onClick={addImage} className="...">Image</button>
  <button onClick={addArticle} className="...">Article</button>
  ```
  There is no "Add Link" button in `Toolbar.tsx`.
- **Authoritative Test Expectations**:
  - `tests/e2e/helpers/canvas-helpers.ts` (line 32):
    `link: 'button[aria-label="Add Link"], button:has-text("Link"), [data-testid="add-link"]'`
  - `tests/e2e/tier1/canvas.spec.ts` (lines 130-161):
    Tests `type: 'link'`, with `data: { title: 'Probate Registry Evidence', url: 'https://registry.example.org/cases/1029' }`, verifying that the node displays `/Probate Registry Evidence/i`.
  - `tests/e2e/tier3/canvas-nodes-strings.spec.ts` (lines 49-60, 98-103):
    Tests `type: 'link'`, with `data: { url: 'https://cyber-records.gov/case/8821', title: 'Decryption Registry Database', description: '...', favicon: '...' }`.

### 1.3 F18: Node Deletion UI & Dangling Edge Cleanup
- **File**: `src/components/nodes/StickyNoteNode.tsx`, `TextNode.tsx`, `ImageNode.tsx`, `ArticleNode.tsx`
  None of the existing node components have a delete button. There is no element matching:
  `button[aria-label="Delete Node"], [data-testid="delete-node"]`
  which is specifically required by `tests/e2e/helpers/canvas-helpers.ts` (line 49).
- **File**: `src/store/useStore.ts` (lines 132-138)
  ```typescript
  deleteNode: (id) =>
      set({
          nodes: get().nodes.filter((node) => node.id !== id),
          edges: get().edges.filter(
              (edge) => edge.source !== id && edge.target !== id
          ),
      }),
  ```
  While `useStore.deleteNode(id)` cleans up connected edges, keyboard deletion does NOT invoke `deleteNode(id)`!
- **File**: `src/components/Board.tsx` (lines 405-433)
  When a user selects a node and presses `Delete` or `Backspace`:
  ReactFlow emits node changes to `onNodesChange` with `{ type: 'remove', id }`.
  ReactFlow also dispatches `onNodesDelete(nodes: Node[])`.
  However, in `Board.tsx`, `onNodesDelete` is NOT defined!
- **File**: `src/store/useStore.ts` (lines 112-116)
  ```typescript
  onNodesChange: (changes: NodeChange[]) => {
      set({
          nodes: applyNodeChanges(changes, get().nodes),
      });
  },
  ```
  `onNodesChange` only runs `applyNodeChanges` on `nodes`. It does NOT touch `edges`.
  Consequently, when a node is deleted via the `Delete` key on the canvas (as in `tests/e2e/tier1/canvas.spec.ts` lines 205-219), all edges connected to the deleted node remain as orphaned/dangling edges!

### 1.4 F19: String Cutting Sync in StringEdge
- **File**: `src/components/edges/StringEdge.tsx` (lines 15, 26-29, 79-86)
  ```typescript
  15: const { setEdges } = useReactFlow();
  ...
  26: const onEdgeClick = (evt: React.MouseEvent) => {
  27:     evt.stopPropagation();
  28:     setEdges((edges) => edges.filter((e) => e.id !== id));
  29: };
  ...
  79: <button
  80:     className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600 shadow-sm transition-colors"
  81:     onClick={onEdgeClick}
  82:     title="Cut String"
  83: >
  84:     <X size={12} />
  85: </button>
  ```
  1. `onEdgeClick` only calls ReactFlow's local `setEdges(...)`.
  2. `useStore.ts` does NOT have a `deleteEdge` action at all!
  3. When the user saves the board (`handleSave` in `Board.tsx` line 155), `Board.tsx` reads `edges` from `useStore((state) => state.edges)`. Because `useStore.edges` was never updated, the cut edge is still present in Zustand and is re-persisted to Turso DB!
  4. The cut button is missing:
     - `aria-label="Cut String"` (required by `canvas-helpers.ts` line 66 and `T1-CANVAS-07` line 253)
     - `data-testid={`cut-string-${id}`}` (required by `canvas-helpers.ts` line 66)
     - A scissors icon (`Scissors` from `lucide-react`)
  5. The cut button is currently only rendered when `selected` is true, but not on mouse hover.

---

## 2. Logic Chain

1. **Build Integrity (F16)**:
   - TypeScript compilation checks fail due to missing type imports in `useStore.test.ts` (`NodeChange`, `EdgeChange`, `Connection`) and an invalid `this` typing invocation in `Toolbar.test.tsx`.
   - Fixing these imports and types resolves the TS compiler errors.
   - `connectMode` exists in `useStore.ts` and `Board.tsx`, but is disconnected from the user interface because `Toolbar.tsx` lacks a button to toggle it. Providing a toggle button in `Toolbar.tsx` wires `connectMode` end-to-end.
2. **Evidence Representation (F17)**:
   - The application advertises 5 core evidence node types: Sticky, Text, Image, Article, and Link.
   - Without `LinkNode.tsx`, any case file or E2E test specifying `type: 'link'` fails to render properly.
   - Designing `LinkNode.tsx` with a detective dossier/manila card aesthetic (thumb-tack, manila styling, URL/title inputs, external link icon, connection handles, preview fetch via `/api/preview`) satisfies visual and functional expectations.
   - Registering `LinkNode` in `nodeTypes` in `Board.tsx` enables ReactFlow to render link nodes.
   - Adding an "Add Link" button in `Toolbar.tsx` with `data-testid="add-link"` and `aria-label="Add Link"` enables users and automated tests to create link nodes on the canvas.
3. **Canvas Deletion & Edge Consistency (F18)**:
   - When users delete a node via the UI button, an explicit `delete-node` button on the node component must call `deleteNode(id)`.
   - When users delete a node via keyboard (`Delete` or `Backspace`), ReactFlow dispatches `onNodesChange` with `{ type: 'remove' }` and `onNodesDelete`.
   - Because `applyNodeChanges` only mutates `nodes`, `onNodesChange` must also purge any edge where `edge.source` or `edge.target` equals any removed node ID.
   - Additionally, providing `onNodesDelete={(nodes) => nodes.forEach(n => deleteNode(n.id))}` in `Board.tsx` guarantees that keyboard deletion triggers the identical edge cleanup path.
4. **State Synchronization on String Cutting (F19)**:
   - ReactFlow's internal edge state and Zustand's persistent edge state must not diverge.
   - Adding `deleteEdge(id: string)` to `useStore.ts` provides the missing store mutation.
   - In `StringEdge.tsx`, calling `useStore.getState().deleteEdge(id)` alongside `setEdges(...)` removes the edge from both ReactFlow and Zustand simultaneously.
   - Adding hover support and attributes (`aria-label="Cut String"`, `data-testid={`cut-string-${id}`}`, `title="Cut String"`, and `Scissors` icon) fulfills all automated test selectors.

---

## 3. Caveats

- **Per-Board State Isolation (Feature 20)**: This report focuses on F16-F19. Feature 20 requires purging `nodes` and `edges` from `localStorage` safeStorage in `useStore.ts` and ensuring `loadBoard` / `resetBoard` clears state when switching routes. This is covered by Explorer 2/3 and the implementation Worker.
- **Preview API Rate Limiting**: `/api/preview` has rate limiting (20 req/min/IP) and SSRF protection. In tests, link nodes should gracefully handle network failures or fallback to standard URL/title when `/api/preview` is unreachable.
- No other caveats.

---

## 4. Conclusion & Concrete Implementation Plan

### 4.1 Plan for F16: Fix Build Blocker (`connectMode`)
1. **`src/store/useStore.ts`**:
   - Ensure `RFState` includes:
     ```typescript
     connectMode: boolean;
     toggleConnectMode: () => void;
     sourceNodeId: string | null;
     setSourceNodeId: (id: string | null) => void;
     deleteEdge: (id: string) => void;
     ```
   - Implementation:
     ```typescript
     connectMode: false,
     toggleConnectMode: () => set({ connectMode: !get().connectMode, sourceNodeId: null }),
     sourceNodeId: null,
     setSourceNodeId: (sourceNodeId) => set({ sourceNodeId }),
     deleteEdge: (id) =>
         set({
             edges: get().edges.filter((edge) => edge.id !== id),
         }),
     ```
2. **`src/store/useStore.test.ts`**:
   - Add import: `import { Connection, EdgeChange, NodeChange } from 'reactflow';`
   - Add unit tests for `toggleConnectMode` and `deleteEdge`:
     ```typescript
     it('should toggle connect mode', () => {
         expect(useStore.getState().connectMode).toBe(false);
         act(() => {
             useStore.getState().toggleConnectMode();
         });
         expect(useStore.getState().connectMode).toBe(true);
     });

     it('should delete an edge', () => {
         useStore.setState({ edges: [{ id: 'e1', source: '1', target: '2' }] });
         act(() => {
             useStore.getState().deleteEdge('e1');
         });
         expect(useStore.getState().edges).toHaveLength(0);
     });
     ```
3. **`src/components/ui/Toolbar.test.tsx`**:
   - Fix `onload` execution:
     `mockFileReader.onload?.call(mockFileReader as unknown as FileReader, { target: { result: mockFileReader.result } } as unknown as ProgressEvent<FileReader>);`
   - Add test verifying that clicking "Link" adds a link node and clicking "String" toggles connect mode.
4. **`src/components/Board.test.tsx`**:
   - Add `toggleConnectMode: vi.fn()`, `deleteEdge: vi.fn()` to store mock.

---

### 4.2 Plan for F17: Link Evidence Node Component & Registration
1. **Create `src/components/nodes/LinkNode.tsx`**:
   - Component characteristics:
     - Envelope / Manila file card styling (`bg-[#fbf7ed] border border-amber-900/20 rounded-md shadow-md`).
     - Visual thumb-tack (`<div className="thumb-tack" />`) at top center.
     - Handles: `<Handle type="target" position={Position.Top} id="target" ... />` and `<Handle type="source" position={Position.Top} id="source" ... />`.
     - Delete button: `<button aria-label="Delete Node" data-testid="delete-node" ...><Trash2 size={12} /></button>`.
     - Header: Web Record / Evidence stamp with `Globe` or `Link2` icon.
     - Title input/display: Editable `<input>` bound to `data.title`, supporting placeholder "Web Evidence".
     - URL input/display:
       - Editable URL input bound to `data.url`.
       - When URL exists, external link anchor `<a href={data.url} target="_blank" rel="noopener noreferrer" className="..."><ExternalLink size={10} /> Open Link</a>`.
     - Metadata auto-fetch: Fetch metadata from `/api/preview?url=...` with debounce when URL changes, storing `title`, `description`, `image`, and `favicon`.
     - Read-only support: `data.isReadOnly` disables editing and hides the delete button.
2. **Register in `src/components/Board.tsx`**:
   ```typescript
   import LinkNode from '@/components/nodes/LinkNode';
   ...
   const nodeTypes = {
       sticky: StickyNoteNode,
       image: ImageNode,
       text: TextNode,
       article: ArticleNode,
       link: LinkNode,
   };
   ```
3. **Add Button in `src/components/ui/Toolbar.tsx`**:
   - Add `addLink` handler:
     ```typescript
     const addLink = () => {
         const centerX = window.innerWidth / 2;
         const centerY = window.innerHeight / 2;
         const projected = project({ x: centerX, y: centerY });
         const newNode = {
             id: `link-${Date.now()}`,
             type: 'link',
             position: projected || { x: centerX, y: centerY },
             data: { title: 'Web Record', url: '' },
         };
         addNode(newNode);
     };
     ```
   - Render button in toolbar with exact selectors:
     ```tsx
     <button
         onClick={addLink}
         aria-label="Add Link"
         data-testid="add-link"
         className="px-4 py-2 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors text-gray-700"
     >
         Link
     </button>
     ```
   - Also add aria-labels and data-testids to all existing toolbar buttons (`add-sticky`, `add-text`, `add-image`, `add-article`).

---

### 4.3 Plan for F18: Node Deletion UI & Dangling Edge Cleanup
1. **Add Delete Button to all 5 Node Components**:
   - Target files:
     - `src/components/nodes/StickyNoteNode.tsx`
     - `src/components/nodes/TextNode.tsx`
     - `src/components/nodes/ImageNode.tsx`
     - `src/components/nodes/ArticleNode.tsx`
     - `src/components/nodes/LinkNode.tsx`
   - Delete Button JSX snippet:
     ```tsx
     {!isReadOnly && (
         <button
             onClick={(e) => {
                 e.stopPropagation();
                 useStore.getState().deleteNode(id);
             }}
             aria-label="Delete Node"
             data-testid="delete-node"
             title="Delete Node"
             className={twMerge(
                 "absolute -top-2 -right-2 z-50 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-all duration-200 pointer-events-auto",
                 selected ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
             )}
         >
             <Trash2 size={12} />
         </button>
     )}
     ```
2. **Purge Connected Edges on Keyboard Delete in `src/store/useStore.ts`**:
   - Update `onNodesChange`:
     ```typescript
     onNodesChange: (changes: NodeChange[]) => {
         const removedIds = new Set(
             changes
                 .filter((c) => c.type === 'remove')
                 .map((c) => (c as { id: string }).id)
         );
         if (removedIds.size > 0) {
             set({
                 nodes: applyNodeChanges(changes, get().nodes),
                 edges: get().edges.filter(
                     (edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target)
                 ),
             });
         } else {
             set({
                 nodes: applyNodeChanges(changes, get().nodes),
             });
         }
     },
     ```
3. **Wire `onNodesDelete` in `src/components/Board.tsx`**:
   ```typescript
   const deleteNode = useStore((state) => state.deleteNode);
   ...
   <ReactFlow
       ...
       onNodesDelete={(deletedNodes) => {
           deletedNodes.forEach((node) => deleteNode(node.id));
       }}
   >
   ```

---

### 4.4 Plan for F19: String Cutting Sync in StringEdge
1. **Add `deleteEdge` to `src/store/useStore.ts`**:
   ```typescript
   deleteEdge: (id: string) => {
       set({
           edges: get().edges.filter((edge) => edge.id !== id),
       });
   },
   ```
2. **Update `src/components/edges/StringEdge.tsx`**:
   - Import `Scissors` from `'lucide-react'`.
   - Import `useStore` from `'@/store/useStore'`.
   - Support hover state:
     ```typescript
     const [isHovered, setIsHovered] = useState(false);
     ```
   - Interaction path:
     ```tsx
     <path
         d={edgePath}
         fill="none"
         stroke="transparent"
         strokeWidth={24}
         className="react-flow__edge-interaction cursor-pointer"
         onMouseEnter={() => setIsHovered(true)}
         onMouseLeave={() => setIsHovered(false)}
     />
     ```
   - Click handler:
     ```typescript
     const onEdgeClick = (evt: React.MouseEvent) => {
         evt.stopPropagation();
         useStore.getState().deleteEdge(id);
         setEdges((edges) => edges.filter((e) => e.id !== id));
     };
     ```
   - Cut button rendering condition: `(selected || isHovered)`
   - Cut button element:
     ```tsx
     <button
         className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-all flex items-center justify-center pointer-events-auto"
         onClick={onEdgeClick}
         onMouseEnter={() => setIsHovered(true)}
         title="Cut String"
         aria-label="Cut String"
         data-testid={`cut-string-${id}`}
     >
         <Scissors size={12} className="rotate-90" />
     </button>
     ```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Unit & Integration Tests**:
   ```bash
   npx vitest run src/store/useStore.test.ts src/components/Board.test.tsx src/components/ui/Toolbar.test.tsx
   ```
   *Expected result*: All unit tests pass with 0 errors.
2. **TypeScript Compilation Check**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected result*: Clean compilation without TS errors in store and component files.
3. **Next.js Production Build**:
   ```bash
   npm run build
   ```
   *Expected result*: Next.js build succeeds with all routes compiled.
4. **Automated E2E Verification**:
   ```bash
   npx playwright test tests/e2e/tier1/canvas.spec.ts
   npx playwright test tests/e2e/tier3/canvas-nodes-strings.spec.ts
   ```
   *Expected result*:
   - `T1-CANVAS-05: Link Evidence Node Creation` passes.
   - `T1-CANVAS-06: Individual Node Deletion & Edge Cleanup` passes.
   - `T1-CANVAS-07: Red Yarn String Cutting Synchronization` passes.
   - `Tier 3.2: Multi-Node Creation (Sticky + Link) & Physics Edge Connections` passes.

### 5.2 Invalidation Conditions
- If deleting a node leaves an edge with matching `source` or `target` in `edges`, the fix is invalid.
- If cutting an edge leaves the edge in `useStore.getState().edges`, the fix is invalid.
- If clicking `button[aria-label="Add Link"]` fails to create a `link` node on the ReactFlow canvas, the fix is invalid.
- If `npx tsc --noEmit` fails on `useStore.test.ts` or `Toolbar.test.tsx`, the build fix is invalid.
