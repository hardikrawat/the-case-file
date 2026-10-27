import { RightPanel } from "@/components/dashboard/RightPanel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DashboardShell rightPanel={<RightPanel />}>
            {children}
        </DashboardShell>
    );
}
