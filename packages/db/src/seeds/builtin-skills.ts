import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { skills } from '../schema/skills.js';

export async function seedBuiltinSkills(db: PostgresJsDatabase<any>) {
  console.log('  Seeding builtin skills...');

  const builtinSkills = [
    {
      name: 'web_search',
      description: 'Search the web using HTTP APIs for real-time information retrieval',
      category: 'http',
      readme: `# Web Search Skill

Performs web searches using HTTP APIs to retrieve real-time information from the internet.

## Usage
This skill can be used to search for current information, news, articles, and general web content.

## Configuration
- api_endpoint: URL of the search API
- api_key: Optional API key for authentication
- max_results: Maximum number of results to return (default: 10)
`,
      config: {
        executor_type: 'http',
        schema: {
          api_endpoint: { type: 'string', required: true },
          api_key: { type: 'string', required: false },
          max_results: { type: 'number', default: 10 }
        }
      },
      tags: ['search', 'http', 'web']
    },
    {
      name: 'send_email',
      description: 'Send emails via SMTP protocol',
      category: 'smtp',
      readme: `# Send Email Skill

Sends emails using SMTP protocol.

## Usage
Use this skill to send email notifications, reports, or any text-based communication.

## Configuration
- smtp_host: SMTP server hostname
- smtp_port: SMTP server port (default: 587)
- from_email: Sender email address
- username: SMTP authentication username
- password: SMTP authentication password
`,
      config: {
        executor_type: 'smtp',
        schema: {
          smtp_host: { type: 'string', required: true },
          smtp_port: { type: 'number', default: 587 },
          from_email: { type: 'string', required: true },
          username: { type: 'string', required: true },
          password: { type: 'string', required: true, sensitive: true }
        }
      },
      tags: ['email', 'smtp', 'notifications']
    },
    {
      name: 'query_database',
      description: 'Execute SQL queries against databases',
      category: 'sql',
      readme: `# Query Database Skill

Executes SQL queries against relational databases.

## Usage
Run SELECT, INSERT, UPDATE queries for data operations.

## Configuration
- connection_string: Database connection string
- max_rows: Maximum rows to return (default: 1000)
- timeout_ms: Query timeout in milliseconds (default: 30000)
`,
      config: {
        executor_type: 'sql',
        schema: {
          connection_string: { type: 'string', required: true, sensitive: true },
          max_rows: { type: 'number', default: 1000 },
          timeout_ms: { type: 'number', default: 30000 }
        }
      },
      tags: ['database', 'sql', 'data']
    },
    {
      name: 'run_shell_command',
      description: 'Execute shell commands on the system',
      category: 'cli',
      readme: `# Run Shell Command Skill

Executes shell commands on the host system.

## Usage
Run system commands, scripts, and CLI tools.

## Configuration
- allowed_commands: List of allowed command patterns
- working_directory: Working directory for command execution
- timeout_ms: Command timeout (default: 60000)
`,
      config: {
        executor_type: 'cli',
        schema: {
          allowed_commands: { type: 'array', required: true },
          working_directory: { type: 'string', default: '/tmp' },
          timeout_ms: { type: 'number', default: 60000 }
        }
      },
      tags: ['cli', 'shell', 'system']
    },
    {
      name: 'mcp_tool_call',
      description: 'Call tools via Model Context Protocol (MCP)',
      category: 'mcp',
      readme: `# MCP Tool Call Skill

Invokes tools using the Model Context Protocol.

## Usage
Connect to MCP servers and invoke their exposed tools.

## Configuration
- mcp_server_url: URL of the MCP server
- tool_name: Name of the tool to invoke
- timeout_ms: Call timeout (default: 30000)
`,
      config: {
        executor_type: 'mcp',
        schema: {
          mcp_server_url: { type: 'string', required: true },
          tool_name: { type: 'string', required: true },
          timeout_ms: { type: 'number', default: 30000 }
        }
      },
      tags: ['mcp', 'protocol', 'tools']
    },
    {
      name: 'read_file',
      description: 'Read file contents from the filesystem',
      category: 'cli',
      readme: `# Read File Skill

Reads file contents from the local filesystem.

## Usage
Read text files, configuration files, logs, etc.

## Configuration
- allowed_paths: List of allowed path patterns
- max_size_bytes: Maximum file size to read (default: 10MB)
`,
      config: {
        executor_type: 'cli',
        schema: {
          allowed_paths: { type: 'array', required: true },
          max_size_bytes: { type: 'number', default: 10485760 }
        }
      },
      tags: ['filesystem', 'read', 'cli']
    },
    {
      name: 'write_file',
      description: 'Write content to files on the filesystem',
      category: 'cli',
      readme: `# Write File Skill

Writes content to files on the local filesystem.

## Usage
Create or update files with new content.

## Configuration
- allowed_paths: List of allowed path patterns for writing
- max_size_bytes: Maximum file size (default: 10MB)
- create_directories: Auto-create parent directories (default: true)
`,
      config: {
        executor_type: 'cli',
        schema: {
          allowed_paths: { type: 'array', required: true },
          max_size_bytes: { type: 'number', default: 10485760 },
          create_directories: { type: 'boolean', default: true }
        }
      },
      tags: ['filesystem', 'write', 'cli']
    },
    {
      name: 'stripe_api',
      description: 'Interact with Stripe payment API',
      category: 'http',
      readme: `# Stripe API Skill

Integrates with Stripe's payment processing API.

## Usage
Create payments, subscriptions, manage customers, retrieve invoices.

## Configuration
- api_key: Stripe secret API key
- api_version: Stripe API version (default: latest)
`,
      config: {
        executor_type: 'http',
        schema: {
          api_key: { type: 'string', required: true, sensitive: true },
          api_version: { type: 'string', default: '2024-11-20.acacia' }
        }
      },
      tags: ['stripe', 'payment', 'api', 'http']
    },
    {
      name: 'github_api',
      description: 'Interact with GitHub REST API',
      category: 'http',
      readme: `# GitHub API Skill

Integrates with GitHub's REST API for repository operations.

## Usage
Create issues, pull requests, manage repositories, fetch code.

## Configuration
- access_token: GitHub personal access token
- default_owner: Default repository owner
- default_repo: Default repository name
`,
      config: {
        executor_type: 'http',
        schema: {
          access_token: { type: 'string', required: true, sensitive: true },
          default_owner: { type: 'string', required: false },
          default_repo: { type: 'string', required: false }
        }
      },
      tags: ['github', 'api', 'http', 'git']
    }
  ];

  let seededCount = 0;

  for (const skillData of builtinSkills) {
    // Check if skill already exists
    const existing = await db.select()
      .from(skills)
      .where(eq(skills.name, skillData.name))
      .limit(1);

    if (existing.length > 0) {
      // Update existing builtin skill
      await db.update(skills)
        .set({
          description: skillData.description,
          category: skillData.category,
          readme: skillData.readme,
          config: skillData.config,
          tags: skillData.tags,
          updatedAt: new Date(),
        })
        .where(eq(skills.id, existing[0]!.id));
    } else {
      // Insert new builtin skill
      await db.insert(skills)
        .values({
          name: skillData.name,
          description: skillData.description,
          category: skillData.category,
          version: '1.0.0',
          author: 'system',
          install_source: 'builtin',
          readme: skillData.readme,
          config: skillData.config,
          tags: skillData.tags,
          is_enabled: true,
        });
      seededCount++;
    }
  }

  console.log(`    ✓ ${seededCount} builtin skills seeded (${builtinSkills.length - seededCount} already existed)`);
}
