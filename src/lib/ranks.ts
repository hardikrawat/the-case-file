/**
 * Unified Detective Rank Title definitions.
 * Pure client-safe utility (zero server/database dependencies).
 */
export function getRankTitle(points: number): string {
    if (points >= 1000) return 'Chief Detective';
    if (points >= 500) return 'Senior Investigator';
    if (points >= 200) return 'Private Eye';
    if (points >= 50) return 'Rookie Cop';
    return 'Patrol Officer';
}
