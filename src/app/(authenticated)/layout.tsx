import { Sidebar } from "@/components/dashboard/Sidebar";
import { RightPanel } from "@/components/dashboard/RightPanel";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen font-sans bg-background text-foreground transition-colors duration-500">
            <Sidebar />
            <div className="flex-1 flex overflow-hidden">
                <main className="flex-1 overflow-y-auto no-scrollbar p-6">
                    {children}
                </main>
                <RightPanel />
            </div>
        </div>
    );
}
