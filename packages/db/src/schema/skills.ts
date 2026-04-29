import { pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb, real } from 'drizzle-orm/pg-core';

// Skills table - Skill Registry
export const skills = pgTable('skills', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  category: varchar('category', { length: 50 }),
  version: varchar('version', { length: 20 }).notNull().default('1.0.0'),
  author: varchar('author', { length: 255 }).notNull().default('system'),
  source_url: text('source_url'),
  install_source: varchar('install_source', { length: 20 }).notNull().default('builtin'), // 'builtin', 'user', 'marketplace'
  usage_count: integer('usage_count').notNull().default(0),
  rating: real('rating'),
  tags: jsonb('tags').notNull().default([]), // string array
  readme: text('readme'),
  config: jsonb('config').notNull().default({}),
  is_enabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
