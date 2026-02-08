'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
    });
    const [passwordStrength, setPasswordStrength] = useState({
        hasMinLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
    });

    useEffect(() => {
        if (!token) {
            toast.error('Invalid reset link');
            router.push('/forgot-password');
        }
    }, [token, router]);

    const validatePasswordStrength = (password: string) => {
        setPasswordStrength({
            hasMinLength: password.length >= 8,
            hasUppercase: /[A-Z]/.test(password),
            hasLowercase: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
        });
    };

    const handlePasswordChange = (password: string) => {
        setFormData({ ...formData, password });
        validatePasswordStrength(password);
    };

    const isPasswordValid = Object.values(passwordStrength).every(Boolean);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (!isPasswordValid) {
            toast.error('Password does not meet requirements');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    password: formData.password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                toast.error(data.error || 'Failed to reset password');
                return;
            }

            toast.success('Password reset successfully!');
            router.push('/login');
        } catch {
            toast.error('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-amber-500 font-serif mb-2">
                        The Case File
                    </h1>
                    <p className="text-stone-400">Create a new password</p>
                </div>

                {/* Reset Password Card */}
                <div className="bg-stone-900/50 backdrop-blur-sm border border-amber-900/30 rounded-xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-bold text-stone-200 mb-2">Set New Password</h2>
                    <p className="text-sm text-stone-400 mb-6">
                        Choose a strong password to secure your account.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-stone-300 mb-2">
                                New Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={(e) => handlePasswordChange(e.target.value)}
                                className="w-full px-4 py-3 bg-stone-800/50 border border-stone-700 rounded-lg text-stone-200 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition"
                                placeholder="••••••••"
                                disabled={isLoading}
                            />

                            {/* Password Strength Indicators */}
                            {formData.password && (
                                <div className="mt-3 space-y-1">
                                    <PasswordRequirement met={passwordStrength.hasMinLength}>
                                        At least 8 characters
                                    </PasswordRequirement>
                                    <PasswordRequirement met={passwordStrength.hasUppercase}>
                                        One uppercase letter
                                    </PasswordRequirement>
                                    <PasswordRequirement met={passwordStrength.hasLowercase}>
                                        One lowercase letter
                                    </PasswordRequirement>
                                    <PasswordRequirement met={passwordStrength.hasNumber}>
                                        One number
                                    </PasswordRequirement>
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-stone-300 mb-2">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                required
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="w-full px-4 py-3 bg-stone-800/50 border border-stone-700 rounded-lg text-stone-200 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition"
                                placeholder="••••••••"
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !isPasswordValid}
                            className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-semibold rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link href="/login" className="text-sm text-amber-500 hover:text-amber-400 transition">
                            ← Back to login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-stone-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}

function PasswordRequirement({ met, children }: { met: boolean; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 text-xs">
            {met ? (
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
            ) : (
                <svg className="w-4 h-4 text-stone-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
            )}
            <span className={met ? 'text-green-500' : 'text-stone-500'}>{children}</span>
        </div>
    );
}
