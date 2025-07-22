import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { testConnection, pool } from "./db";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { analyzeQuery } from "./query_analyzer";

// Test MySQL connection at startup
(async () => {
  try {
    await testConnection();
    console.error("MySQL connection successful.");
  } catch (err) {
    console.error("MySQL connection failed:", err);
    process.exit(1);
  }
})();

// Create the MCP server instance
const server = new McpServer({
  name: "mysql-readonly-server",
  version: "0.1.0",
  description: "MCP server for read-only MySQL access with schema inspection."
});

// Register a test resource (does not require DB)
server.registerResource(
  "test_resource",
  "test://hello",
  {
    title: "Test Resource",
    description: "A test resource to check MCP registration.",
    mimeType: "text/plain"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: "Hello, MCP! This is a test resource."
    }]
  })
);

// Register a test tool (does not require DB)
server.registerTool(
  "test_tool",
  {
    title: "Test Tool",
    description: "A test tool that echoes input.",
    inputSchema: { message: z.string() }
  },
  async ({ message }) => ({
    content: [{ type: "text", text: `Echo: ${message}` }]
  })
);

// Register a health check tool
server.registerTool(
  "health_check",
  {
    title: "Health Check",
    description: "Check if the server is alive and get basic info.",
    inputSchema: z.object({}) as any,
  },
  async () => ({
    content: [
      {
        type: "text" as const,
        text: `Status: ok\nServer time: ${new Date().toISOString()}\nVersion: 0.1.0`
      }
    ]
  })
);

// Register a resource to list all tables in the current database
server.registerResource(
  "list_tables",
  "schema://tables",
  {
    title: "List Tables",
    description: "List all tables in the current database.",
    mimeType: "text/plain"
  },
  async () => {
    const [rows] = await pool.query("SHOW TABLES") as [any[], any];
    const tableNames = rows.map((row: any) => Object.values(row)[0]);
    return {
      contents: [{
        uri: "schema://tables",
        text: tableNames.join("\n")
      }]
    };
  }
);

// Register a resource to get the schema of a table
server.registerResource(
  "table_schema",
  new ResourceTemplate("schema://table/{table}", { list: undefined }),
  {
    title: "Table Schema",
    description: "Get columns and types for a table.",
    mimeType: "text/plain"
  },
  async (uri, { table }) => {
    const [columns] = await pool.query("SHOW COLUMNS FROM ??", [table]) as [any[], any];
    const schemaText = columns.map((col: any) => `${col.Field}: ${col.Type}`).join("\n");
    return {
      contents: [{
        uri: uri.href,
        text: schemaText
      }]
    };
  }
);

