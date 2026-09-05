'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import AppleSpinner from '@/components/ui/AppleSpinner';
import { exportBoard } from '@/lib/export';
import { toast } from 'sonner';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    boardId: string;
    boardData: Record<string, unknown>;
    boardElement?: HTMLElement;
}

export function ExportModal({ isOpen, onClose, boardData, boardElement }: ExportModalProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [format, setFormat] = useState<'json' | 'png' | 'pdf'>('json');

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const title = (boardData.title as string) || (boardData.caseTitle as string) || 'case-file';
            const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.${format}`;

            const targetElement = boardElement || (document.querySelector('.react-flow') as HTMLElement) || document.body;
            await exportBoard(format, boardData, targetElement, filename);
            toast.success(`Exported as ${format.toUpperCase()}`);
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isExporting) onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, isExporting, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => { if (!isExporting) onClose(); }}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-xl shadow-2xl p-6 z-10 text-[var(--panel-foreground)] transition-colors duration-300">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-[var(--foreground)]">Export Board</h2>
                    <button
                        onClick={onClose}
                        className="text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] transition-colors p-1 rounded"
                        title="Close Export"
                        aria-label="Close Export"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Format Selection */}
                <div className="space-y-3 mb-6">
                    <label className="block text-sm font-medium text-[var(--panel-foreground)]/70 mb-2">
                        Export Format
                    </label>

                    <button
                        type="button"
                        data-testid="export-json"
                        onClick={() => setFormat('json')}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                            format === 'json'
                                ? 'border-[var(--sidebar-accent)] bg-[var(--sidebar-accent)]/10'
                                : 'border-[var(--panel-border)] bg-[var(--background)]/50 hover:border-[var(--sidebar-accent)]/50'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">📄</div>
                            <div className="flex-1">
                                <p className="font-semibold text-[var(--foreground)]">JSON</p>
                                <p className="text-xs text-[var(--panel-foreground)]/60 mt-1">
                                    Full investigation dossier for backup or re-import
                                </p>
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        data-testid="export-png"
                        onClick={() => setFormat('png')}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                            format === 'png'
                                ? 'border-[var(--sidebar-accent)] bg-[var(--sidebar-accent)]/10'
                                : 'border-[var(--panel-border)] bg-[var(--background)]/50 hover:border-[var(--sidebar-accent)]/50'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">🖼️</div>
                            <div className="flex-1">
                                <p className="font-semibold text-[var(--foreground)]">PNG Image</p>
                                <p className="text-xs text-[var(--panel-foreground)]/60 mt-1">
                                    High-resolution snapshot of canvas evidence
                                </p>
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        data-testid="export-pdf"
                        onClick={() => setFormat('pdf')}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                            format === 'pdf'
                                ? 'border-[var(--sidebar-accent)] bg-[var(--sidebar-accent)]/10'
                                : 'border-[var(--panel-border)] bg-[var(--background)]/50 hover:border-[var(--sidebar-accent)]/50'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">📑</div>
                            <div className="flex-1">
                                <p className="font-semibold text-[var(--foreground)]">PDF Document</p>
                                <p className="text-xs text-[var(--panel-foreground)]/60 mt-1">
                                    Printable courtroom investigation dossier
                                </p>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Export Button */}
                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    data-testid="export-submit-button"
                    className="w-full py-3 px-4 bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/90 text-[var(--sidebar-accent-foreground)] font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                >
                    {isExporting ? (
                        <>
                            <AppleSpinner size="sm" />
                            <span>Exporting Dossier...</span>
                        </>
                    ) : (
                        <>
                            <Download className="w-5 h-5" />
                            <span>Export as {format.toUpperCase()}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
