import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// Define brawls table
export const brawls = pgTable('brawls', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  slug: text('slug').notNull().unique(), // URL-safe slug for sharing
  winnerId: text('winner_id'), // character id of winner
  currentPlayerId: text('current_player_id'), // character id whose turn it is
  turnNumber: integer('turn_number').notNull().default(1),
  currentImageUrl: text('current_image_url'), // URL of the current scene image
  location: text('location').notNull().default('San Francisco'), // Fight location
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Define characters table
export const characters = pgTable('characters', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  brawlId: text('brawl_id')
    .notNull()
    .references(() => brawls.id, { onDelete: 'cascade' }),
  browserId: text('browser_id').notNull(), // stored in localStorage
  species: text('species').notNull(),
  // Character stats (1-100)
  attack: integer('attack').notNull().default(50),
  defense: integer('defense').notNull().default(50),
  speed: integer('speed').notNull().default(50),
  energy: integer('energy').notNull().default(100),
  recovery: integer('recovery').notNull().default(3),
  health: integer('health').notNull().default(100),
  maxHealth: integer('max_health').notNull().default(100),
  maxEnergy: integer('max_energy').notNull().default(100),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Define attacks table
export const attacks = pgTable('attacks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  characterId: text('character_id')
    .notNull()
    .references(() => characters.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  energyCost: integer('energy_cost').notNull(),
  damage: integer('damage').notNull(),
  criticalHitChance: integer('critical_hit_chance').notNull().default(10), // percentage 0-100
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Define image generations table - tracks Replicate predictions for image generation
export const imageGenerations = pgTable('image_generations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  brawlId: text('brawl_id')
    .notNull()
    .references(() => brawls.id, { onDelete: 'cascade' }),
  turnNumber: integer('turn_number').notNull(), // Turn when image was generated
  replicateId: text('replicate_id'), // Replicate prediction ID
  status: text('status').notNull().default('pending'), // pending, processing, completed, failed
  prompt: text('prompt'), // The prompt used for generation (only for initial image)
  modification: text('modification'), // The modification instruction for Kontext (for subsequent images)
  inputImageUrl: text('input_image_url'), // Previous image URL (for Kontext)
  outputImageUrl: text('output_image_url'), // Generated image URL
  gcsPath: text('gcs_path'), // Path in Google Cloud Storage
  webhookData: jsonb('webhook_data'), // Raw webhook response from Replicate
  errorMessage: text('error_message'), // Error details if generation failed
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Define relationships
export const brawlsRelations = relations(brawls, ({ one, many }) => ({
  characters: many(characters),
  imageGenerations: many(imageGenerations),
  winner: one(characters, {
    fields: [brawls.winnerId],
    references: [characters.id],
    relationName: 'winner',
  }),
  currentPlayer: one(characters, {
    fields: [brawls.currentPlayerId],
    references: [characters.id],
    relationName: 'currentPlayer',
  }),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  brawl: one(brawls, {
    fields: [characters.brawlId],
    references: [brawls.id],
  }),
  attacks: many(attacks),
}));

export const attacksRelations = relations(attacks, ({ one }) => ({
  character: one(characters, {
    fields: [attacks.characterId],
    references: [characters.id],
  }),
}));

export const imageGenerationsRelations = relations(
  imageGenerations,
  ({ one }) => ({
    brawl: one(brawls, {
      fields: [imageGenerations.brawlId],
      references: [brawls.id],
    }),
  })
);

// Type exports for TypeScript
export type Brawl = typeof brawls.$inferSelect;
export type NewBrawl = typeof brawls.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type Attack = typeof attacks.$inferSelect;
export type NewAttack = typeof attacks.$inferInsert;
export type ImageGeneration = typeof imageGenerations.$inferSelect;
export type NewImageGeneration = typeof imageGenerations.$inferInsert;
