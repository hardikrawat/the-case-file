import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
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
}));

export const sessions = sqliteTable('sessions', {
    sessionToken: text('sessionToken').primaryKey(),
    userId: text('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

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
    parentId: text('parentId'), // ID of the original board if this is a fork
    isPublic: integer('is_public', { mode: 'boolean' }).default(false),
    content: text('content', { mode: 'json' }).$type<any>().default('{}'), // JSON content
    thumbnail: text('thumbnail'),
    stars: integer('stars').default(0),
    views: integer('views').default(0),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }), // For soft delete
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const contributions = sqliteTable('contributions', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    boardId: text('boardId')
        .notNull()
        .references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    snapshot: text('snapshot', { mode: 'json' }).$type<any>().notNull(), // The proposed state
    message: text('message'),
    status: text('status', { enum: ['open', 'merged', 'rejected'] }).default('open'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Password reset tokens
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expires: integer('expires', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Email verification tokens
export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expires: integer('expires', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

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
    parentId: text('parent_id').references((): any => comments.id), // For replies
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Board versions for history
export const boardVersions = sqliteTable('board_versions', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    boardId: text('board_id')
        .notNull()
        .references(() => boards.id, { onDelete: 'cascade' }),
    content: text('content', { mode: 'json' }).$type<any>().notNull(),
    createdBy: text('created_by')
        .notNull()
        .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

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
});

// User reputation for leaderboard
export const userReputation = sqliteTable('user_reputation', {
    userId: text('user_id')
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    points: integer('points').default(0),
    boardsCreated: integer('boards_created').default(0),
    contributionsAccepted: integer('contributions_accepted').default(0),
    lastUpdated: integer('last_updated', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const usersRelations = relations(users, ({ one, many }) => ({
    accounts: many(accounts),
    sessions: many(sessions),
    boards: many(boards),
    contributions: many(contributions),
    comments: many(comments),
    boardVersions: many(boardVersions),
    collaborators: many(boardCollaborators),
    reputation: one(userReputation)
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
    contributions: many(contributions),
    comments: many(comments),
    versions: many(boardVersions),
    collaborators: many(boardCollaborators)
}));

export const contributionsRelations = relations(contributions, ({ one }) => ({
    board: one(boards, {
        fields: [contributions.boardId],
        references: [boards.id]
    }),
    user: one(users, {
        fields: [contributions.userId],
        references: [users.id]
    })
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
    board: one(boards, {
        fields: [comments.boardId],
        references: [boards.id]
    }),
    user: one(users, {
        fields: [comments.userId],
        references: [users.id]
    }),
    parent: one(comments, {
        fields: [comments.parentId],
        references: [comments.id],
        relationName: "parent_comment"
    }),
    replies: many(comments, {
        relationName: "parent_comment"
    })
}));

export const boardVersionsRelations = relations(boardVersions, ({ one }) => ({
    board: one(boards, {
        fields: [boardVersions.boardId],
        references: [boards.id]
    }),
    createdBy: one(users, {
        fields: [boardVersions.createdBy],
        references: [users.id]
    })
}));

export const boardCollaboratorsRelations = relations(boardCollaborators, ({ one }) => ({
    board: one(boards, {
        fields: [boardCollaborators.boardId],
        references: [boards.id]
    }),
    user: one(users, {
        fields: [boardCollaborators.userId],
        references: [users.id]
    })
}));

export const userReputationRelations = relations(userReputation, ({ one }) => ({
    user: one(users, {
        fields: [userReputation.userId],
        references: [users.id]
    })
}));

// Rate Limiting
export const rateLimits = sqliteTable('rate_limits', {
    key: text('key').primaryKey(), // IP or UserID
    count: integer('count').default(0),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
});
