/**
 * v2-placeholders.ts
 *
 * This file documents planned multi-user tables for OS // SOLO v2.
 * These tables are NOT created yet. This is documentation only for contributors.
 *
 * See CONTRIBUTING.md for the multi-user wiring guide.
 *
 * DO NOT IMPORT THIS FILE. It exports nothing and should not be included in the schema index.
 */

/* ============================================================================
 * TEAMS TABLE (Planned for v2)
 * ============================================================================
 *
 * Purpose: Multi-tenant organization structure
 *
 * Schema:
 * - id: serial PRIMARY KEY
 * - name: varchar(255) NOT NULL - Team/organization display name
 * - owner_user_id: integer NOT NULL REFERENCES users(id) ON DELETE CASCADE - Team owner
 * - plan: varchar(50) NOT NULL DEFAULT 'starter' - Subscription plan (starter, professional, enterprise)
 * - mrr_cents: integer - Monthly recurring revenue in cents
 * - ai_usage_limit_tokens: integer - Token budget limit (NULL = unlimited)
 * - created_at: timestamp with time zone NOT NULL DEFAULT now()
 * - updated_at: timestamp with time zone NOT NULL DEFAULT now()
 *
 * Indexes:
 * - teams_owner_user_id_idx ON (owner_user_id)
 * - teams_plan_idx ON (plan)
 *
 * Notes:
 * - Single-user mode: Default team auto-created for the sole operator
 * - Multi-user mode: Users can own multiple teams, be members of multiple teams
 * - Plan enforcement happens at team level, not user level
 */

/* ============================================================================
 * TEAM_MEMBERS TABLE (Planned for v2)
 * ============================================================================
 *
 * Purpose: Many-to-many relationship between users and teams with role-based access
 *
 * Schema:
 * - id: serial PRIMARY KEY
 * - team_id: integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE
 * - user_id: integer NOT NULL REFERENCES users(id) ON DELETE CASCADE
 * - role: varchar(20) NOT NULL DEFAULT 'member' - Role: owner, admin, member, viewer
 * - invited_at: timestamp with time zone NOT NULL DEFAULT now()
 * - invited_by_user_id: integer REFERENCES users(id) ON DELETE SET NULL
 * - accepted_at: timestamp with time zone - NULL if invitation pending
 * - created_at: timestamp with time zone NOT NULL DEFAULT now()
 *
 * Indexes:
 * - team_members_team_id_idx ON (team_id)
 * - team_members_user_id_idx ON (user_id)
 * - team_members_team_user_unique UNIQUE (team_id, user_id)
 *
 * Notes:
 * - Owner role: Full control, can delete team, manage billing
 * - Admin role: Can invite/remove members, manage settings, but not delete team
 * - Member role: Can create/edit resources, run agents
 * - Viewer role: Read-only access
 * - Pending invitations: accepted_at IS NULL
 */

/* ============================================================================
 * API_KEYS TABLE (Planned for v2)
 * ============================================================================
 *
 * Purpose: Programmatic API access tokens scoped to teams
 *
 * Schema:
 * - id: serial PRIMARY KEY
 * - team_id: integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE
 * - user_id: integer NOT NULL REFERENCES users(id) ON DELETE CASCADE - Creator
 * - key_hash: text NOT NULL UNIQUE - bcrypt hash of the API key
 * - key_prefix: varchar(20) NOT NULL - Display prefix (e.g., sk_live_abc1)
 * - name: varchar(255) NOT NULL - User-defined key name
 * - scopes: jsonb NOT NULL DEFAULT '["read"]' - Array of permissions: read, write, admin
 * - last_used_at: timestamp with time zone - Last usage timestamp
 * - last_used_ip: varchar(45) - Last IP address that used this key
 * - expires_at: timestamp with time zone - NULL = never expires
 * - revoked_at: timestamp with time zone - NULL = active, timestamp = revoked
 * - created_at: timestamp with time zone NOT NULL DEFAULT now()
 *
 * Indexes:
 * - api_keys_team_id_idx ON (team_id)
 * - api_keys_user_id_idx ON (user_id)
 * - api_keys_key_hash_idx ON (key_hash) - For fast authentication lookups
 * - api_keys_revoked_at_idx ON (revoked_at) WHERE revoked_at IS NULL - Active keys only
 *
 * Notes:
 * - Key format: sk_live_<random> or sk_test_<random>
 * - Only key_prefix stored in plain text for display (e.g., "sk_live_****abc123")
 * - Full key never stored, only hash for verification
 * - Scopes: read (GET), write (POST/PUT/PATCH), admin (DELETE, team management)
 * - Revocation: Set revoked_at timestamp, key becomes invalid immediately
 * - Rate limiting applied per key_hash
 */

/* ============================================================================
 * MIGRATION NOTES
 * ============================================================================
 *
 * When implementing v2 multi-user support:
 *
 * 1. Create migration to add these tables
 * 2. Add default team for existing single user:
 *    INSERT INTO teams (name, owner_user_id, plan)
 *    SELECT 'Default Team', id, 'enterprise' FROM users LIMIT 1;
 * 3. Add team_member entry for existing user:
 *    INSERT INTO team_members (team_id, user_id, role, accepted_at)
 *    SELECT t.id, u.id, 'owner', now()
 *    FROM teams t, users u LIMIT 1;
 * 4. Add team_id foreign key to all user-scoped tables (agents, projects, etc.)
 * 5. Backfill team_id for existing records with the default team
 * 6. Update all API queries to filter by team_id from session
 * 7. Update UI to show team switcher in sidebar
 * 8. Add team management pages (already scaffolded in OrgAdmin/SuperAdmin)
 *
 * Breaking changes:
 * - API endpoints will require team context (team_id in session or API key)
 * - Single-user deployments continue to work with auto-created default team
 */

// This file intentionally exports nothing
// Do not import or include in schema/index.ts
