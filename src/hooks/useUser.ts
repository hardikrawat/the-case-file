
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface UserProfile {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: string;
    reputationPoints: number;
    boardsCreated: number;
    contributionsAccepted: number;
}

export function useUser() {
    const { data: session, status } = useSession();

    const { data: user, error, isLoading: isUserLoading, mutate } = useSWR<UserProfile>(
        session?.user ? '/api/me' : null,
        fetcher,
        {
            revalidateOnFocus: true,
            refreshInterval: 30000, // Refresh every 30s to keep stats updated
        }
    );

    const rank = useMemo(() => {
        const points = user?.reputationPoints || 0;
        if (points >= 1000) return "Chief Detective";
        if (points >= 500) return "Senior Investigator";
        if (points >= 200) return "Private Eye";
        if (points >= 50) return "Rookie Cop";
        return "Patrol Officer";
    }, [user?.reputationPoints]);

    return {
        user,
        sessionUser: session?.user,
        isAuthenticated: status === "authenticated",
        isLoading: status === "loading" || (status === "authenticated" && isUserLoading),
        error,
        rank,
        mutate,
    };
}
