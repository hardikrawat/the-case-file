'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';

interface UserProfile {
    id: string;
    name: string | null;
    email: string;
    bio: string | null;
    avatarUrl: string | null;
    boardsCount: number;
    reputation: number;
}

export default function ProfilePage() {
    const params = useParams();
    const { data: session } = useSession();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', bio: '' });
    const [isLoading, setIsLoading] = useState(true);

    const isOwnProfile = session?.user?.id === params.id;

    useEffect(() => {
        loadProfile();
    }, [params.id]);

    const loadProfile = async () => {
        try {
            const response = await fetch(`/api/profile/${params.id}`);
            const data = await response.json();

            if (response.ok) {
                setProfile(data);
                setEditForm({ name: data.name || '', bio: data.bio || '' });
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
                toast.success('Profile updated!');
                setIsEditing(false);
                await loadProfile();
            } else {
                toast.error('Failed to update profile');
            }
        } catch (error) {
            toast.error('An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 flex items-center justify-center">
                <p className="text-stone-400">Loading profile...</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 flex items-center justify-center">
                <p className="text-stone-400">Profile not found</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/dashboard" className="text-amber-500 hover:text-amber-400 text-sm mb-4 inline-block">
                        ← Back to Dashboard
                    </Link>
                </div>

                {/* Profile Card */}
                <div className="bg-stone-900/50 backdrop-blur-sm border border-stone-800 rounded-xl p-8">
                    <div className="flex items-start gap-6">
                        {/* Avatar */}
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-600 to-amber-500 flex items-center justify-center text-stone-950 font-bold text-3xl">
                            {(profile.name || profile.email)[0].toUpperCase()}
                        </div>

                        {/* Profile Info */}
                        <div className="flex-1">
                            {isEditing ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-stone-300 mb-2">Name</label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            className="w-full px-4 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-stone-300 mb-2">Bio</label>
                                        <textarea
                                            value={editForm.bio}
                                            onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSave}
                                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium rounded-lg transition-colors"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditing(false);
                                                setEditForm({ name: profile.name || '', bio: profile.bio || '' });
                                            }}
                                            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-medium rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <h1 className="text-3xl font-bold text-stone-200">{profile.name || 'Anonymous'}</h1>
                                        {isOwnProfile && (
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="text-sm text-amber-500 hover:text-amber-400"
                                            >
                                                Edit Profile
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-stone-400 mb-4">{profile.email}</p>
                                    {profile.bio && (
                                        <p className="text-stone-300 mb-4">{profile.bio}</p>
                                    )}
                                </>
                            )}

                            {/* Stats */}
                            {!isEditing && (
                                <div className="flex gap-6 mt-6">
                                    <div>
                                        <p className="text-2xl font-bold text-amber-500">{profile.boardsCount}</p>
                                        <p className="text-sm text-stone-400">Cases</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-amber-500">{profile.reputation}</p>
                                        <p className="text-sm text-stone-400">Reputation</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
