'use client';

import { useCallback, useState } from 'react';
import { Upload, X, FileImage } from 'lucide-react';
import { toast } from 'sonner';
import ProgressBar from '@/components/ui/ProgressBar';

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

    const handleUpload = async (file: File) => {
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
        } catch (error) {
            toast.error('Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleUpload(files[0]);
        }
    }, []);

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
                    <img
                        src={uploadedUrl}
                        alt="Uploaded"
                        className="w-full h-48 object-cover rounded-lg border border-stone-700"
                    />
                    <button
                        onClick={() => {
                            setUploadedUrl(null);
                            onUploadComplete?.('');
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
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-stone-700 bg-stone-900/30 hover:border-stone-600'
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
                            <ProgressBar isIndeterminate label="Uploading..." className="max-w-[150px]" />
                        ) : (
                            <>
                                <div className="p-3 bg-stone-800 rounded-full">
                                    <FileImage className="w-8 h-8 text-stone-400" />
                                </div>
                                <div>
                                    <p className="text-stone-200 font-medium mb-1">
                                        Drop your file here or click to browse
                                    </p>
                                    <p className="text-xs text-stone-500">
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
