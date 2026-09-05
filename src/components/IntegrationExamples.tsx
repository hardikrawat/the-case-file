'use client';

import { useState } from 'react';
import { FileUploadZone } from '@/components/FileUploadZone';


// Example integration component showing file upload with reputation
export function ProfileAvatarUpload({ userId }: { userId: string }) {
    const [avatarUrl, setAvatarUrl] = useState<string>('');

    const handleUploadComplete = async (url: string) => {
        setAvatarUrl(url);

        // Update user profile
        await fetch(`/api/profile/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarUrl: url }),
        });

        // Award points for completing profile
        // Note: This would typically be done server-side
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--foreground)]">Profile Picture</h3>
            <FileUploadZone
                onUploadComplete={handleUploadComplete}
                accept="image/*"
                maxSize={2 * 1024 * 1024} // 2MB for avatars
            />
            {avatarUrl && (
                <p className="text-xs text-[var(--sidebar-accent)]">
                    Avatar updated successfully!
                </p>
            )}
        </div>
    );
}

// Edge customization panel
export function EdgeCustomizationPanel({ onStyleChange }: { onStyleChange: (style: unknown) => void }) {
    const [edgeType, setEdgeType] = useState('default');
    const [edgeLabel, setEdgeLabel] = useState('');
    const [edgeColor, setEdgeColor] = useState('#78716c');

    const handleApply = () => {
        onStyleChange({
            type: edgeType,
            label: edgeLabel,
            color: edgeColor,
        });
    };

    return (
        <div className="bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-lg p-4 space-y-4 text-[var(--panel-foreground)]">
            <h3 className="font-semibold text-[var(--foreground)]">Edge Style</h3>

            <div>
                <label className="block text-xs text-[var(--panel-foreground)]/60 mb-2">Type</label>
                <select
                    value={edgeType}
                    onChange={(e) => setEdgeType(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--panel-border)] rounded text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--sidebar-accent)]"
                >
                    <option value="default">Default</option>
                    <option value="arrow">Arrow</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="bold">Bold</option>
                </select>
            </div>

            <div>
                <label className="block text-xs text-[var(--panel-foreground)]/60 mb-2">Label (optional)</label>
                <input
                    type="text"
                    value={edgeLabel}
                    onChange={(e) => setEdgeLabel(e.target.value)}
                    placeholder="e.g., leads to"
                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--panel-border)] rounded text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--sidebar-accent)] placeholder:text-[var(--panel-foreground)]/30"
                />
            </div>

            <div>
                <label className="block text-xs text-[var(--panel-foreground)]/60 mb-2">Color</label>
                <div className="flex gap-2">
                    {['#78716c', '#f59e0b', '#60a5fa', '#ef4444', '#10b981'].map(color => (
                        <button
                            key={color}
                            onClick={() => setEdgeColor(color)}
                            className={`w-8 h-8 rounded border-2 ${edgeColor === color ? 'border-[var(--sidebar-accent)] ring-2 ring-[var(--sidebar-accent)]/30' : 'border-[var(--panel-border)]'
                                }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
            </div>

            <button
                onClick={handleApply}
                className="w-full py-2 bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/90 text-[var(--sidebar-accent-foreground)] font-medium rounded transition-colors shadow"
            >
                Apply Style
            </button>
        </div>
    );
}
