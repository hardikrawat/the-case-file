'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Users, X, Plus, Shield, Eye, Edit, Trash2, AlertTriangle, AtSign, Hash, Info } from 'lucide-react';
import { toast } from 'sonner';
import AppleSpinner from '@/components/ui/AppleSpinner';

interface Collaborator {
    id: string;
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    addedAt: Date | string;
    userName: string | null;
    userEmail: string | null;
    userImage?: string | null;
    isLeadOwner?: boolean;
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
    const [isAdding, setIsAdding] = useState(false);
    const [inviteMode, setInviteMode] = useState<'email' | 'id'>('email');
    const [inputValue, setInputValue] = useState('');
    const [newRole, setNewRole] = useState<'editor' | 'viewer'>('viewer');
    
    // Custom in-modal confirmation dialog for removing collaborator
    const [confirmingRemoval, setConfirmingRemoval] = useState<Collaborator | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);

    const panelRef = useRef<HTMLDivElement>(null);

    const loadCollaborators = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/boards/${boardId}/collaborators`);
            if (response.ok) {
                const data = await response.json();
                setCollaborators(Array.isArray(data) ? data : []);
            } else {
                toast.error('Failed to load team roster');
            }
        } catch (error) {
            console.error('Failed to load collaborators:', error);
            toast.error('Failed to load collaborators');
        } finally {
            setIsLoading(false);
        }
    }, [boardId]);

    useEffect(() => {
        if (isOpen) {
            loadCollaborators();
        } else {
            setInputValue('');
            setNewRole('viewer');
            setConfirmingRemoval(null);
        }
    }, [isOpen, loadCollaborators]);

    // Keyboard navigation (Escape to close or cancel removal)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') {
                if (confirmingRemoval) {
                    setConfirmingRemoval(null);
                } else {
                    onClose?.();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, confirmingRemoval, onClose]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) return;

        setIsAdding(true);
        try {
            const payload = inviteMode === 'email'
                ? { userEmail: trimmed, role: newRole }
                : { userId: trimmed, role: newRole };

            const response = await fetch(`/api/boards/${boardId}/collaborators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                toast.success('Detective clearance granted!');
                setInputValue('');
                await loadCollaborators();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to grant clearance');
            }
        } catch {
            toast.error('An error occurred granting clearance');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRoleChange = async (collaboratorId: string, role: 'viewer' | 'editor') => {
        // Optimistic UI update
        setCollaborators((prev) =>
            prev.map((c) => (c.id === collaboratorId ? { ...c, role } : c))
        );

        try {
            const response = await fetch(`/api/boards/${boardId}/collaborators`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ collaboratorId, role }),
            });

            if (response.ok) {
                toast.success(`Clearance updated to ${role}`);
                await loadCollaborators();
            } else {
                const err = await response.json();
                toast.error(err.error || 'Failed to update role');
                await loadCollaborators(); // Revert on failure
            }
        } catch {
            toast.error('Failed to update collaborator role');
            await loadCollaborators();
        }
    };

    const executeRemove = async (collab: Collaborator) => {
        setIsRemoving(true);
        try {
            const query = `collaboratorId=${encodeURIComponent(collab.id)}&userId=${encodeURIComponent(collab.userId)}`;
            const response = await fetch(`/api/boards/${boardId}/collaborators?${query}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Clearance safely revoked (archived)');
                setConfirmingRemoval(null);
                await loadCollaborators();
            } else {
                const err = await response.json();
                toast.error(err.error || 'Failed to revoke clearance');
            }
        } catch {
            toast.error('Failed to remove collaborator');
        } finally {
            setIsRemoving(false);
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'owner':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                        <Shield className="w-3 h-3 text-amber-400" /> Owner
                    </span>
                );
            case 'editor':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider">
                        <Edit className="w-3 h-3 text-blue-400" /> Editor
                    </span>
                );
            case 'viewer':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30 text-[10px] font-bold uppercase tracking-wider">
                        <Eye className="w-3 h-3 text-green-400" /> Viewer
                    </span>
                );
            default:
                return null;
        }
    };

    if (!isOpen) return null;

    return (
        <div
            ref={panelRef}
            data-testid="collaborators-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Case Collaborators and Team Clearance"
            className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-1.5rem)] bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-xl shadow-2xl overflow-hidden max-h-[620px] flex flex-col z-50 text-[var(--panel-foreground)] transition-colors duration-300"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] bg-[var(--background)]/60">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[var(--sidebar-accent)]" />
                    <div>
                        <h3 className="font-semibold text-sm text-[var(--foreground)]">Investigation Team</h3>
                        <p className="text-[10px] font-mono text-[var(--panel-foreground)]/50">RBAC Clearance & Member Roster</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] transition-colors p-1.5 rounded-lg hover:bg-[var(--background)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]"
                    title="Close Collaborators"
                    aria-label="Close Collaborators"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Custom Removal Confirmation Overlay */}
            {confirmingRemoval && (
                <div
                    role="alertdialog"
                    aria-label="Confirm Revocation of Clearance"
                    className="p-4 m-3 rounded-xl border border-red-500/40 bg-red-950/40 text-red-200 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-xs uppercase tracking-wide text-red-300">
                                Revoke Clearance Confirmation
                            </h4>
                            <p className="text-[11px] text-red-200/80 mt-1 leading-relaxed">
                                Revoke clearance for <strong className="text-white">{confirmingRemoval.userName || confirmingRemoval.userEmail}</strong>?
                                Collaborator records are protected by soft-delete safeguards.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={() => executeRemove(confirmingRemoval)}
                            disabled={isRemoving}
                            className="flex-1 py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            {isRemoving ? <AppleSpinner size="xs" /> : <Trash2 className="w-3.5 h-3.5" />}
                            <span>Confirm Revocation</span>
                        </button>
                        <button
                            onClick={() => setConfirmingRemoval(null)}
                            disabled={isRemoving}
                            className="py-1.5 px-3 border border-red-700/50 hover:bg-red-900/30 text-red-200 text-xs rounded transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Add Collaborator (Owner Only) */}
            {isOwner && (
                <form onSubmit={handleAdd} className="p-3.5 border-b border-[var(--panel-border)] bg-[var(--background)]/30 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--panel-foreground)]/80">Grant Case Clearance</span>
                        <div className="flex bg-[var(--background)] p-0.5 rounded border border-[var(--panel-border)] text-[10px]">
                            <button
                                type="button"
                                onClick={() => setInviteMode('email')}
                                className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                                    inviteMode === 'email'
                                        ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] font-bold'
                                        : 'text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)]'
                                }`}
                            >
                                <AtSign className="w-2.5 h-2.5" /> Email
                            </button>
                            <button
                                type="button"
                                onClick={() => setInviteMode('id')}
                                className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                                    inviteMode === 'id'
                                        ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] font-bold'
                                        : 'text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)]'
                                }`}
                            >
                                <Hash className="w-2.5 h-2.5" /> User ID
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <label htmlFor="collaborator-input" className="sr-only">
                            {inviteMode === 'email' ? 'Detective Email' : 'Detective User ID'}
                        </label>
                        <input
                            id="collaborator-input"
                            type={inviteMode === 'email' ? 'email' : 'text'}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={inviteMode === 'email' ? 'colleague@precinct.gov' : 'cuid_user_id...'}
                            className="flex-1 px-2.5 py-1.5 bg-[var(--background)] border border-[var(--panel-border)] rounded-lg text-[var(--foreground)] placeholder-[var(--panel-foreground)]/40 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]/50"
                        />
                        <label htmlFor="role-select" className="sr-only">Clearance Role</label>
                        <select
                            id="role-select"
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as 'editor' | 'viewer')}
                            className="px-2 py-1.5 bg-[var(--background)] border border-[var(--panel-border)] rounded-lg text-[var(--foreground)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]/50 font-medium"
                        >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={isAdding || !inputValue.trim()}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/90 text-[var(--sidebar-accent-foreground)] font-medium rounded-lg transition-colors text-xs disabled:opacity-50"
                    >
                        {isAdding ? (
                            <>
                                <AppleSpinner size="xs" />
                                <span>Verifying Clearance...</span>
                            </>
                        ) : (
                            <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add to Roster</span>
                            </>
                        )}
                    </button>
                </form>
            )}

            {/* Collaborators List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[var(--background)]/20">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <AppleSpinner size="md" className="text-[var(--sidebar-accent)]" />
                        <span className="text-xs text-[var(--panel-foreground)]/60 font-mono">Loading investigation roster...</span>
                    </div>
                ) : collaborators.length === 0 ? (
                    <p className="text-center text-[var(--panel-foreground)]/60 text-xs py-8">No external team members listed</p>
                ) : (
                    collaborators.map((collab) => (
                        <div
                            key={collab.id}
                            className="flex items-center gap-2.5 p-2.5 bg-[var(--background)]/50 border border-[var(--panel-border)] rounded-lg shadow-sm hover:border-[var(--sidebar-accent)]/30 transition-colors"
                        >
                            {/* Avatar */}
                            {collab.userImage ? (
                                <Image
                                    src={collab.userImage}
                                    alt=""
                                    width={32}
                                    height={32}
                                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-[var(--panel-border)]"
                                    unoptimized
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-[var(--sidebar-accent)]/20 border border-[var(--sidebar-accent)]/40 flex items-center justify-center text-[var(--sidebar-accent)] font-bold text-xs shrink-0 font-mono">
                                    {(collab.userName || collab.userEmail || 'D')[0].toUpperCase()}
                                </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-semibold text-[var(--foreground)] truncate">
                                        {collab.userName || 'Detective'}
                                    </p>
                                    {getRoleBadge(collab.role)}
                                </div>
                                {collab.userEmail && (
                                    <p className="text-[11px] text-[var(--panel-foreground)]/60 font-mono truncate">
                                        {collab.userEmail}
                                    </p>
                                )}
                            </div>

                            {/* Role Switcher or Static Indicator */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                {isOwner && !collab.isLeadOwner && collab.role !== 'owner' ? (
                                    <>
                                        <label htmlFor={`role-switch-${collab.id}`} className="sr-only">
                                            Change role for {collab.userName || collab.userEmail}
                                        </label>
                                        <select
                                            id={`role-switch-${collab.id}`}
                                            value={collab.role}
                                            onChange={(e) => handleRoleChange(collab.id, e.target.value as 'viewer' | 'editor')}
                                            className="text-[11px] bg-[var(--panel-background)] border border-[var(--panel-border)] text-[var(--panel-foreground)] rounded px-1.5 py-1 focus:outline-none focus:border-[var(--sidebar-accent)] font-medium"
                                        >
                                            <option value="viewer">Viewer</option>
                                            <option value="editor">Editor</option>
                                        </select>
                                        <button
                                            onClick={() => setConfirmingRemoval(collab)}
                                            className="text-[var(--panel-foreground)]/40 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-950/20"
                                            title={`Revoke clearance for ${collab.userName || collab.userEmail}`}
                                            aria-label={`Revoke clearance for ${collab.userName || collab.userEmail}`}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-[10px] text-[var(--panel-foreground)]/40 font-mono capitalize">
                                        {collab.role}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Clearance Guidance Footer */}
            <div className="p-3 border-t border-[var(--panel-border)] bg-[var(--background)]/40 space-y-1 text-[11px] text-[var(--panel-foreground)]/60">
                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground)] font-medium">
                    <Info className="w-3.5 h-3.5 text-[var(--sidebar-accent)] shrink-0" />
                    <span>Clearance Roles Summary</span>
                </div>
                <p className="text-[10px] leading-relaxed">
                    <strong>Owner:</strong> Full admin & versions • <strong>Editor:</strong> Canvas mutations & snapshots • <strong>Viewer:</strong> Read-only access
                </p>
            </div>
        </div>
    );
}

