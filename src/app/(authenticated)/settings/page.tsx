'use client';

import useStore from '@/store/useStore';
import { Palette, Check } from 'lucide-react';

export default function SettingsPage() {
    const theme = useStore((state) => state.theme);
    const setTheme = useStore((state) => state.setTheme);

    const themes = [
        { id: 'theme-cork', name: 'Cork Board', color: '#a1887f' },
        { id: 'theme-noir', name: 'Noir Detective', color: '#0f172a' },
        { id: 'theme-blueprint', name: 'Blueprint', color: '#1e3a8a' },
        { id: 'theme-minimal', name: 'Minimalist Dossier', color: '#f7f1e3' },
        { id: 'theme-profile', name: 'Confidential File', color: '#1c1917' },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-sidebar-accent/10 rounded-lg text-sidebar-accent">
                    <Palette className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold font-serif text-sidebar-foreground">Settings</h1>
                    <p className="text-sidebar-foreground/60">Customize your investigation environment</p>
                </div>
            </div>

            <section className="bg-panel/50 border border-panel-border rounded-xl p-8 backdrop-blur-sm">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-panel-foreground mb-2">Appearance</h2>
                    <p className="text-sm text-panel-foreground/60">Select a theme for your detective board and workspace.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {themes.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTheme(t.id)}
                            className={`group relative flex items-center gap-4 p-4 rounded-lg border transition-all duration-200 text-left hover:scale-[1.02] ${theme === t.id
                                ? 'bg-sidebar-accent/10 border-sidebar-accent ring-1 ring-sidebar-accent'
                                : 'bg-background/50 border-panel-border hover:border-sidebar-accent/50'
                                }`}
                        >
                            <div
                                className="w-12 h-12 rounded-full border border-panel-border shadow-sm shrink-0"
                                style={{ backgroundColor: t.color }}
                            />
                            <div className="flex-1">
                                <span className={`block font-medium ${theme === t.id ? 'text-sidebar-accent' : 'text-panel-foreground'}`}>
                                    {t.name}
                                </span>
                                {theme === t.id && (
                                    <span className="text-xs text-sidebar-accent/80 font-medium">Active</span>
                                )}
                            </div>
                            {theme === t.id && (
                                <div className="absolute top-4 right-4 text-sidebar-accent">
                                    <Check className="w-5 h-5" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
