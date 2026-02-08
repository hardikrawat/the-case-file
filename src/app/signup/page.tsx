'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { signIn } from 'next-auth/react';

export default function SignupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [passwordStrength, setPasswordStrength] = useState({
        hasMinLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
    });

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
            toast.error('Passcode mismatch. Retry.');
            return;
        }

        if (!isPasswordValid) {
            toast.error('Passcode weak. Follow protocol.');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.details && Array.isArray(data.details)) {
                    data.details.forEach((err: { message: string }) => {
                        toast.error(`${err.message}`);
                    });
                } else {
                    toast.error(data.error || 'Registration failed.');
                }
                return;
            }

            toast.success('Agent registered. Verification required.');
            router.push(`/signup/verify?email=${encodeURIComponent(formData.email)}&token=${data.verificationToken}`);
        } catch {
            toast.error('System error. Contact HQ.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOAuthSignIn = async (provider: 'github' | 'google') => {
        setIsLoading(true);
        try {
            await signIn(provider, { callbackUrl: '/cases' });
        } catch {
            toast.error(`Auth failure: ${provider}`);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-stone-900 via-black to-black opacity-80 z-0"></div>

            {/* Spotlight Effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-900/10 blur-[120px] rounded-full pointer-events-none z-0"></div>

            <div className="w-full max-w-md relative z-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-amber-600 font-serif tracking-widest mb-2 uppercase drop-shadow-lg">
                        NEW RECRUIT
                    </h1>
                    <p className="text-stone-500 font-mono text-xs tracking-[0.2em] uppercase">Initiate Protocol 77-B</p>
                </div>

                {/* Form Card */}
                <div className="bg-[#1c1917] border border-stone-800 p-8 shadow-2xl relative">
                    {/* Corner Brackets */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-800/50"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-800/50"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-800/50"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-800/50"></div>

                    <h2 className="text-xl font-mono text-stone-300 mb-6 border-b border-stone-800 pb-2">
                        &gt; AGENT REGISTRATION
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="group">
                            <label htmlFor="name" className="block text-xs font-bold text-amber-700 uppercase mb-1 tracking-wider">
                                Full Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-transparent border-b border-stone-700 py-2 text-stone-300 placeholder-stone-700 focus:outline-none focus:border-amber-600 focus:bg-stone-900/30 transition-colors font-mono"
                                placeholder="Sherlock Holmes"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="group">
                            <label htmlFor="email" className="block text-xs font-bold text-amber-700 uppercase mb-1 tracking-wider">
                                Agent ID (Email)
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full bg-transparent border-b border-stone-700 py-2 text-stone-300 placeholder-stone-700 focus:outline-none focus:border-amber-600 focus:bg-stone-900/30 transition-colors font-mono"
                                placeholder="detective@example.com"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="group">
                            <label htmlFor="password" className="block text-xs font-bold text-amber-700 uppercase mb-1 tracking-wider">
                                Set Passcode
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={(e) => handlePasswordChange(e.target.value)}
                                className="w-full bg-transparent border-b border-stone-700 py-2 text-stone-300 placeholder-stone-700 focus:outline-none focus:border-amber-600 focus:bg-stone-900/30 transition-colors font-mono"
                                placeholder="••••••••"
                                disabled={isLoading}
                            />

                            {/* Password Strength Indicators */}
                            {formData.password && (
                                <div className="mt-3 space-y-1 bg-stone-900/50 p-2 rounded border border-stone-800">
                                    <PasswordRequirement met={passwordStrength.hasMinLength}>
                                        MIN LENGTH: 8
                                    </PasswordRequirement>
                                    <PasswordRequirement met={passwordStrength.hasUppercase}>
                                        UPPERCASE CHAR
                                    </PasswordRequirement>
                                    <PasswordRequirement met={passwordStrength.hasLowercase}>
                                        LOWERCASE CHAR
                                    </PasswordRequirement>
                                    <PasswordRequirement met={passwordStrength.hasNumber}>
                                        NUMERIC DIGIT
                                    </PasswordRequirement>
                                </div>
                            )}
                        </div>

                        <div className="group">
                            <label htmlFor="confirmPassword" className="block text-xs font-bold text-amber-700 uppercase mb-1 tracking-wider">
                                Confirm Passcode
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                required
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="w-full bg-transparent border-b border-stone-700 py-2 text-stone-300 placeholder-stone-700 focus:outline-none focus:border-amber-600 focus:bg-stone-900/30 transition-colors font-mono"
                                placeholder="••••••••"
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !isPasswordValid}
                            className="w-full py-3 px-4 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold uppercase tracking-widest border border-stone-600 hover:border-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:translate-y-0.5"
                        >
                            {isLoading ? 'Processing...' : 'Submit Profile'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-stone-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-[#1c1917] text-stone-600 font-mono uppercase">Alternative Channels</span>
                        </div>
                    </div>

                    {/* OAuth Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={() => handleOAuthSignIn('github')}
                            disabled={isLoading}
                            className="w-full py-2 px-4 bg-transparent border border-stone-700 text-stone-400 font-mono text-sm hover:text-stone-200 hover:border-stone-500 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            GITHUB_AUTH
                        </button>

                        <button
                            onClick={() => handleOAuthSignIn('google')}
                            disabled={isLoading}
                            className="w-full py-2 px-4 bg-transparent border border-stone-700 text-stone-400 font-mono text-sm hover:text-stone-200 hover:border-stone-500 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            GOOGLE_AUTH
                        </button>
                    </div>


                    {/* Login Link */}
                    <p className="mt-8 text-center text-xs font-mono text-stone-500">
                        ALREADY CLEARED?{' '}
                        <Link href="/login" className="text-amber-600 hover:text-amber-500 font-bold transition">
                            [ IDENTIFY ]
                        </Link>
                    </p>
                </div>

                {/* Back to Home */}
                <div className="text-center mt-8">
                    <Link href="/" className="text-xs font-mono text-stone-600 hover:text-stone-400 transition">
                        {/* ABORT AND RETURN TO HOME */}
                    </Link>
                </div>
            </div>
        </div>
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
