'use client';

import { useState } from 'react';
import { Users, X, Plus, Shield, Eye, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Collaborator {
    id: string;
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    addedAt: Date;
    userName: string | null;
    userEmail: string;
}

interface CollaboratorsProps {
    boardId: string;
    isOwner: boolean;
}

export function CollaboratorsPanel({ boardId, isOwner }: CollaboratorsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<'editor' | 'viewer'>('viewer');

    const loadCollaborators = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/boards/${boardId}/collaborators`);
            const data = await response.json();
            setCollaborators(data);
        } catch (error) {
            console.error('Failed to load collaborators:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail.trim()) return;

        try {
            // First, find user by email (would need a search endpoint)
            const response = await fetch(`/api/boards/${boardId}/collaborators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userEmail: newEmail, role: newRole }),
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

    const handleRemove = async (collaboratorId: string) => {
        if (!confirm('Remove this collaborator?')) return;

        try {
            const response = await fetch(`/api/boards/${boardId}/collaborators/${collaboratorId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Collaborator removed');
                await loadCollaborators();
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

    if (!isOpen) {
        return (
            <button
                onClick={() => {
                    setIsOpen(true);
                    loadCollaborators();
                }}
                className="fixed bottom-40 right-6 bg-stone-800 hover:bg-stone-700 text-stone-200 px-4 py-2 rounded-full shadow-lg font-medium transition-colors border border-stone-700 flex items-center gap-2"
                title="Collaborators"
            >
                <Users className="w-4 h-4" />
                Team
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-800 bg-stone-900/50">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" />
                    <h3 className="font-semibold text-stone-200">Collaborators</h3>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-stone-400 hover:text-stone-200 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Add Collaborator (Owner Only) */}
            {isOwner && (
                <form onSubmit={handleAdd} className="p-4 border-b border-stone-800 bg-stone-950/50">
                    <label className="block text-xs font-medium text-stone-400 mb-2">
                        Add Collaborator
                    </label>
                    <div className="flex gap-2 mb-2">
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="Email address"
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
                        className="w-full flex items-center justify-center gap-2 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium rounded-lg transition-colors text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </button>
                </form>
            )}

            {/* Collaborators List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isLoading ? (
                    <p className="text-center text-stone-500 text-sm py-8">Loading...</p>
                ) : collaborators.length === 0 ? (
                    <p className="text-center text-stone-500 text-sm py-8">
                        No collaborators yet
                    </p>
                ) : (
                    collaborators.map((collab) => (
                        <div
                            key={collab.id}
                            className="flex items-center gap-3 p-3 bg-stone-800/50 rounded-lg"
                        >
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-500 flex items-center justify-center text-stone-950 font-bold">
                                {(collab.userName || collab.userEmail)[0].toUpperCase()}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-stone-200 truncate">
                                    {collab.userName || collab.userEmail}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {getRoleIcon(collab.role)}
                                    <span className="text-xs text-stone-400 capitalize">
                                        {collab.role}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            {isOwner && collab.role !== 'owner' && (
                                <button
                                    onClick={() => handleRemove(collab.id)}
                                    className="text-stone-500 hover:text-red-400 transition-colors"
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
                    {isOwner ? '👑 You can manage team access' : '👁️ View-only access'}
                </p>
            </div>
        </div>
    );
}
