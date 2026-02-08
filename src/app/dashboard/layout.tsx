import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { RightPanel } from "@/components/dashboard/RightPanel";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-stone-950 text-stone-100 font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 flex overflow-hidden">
                    <main className="flex-1 overflow-y-auto no-scrollbar p-6">
                        {children}
                    </main>
                    <RightPanel />
                </div>
            </div>
        </div>
    );
}
