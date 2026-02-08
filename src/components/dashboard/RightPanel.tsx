import { db } from "@/lib/db";
import { userReputation, comments, boards, users } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";

export async function RightPanel() {
    // 1. Fetch Top Detectives
    const topDetectives = await db.query.userReputation.findMany({
        orderBy: [desc(userReputation.points)],
        limit: 5,
        with: {
            user: true
        }
    });

    // 2. Fetch Recent System Activity (Comments for now)
    const recentActivity = await db.query.comments.findMany({
        orderBy: [desc(comments.createdAt)],
        limit: 5,
        with: {
            user: true,
            board: true
        }
    });

    return (
        <aside className="w-80 border-l border-stone-800 bg-stone-950 p-6 hidden xl:block overflow-y-auto no-scrollbar">
            {/* Top Detectives Section */}
            <div className="mb-8">
                <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-4">Top Detectives</h3>
                <ul className="space-y-4">
                    {topDetectives.length > 0 ? (
                        topDetectives.map((detective, index) => (
                            <li key={detective.userId} className="flex items-center gap-3">
                                <div className="relative">
                                    <div className={`w-10 h-10 rounded-full bg-stone-800 border-2 border-stone-700 overflow-hidden flex items-center justify-center text-xs font-bold text-stone-300`}>
                                        {detective.user?.avatarUrl ? (
                                            <img src={detective.user.avatarUrl} alt={detective.user.name || "User"} className="w-full h-full object-cover" />
                                        ) : (
                                            (detective.user?.name?.[0] || "U").toUpperCase()
                                        )}
                                    </div>
                                    {index < 3 && (
                                        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-stone-950 ${index === 0 ? "bg-amber-500 text-stone-950" :
                                                index === 1 ? "bg-stone-300 text-stone-950" :
                                                    "bg-amber-900 text-amber-100"
                                            }`}>
                                            {index + 1}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-medium text-stone-200 truncate">
                                        {detective.user?.name || "Anonymous Detective"}
                                    </p>
                                    <p className="text-xs text-stone-500 truncate">{detective.boardsCreated} Cases Solved • {detective.points} Rep</p>
                                </div>
                            </li>
                        ))
                    ) : (
                        <p className="text-stone-600 text-sm italic">No detectives ranked yet.</p>
                    )}
                </ul>
            </div>

            {/* Activity Log Section */}
            <div>
                <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-4">Latest Activity</h3>
                <div className="space-y-4">
                    {recentActivity.length > 0 ? (
                        recentActivity.map((activity) => (
                            <div key={activity.id} className="flex gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0 animate-pulse"></div>
                                <div>
                                    <p className="text-sm text-stone-300">
                                        <span className="font-bold text-stone-200">{activity.user?.name || "Someone"}</span> commented on <span className="text-amber-500">{activity.board?.title || "a case"}</span>
                                    </p>
                                    <p className="text-xs text-stone-600 mt-1">
                                        {activity.createdAt ? formatDistanceToNow(activity.createdAt, { addSuffix: true }) : 'Just now'}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-stone-600 text-sm italic">No recent activity.</p>
                    )}
                </div>
            </div>
        </aside>
    );
}
