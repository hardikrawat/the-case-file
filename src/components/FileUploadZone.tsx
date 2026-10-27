'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { X, FileImage } from 'lucide-react';
import { toast } from 'sonner';
import AppleSpinner from '@/components/ui/AppleSpinner';

interface FileUploadProps {
    onUploadComplete?: (url: string) => void;
    maxSize?: number; // in bytes
    accept?: string;
}

export function FileUploadZone({
    onUploadComplete,
    maxSize = 5 * 1024 * 1024,
    accept = 'image/*',
}: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

    const handleUpload = useCallback(async (file: File) => {
        if (file.size > maxSize) {
            toast.error(`File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`);
            return;
        }

        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                setUploadedUrl(data.url);
                onUploadComplete?.(data.url);
                toast.success('File uploaded successfully!');
            } else {
                const error = await response.json();
                toast.error(error.error || 'Upload failed');
            }
        } catch {
            toast.error('Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    }, [maxSize, onUploadComplete]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            const file = files[0];
            if (accept && !file.type.match(accept.replace('*', '.*'))) {
                toast.error('Invalid file type');
                return;
            }
            handleUpload(file);
        }
    }, [handleUpload, accept]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleUpload(files[0]);
        }
    };

    return (
        <div className="w-full">
            {uploadedUrl ? (
                <div className="relative group">
                    <div className="relative w-full h-48 rounded-lg overflow-hidden border border-[var(--panel-border)]">
                        <Image
                            src={uploadedUrl}
                            alt="Uploaded"
                            fill
                            className="object-cover"
                            unoptimized
                        />
                    </div>
                    <button
                        onClick={() => {
                            setUploadedUrl(null);
                            onUploadComplete?.(null as unknown as string);
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${isDragging
                        ? 'border-[var(--sidebar-accent)] bg-[var(--sidebar-accent)]/10'
                        : 'border-[var(--panel-border)] bg-[var(--panel-background)]/50 hover:border-[var(--sidebar-accent)]/50'
                        }`}
                >
                    <input
                        type="file"
                        id="file-upload"
                        accept={accept}
                        onChange={handleFileSelect}
                        disabled={isUploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />

                    <div className="flex flex-col items-center gap-3 text-center pointer-events-none">
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-2 p-4">
                                <AppleSpinner size="lg" className="text-[var(--sidebar-accent)]" />
                                <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Uploading evidence...</span>
                            </div>
                        ) : (
                            <>
                                <div className="p-3 bg-[var(--background)] rounded-full border border-[var(--panel-border)]">
                                    <FileImage className="w-8 h-8 text-[var(--panel-foreground)]/60" />
                                </div>
                                <div>
                                    <p className="text-[var(--foreground)] font-medium mb-1">
                                        Drop your file here or click to browse
                                    </p>
                                    <p className="text-xs text-[var(--panel-foreground)]/60">
                                        Max size: {Math.round(maxSize / 1024 / 1024)}MB
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
