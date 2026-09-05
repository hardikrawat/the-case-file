import type { Page } from '@playwright/test';

/**
 * Canvas automation helpers for ReactFlow evidence board interactions.
 */

/**
 * Waits for the ReactFlow canvas to mount and for loading overlays to disappear.
 */
export async function waitForBoardReady(page: Page, timeout: number = 20000): Promise<void> {
    // Wait for canvas container
    await page.waitForSelector('.react-flow', { state: 'visible', timeout });
    // Wait for any reconstruct / loading skeleton to detach
    const loader = page.locator('text=Reconstructing Case Evidence');
    if (await loader.isVisible()) {
        await loader.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
    }
}

/**
 * Adds an evidence node by clicking the corresponding button on the board toolbar.
 */
export async function addNode(
    page: Page,
    type: 'sticky' | 'text' | 'image' | 'article' | 'link'
): Promise<void> {
    const selectorMap: Record<string, string> = {
        sticky: 'button[aria-label="Add Sticky Note"], button:has-text("Sticky"), [data-testid="add-sticky"]',
        text: 'button[aria-label="Add Text"], button:has-text("Text"), [data-testid="add-text"]',
        image: 'button[aria-label="Add Image"], button:has-text("Image"), [data-testid="add-image"]',
        article: 'button[aria-label="Add Article"], button:has-text("Article"), [data-testid="add-article"]',
        link: 'button[aria-label="Add Link"], button:has-text("Link"), [data-testid="add-link"]',
    };

    const selector = selectorMap[type];
    await page.click(selector);
    // Short wait for ReactFlow node mount animation
    await page.waitForTimeout(300);
}

/**
 * Deletes a selected node on the ReactFlow canvas.
 */
export async function deleteNode(page: Page, nodeId: string): Promise<void> {
    const nodeLocator = page.locator(`[data-id="${nodeId}"], .react-flow__node[data-id="${nodeId}"]`);
    await nodeLocator.click();

    // Click delete action on node or trigger Backspace/Delete key
    const deleteBtn = nodeLocator.locator('button[aria-label="Delete Node"], [data-testid="delete-node"]');
    if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
    } else {
        await page.keyboard.press('Delete');
    }
    await page.waitForTimeout(300);
}

/**
 * Cuts a red yarn string edge connection on the ReactFlow canvas.
 */
export async function cutEdge(page: Page, edgeId: string): Promise<void> {
    const edgeLocator = page.locator(`[data-testid="rf__edge-${edgeId}"], g[data-id="${edgeId}"]`);
    await edgeLocator.click({ force: true });

    // Look for cut button (scissors icon or button with aria-label)
    const cutBtn = page.locator(`button[aria-label="Cut String"], [data-testid="cut-string-${edgeId}"]`);
    if (await cutBtn.isVisible()) {
        await cutBtn.click();
    }
    await page.waitForTimeout(300);
}

/**
 * Toggles an overlay panel on the board UI.
 */
export async function openPanel(
    page: Page,
    panel: 'comments' | 'collaborators' | 'history' | 'export'
): Promise<void> {
    const panelBtnMap: Record<string, string> = {
        comments: 'button[aria-label="Toggle Comments"], button:has-text("Comments"), [data-testid="toggle-comments"]',
        collaborators: 'button[aria-label="Collaborators"], button:has-text("Team"), [data-testid="toggle-collaborators"]',
        history: 'button[aria-label="Version History"], button:has-text("History"), [data-testid="toggle-history"]',
        export: 'button[aria-label="Export Board"], button:has-text("Export"), [data-testid="toggle-export"]',
    };

    await page.click(panelBtnMap[panel]);
    await page.waitForTimeout(300);
}
