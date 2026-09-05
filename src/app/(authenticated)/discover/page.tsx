import Link from "next/link";
import { Flame, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { boards } from "@/lib/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import BoardCard from "@/components/dashboard/BoardCard";
import BoardPreview, { PreviewEdge, PreviewNode } from "@/components/dashboard/BoardPreview";
import { Board, BoardContent } from "@/lib/types";

export default async function DiscoverPage() {
  // If we are in a build environment without DB credentials, return empty array to prevent build failure
  if (!process.env.TURSO_DATABASE_URL) {
    return (
      <div className="font-sans">
        <div className="max-w-6xl mx-auto py-4">
          {/* Feed */}
          <div className="space-y-12">
            {/* Hero Section */}
            <div className="col-span-2 text-center text-[var(--foreground)]/60 py-10">
              Database credentials not found. Build mode.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const publicBoards = await db.query.boards.findMany({
    where: and(eq(boards.isPublic, true), isNull(boards.deletedAt)),
    orderBy: [desc(boards.createdAt)],
    limit: 10,
    with: {
      author: true
    }
  });

  return (
    <div className="font-sans p-8">
      <div className="max-w-6xl mx-auto py-4">
        {/* Feed */}
        <div className="space-y-12">
          {/* Hero Section - "Featured Case File" Aesthetic */}
          {publicBoards.length > 0 && (
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-900/30 to-stone-900/30 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-0 bg-[var(--panel-background)] rounded-xl overflow-hidden shadow-2xl border border-[var(--panel-border)]">

                {/* Visual Preview (Left/Top) */}
                <div className="col-span-1 lg:col-span-3 h-64 lg:h-96 relative overflow-hidden border-b lg:border-b-0 lg:border-r border-[var(--panel-border)]">
                  <Link href={`/board/${publicBoards[0].id}`} className="block w-full h-full cursor-pointer hover:scale-[1.02] transition-transform duration-700 ease-out">
                    <div className="absolute inset-0 bg-[var(--background)] opacity-40 pattern-grid-lg"></div>
                    <BoardPreview
                      nodes={((publicBoards[0].content as unknown as BoardContent)?.nodes as unknown as PreviewNode[]) || []}
                      edges={((publicBoards[0].content as unknown as BoardContent)?.edges as unknown as PreviewEdge[]) || []}
                      className="w-full h-full bg-[var(--background)] opacity-80 hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 ring-1 ring-inset ring-black/5 dark:ring-white/5 pointer-events-none"></div>
                  </Link>
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm shadow-md">
                      <Flame className="w-3 h-3" /> Top Sceret
                    </span>
                  </div>
                </div>

                {/* Case Details (Right/Bottom) */}
                <div className="col-span-1 lg:col-span-2 p-8 flex flex-col justify-between bg-[var(--panel-background)]">
                  <div>
                    <div className="flex items-center justify-between mb-4 border-b border-[var(--panel-border)] pb-4">
                      <div className="flex items-center gap-2 text-xs font-mono text-[var(--panel-foreground)]/60 uppercase tracking-widest">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Case File #{publicBoards[0].id.slice(0, 8)}
                      </div>
                      <div className="text-[var(--panel-foreground)]/40 text-xs font-mono">
                        {new Date(publicBoards[0].createdAt || Date.now()).toLocaleDateString()}
                      </div>
                    </div>

                    <Link href={`/board/${publicBoards[0].id}`} className="group/title">
                      <h2 className="text-3xl font-bold font-serif text-[var(--foreground)] mb-3 leading-tight group-hover/title:text-[var(--sidebar-accent)] transition-colors">
                        {publicBoards[0].title}
                      </h2>
                    </Link>

                    <p className="text-[var(--panel-foreground)]/70 text-sm leading-relaxed line-clamp-4 mb-6 font-medium">
                      An open investigation by the community. Examine the evidence, follow the strings, and uncover the truth. The board contains complex connections waiting to be deciphered.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Detective Info */}
                    <div className="flex items-center gap-4 p-3 bg-[var(--background)]/50 rounded-lg border border-[var(--panel-border)]">
                      {publicBoards[0].author ? (
                        <>
                          {publicBoards[0].author.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={publicBoards[0].author.image} alt={publicBoards[0].author.name || "Author"} className="w-10 h-10 rounded-full border border-[var(--panel-border)] p-0.5 bg-[var(--background)]" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[var(--background)] flex items-center justify-center border border-[var(--panel-border)]">
                              <span className="text-sm font-bold text-[var(--panel-foreground)]/50">?</span>
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-[10px] text-[var(--panel-foreground)]/40 uppercase tracking-wider font-bold">Investigator</span>
                            <span className="text-sm font-bold text-[var(--panel-foreground)]/90">{publicBoards[0].author.name}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-[var(--panel-foreground)]/50 italic text-sm">Unknown Detective</span>
                      )}
                    </div>

                    <Link href={`/board/${publicBoards[0].id}`} className="block w-full text-center py-3 bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/90 text-[var(--sidebar-accent-foreground)] rounded-lg font-bold uppercase tracking-widest text-xs transition-colors shadow-lg">
                      Open Case File
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="flex items-center justify-between border-b border-[var(--panel-border)] pb-4 mt-8">
            <h3 className="text-xl font-serif font-bold text-[var(--foreground)] flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Latest Investigations
            </h3>
            {/* Filter tabs could go here */}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicBoards.slice(1).map((board) => (
              <BoardCard key={board.id} board={board as unknown as Board} />
            ))}
            {publicBoards.length <= 1 && (
              <div className="col-span-3 text-center py-20 bg-[var(--panel-background)]/30 rounded-xl border border-dashed border-[var(--panel-border)]">
                <p className="text-[var(--panel-foreground)]/60 font-mono text-sm">
                  {publicBoards.length === 0 ? 'Archives are empty.' : 'No other public cases pending review.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
