'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface Comment {
    id: string;
    userId: string;
    content: string;
    createdAt: Date;
    userName?: string;
    parentId?: string | null;
}

interface CommentsUIProps {
    boardId: string;
    nodeId?: string | null;
}

export function CommentsPanel({ boardId, nodeId }: CommentsUIProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const loadComments = async () => {
        try {
            const url = nodeId
                ? `/api/comments?boardId=${boardId}&nodeId=${nodeId}`
                : `/api/comments?boardId=${boardId}`;

            const response = await fetch(url);
            const data = await response.json();
            setComments(data);
        } catch (error) {
            console.error('Failed to load comments:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boardId,
                    nodeId: nodeId || null,
                    content: newComment,
                }),
            });

            if (response.ok) {
                setNewComment('');
                await loadComments();
            }
        } catch (error) {
            console.error('Failed to post comment:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => {
                    setIsOpen(true);
                    loadComments();
                }}
                className="fixed bottom-6 right-6 bg-amber-600 hover:bg-amber-500 text-stone-950 px-4 py-2 rounded-full shadow-lg font-medium transition-colors"
            >
                💬 Comments
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-800 bg-stone-900/50">
                <h3 className="font-semibold text-stone-200">
                    {nodeId ? 'Node Comments' : 'Board Comments'}
                </h3>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-stone-400 hover:text-stone-200 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Comments List */}
            <div className="h-96 overflow-y-auto p-4 space-y-3 bg-stone-950/50">
                {comments.length === 0 ? (
                    <p className="text-center text-stone-500 text-sm py-8">No comments yet</p>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="bg-stone-800/50 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                                <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-stone-950 font-bold text-sm">
                                    {comment.userName?.[0] || 'U'}
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-stone-400">
                                        {comment.userName || 'Anonymous'} • {new Date(comment.createdAt).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-stone-200 mt-1">{comment.content}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New Comment Form */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-stone-800 bg-stone-900">
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-200 placeholder-stone-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                    rows={2}
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading || !newComment.trim()}
                    className="mt-2 w-full py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                    {isLoading ? 'Posting...' : 'Post Comment'}
                </button>
            </form>
        </div>
    );
}