// Register a resource to get the relationships of a table
server.registerResource(
  "table_relationships",
  new ResourceTemplate("schema://table/{table}/relationships", { list: undefined }),
  {
    title: "Table Relationships",
    description: "Get foreign key relationships for a table.",
    mimeType: "text/plain"
  },
  async (uri, { table }) => {
    const [relations] = await pool.query(
      `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [table]
    ) as [any[], any];
    if (relations.length === 0) {
      return {
        contents: [{
          uri: uri.href,
          text: `No foreign key relationships found for ${table}.`
        }]
      };
    }
    const relText = relations
      .map(
        (rel: any) =>
          `${rel.COLUMN_NAME} → ${rel.REFERENCED_TABLE_NAME}(${rel.REFERENCED_COLUMN_NAME})`
      )
      .join("\n");
    return {
      contents: [{
        uri: uri.href,
        text: relText
      }]
    };
  }
);

// Register a tool to suggest a SQL query from a natural language question
server.registerTool(
  "suggest_query",
  {
    title: "Suggest SQL Query",
    description: "Suggest a SQL SELECT query for a natural language question, using schema info and relationships.",
    inputSchema: { question: z.string() },
  },
  async ({ question }) => {
    // 1. Gather schema info
    const [tables] = await pool.query("SHOW TABLES") as [any[], any];
    const tableNames: string[] = tables.map((row: any) => String(Object.values(row)[0]));

    // Build tableColumns, outgoing and incoming relationships
    const tableColumns: Record<string, string[]> = {};
    const tableRelationships: Record<string, string[]> = {}; // outgoing
    const incomingRelationships: Record<string, string[]> = {}; // incoming
    for (const table of tableNames) {
      const [columns] = await pool.query("SHOW COLUMNS FROM ??", [table]) as [any[], any];
      tableColumns[table] = columns.map((col: any) => col.Field);
      tableRelationships[table] = [];
      // Outgoing FKs
      const [relations] = await pool.query(
        `SELECT REFERENCED_TABLE_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [table]
      ) as [any[], any];
      tableRelationships[table] = relations.map((rel: any) => rel.REFERENCED_TABLE_NAME);
      // Incoming FKs
      const [incoming] = await pool.query(
        `SELECT TABLE_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND REFERENCED_TABLE_NAME = ?
           AND TABLE_NAME != ?`,
        [table, table]
      ) as [any[], any];
      incomingRelationships[table] = incoming.map((rel: any) => rel.TABLE_NAME);
    }

    // 2. Use the analyzer to get relevant tables/columns/relationships
    const { tables: relevantTables, columns: relevantColumns } = analyzeQuery(
      question,
      tableNames,
      tableColumns,
      tableRelationships
    );

    // 3. Recursively expand all related tables (outgoing and incoming FKs, plus substring logic)
    const tablesWithMatchedColumns = Object.keys(tableColumns).filter(table =>
      tableColumns[table].some(col => relevantColumns.includes(col))
    );
    const initialTables = new Set<string>([...relevantTables, ...tablesWithMatchedColumns]);
    const expandedTables = new Set<string>();
    const queue = [...initialTables];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (expandedTables.has(current)) continue;
      expandedTables.add(current);
      // Outgoing FKs
      const related = tableRelationships[current] || [];
      for (const relTable of related) {
        if (!expandedTables.has(relTable)) {
          queue.push(relTable);
        }
        for (const otherTable of tableNames) {
          if (
            otherTable !== relTable &&
            otherTable.includes(relTable) &&
            !expandedTables.has(otherTable)
          ) {
            queue.push(otherTable);
          }
        }
      }
      // Incoming FKs
      const incoming = incomingRelationships[current] || [];
      for (const incTable of incoming) {
        if (!expandedTables.has(incTable)) {
          queue.push(incTable);
        }
        for (const otherTable of tableNames) {
          if (
            otherTable !== incTable &&
            otherTable.includes(incTable) &&
            !expandedTables.has(otherTable)
          ) {
            queue.push(otherTable);
          }
        }
      }
    }
    const allTables: string[] = Array.from(expandedTables);

    // 4. Build schema context for all tables in the set
    let schemaText = "";
    for (const table of allTables) {
      const [columns] = await pool.query("SHOW COLUMNS FROM ??", [table]) as [any[], any];
      schemaText += `Table: ${table}\n`;
      schemaText += columns.map((col: any) => `  ${col.Field}: ${col.Type}`).join("\n") + "\n";
      // Add all relationships
      const [relations] = await pool.query(
        `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [table]
      ) as [any[], any];
      if (relations.length > 0) {
        schemaText += "  Foreign keys:\n";
        schemaText += relations
          .map(
            (rel: any) =>
              `    ${rel.COLUMN_NAME} → ${rel.REFERENCED_TABLE_NAME}(${rel.REFERENCED_COLUMN_NAME})`
          )
          .join("\n") + "\n";
      }
    }

    const prompt = `Given the following database schema and relationships:\n\n${schemaText}\n\nWrite a SQL SELECT query to answer: "${question}".\nOnly return the SQL query, nothing else.`;

    return {
      content: [
        {
          type: "text" as const,
          text: prompt,
        },
      ],
    };
  }
);

server.registerPrompt(
  "suggest_query_promt",
  {
    title: "Suggest SQL Query",
    description: "Given a database schema and a natural language question, generate a SQL SELECT query.",
    argsSchema: {
      schema: z.string().describe("Database schema and relationships"),
      question: z.string().describe("Natural language question to answer with SQL")
    }
  },
  ({ schema, question }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Given the following database schema and relationships:\n\n${schema}\n\nWrite a SQL SELECT query to answer: "${question}".\nOnly return the SQL query, nothing else.`
        }
      }
    ]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP MySQL Read-Only Server started (STDIO mode)");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
}); 