'use client';

import { useState } from 'react';
import { Download, X } from 'lucide-react';
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
            const filename = `${boardData.title || 'board'}-${Date.now()}`;

            await exportBoard(format, boardData, boardElement, `${filename}.${format}`);
            toast.success(`Exported as ${format.toUpperCase()}`);
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-stone-900 border border-stone-700 rounded-xl shadow-2xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-stone-200">Export Board</h2>
                    <button
                        onClick={onClose}
                        className="text-stone-400 hover:text-stone-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Format Selection */}
                <div className="space-y-3 mb-6">
                    <label className="block text-sm font-medium text-stone-300 mb-2">
                        Export Format
                    </label>

                    <button
                        onClick={() => setFormat('json')}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${format === 'json'
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">📄</div>
                            <div className="flex-1">
                                <p className="font-semibold text-stone-200">JSON</p>
                                <p className="text-xs text-stone-400 mt-1">
                                    Export board data for backup or sharing
                                </p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setFormat('png')}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${format === 'png'
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">🖼️</div>
                            <div className="flex-1">
                                <p className="font-semibold text-stone-200">PNG Image</p>
                                <p className="text-xs text-stone-400 mt-1">
                                    High-quality screenshot of your board
                                </p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setFormat('pdf')}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${format === 'pdf'
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">📑</div>
                            <div className="flex-1">
                                <p className="font-semibold text-stone-200">PDF Document</p>
                                <p className="text-xs text-stone-400 mt-1">
                                    Printable document version
                                </p>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Export Button */}
                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <Download className="w-5 h-5" />
                    {isExporting ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
                </button>
            </div>
        </div>
    );
}
