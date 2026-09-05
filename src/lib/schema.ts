import { sqliteTable, text, integer, primaryKey, index, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export const users = sqliteTable('users', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    name: text('name'),
    email: text('email').notNull().unique(),
    emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
    image: text('image'),
    // Email auth fields
    passwordHash: text('password_hash'),
    emailVerifiedFlag: integer('email_verified_flag', { mode: 'boolean' }).default(false),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const accounts = sqliteTable('accounts', {
    userId: text('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
}, (account) => ({
    compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
    userIdIdx: index('accounts_userId_idx').on(account.userId),
}));

export const sessions = sqliteTable('sessions', {
    sessionToken: text('sessionToken').primaryKey(),
    userId: text('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
}, (session) => ({
    userIdIdx: index('sessions_userId_idx').on(session.userId),
}));

export const verificationTokens = sqliteTable(
    'verificationToken',
    {
        identifier: text('identifier').notNull(),
        token: text('token').notNull(),
        expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
    },
    (vt) => ({
        compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
    })
);

export const boards = sqliteTable('boards', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    parentId: text('parentId').references((): AnySQLiteColumn => boards.id, { onDelete: 'set null' }), // ID of the original board if this is a fork
    isPublic: integer('is_public', { mode: 'boolean' }).default(false),
    content: text('content', { mode: 'json' }).$type<Record<string, unknown>>().default({}), // JSON content
    thumbnail: text('thumbnail'),
    stars: integer('stars').default(0),
    views: integer('views').default(0),
    version: integer('version').default(1).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }), // For soft delete
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (board) => ({
    userIdIdx: index('boards_userId_idx').on(board.userId),
    updatedAtIdx: index('boards_updated_at_idx').on(board.updatedAt),
    publicDeletedIdx: index('boards_is_public_deleted_at_idx').on(board.isPublic, board.deletedAt),
    parentIdIdx: index('boards_parent_id_idx').on(board.parentId),
}));

export const contributions = sqliteTable('contributions', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    boardId: text('boardId')
        .notNull()
        .references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    snapshot: text('snapshot', { mode: 'json' }).$type<Record<string, unknown>>().notNull(), // The proposed state
    message: text('message'),
    status: text('status', { enum: ['open', 'merged', 'rejected'] }).default('open'),
    rejectionReason: text('rejection_reason'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (contribution) => ({
    boardIdIdx: index('contributions_boardId_idx').on(contribution.boardId),
    userIdIdx: index('contributions_userId_idx').on(contribution.userId),
    statusIdx: index('contributions_status_idx').on(contribution.status),
    boardStatusIdx: index('contributions_board_status_idx').on(contribution.boardId, contribution.status),
}));

// Password reset tokens
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expires: integer('expires', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (prt) => ({
    userIdIdx: index('password_reset_tokens_user_id_idx').on(prt.userId),
}));

// Email verification tokens
export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expires: integer('expires', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (evt) => ({
    userIdIdx: index('email_verification_tokens_user_id_idx').on(evt.userId),
}));

// Comments system
export const comments = sqliteTable('comments', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    boardId: text('board_id')
        .notNull()
        .references(() => boards.id, { onDelete: 'cascade' }),
    nodeId: text('node_id'), // Optional: specific node
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    parentId: text('parent_id'), // For replies - avoid direct circular reference here if it impacts inference
    isAnonymous: integer('is_anonymous', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (comment) => ({
    boardIdIdx: index('comments_board_id_idx').on(comment.boardId),
    nodeIdIdx: index('comments_node_id_idx').on(comment.nodeId),
    userIdIdx: index('comments_user_id_idx').on(comment.userId),
    parentIdIdx: index('comments_parent_id_idx').on(comment.parentId),
}));

// Board versions for history
export const boardVersions = sqliteTable('board_versions', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    boardId: text('board_id')
        .notNull()
        .references(() => boards.id, { onDelete: 'cascade' }),
    content: text('content', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    createdBy: text('created_by')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (bv) => ({
    boardIdIdx: index('board_versions_board_id_idx').on(bv.boardId),
    createdAtIdx: index('board_versions_created_at_idx').on(bv.createdAt),
    boardCreatedIdx: index('board_versions_board_created_idx').on(bv.boardId, bv.createdAt),
}));

// Board collaborators
export const boardCollaborators = sqliteTable('board_collaborators', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    boardId: text('board_id')
        .notNull()
        .references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull(),
    addedAt: integer('added_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }), // Soft-delete safeguard protecting collaborator records against data loss
}, (table) => ({
    boardUserIdx: uniqueIndex('board_collaborators_board_user_idx').on(table.boardId, table.userId),
    boardUserDeletedIdx: index('board_collaborators_board_user_deleted_idx').on(table.boardId, table.userId, table.deletedAt),
}));

// User reputation for leaderboard
export const userReputation = sqliteTable('user_reputation', {
    userId: text('user_id')
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    points: integer('points').default(0),
    boardsCreated: integer('boards_created').default(0),
    contributionsAccepted: integer('contributions_accepted').default(0),
    lastUpdated: integer('last_updated', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (ur) => ({
    pointsIdx: index('user_reputation_points_idx').on(ur.points),
}));

// Notifications
export const notifications = sqliteTable('notifications', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    recipientId: text('recipient_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    actorId: text('actor_id')
        .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    referenceId: text('reference_id').notNull(),
    referenceType: text('reference_type').notNull(),
    message: text('message').notNull(),
    isRead: integer('is_read', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (notification) => ({
    recipientIsReadIdx: index('notifications_recipient_id_is_read_idx').on(notification.recipientId, notification.isRead),
}));

// Rate Limiting
export const rateLimits = sqliteTable('rate_limits', {
    key: text('key').primaryKey(), // IP or UserID
    count: integer('count').default(0),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
}, (rl) => ({
    expiresAtIdx: index('rate_limits_expires_at_idx').on(rl.expiresAt),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
    accounts: many(accounts),
    sessions: many(sessions),
    boards: many(boards),
    contributions: many(contributions),
    comments: many(comments),
    boardVersions: many(boardVersions),
    collaborators: many(boardCollaborators),
    reputation: one(userReputation),
    receivedNotifications: many(notifications, { relationName: 'user_notifications_received' }),
    triggeredNotifications: many(notifications, { relationName: 'user_notifications_sent' }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
    user: one(users, {
        fields: [accounts.userId],
        references: [users.id],
    }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id],
    }),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
    author: one(users, {
        fields: [boards.userId],
        references: [users.id],
    }),
    parent: one(boards, {
        fields: [boards.parentId],
        references: [boards.id],
        relationName: 'board_forks',
    }),
    forks: many(boards, {
        relationName: 'board_forks',
    }),
    contributions: many(contributions),
    comments: many(comments),
    versions: many(boardVersions),
    collaborators: many(boardCollaborators),
}));

export const contributionsRelations = relations(contributions, ({ one }) => ({
    board: one(boards, {
        fields: [contributions.boardId],
        references: [boards.id],
    }),
    user: one(users, {
        fields: [contributions.userId],
        references: [users.id],
    }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
    board: one(boards, {
        fields: [comments.boardId],
        references: [boards.id],
    }),
    user: one(users, {
        fields: [comments.userId],
        references: [users.id],
    }),
    parent: one(comments, {
        fields: [comments.parentId],
        references: [comments.id],
        relationName: 'parent_comment',
    }),
    replies: many(comments, {
        relationName: 'parent_comment',
    }),
}));

export const boardVersionsRelations = relations(boardVersions, ({ one }) => ({
    board: one(boards, {
        fields: [boardVersions.boardId],
        references: [boards.id],
    }),
    createdBy: one(users, {
        fields: [boardVersions.createdBy],
        references: [users.id],
    }),
}));

export const boardCollaboratorsRelations = relations(boardCollaborators, ({ one }) => ({
    board: one(boards, {
        fields: [boardCollaborators.boardId],
        references: [boards.id],
    }),
    user: one(users, {
        fields: [boardCollaborators.userId],
        references: [users.id],
    }),
}));

export const userReputationRelations = relations(userReputation, ({ one }) => ({
    user: one(users, {
        fields: [userReputation.userId],
        references: [users.id],
    }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    recipient: one(users, {
        fields: [notifications.recipientId],
        references: [users.id],
        relationName: 'user_notifications_received',
    }),
    actor: one(users, {
        fields: [notifications.actorId],
        references: [users.id],
        relationName: 'user_notifications_sent',
    }),
}));
