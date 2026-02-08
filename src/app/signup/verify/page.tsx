'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

function VerifyInstructionsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const email = searchParams.get('email');
    const token = searchParams.get('token');
    const [isVerifying, setIsVerifying] = useState(false);

    const handleVerify = async () => {
        if (!token) return;
        setIsVerifying(true);
        try {
            const response = await fetch(`/api/auth/verify-email?token=${token}`);
            const data = await response.json();

            if (response.ok) {
                toast.success('Email verified successfully! You can now sign in.');
                router.push('/login');
            } else {
                toast.error(data.error || 'Verification failed');
            }
        } catch {
            toast.error('An error occurred during verification');
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-amber-500 font-serif mb-2">
                        Verify Your Account
                    </h1>
                    <p className="text-stone-400">One last step, Detective</p>
                </div>

                <div className="bg-stone-900/50 backdrop-blur-sm border border-amber-900/30 rounded-xl p-8 shadow-2xl text-center">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold text-stone-200 mb-4">Check Your Email</h2>
                    <p className="text-stone-400 mb-8">
                        We&apos;ve sent a verification link to <span className="text-amber-500 font-medium">{email || 'your email'}</span>.
                        Please click the link to verify your account and start your investigation.
                    </p>

                    {/* Developer Mock Info */}
                    <div className="p-4 bg-amber-950/20 border border-amber-900/30 rounded-lg mb-8 text-left">
                        <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Developer Notice (Mocked Email)</p>
                        <p className="text-sm text-stone-300 mb-4">
                            In this production-hardened environment, the email service is currently mocked.
                            You can simulate clicking the verification link by using the button below.
                        </p>
                        <button
                            onClick={handleVerify}
                            disabled={isVerifying}
                            className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-stone-950 font-bold rounded transition-colors disabled:opacity-50"
                        >
                            {isVerifying ? 'Verifying...' : 'Simulate Email Verification'}
                        </button>
                    </div>

                    <div className="flex flex-col gap-4">
                        <Link href="/login" className="text-amber-500 hover:text-amber-400 text-sm font-medium transition">
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function VerifyInstructionsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-stone-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        }>
            <VerifyInstructionsContent />
        </Suspense>
    );
}
