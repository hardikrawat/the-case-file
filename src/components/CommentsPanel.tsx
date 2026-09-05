'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { 
    X, 
    MessageSquare, 
    Send, 
    CornerDownRight, 
    Trash2, 
    Edit2, 
    Check, 
    Shield, 
    Award, 
    Paperclip, 
    Reply,
    Clock,
    User
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import AppleSpinner from '@/components/ui/AppleSpinner';
import { toast } from 'sonner';

interface Comment {
    id: string;
    userId: string;
    content: string;
    createdAt: string | Date;
    updatedAt?: string | Date;
    userName?: string | null;
    userImage?: string | null;
    parentId?: string | null;
    nodeId?: string | null;
    points?: number;
    isAnonymous?: boolean;
}

interface CommentsUIProps {
    boardId: string;
    nodeId?: string | null;
    isOpen?: boolean;
    onClose?: () => void;
    currentUserId?: string;
    isOwner?: boolean;
}

export function CommentsPanel({ boardId, nodeId, isOpen = false, onClose, currentUserId, isOwner }: CommentsUIProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    
    // Threading & Reply state
    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

    // In-place editing state
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Deletion confirmation
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

    const panelRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const loadComments = useCallback(async () => {
        setIsFetching(true);
        try {
            const url = nodeId
                ? `/api/comments?boardId=${boardId}&nodeId=${nodeId}`
                : `/api/comments?boardId=${boardId}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setComments(Array.isArray(data) ? data : []);
            } else {
                toast.error('Failed to load case comments');
            }
        } catch (error) {
            console.error('Failed to load comments:', error);
            toast.error('Failed to load comments');
        } finally {
            setIsFetching(false);
        }
    }, [boardId, nodeId]);

    useEffect(() => {
        if (isOpen) {
            loadComments();
        } else {
            setNewComment('');
            setReplyingTo(null);
            setEditingCommentId(null);
            setConfirmingDeleteId(null);
        }
    }, [isOpen, loadComments]);

    // Keyboard listener (Escape to close or cancel reply)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') {
                if (editingCommentId) {
                    setEditingCommentId(null);
                } else if (replyingTo) {
                    setReplyingTo(null);
                } else if (confirmingDeleteId) {
                    setConfirmingDeleteId(null);
                } else {
                    onClose?.();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, editingCommentId, replyingTo, confirmingDeleteId, onClose]);

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
                    parentId: replyingTo?.id || null,
                }),
            });

            if (response.ok) {
                setNewComment('');
                setReplyingTo(null);
                toast.success('Investigation lead submitted (+Reputation points)!');
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

    const handleSaveEdit = async (commentId: string) => {
        const trimmed = editingText.trim();
        if (!trimmed) return;

        setIsUpdating(true);
        try {
            const res = await fetch(`/api/comments/${commentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: trimmed }),
            });

            if (res.ok) {
                toast.success('Observation updated');
                setEditingCommentId(null);
                setEditingText('');
                await loadComments();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to update observation');
            }
        } catch {
            toast.error('Error updating comment');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        try {
            const res = await fetch(`/api/comments/${commentId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                toast.success('Comment removed');
                setConfirmingDeleteId(null);
                await loadComments();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to delete comment');
            }
        } catch {
            toast.error('Error deleting comment');
        }
    };

    const formatRelativeTime = (dateInput: Date | string | number) => {
        try {
            const d = new Date(dateInput);
            if (isNaN(d.getTime())) return 'Recently';
            return formatDistanceToNow(d, { addSuffix: true });
        } catch {
            return 'Recently';
        }
    };

    const getRankBadge = (points?: number) => {
        const score = points ?? 0;
        if (score >= 200) {
            return (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider font-mono">
                    <Shield className="w-2.5 h-2.5" /> Lead Detective
                </span>
            );
        }
        if (score >= 50) {
            return (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[9px] font-bold uppercase tracking-wider font-mono">
                    <Award className="w-2.5 h-2.5" /> Senior Sleuth
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-stone-500/15 text-stone-400 border border-stone-500/30 text-[9px] font-mono">
                Investigator
            </span>
        );
    };

    // Organize comments into parent threads and reply maps
    const { parentComments, repliesByParentId } = useMemo(() => {
        const parents: Comment[] = [];
        const replyMap = new Map<string, Comment[]>();

        comments.forEach((c) => {
            if (!c.parentId) {
                parents.push(c);
            } else {
                const existing = replyMap.get(c.parentId) || [];
                existing.push(c);
                replyMap.set(c.parentId, existing);
            }
        });

        return { parentComments: parents, repliesByParentId: replyMap };
    }, [comments]);

    if (!isOpen) return null;

    return (
        <div
            ref={panelRef}
            data-testid="comments-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Threaded Case Comments and Observations"
            className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-1.5rem)] bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[600px] text-[var(--panel-foreground)] transition-colors duration-300"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] bg-[var(--background)]/60">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[var(--sidebar-accent)]" />
                    <div>
                        <h3 className="font-semibold text-sm text-[var(--foreground)]">
                            {nodeId ? 'Clue Observation Thread' : 'Case Theory Discussion'}
                        </h3>
                        <p className="text-[10px] font-mono text-[var(--panel-foreground)]/50">
                            {nodeId ? 'Attached to evidence clue' : 'Board-wide detective debate'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] transition-colors p-1.5 rounded-lg hover:bg-[var(--background)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]"
                    title="Close Comments"
                    aria-label="Close Comments"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Comments Stream (Threaded) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[var(--background)]/20">
                {isFetching ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <AppleSpinner size="md" className="text-[var(--sidebar-accent)]" />
                        <span className="text-xs font-mono text-[var(--panel-foreground)]/60">Loading detective transmissions...</span>
                    </div>
                ) : parentComments.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <MessageSquare className="w-10 h-10 text-[var(--panel-foreground)]/20 mx-auto mb-2" />
                        <p className="text-[var(--panel-foreground)]/70 text-sm font-medium">No theories submitted yet</p>
                        <p className="text-[var(--panel-foreground)]/40 text-xs mt-1 leading-relaxed">
                            Share an investigative observation or question for your detective team.
                        </p>
                    </div>
                ) : (
                    parentComments.map((parent) => {
                        const replies = repliesByParentId.get(parent.id) || [];
                        const isEditingThis = editingCommentId === parent.id;
                        const isConfirmingDelete = confirmingDeleteId === parent.id;

                        return (
                            <div key={parent.id} className="space-y-2">
                                {/* Parent Comment Card */}
                                <div className="bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-lg p-3 shadow-sm hover:border-[var(--sidebar-accent)]/30 transition-colors">
                                    <div className="flex items-start gap-2.5">
                                        {/* Avatar */}
                                        {parent.userImage ? (
                                            <Image
                                                src={parent.userImage}
                                                alt=""
                                                width={28}
                                                height={28}
                                                className="w-7 h-7 rounded-full object-cover shrink-0 border border-[var(--panel-border)]"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-[var(--sidebar-accent)]/20 border border-[var(--sidebar-accent)]/40 flex items-center justify-center text-[var(--sidebar-accent)] font-bold text-xs shrink-0 font-mono">
                                                {(parent.userName || 'D')[0].toUpperCase()}
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1.5 mb-1">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="text-xs font-semibold text-[var(--foreground)] truncate">
                                                        {parent.userName || 'Detective'}
                                                    </span>
                                                    {getRankBadge(parent.points)}
                                                </div>
                                                <span className="text-[10px] font-mono text-[var(--panel-foreground)]/50 shrink-0">
                                                    {formatRelativeTime(parent.createdAt)}
                                                </span>
                                            </div>

                                            {/* Clue Node Indicator if attached to a clue */}
                                            {parent.nodeId && !nodeId && (
                                                <div className="mb-1 inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 text-[10px] font-mono border border-amber-500/20">
                                                    <Paperclip className="w-2.5 h-2.5" /> Attached to Clue
                                                </div>
                                            )}

                                            {/* Edit Box or Content */}
                                            {isEditingThis ? (
                                                <div className="mt-1 space-y-1.5">
                                                    <textarea
                                                        value={editingText}
                                                        onChange={(e) => setEditingText(e.target.value)}
                                                        className="w-full text-xs p-2 rounded bg-[var(--background)] border border-[var(--panel-border)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)]"
                                                        rows={2}
                                                    />
                                                    <div className="flex gap-1.5 justify-end">
                                                        <button
                                                            onClick={() => handleSaveEdit(parent.id)}
                                                            disabled={isUpdating}
                                                            className="px-2 py-0.5 bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] rounded text-[11px] font-medium flex items-center gap-1"
                                                        >
                                                            {isUpdating ? <AppleSpinner size="xs" /> : <Check className="w-3 h-3" />}
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingCommentId(null)}
                                                            className="px-2 py-0.5 text-[11px] text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)]"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-[var(--foreground)] leading-relaxed whitespace-pre-wrap break-words">
                                                    {parent.content}
                                                </p>
                                            )}

                                            {/* Footer Actions: Reply, Edit, Delete */}
                                            <div className="mt-2 pt-1.5 border-t border-[var(--panel-border)]/40 flex items-center justify-between text-[11px]">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReplyingTo(parent);
                                                        textareaRef.current?.focus();
                                                    }}
                                                    className="text-[var(--sidebar-accent)] hover:underline flex items-center gap-1 font-mono text-[10px]"
                                                >
                                                    <Reply className="w-3 h-3" /> Reply
                                                </button>

                                                <div className="flex items-center gap-1.5">
                                                    {/* In-place edit toggle */}
                                                    {currentUserId && parent.userId === currentUserId && !isEditingThis && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingCommentId(parent.id);
                                                                setEditingText(parent.content);
                                                            }}
                                                            className="text-[var(--panel-foreground)]/40 hover:text-[var(--foreground)] p-0.5"
                                                            title="Edit observation"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </button>
                                                    )}

                                                    {/* Delete action */}
                                                    {isConfirmingDelete ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(parent.id)}
                                                                className="px-1.5 py-0.2 bg-red-600 text-white rounded text-[10px] font-bold"
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfirmingDeleteId(null)}
                                                                className="text-[10px] text-[var(--panel-foreground)]/60"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        (isOwner || (currentUserId && parent.userId === currentUserId)) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfirmingDeleteId(parent.id)}
                                                                className="text-[var(--panel-foreground)]/40 hover:text-red-400 p-0.5"
                                                                title="Delete observation"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Threaded Replies Indented */}
                                {replies.length > 0 && (
                                    <div className="pl-6 space-y-2 border-l-2 border-[var(--sidebar-accent)]/20 ml-3">
                                        {replies.map((reply) => {
                                            const isEditingReply = editingCommentId === reply.id;
                                            const isConfirmingReplyDelete = confirmingDeleteId === reply.id;

                                            return (
                                                <div
                                                    key={reply.id}
                                                    className="bg-[var(--panel-background)]/80 border border-[var(--panel-border)]/80 rounded-lg p-2.5 shadow-sm hover:border-[var(--sidebar-accent)]/30 transition-colors"
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <CornerDownRight className="w-3.5 h-3.5 text-[var(--sidebar-accent)]/60 mt-1 shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                                <div className="flex items-center gap-1 truncate">
                                                                    <span className="text-[11px] font-semibold text-[var(--foreground)] truncate">
                                                                        {reply.userName || 'Detective'}
                                                                    </span>
                                                                    {getRankBadge(reply.points)}
                                                                </div>
                                                                <span className="text-[9px] font-mono text-[var(--panel-foreground)]/50">
                                                                    {formatRelativeTime(reply.createdAt)}
                                                                </span>
                                                            </div>

                                                            {isEditingReply ? (
                                                                <div className="mt-1 space-y-1">
                                                                    <textarea
                                                                        value={editingText}
                                                                        onChange={(e) => setEditingText(e.target.value)}
                                                                        className="w-full text-xs p-1.5 rounded bg-[var(--background)] border border-[var(--panel-border)] text-[var(--foreground)] focus:outline-none"
                                                                        rows={2}
                                                                    />
                                                                    <div className="flex gap-1 justify-end">
                                                                        <button
                                                                            onClick={() => handleSaveEdit(reply.id)}
                                                                            disabled={isUpdating}
                                                                            className="px-2 py-0.5 bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] rounded text-[10px]"
                                                                        >
                                                                            Save
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setEditingCommentId(null)}
                                                                            className="px-1.5 py-0.5 text-[10px] text-[var(--panel-foreground)]/60"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-[var(--foreground)]/90 leading-relaxed whitespace-pre-wrap break-words">
                                                                    {reply.content}
                                                                </p>
                                                            )}

                                                            <div className="mt-1 flex justify-end gap-1 text-[10px]">
                                                                {currentUserId && reply.userId === currentUserId && !isEditingReply && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditingCommentId(reply.id);
                                                                            setEditingText(reply.content);
                                                                        }}
                                                                        className="text-[var(--panel-foreground)]/40 hover:text-[var(--foreground)]"
                                                                    >
                                                                        <Edit2 className="w-2.5 h-2.5" />
                                                                    </button>
                                                                )}
                                                                {isConfirmingReplyDelete ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDelete(reply.id)}
                                                                            className="text-red-400 font-bold"
                                                                        >
                                                                            Confirm
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setConfirmingDeleteId(null)}
                                                                            className="text-[var(--panel-foreground)]/60"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    (isOwner || (currentUserId && reply.userId === currentUserId)) && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setConfirmingDeleteId(reply.id)}
                                                                            className="text-[var(--panel-foreground)]/40 hover:text-red-400"
                                                                        >
                                                                            <Trash2 className="w-2.5 h-2.5" />
                                                                        </button>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Replying Banner */}
            {replyingTo && (
                <div className="p-2 px-3 bg-[var(--sidebar-accent)]/10 border-t border-[var(--sidebar-accent)]/30 flex items-center justify-between text-xs text-[var(--sidebar-accent)]">
                    <div className="flex items-center gap-1.5 truncate">
                        <Reply className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Replying to {replyingTo.userName || 'Detective'}: &ldquo;{replyingTo.content.slice(0, 30)}...&rdquo;</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] p-0.5"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* New Comment Composer Form */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-[var(--panel-border)] bg-[var(--background)]/60">
                <label htmlFor="case-comment-textarea" className="sr-only">
                    Investigative Comment
                </label>
                <textarea
                    id="case-comment-textarea"
                    ref={textareaRef}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(evt) => {
                        evt.stopPropagation();
                        if ((evt.ctrlKey || evt.metaKey) && evt.key === 'Enter') {
                            evt.preventDefault();
                            handleSubmit(evt as unknown as React.FormEvent);
                        }
                    }}
                    placeholder={replyingTo ? 'Write a follow-up transmission...' : 'Add an investigative observation (Ctrl+Enter to post)...'}
                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--panel-border)] rounded-lg text-[var(--foreground)] placeholder-[var(--panel-foreground)]/40 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]/50 resize-none"
                    rows={2}
                    maxLength={5000}
                    disabled={isLoading}
                />
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[var(--panel-foreground)]/40">
                        {newComment.length}/5000 chars
                    </span>
                    <button
                        type="submit"
                        disabled={isLoading || !newComment.trim()}
                        className="py-1.5 px-3 bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/90 text-[var(--sidebar-accent-foreground)] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-1.5 shadow-sm"
                    >
                        {isLoading ? (
                            <>
                                <AppleSpinner size="xs" />
                                <span>Dispatching...</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-3 h-3" />
                                <span>{replyingTo ? 'Send Reply' : 'Post Observation'}</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

