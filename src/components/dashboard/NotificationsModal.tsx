'use client';

import React, { useEffect, useState } from 'react';
import { X, Bell, CheckCheck, Clock, ExternalLink, ShieldAlert, GitPullRequest, MessageSquare, Award } from 'lucide-react';
import Link from 'next/link';
import AppleSpinner from '@/components/ui/AppleSpinner';

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

interface NotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUnreadChange?: (count: number) => void;
}

export function NotificationsModal({ isOpen, onClose, onUnreadChange }: NotificationsModalProps) {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotifications = React.useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                if (onUnreadChange && typeof data.unreadCount === 'number') {
                    onUnreadChange(data.unreadCount);
                }
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        } finally {
            setIsLoading(false);
        }
    }, [onUnreadChange]);

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen, fetchNotifications]);

    const markAllAsRead = async () => {
        try {
            const res = await fetch('/api/notifications', { method: 'PATCH' });
            if (res.ok) {
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                if (onUnreadChange) onUnreadChange(0);
            }
        } catch (error) {
            console.error('Failed to mark notifications read:', error);
        }
    };

    const markSingleAsRead = async (id: string) => {
        try {
            await fetch(`/api/notifications?id=${id}`, { method: 'PATCH' });
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
            );
            const remaining = notifications.filter((n) => n.id !== id && !n.isRead).length;
            if (onUnreadChange) onUnreadChange(remaining);
        } catch (error) {
            console.error('Failed to mark notification read:', error);
        }
    };

    if (!isOpen) return null;

    const getIcon = (type: string) => {
        switch (type) {
            case 'contribution':
                return <GitPullRequest className="w-4 h-4 text-purple-400" />;
            case 'comment':
                return <MessageSquare className="w-4 h-4 text-amber-400" />;
            case 'reputation':
                return <Award className="w-4 h-4 text-yellow-400" />;
            default:
                return <ShieldAlert className="w-4 h-4 text-blue-400" />;
        }
    };

    const getTargetLink = (n: NotificationItem) => {
        if (n.referenceType === 'board') {
            return `/board/${n.referenceId}`;
        }
        return null;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[var(--panel-foreground)] transition-colors duration-300">
                {/* Header */}
                <div className="p-4 border-b border-[var(--panel-border)] flex items-center justify-between bg-[var(--background)]/60">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-[var(--sidebar-accent)]/10 rounded-lg text-[var(--sidebar-accent)] border border-[var(--sidebar-accent)]/20">
                            <Bell className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-[var(--foreground)] text-base font-serif">Case Wire & Alerts</h3>
                            <p className="text-xs text-[var(--panel-foreground)]/60 font-mono">Incoming investigation dispatches</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {notifications.some((n) => !n.isRead) && (
                            <button
                                onClick={markAllAsRead}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--sidebar-accent)] hover:opacity-80 hover:bg-[var(--sidebar-accent)]/10 rounded transition-colors font-mono"
                                title="Mark all as read"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>Clear unread</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] hover:bg-[var(--panel-border)]/50 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto divide-y divide-[var(--panel-border)]/50 flex-1">
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center">
                            <AppleSpinner size="md" label="Decrypting incoming dispatches..." />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-[var(--background)]/50 flex items-center justify-center text-[var(--panel-foreground)]/40 border border-[var(--panel-border)]">
                                <Bell className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-serif font-bold text-[var(--foreground)]">The Wires Are Quiet</span>
                                <span className="text-xs text-[var(--panel-foreground)]/60 font-mono max-w-xs mt-1">
                                    No new dispatches or case updates found. Activity on your investigation boards will alert you here.
                                </span>
                            </div>
                        </div>
                    ) : (
                        notifications.map((n) => {
                            const targetLink = getTargetLink(n);
                            return (
                                <div
                                    key={n.id}
                                    onClick={() => !n.isRead && markSingleAsRead(n.id)}
                                    className={`py-3 px-2 flex items-start gap-3 rounded-lg transition-colors cursor-pointer ${
                                        n.isRead
                                            ? 'opacity-60 hover:opacity-100 hover:bg-[var(--background)]/30'
                                            : 'bg-[var(--sidebar-accent)]/10 hover:bg-[var(--sidebar-accent)]/15 border-l-2 border-[var(--sidebar-accent)]'
                                    }`}
                                >
                                    <div className="p-2 rounded-lg bg-[var(--background)] border border-[var(--panel-border)] shrink-0 mt-0.5">
                                        {getIcon(n.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-[var(--foreground)] leading-snug">{n.message}</p>
                                        <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--panel-foreground)]/60 font-mono">
                                            {n.actorName && <span>From: {n.actorName}</span>}
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(n.createdAt).toLocaleDateString()}
                                            </span>
                                            {targetLink && (
                                                <Link
                                                    href={targetLink}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onClose();
                                                    }}
                                                    className="flex items-center gap-1 text-[var(--sidebar-accent)] hover:underline font-bold"
                                                >
                                                    <span>Open Case</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                    {!n.isRead && (
                                        <span className="w-2 h-2 rounded-full bg-[var(--sidebar-accent)] shrink-0 mt-2"></span>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-[var(--background)]/40 border-t border-[var(--panel-border)] text-center text-xs text-[var(--panel-foreground)]/50 font-mono">
                    Case Intelligence Dispatch System • Confidential
                </div>
            </div>
        </div>
    );
}
