import {
  pgTable,
  uuid,
  timestamp,
  text,
  varchar,
  jsonb,
  boolean,
  primaryKey,
  integer,
  pgEnum,
  unique,
  uniqueIndex,
  index,
  AnyPgColumn
} from 'drizzle-orm/pg-core';
import { relations, Many, One } from 'drizzle-orm';
import { InferSelectModel } from 'drizzle-orm';

export const user = pgTable("user", {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  username: text('username').unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
}, (t) => ({
  emailIdx: index('user_email_idx').on(t.email),
  usernameIdx: index('user_username_idx').on(t.username),
  stripeCustomerIdIdx: index('user_stripe_customer_id_idx').on(t.stripeCustomerId),
  createdAtIdx: index('user_created_at_idx').on(t.createdAt),
  updatedAtIdx: index('user_updated_at_idx').on(t.updatedAt),
  emailVerifiedIdx: index('user_email_verified_idx').on(t.emailVerified),
}));

export const session = pgTable("session", {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
}, (t) => ({
  userIdIdx: index('session_user_id_idx').on(t.userId),
  expiresAtIdx: index('session_expires_at_idx').on(t.expiresAt),
}));

export const account = pgTable("account", {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (t) => ({
  userIdIdx: index('account_user_id_idx').on(t.userId),
  providerUserIdIdx: index('account_provider_user_id_idx').on(t.providerId, t.userId),
  expiresAtIdx: index('account_expires_at_idx').on(t.accessTokenExpiresAt),
}));

export const verification = pgTable("verification", {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
}, (t) => ({
  identifierIdx: index('verification_identifier_idx').on(t.identifier),
  expiresAtIdx: index('verification_expires_at_idx').on(t.expiresAt),
}));

export const Chat = pgTable('Chat', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('createdAt', { mode: 'string' }).notNull(),
  title: text('title').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  document_context: jsonb('document_context'),
}, (t) => ({
  userIdIdx: index('chat_user_id_idx').on(t.userId),
  createdAtIdx: index('chat_created_at_idx').on(t.createdAt),
}));

export type Chat = InferSelectModel<typeof Chat>;

export const Message = pgTable('Message', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => Chat.id),
  role: varchar('role').notNull(),
  content: jsonb('content').notNull(),
  createdAt: timestamp('createdAt', { mode: 'string' }).notNull(),
}, (t) => ({
  chatIdIdx: index('message_chat_id_idx').on(t.chatId),
  createdAtIdx: index('message_created_at_idx').on(t.createdAt),
  roleIdx: index('message_role_idx').on(t.role),
}));

export type Message = InferSelectModel<typeof Message>;

export const artifactKindEnum = pgEnum('artifact_kind', ['text', 'code', 'image', 'sheet']);

export const documentVisibilityEnum = pgEnum('document_visibility', ['public', 'private']);

export const Document = pgTable(
  'Document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' })
      .notNull()
      .$onUpdate(() => new Date()),
    title: text('title').notNull(),
    content: text('content'),
    kind: artifactKindEnum('kind')
      .notNull()
      .default('text'),
    userId: text('userId')
      .notNull()
      .references(() => user.id),
    chatId: uuid('chatId')
      .references(() => Chat.id),
    is_current: boolean('is_current').notNull(),
    visibility: text('visibility', { enum: ['public', 'private'] }).notNull().default('private'),
    documentVersionId: uuid('document_version_id').references((): AnyPgColumn => DocumentVersion.id),
    style: jsonb('style'),
    author: text('author'),
    slug: text('slug'),
  },
  (t) => ({
    userIdIdx: index('document_user_id_idx').on(t.userId),
    chatIdIdx: index('document_chat_id_idx').on(t.chatId),
    visibilityIdx: index('document_visibility_idx').on(t.visibility),
    isCurrentIdx: index('document_is_current_idx').on(t.is_current),
    slugIdx: index('document_slug_idx').on(t.slug),
    authorIdx: index('document_author_idx').on(t.author),
    createdAtIdx: index('document_created_at_idx').on(t.createdAt),
    updatedAtIdx: index('document_updated_at_idx').on(t.updatedAt),
    userIdVisibilityIdx: index('document_user_visibility_idx').on(t.userId, t.visibility),
  })
);

export type Document = InferSelectModel<typeof Document>;

export const DocumentVersion = pgTable('DocumentVersion', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('documentId')
    .notNull()
    .references(() => Document.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
  content: text('content').notNull(),
  diffContent: text('diff_content'),
  previousVersionId: uuid('previous_version_id').references((): AnyPgColumn => DocumentVersion.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$onUpdate(() => new Date()),
}, (t) => ({
  documentIdIdx: index('document_version_document_id_idx').on(t.documentId),
  versionIdx: index('document_version_version_idx').on(t.version),
  previousVersionIdIdx: index('document_version_previous_version_id_idx').on(t.previousVersionId),
  createdAtIdx: index('document_version_created_at_idx').on(t.createdAt),
  documentVersionIdx: index('document_version_document_version_idx').on(t.documentId, t.version),
}));

export const subscription = pgTable("subscription", {
  id: text('id').primaryKey(),
  plan: text('plan').notNull(),
  referenceId: text('reference_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  status: text('status').notNull(),
  periodStart: timestamp('period_start', { mode: 'date' }),
  periodEnd: timestamp('period_end', { mode: 'date' }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end'),
  seats: integer('seats'),
  trialStart: timestamp('trial_start', { mode: 'date' }),
  trialEnd: timestamp('trial_end', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => ({
  referenceIdIdx: index('subscription_reference_id_idx').on(t.referenceId),
  statusIdx: index('subscription_status_idx').on(t.status),
  stripeCustomerIdIdx: index('subscription_stripe_customer_id_idx').on(t.stripeCustomerId),
  periodEndIdx: index('subscription_period_end_idx').on(t.periodEnd),
  trialEndIdx: index('subscription_trial_end_idx').on(t.trialEnd),
  createdAtIdx: index('subscription_created_at_idx').on(t.createdAt),
}));

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
  documents: many(Document),
  chats: many(Chat),
  subscriptions: many(subscription),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const chatRelations = relations(Chat, ({ one, many }) => ({
  user: one(user, {
    fields: [Chat.userId],
    references: [user.id],
  }),
  messages: many(Message),
  documents: many(Document),
}));

export const documentRelations = relations(Document, ({ one, many }) => ({
  user: one(user, {
    fields: [Document.userId],
    references: [user.id],
  }),
  chat: one(Chat, {
    fields: [Document.chatId],
    references: [Chat.id],
  }),
}));

export const documentVersionRelations = relations(DocumentVersion, ({ one }) => ({
  document: one(Document, {
    fields: [DocumentVersion.documentId],
    references: [Document.id],
  }),
}));

export const messageRelations = relations(Message, ({ one }) => ({
  chat: one(Chat, {
    fields: [Message.chatId],
    references: [Chat.id],
  }),
}));

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  user: one(user, {
    fields: [subscription.referenceId],
    references: [user.id],
  }),
}));