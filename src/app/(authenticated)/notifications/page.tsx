'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
    Bell,
    CheckCheck,
    Clock,
    ExternalLink,
    ShieldAlert,
    GitPullRequest,
    MessageSquare,
    Award,
    RotateCcw,
    Filter,
    CheckCircle2
} from 'lucide-react';
import AppleSpinner from '@/components/ui/AppleSpinner';
import { toast } from 'sonner';

export interface NotificationItem {
    id: string;
    type: string;
    referenceId: string;
    referenceType: string;
    message: string;
    isRead: boolean;
    createdAt: string | Date;
    actorName?: string | null;
    actorImage?: string | null;
}

type FilterType = 'all' | 'unread' | 'contribution' | 'comment' | 'reputation';

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMarkingAll, setIsMarkingAll] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');

    const fetchNotifications = useCallback(async (showToast = false) => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                if (showToast) {
                    toast.success('Dispatches updated');
                }
            } else {
                toast.error('Failed to retrieve wire dispatches');
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('Network error checking wire');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markAllAsRead = async () => {
        if (isMarkingAll) return;
        setIsMarkingAll(true);
        try {
            const res = await fetch('/api/notifications', { method: 'PATCH' });
            if (res.ok) {
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                toast.success('All dispatches marked as read');
            } else {
                toast.error('Failed to update dispatches');
            }
        } catch (error) {
            console.error('Failed to mark all as read:', error);
            toast.error('Network error updating notifications');
        } finally {
            setIsMarkingAll(false);
        }
    };

    const markSingleAsRead = async (id: string) => {
        try {
            // Optimistic update
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
            );
            await fetch(`/api/notifications?id=${id}`, { method: 'PATCH' });
        } catch (error) {
            console.error('Failed to mark notification read:', error);
        }
    };

    const unreadCount = useMemo(
        () => notifications.filter((n) => !n.isRead).length,
        [notifications]
    );

    const filteredNotifications = useMemo(() => {
        return notifications.filter((n) => {
            if (activeFilter === 'unread') return !n.isRead;
            if (activeFilter === 'contribution') return n.type === 'contribution';
            if (activeFilter === 'comment') return n.type === 'comment';
            if (activeFilter === 'reputation') return n.type === 'reputation';
            return true;
        });
    }, [notifications, activeFilter]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'contribution':
                return <GitPullRequest className="w-5 h-5 text-purple-400" />;
            case 'comment':
                return <MessageSquare className="w-5 h-5 text-amber-400" />;
            case 'reputation':
                return <Award className="w-5 h-5 text-yellow-400" />;
            default:
                return <ShieldAlert className="w-5 h-5 text-blue-400" />;
        }
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'contribution':
                return (
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-purple-950/60 text-purple-300 border border-purple-800">
                        Contribution
                    </span>
                );
            case 'comment':
                return (
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-amber-950/60 text-amber-300 border border-amber-800">
                        Comment
                    </span>
                );
            case 'reputation':
                return (
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-yellow-950/60 text-yellow-300 border border-yellow-800">
                        Reputation
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-blue-950/60 text-blue-300 border border-blue-800">
                        Dispatch
                    </span>
                );
        }
    };

    const getTargetLink = (n: NotificationItem) => {
        if (n.referenceType === 'board' && n.referenceId) {
            return `/board/${n.referenceId}`;
        }
        return null;
    };

    const filterTabs: { id: FilterType; label: string; count?: number }[] = [
        { id: 'all', label: 'All Dispatches', count: notifications.length },
        { id: 'unread', label: 'Unread', count: unreadCount },
        {
            id: 'contribution',
            label: 'Contributions',
            count: notifications.filter((n) => n.type === 'contribution').length,
        },
        {
            id: 'comment',
            label: 'Comments',
            count: notifications.filter((n) => n.type === 'comment').length,
        },
        {
            id: 'reputation',
            label: 'Reputation',
            count: notifications.filter((n) => n.type === 'reputation').length,
        },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--panel-border)]">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2.5 bg-[var(--sidebar-accent)]/10 text-[var(--sidebar-accent)] rounded-lg border border-[var(--sidebar-accent)]/20">
                            <Bell className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold font-serif tracking-tight text-[var(--foreground)]">
                            Case Wire & Alerts
                        </h1>
                        {unreadCount > 0 && (
                            <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-red-600 text-white animate-pulse">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-[var(--panel-foreground)]/60 font-mono">
                        Incoming intelligence transmissions and investigative activity across all bureaus
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchNotifications(true)}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-background)]/80 hover:bg-[var(--panel-background)] text-xs font-mono font-medium text-[var(--panel-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50 shadow-sm"
                        title="Refresh Dispatches"
                    >
                        <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh Wire</span>
                    </button>

                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            disabled={isMarkingAll}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/90 text-[var(--sidebar-accent-foreground)] text-xs font-mono font-bold transition-all shadow-md disabled:opacity-50"
                        >
                            {isMarkingAll ? (
                                <>
                                    <AppleSpinner size="xs" />
                                    <span>Updating...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCheck className="w-4 h-4" />
                                    <span>Mark All as Read</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[var(--panel-border)]/50 no-scrollbar">
                <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--panel-foreground)]/50 pr-2 border-r border-[var(--panel-border)]/60 shrink-0">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filter:</span>
                </div>
                {filterTabs.map((tab) => {
                    const isActive = activeFilter === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveFilter(tab.id)}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all shrink-0 ${
                                isActive
                                    ? 'bg-[var(--sidebar-accent)]/15 text-[var(--sidebar-accent)] font-bold border border-[var(--sidebar-accent)]/30'
                                    : 'text-[var(--panel-foreground)]/70 hover:text-[var(--foreground)] hover:bg-[var(--panel-background)]/60'
                            }`}
                        >
                            <span>{tab.label}</span>
                            {typeof tab.count === 'number' && (
                                <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] ${
                                        isActive
                                            ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]'
                                            : 'bg-[var(--panel-border)] text-[var(--panel-foreground)]/80'
                                    }`}
                                >
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="bg-[var(--panel-background)]/80 backdrop-blur-sm border border-[var(--panel-border)] rounded-xl overflow-hidden shadow-xl">
                {isLoading ? (
                    <div className="py-24 flex flex-col items-center justify-center gap-3">
                        <AppleSpinner size="lg" label="Decrypting incoming dispatches..." />
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-[var(--background)]/60 border border-[var(--panel-border)] flex items-center justify-center text-[var(--panel-foreground)]/40 mb-4 shadow-inner">
                            <Bell className="w-8 h-8 opacity-40" />
                        </div>
                        <h3 className="text-xl font-serif font-bold text-[var(--foreground)] mb-1">
                            {activeFilter === 'all'
                                ? 'The Wires Are Quiet'
                                : `No ${activeFilter} Dispatches Found`}
                        </h3>
                        <p className="text-xs text-[var(--panel-foreground)]/60 font-mono max-w-md">
                            {activeFilter === 'all'
                                ? 'No new transmissions recorded. Activity on your evidence boards, comments, and detective reviews will be reported here.'
                                : `Try switching filters or clearing unread dispatches to view past activity.`}
                        </p>
                        {activeFilter !== 'all' && (
                            <button
                                onClick={() => setActiveFilter('all')}
                                className="mt-4 px-3 py-1.5 text-xs text-[var(--sidebar-accent)] hover:underline font-mono"
                            >
                                ← View all dispatches
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--panel-border)]/50">
                        {filteredNotifications.map((n) => {
                            const targetLink = getTargetLink(n);
                            return (
                                <div
                                    key={n.id}
                                    onClick={() => !n.isRead && markSingleAsRead(n.id)}
                                    className={`p-4 md:p-5 flex items-start gap-4 transition-colors cursor-pointer group ${
                                        n.isRead
                                            ? 'bg-transparent hover:bg-[var(--background)]/40 opacity-75 hover:opacity-100'
                                            : 'bg-[var(--sidebar-accent)]/5 hover:bg-[var(--sidebar-accent)]/10 border-l-4 border-[var(--sidebar-accent)]'
                                    }`}
                                >
                                    {/* Icon Avatar */}
                                    <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--panel-border)] shrink-0 shadow-sm group-hover:border-[var(--sidebar-accent)]/40 transition-colors">
                                        {getIcon(n.type)}
                                    </div>

                                    {/* Dispatch Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                            {getTypeBadge(n.type)}
                                            {n.actorName && (
                                                <span className="text-xs font-mono font-semibold text-[var(--sidebar-accent)]">
                                                    Agent {n.actorName}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1 text-[11px] text-[var(--panel-foreground)]/50 font-mono ml-auto">
                                                <Clock className="w-3 h-3" />
                                                {new Date(n.createdAt).toLocaleString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>

                                        <p className="text-sm text-[var(--foreground)] font-sans leading-relaxed">
                                            {n.message}
                                        </p>

                                        {/* Actions Bar */}
                                        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-[var(--panel-border)]/30 text-xs font-mono">
                                            {targetLink && (
                                                <Link
                                                    href={targetLink}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!n.isRead) markSingleAsRead(n.id);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 text-[var(--sidebar-accent)] hover:opacity-80 font-bold transition-opacity"
                                                >
                                                    <span>Open Case Dossier</span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>
                                            )}

                                            {!n.isRead && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markSingleAsRead(n.id);
                                                    }}
                                                    className="flex items-center gap-1 text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] transition-colors ml-auto"
                                                    title="Mark this dispatch as read"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    <span>Mark as read</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Unread Indicator */}
                                    {!n.isRead && (
                                        <div
                                            className="w-2.5 h-2.5 rounded-full bg-[var(--sidebar-accent)] shrink-0 mt-2 ring-4 ring-[var(--sidebar-accent)]/20"
                                            title="Unread dispatch"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
