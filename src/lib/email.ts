const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

function isTestEmail(email: string): boolean {
    return (
        email.endsWith('@testcasefile.dev') ||
        email.endsWith('@example.com') ||
        email.endsWith('@test.dev') ||
        process.env.NODE_ENV === 'test' ||
        process.env.CI === 'true' ||
        !RESEND_API_KEY
    );
}

export async function sendVerificationEmail(email: string, token: string) {
    const confirmLink = `http://localhost:3000/signup/verify?token=${token}`;

    if (isTestEmail(email)) {
        console.log(`[TEST EMAIL MOCK] Verification email bypassed for ${email}. Token: ${token}`);
        return;
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
            from: 'Detective HQ <onboarding@resend.dev>',
            to: email,
            subject: 'Action Required: Verify Your Agent Clearance',
            html: `
                <div style="font-family: monospace; background: #0a0a0a; color: #d6d3d1; padding: 40px;">
                    <h1 style="color: #d97706; text-transform: uppercase;">Classified Clearance</h1>
                    <p>Agent,</p>
                    <p>Your request for clearance has been received. To access the Case File system, you must verify your identity immediately.</p>
                    <p>Click the secure link below to authorize your device:</p>
                    <p>
                        <a href="${confirmLink}" style="background: #1c1917; color: #d97706; padding: 10px 20px; text-decoration: none; border: 1px solid #d97706; display: inline-block;">[ AUTHORIZE ACCESS ]</a>
                    </p>
                    <p>If you did not request this, destroy this communication immediately.</p>
                    <p>-- HQ</p>
                </div>
            `
        })
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to send verification email:', errorText);
        throw new Error(`Failed to send email: ${errorText}`);
    }
}

export async function sendPasswordResetEmail(email: string, token: string) {
    const resetLink = `http://localhost:3000/reset-password?token=${token}`;

    if (isTestEmail(email)) {
        console.log(`[TEST EMAIL MOCK] Password reset email bypassed for ${email}. Token: ${token}`);
        return;
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
            from: 'Detective HQ <onboarding@resend.dev>',
            to: email,
            subject: 'Security Alert: Reset Your Passcode',
            html: `
                <div style="font-family: monospace; background: #0a0a0a; color: #d6d3d1; padding: 40px;">
                    <h1 style="color: #ef4444; text-transform: uppercase;">Passcode Reset Initiated</h1>
                    <p>Agent,</p>
                    <p>A request to reset your system passcode was initiated. If this was you, proceed using the secure link below.</p>
                    <p>
                        <a href="${resetLink}" style="background: #1c1917; color: #ef4444; padding: 10px 20px; text-decoration: none; border: 1px solid #ef4444; display: inline-block;">[ RESET PASSCODE ]</a>
                    </p>
                    <p>If you did not request this, your credentials may be compromised. Report to HQ immediately.</p>
                </div>
            `
        })
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to send reset email:', errorText);
        throw new Error(`Failed to send email: ${errorText}`);
    }
}
