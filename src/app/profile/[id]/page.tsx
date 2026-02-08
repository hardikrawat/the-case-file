'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { UserBadge } from '@/components/dashboard/UserBadge';

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
    const { user: currentUser, rank: currentRank } = useUser();

    // We fetch the profile data for the ID in the URL
    // If it's the current user, we could theoretically use `currentUser`, but fetching ensures we get the public view data structure
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', bio: '', avatarUrl: '' });
    const [isLoading, setIsLoading] = useState(true);

    const isOwnProfile = currentUser?.id === params.id;

    // Use current user data for live updates if it's their own profile
    // But we still need the base fetch for boardsCount etc if not in /me
    useEffect(() => {
        loadProfile();
    }, [params.id]);

    const loadProfile = async () => {
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
        } catch (error) {
            console.error('Failed to load profile:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
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
        } catch (error) {
            toast.error('An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-stone-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
                    <p className="text-amber-500 font-mono animate-pulse">RETRIEVING FILE...</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-stone-950 flex items-center justify-center">
                <div className="bg-stone-900 p-8 rounded-lg border border-red-900/50 text-center">
                    <h1 className="text-2xl text-red-500 font-bold mb-2">FILE NOT FOUND</h1>
                    <p className="text-stone-400">The requested dossier does not exist or has been redacted.</p>
                    <Link href="/dashboard" className="inline-block mt-4 text-amber-500 hover:text-amber-400 font-mono">
                        ← Return to HQ
                    </Link>
                </div>
            </div>
        );
    }

    // Calculate rank for the displayed profile (not necessarily the current user)
    // Simple calc for display purposes if not passed from backend
    const getRank = (points: number) => {
        if (points >= 1000) return "Chief Detective";
        if (points >= 500) return "Senior Investigator";
        if (points >= 200) return "Private Eye";
        if (points >= 50) return "Rookie Cop";
        return "Patrol Officer";
    };

    const displayRank = getRank(profile.reputation || 0);

    return (
        <div className="min-h-screen bg-[#1c1917] p-4 md:p-8 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            {/* Back Link */}
            <div className="max-w-5xl mx-auto mb-6">
                <Link href="/dashboard" className="text-stone-400 hover:text-amber-500 transition-colors font-mono text-sm flex items-center gap-2">
                    ← RETURN TO DASHBOARD
                </Link>
            </div>

            <div className="max-w-5xl mx-auto relative perspective-1000">
                {/* Manila Folder Tab */}
                <div className="absolute -top-8 left-0 w-48 h-10 bg-[#e3d5b4] rounded-t-lg border-t border-x border-[#cbbfa0] flex items-center justify-center shadow-inner z-0">
                    <span className="text-[#5c5042] font-bold font-mono tracking-widest text-sm opacity-70">CONFIDENTIAL</span>
                </div>

                {/* Main Folder Body */}
                <div className="relative bg-[#f0e6d2] rounded-tr-lg rounded-b-lg shadow-2xl p-6 md:p-12 min-h-[600px] border border-[#d6c9ac] z-10"
                    style={{
                        backgroundImage: 'url("https://www.transparenttextures.com/patterns/cardboard-flat.png")',
                        boxShadow: 'inset 0 0 100px rgba(0,0,0,0.1), 0 20px 50px rgba(0,0,0,0.5)'
                    }}>

                    {/* Folder Crease */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-[#d6c9ac] opacity-50 hidden md:block"></div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative">

                        {/* LEFT COLUMN: Identity */}
                        <div className="flex flex-col items-center md:items-start space-y-8">

                            {/* Polaroid Avatar */}
                            <div className="relative transform -rotate-2 hover:rotate-0 transition-transform duration-300">
                                <div className="bg-white p-4 pb-12 shadow-md border border-stone-200 w-64">
                                    {profile.avatarUrl || profile.image ? (
                                        <div className="w-full h-56 bg-stone-800 overflow-hidden grayscale contrast-125 sepia-[.2]">
                                            <img
                                                src={profile.avatarUrl || profile.image || ''}
                                                alt="Subject"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-56 bg-stone-200 flex items-center justify-center text-stone-400 font-mono text-4xl">
                                            ?
                                        </div>
                                    )}
                                    <div className="mt-4 text-center font-handwriting text-2xl text-[#2d2d2d] transform -rotate-1">
                                        {profile.name}
                                    </div>
                                </div>
                                {/* Paperclip */}
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-16 border-4 border-stone-400 rounded-full z-20 opacity-80 pointer-events-none"></div>
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
                                    className="mt-4 px-6 py-2 bg-stone-800 text-stone-200 font-mono text-sm hover:bg-stone-700 transition-colors shadow-lg transform active:scale-95"
                                >
                                    [ UPDATE DOSSIER ]
                                </button>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Data */}
                        <div className="font-mono text-[#4a4036] space-y-8 relative">
                            {/* Red String Connector (Visual only) */}
                            <div className="absolute top-20 -left-16 w-16 h-1 bg-red-800/60 transform -rotate-12 hidden md:block"></div>

                            <div className="space-y-6">
                                <h2 className="text-3xl font-bold tracking-tighter border-b-2 border-[#4a4036] pb-2 mb-6 uppercase">
                                    Subject Details
                                </h2>

                                {isEditing ? (
                                    <div className="space-y-4 bg-white/50 p-6 rounded border border-stone-300 shadow-inner">
                                        <div>
                                            <label className="block text-xs font-bold uppercase mb-1">Full Name</label>
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                className="w-full bg-[#fdfbf7] border-b-2 border-stone-400 p-2 focus:outline-none focus:border-amber-600 font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase mb-1">Mugshot URL</label>
                                            <input
                                                type="text"
                                                value={editForm.avatarUrl}
                                                onChange={(e) => setEditForm({ ...editForm, avatarUrl: e.target.value })}
                                                className="w-full bg-[#fdfbf7] border-b-2 border-stone-400 p-2 focus:outline-none focus:border-amber-600 font-mono text-xs"
                                                placeholder="https://..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase mb-1">Field Notes (Bio)</label>
                                            <textarea
                                                value={editForm.bio}
                                                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                                rows={4}
                                                className="w-full bg-[#fdfbf7] border-b-2 border-stone-400 p-2 focus:outline-none focus:border-amber-600 font-mono resize-none"
                                            />
                                        </div>
                                        <div className="flex gap-4 pt-4">
                                            <button onClick={handleSave} className="bg-amber-700 text-white px-4 py-2 hover:bg-amber-800 font-bold text-sm">SAVE CHANGES</button>
                                            <button onClick={() => setIsEditing(false)} className="bg-stone-400 text-white px-4 py-2 hover:bg-stone-500 font-bold text-sm">CANCEL</button>
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
                                            <div className="bg-white/40 p-4 rounded min-h-[100px] border border-stone-300 font-typewriter leading-relaxed">
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
