import Link from "next/link";
import { Flame, Clock, Award } from "lucide-react";
import { db } from "@/lib/db";
import { boards, userReputation } from "@/lib/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
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
      where: and(eq(boards.isPublic, true), isNull(boards.deletedAt)),
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
    <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-500">
      {/* Header */}
      <DiscoverHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-24 pb-12 flex gap-12">
        {/* Feed */}
        <div className="flex-1 space-y-12">
          {/* Hero Section */}
          {publicBoards.length > 0 && (
            <Link href={`/board/${publicBoards[0].id}`} className="block relative aspect-[2/1] rounded-2xl overflow-hidden border border-panel-border bg-panel group cursor-pointer shadow-xl">
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] transition-opacity group-hover:opacity-40"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-8">
                <div className="flex items-center gap-2 text-sidebar-accent mb-2">
                  <Flame className="w-5 h-5 fill-current" />
                  <span className="text-sm font-bold uppercase tracking-wider">Featured Case</span>
                </div>
                <h2 className="text-4xl font-bold font-serif text-white mb-2">{publicBoards[0].title}</h2>
                <p className="text-white/80 max-w-xl">Investigate this public case file.</p>
              </div>
            </Link>
          )}

          {/* Categories */}
          <div className="flex items-center gap-8 border-b border-panel-border pb-4">
            <button className="text-foreground font-bold border-b-2 border-sidebar-accent pb-4 -mb-4.5">Newest Cases</button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {publicBoards.slice(1).map((board) => (
              <Link href={`/board/${board.id}`} key={board.id} className="group block bg-panel/50 border border-panel-border rounded-xl overflow-hidden hover:border-sidebar-accent transition-all hover:translate-y-[-2px] shadow-sm">
                <div className="aspect-video bg-background relative flex items-center justify-center border-b border-panel-border/50">
                  <span className="text-panel-foreground/40 font-mono text-xs">PREVIEW</span>
                  <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-md px-2 py-1 rounded text-xs font-medium text-foreground/80 flex items-center gap-1 border border-panel-border/50">
                    <Clock className="w-3 h-3" /> {board.createdAt ? new Date(board.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-bold text-foreground group-hover:text-sidebar-accent transition-colors mb-2">
                    {board.title}
                  </h3>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-sidebar-accent/10 border border-sidebar-accent/20 flex items-center justify-center text-[10px] font-bold text-sidebar-accent">?</div>
                      <span className="text-sm text-panel-foreground/60">Detective</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {publicBoards.length <= 1 && (
              <div className="col-span-2 text-center text-panel-foreground/50 py-10 bg-panel/30 border border-dashed border-panel-border rounded-xl">
                No other public cases yet. Be the first to publish one!
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-80 hidden lg:block space-y-8">
          <div className="bg-panel/50 border border-panel-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Award className="w-5 h-5 text-sidebar-accent" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Top Detectives</h3>
            </div>
            <ul className="space-y-4">
              {topDetectives.length > 0 ? (
                topDetectives.map((detective, index) => (
                  <li key={detective.userId} className="flex items-center gap-3 p-2 rounded-lg bg-background/50 hover:bg-background border border-panel-border/50 transition-colors">
                    <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${index === 0 ? 'bg-sidebar-accent text-sidebar-accent-foreground' :
                      index === 1 ? 'bg-stone-300 text-stone-900' :
                        index === 2 ? 'bg-amber-800 text-amber-100' :
                          'bg-panel text-panel-foreground/60 border border-panel-border'
                      }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {detective.user?.name || 'Anonymous Detective'}
                      </p>
                      <p className="text-xs text-panel-foreground/60">{detective.points} Rep</p>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-panel-foreground/40 text-sm italic">No data available yet</li>
              )}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
