'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@/hooks/useUser';
import { getRankTitle } from '@/lib/ranks';
import AppleSpinner from '@/components/ui/AppleSpinner';

interface UserProfile {
    id: string;
    name: string | null;
    email: string;
    bio: string | null;
    avatarUrl: string | null;
    image: string | null;
    boardsCount: number;
    reputation: number;
    createdAt: string;
}

export default function ProfilePage() {
    const params = useParams();
    const { user: currentUser } = useUser();

    // We fetch the profile data for the ID in the URL
    // If it's the current user, we could theoretically use `currentUser`, but fetching ensures we get the public view data structure
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', bio: '', avatarUrl: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const isOwnProfile = currentUser?.id === params.id;

    // Use current user data for live updates if it's their own profile
    // But we still need the base fetch for boardsCount etc if not in /me
    const loadProfile = useCallback(async () => {
        try {
            const response = await fetch(`/api/profile/${params.id}`);
            const data = await response.json();

            if (response.ok) {
                setProfile(data);
                setEditForm({
                    name: data.name || '',
                    bio: data.bio || '',
                    avatarUrl: data.avatarUrl || data.image || ''
                });
            }
        } catch (_error) {
            console.error('Failed to load profile:', _error);
        } finally {
            setIsLoading(false);
        }
    }, [params.id]);

    // Use current user data for live updates if it's their own profile
    // But we still need the base fetch for boardsCount etc if not in /me
    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(`/api/profile/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });

            if (response.ok) {
                toast.success('Dossier updated!');
                setIsEditing(false);
                await loadProfile();
            } else {
                toast.error('Failed to update dossier');
            }
        } catch {
            toast.error('An error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-500">
                <AppleSpinner size="xl" label="RETRIEVING FILE..." />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-500">
                <div className="bg-panel p-8 rounded-lg border border-red-900/50 text-center">
                    <h1 className="text-2xl text-red-500 font-bold mb-2">FILE NOT FOUND</h1>
                    <p className="text-panel-foreground/60">The requested dossier does not exist or has been redacted.</p>
                    <Link href="/cases" className="inline-block mt-4 text-sidebar-accent hover:text-sidebar-foreground font-mono">
                        ← Return to HQ
                    </Link>
                </div>
            </div>
        );
    }

    const displayRank = getRankTitle(profile.reputation || 0);

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 overflow-y-auto transition-colors duration-500">
            {/* Back Link */}
            <div className="max-w-5xl mx-auto mb-6">
                <Link href="/cases" className="text-muted-foreground hover:text-sidebar-accent transition-colors font-mono text-sm flex items-center gap-2">
                    ← RETURN TO DASHBOARD
                </Link>
            </div>

            <div className="max-w-5xl mx-auto relative perspective-1000">
                {/* Folder Tab */}
                <div className="absolute -top-8 left-0 w-48 h-10 bg-panel border-t border-x border-panel-border rounded-t-lg flex items-center justify-center shadow-sm z-0">
                    <span className="text-panel-foreground/60 font-bold font-mono tracking-widest text-sm">CONFIDENTIAL</span>
                </div>

                {/* Main Folder Body */}
                <div className="relative bg-panel border border-panel-border rounded-tr-lg rounded-b-lg shadow-2xl p-6 md:p-12 min-h-[600px] z-10 transition-colors duration-500">

                    {/* Folder Crease */}
                    {/* Folder Crease - optional, maybe remove if it clashes, or make subtle */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-panel-border opacity-50 hidden md:block"></div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative">

                        {/* LEFT COLUMN: Identity */}
                        <div className="flex flex-col items-center md:items-start space-y-8">

                            {/* Polaroid Avatar */}
                            {/* Polaroid Avatar */}
                            <div className="relative transform -rotate-2 hover:rotate-0 transition-transform duration-300">
                                <div className="bg-background p-4 pb-12 shadow-md border border-panel-border w-64">
                                    {profile.avatarUrl || profile.image ? (
                                        <div className="w-full h-56 bg-sidebar-background overflow-hidden grayscale contrast-125 sepia-[.2]">
                                            <div className="relative w-full h-full">
                                                <Image
                                                    src={profile.avatarUrl || profile.image || ''}
                                                    alt="Subject"
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full h-56 bg-sidebar-accent/10 flex items-center justify-center text-sidebar-accent font-mono text-4xl">
                                            ?
                                        </div>
                                    )}
                                    <div className="mt-4 text-center font-handwriting text-2xl text-foreground transform -rotate-1">
                                        {profile.name}
                                    </div>
                                </div>
                                {/* Paperclip */}
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-16 border-4 border-panel-foreground/40 rounded-full z-20 opacity-80 pointer-events-none"></div>
                            </div>

                            {/* Badge/Stamp */}
                            <div className="border-4 border-red-800/80 p-4 rounded-lg transform rotate-3 opacity-90">
                                <h3 className="text-red-900 font-black text-xl tracking-widest uppercase text-center border-b-2 border-red-900/50 pb-1 mb-1">
                                    CLEARED
                                </h3>
                                <p className="text-red-900 font-bold text-center text-sm">LEVEL: {displayRank}</p>
                            </div>

                            {isOwnProfile && !isEditing && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="mt-4 px-6 py-2 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-accent-foreground font-mono text-sm transition-colors shadow-lg transform active:scale-95"
                                >
                                    [ UPDATE DOSSIER ]
                                </button>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Data */}
                        <div className="font-mono text-panel-foreground space-y-8 relative">
                            {/* Red String Connector (Visual only) */}
                            <div className="absolute top-20 -left-16 w-16 h-1 bg-red-800/60 transform -rotate-12 hidden md:block"></div>

                            <div className="space-y-6">
                                <h2 className="text-3xl font-bold tracking-tighter border-b-2 border-panel-foreground/20 pb-2 mb-6 uppercase">
                                    Subject Details
                                </h2>

                                {isEditing ? (
                                    <div className="space-y-4 bg-background/50 p-6 rounded border border-panel-border shadow-inner relative overflow-hidden">
                                        {isSaving && (
                                            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in duration-200">
                                                <AppleSpinner size="md" label="Updating dossier..." />
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold uppercase mb-1 opacity-70">Full Name</label>
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                className="w-full bg-background border-b-2 border-panel-border p-2 focus:outline-none focus:border-sidebar-accent font-mono text-foreground"
                                                disabled={isSaving}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase mb-1 opacity-70">Mugshot URL</label>
                                            <input
                                                type="text"
                                                value={editForm.avatarUrl}
                                                onChange={(e) => setEditForm({ ...editForm, avatarUrl: e.target.value })}
                                                className="w-full bg-background border-b-2 border-panel-border p-2 focus:outline-none focus:border-sidebar-accent font-mono text-xs text-foreground"
                                                placeholder="https://..."
                                                disabled={isSaving}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase mb-1 opacity-70">Field Notes (Bio)</label>
                                            <textarea
                                                value={editForm.bio}
                                                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                                rows={4}
                                                className="w-full bg-background border-b-2 border-panel-border p-2 focus:outline-none focus:border-sidebar-accent font-mono resize-none text-foreground"
                                                disabled={isSaving}
                                            />
                                        </div>
                                        <div className="flex gap-4 pt-4">
                                            <button
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                className="bg-sidebar-accent text-sidebar-accent-foreground px-4 py-2 hover:bg-sidebar-accent/80 font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {isSaving ? (
                                                    <>
                                                        <AppleSpinner size="sm" />
                                                        <span>SAVING...</span>
                                                    </>
                                                ) : (
                                                    'SAVE CHANGES'
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                disabled={isSaving}
                                                className="bg-panel-border text-panel-foreground px-4 py-2 hover:bg-panel-border/80 font-bold text-sm"
                                            >
                                                CANCEL
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-[120px_1fr] gap-4 items-baseline">
                                            <span className="font-bold uppercase opacity-60">ID:</span>
                                            <span>{profile.id.substring(0, 8).toUpperCase()}</span>

                                            <span className="font-bold uppercase opacity-60">Full Name:</span>
                                            <span className="font-bold text-lg">{profile.name}</span>

                                            <span className="font-bold uppercase opacity-60">Contact:</span>
                                            <span>{profile.email}</span>

                                            <span className="font-bold uppercase opacity-60">Joined:</span>
                                            <span>{new Date(profile.createdAt || Date.now()).toLocaleDateString()}</span>
                                        </div>

                                        <div className="mt-8">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-bold uppercase opacity-60">Field Notes:</span>
                                            </div>
                                            <div className="bg-background/40 p-4 rounded min-h-[100px] border border-panel-border font-typewriter leading-relaxed">
                                                {profile.bio || "No field notes available for this subject."}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Sticky Notes for Stats */}
                            <div className="absolute -right-8 -bottom-8 md:bottom-20 md:-right-20 flex flex-col gap-4 transform rotate-3">
                                {/* Case Count Note */}
                                <div className="bg-yellow-200 w-40 h-40 p-4 shadow-lg flex flex-col items-center justify-center transform -rotate-2 hover:rotate-0 transition-transform text-[#2d2d2d] relative sticky-note-paper">
                                    <div className="absolute -top-3 left-1/2 w-4 h-4 rounded-full bg-red-500 shadow-sm thumb-tack"></div>
                                    <span className="font-handwriting text-4xl mb-1">{profile.boardsCount}</span>
                                    <span className="font-mono text-xs uppercase tracking-wider text-center">Cases Closed</span>
                                </div>

                                {/* Reputation Note */}
                                <div className="bg-pink-200 w-40 h-40 p-4 shadow-lg flex flex-col items-center justify-center transform rotate-6 hover:rotate-3 transition-transform text-[#2d2d2d] relative sticky-note-paper">
                                    <div className="absolute -top-2 left-1/2 w-3 h-10 bg-amber-200/50 rotate-45 transform -translate-x-1/2 opacity-50 z-10"></div> {/* Tape effect */}
                                    <span className="font-handwriting text-3xl mb-1">{profile.reputation}</span>
                                    <span className="font-mono text-xs uppercase tracking-wider text-center">Reputation</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
