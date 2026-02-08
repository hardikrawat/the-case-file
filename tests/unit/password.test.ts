import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword, validatePasswordStrength, validateEmail } from '@/lib/password';

describe('Password Utilities', () => {
    describe('hashPassword', () => {
        it('should hash password', async () => {
            const hashed = await hashPassword('TestPass123');
            expect(hashed).toBeTruthy();
            expect(hashed).not.toBe('TestPass123');
            expect(hashed.startsWith('$2a$')).toBe(true);
        });

        it('should generate different hashes for same password', async () => {
            const hash1 = await hashPassword('TestPass123');
            const hash2 = await hashPassword('TestPass123');
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('comparePassword', () => {
        it('should return true for correct password', async () => {
            const password = 'TestPass123';
            const hashed = await hashPassword(password);
            const result = await comparePassword(password, hashed);
            expect(result).toBe(true);
        });

        it('should return false for incorrect password', async () => {
            const hashed = await hashPassword('TestPass123');
            const result = await comparePassword('WrongPass', hashed);
            expect(result).toBe(false);
        });
    });

    describe('validatePasswordStrength', () => {
        it('should pass for strong password', () => {
            expect(validatePasswordStrength('TestPass123').valid).toBe(true);
            expect(validatePasswordStrength('Complex!Pass99').valid).toBe(true);
        });

        it('should fail for weak password', () => {
            expect(validatePasswordStrength('weak').valid).toBe(false);
            expect(validatePasswordStrength('12345678').valid).toBe(false);
            expect(validatePasswordStrength('lowercase').valid).toBe(false);
            expect(validatePasswordStrength('UPPERCASE').valid).toBe(false);
        });

        it('should require minimum 8 characters', () => {
            expect(validatePasswordStrength('Test123').valid).toBe(false);
            expect(validatePasswordStrength('Test1234').valid).toBe(true);
        });
    });

    describe('validateEmail', () => {
        it('should validate correct emails', () => {
            expect(validateEmail('test@example.com')).toBe(true);
            expect(validateEmail('user.name@domain.co.uk')).toBe(true);
        });

        it('should reject invalid emails', () => {
            expect(validateEmail('invalid')).toBe(false);
            expect(validateEmail('@example.com')).toBe(false);
            expect(validateEmail('test@')).toBe(false);
            expect(validateEmail('')).toBe(false);
        });
    });
});
