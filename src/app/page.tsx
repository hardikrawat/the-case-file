import Link from "next/link";
import { Flame, Clock, Award } from "lucide-react";
import { db } from "@/lib/db";
import { boards, userReputation } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { DiscoverHeader } from "@/components/DiscoverHeader";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

interface Board {
  id: string;
  title: string;
  isPublic: boolean | null;
  createdAt: Date | string | null;
  thumbnail?: string | null;
}

interface Detective {
  userId: string;
  points: number | null;
  user: {
    name: string | null;
    image?: string | null;
  }
}

export default async function DiscoverPage() {
  const session = await auth();

  // If authenticated, go to the unified dashboard view
  if (session?.user) {
    redirect("/discover");
  }
  let publicBoards: Board[] = [];
  let topDetectives: Detective[] = [];

  // Only query DB if credentials exist or in test environment
  if (process.env.TURSO_DATABASE_URL || process.env.NODE_ENV === 'test') {
    publicBoards = await db.query.boards.findMany({
      where: eq(boards.isPublic, true),
      orderBy: [desc(boards.createdAt)],
      limit: 10,
      with: {
        // ideally we would want user info here but simplified for now
      }
    });

    topDetectives = (await db.query.userReputation.findMany({
      orderBy: [desc(userReputation.points)],
      limit: 5,
      with: {
        user: true
      }
    })) as unknown as Detective[];
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans">
      {/* Header */}
      <DiscoverHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-24 pb-12 flex gap-12">
        {/* Feed */}
        <div className="flex-1 space-y-12">
          {/* Hero Section */}
          {publicBoards.length > 0 && (
            <Link href={`/board/${publicBoards[0].id}`} className="block relative aspect-[2/1] rounded-2xl overflow-hidden border border-stone-800 group cursor-pointer">
              <div className="absolute inset-0 bg-stone-900 bg-cover bg-center opacity-50 transition-opacity group-hover:opacity-40"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-8">
                <div className="flex items-center gap-2 text-amber-500 mb-2">
                  <Flame className="w-5 h-5 fill-amber-500" />
                  <span className="text-sm font-bold uppercase tracking-wider">Featured Case</span>
                </div>
                <h2 className="text-4xl font-bold font-serif text-white mb-2">{publicBoards[0].title}</h2>
                <p className="text-stone-300 max-w-xl">Investigate this public case file.</p>
              </div>
            </Link>
          )}

          {/* Categories */}
          <div className="flex items-center gap-8 border-b border-stone-800 pb-4">
            <button className="text-stone-100 font-bold border-b-2 border-amber-500 pb-4 -mb-4.5">Newest Cases</button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {publicBoards.slice(1).map((board) => (
              <Link href={`/board/${board.id}`} key={board.id} className="group block bg-stone-900/50 border border-stone-800 rounded-xl overflow-hidden hover:border-stone-600 transition-all hover:translate-y-[-2px]">
                <div className="aspect-video bg-stone-800 relative flex items-center justify-center">
                  <span className="text-stone-700 font-mono text-xs">PREVIEW</span>
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-medium text-stone-300 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {board.createdAt ? new Date(board.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-bold text-stone-200 group-hover:text-amber-500 transition-colors mb-2">
                    {board.title}
                  </h3>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-stone-700"></div>
                      <span className="text-sm text-stone-400">Detective</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {publicBoards.length <= 1 && (
              <div className="col-span-2 text-center text-stone-500 py-10">
                No other public cases yet. Be the first to publish one!
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-80 hidden lg:block space-y-8">
          <div className="bg-stone-900/30 border border-stone-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider">Top Detectives</h3>
            </div>
            <ul className="space-y-4">
              {topDetectives.length > 0 ? (
                topDetectives.map((detective, index) => (
                  <li key={detective.userId} className="flex items-center gap-3 p-2 rounded-lg bg-stone-900/50 hover:bg-stone-800 transition-colors">
                    <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${index === 0 ? 'bg-amber-500 text-stone-900' :
                      index === 1 ? 'bg-stone-400 text-stone-900' :
                        index === 2 ? 'bg-amber-900 text-amber-200' :
                          'bg-stone-800 text-stone-500 border border-stone-700'
                      }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-200 truncate">
                        {detective.user?.name || 'Anonymous Detective'}
                      </p>
                      <p className="text-xs text-stone-500">{detective.points} Rep</p>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-stone-500 text-sm italic">No data available yet</li>
              )}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
