#!/usr/bin/env node
import "dotenv/config";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mysql from "mysql2/promise";

// --- MySQL Connection Setup ---
const {
  DB_HOST,
  DB_PORT,
  DB_USERNAME,
  DB_PASSWORD,
  DB_DATABASE
} = process.env;

if (!DB_HOST || !DB_USERNAME || DB_PASSWORD === undefined || !DB_DATABASE) {
  throw new Error("Missing required MySQL environment variables.");
}

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT ? Number(DB_PORT) : 3306,
  user: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
}

// --- Schema Helper Functions ---
async function listTables(): Promise<string[]> {
  const [rows] = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
    [DB_DATABASE]
  );
  return (rows as any[]).map(row => row.table_name);
}

async function getTableSchema(tableName: string): Promise<{ column: string; type: string }[]> {
  const [rows] = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = ? AND table_name = ?`,
    [DB_DATABASE, tableName]
  );
  return (rows as any[]).map(row => ({ column: row.column_name, type: row.data_type }));
}

async function getTableRelationships(tableName: string): Promise<{ column: string; referencedTable: string; referencedColumn: string }[]> {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [DB_DATABASE, tableName]
  );
  return (rows as any[]).map(row => ({
    column: row.COLUMN_NAME,
    referencedTable: row.REFERENCED_TABLE_NAME,
    referencedColumn: row.REFERENCED_COLUMN_NAME
  }));
}

// --- Query Analyzer Logic ---
interface QueryAnalysisResult {
  tables: string[];
  columns: string[];
  relatedTables: string[];
}

function getSingular(word: string): string {
  if (word.endsWith('ies')) {
    return word.slice(0, -3) + 'y';
  } else if (word.endsWith('s')) {
    return word.slice(0, -1);
  }
  return word;
}

function getPlural(word: string): string {
  if (word.endsWith('y')) {
    return word.slice(0, -1) + 'ies';
  } else {
    return word + 's';
  }
}

/**
 * Analyze a natural language question to extract relevant tables, columns, and related tables.
 */
function analyzeQuery(
  question: string,
  tableNames: string[],
  tableColumns: Record<string, string[]>,
  tableRelationships: Record<string, string[]>
): QueryAnalysisResult {
  const lowerQuestion = question.toLowerCase();
  const words = lowerQuestion.split(/\W+/);

  // Find tables
  const foundTables: string[] = [];
  tableNames.forEach(table => {
    const tableLower = table.toLowerCase();
    const singular = getSingular(tableLower);
    const plural = getPlural(singular);
    if (
      words.includes(tableLower) ||
      words.includes(singular) ||
      words.includes(plural)
    ) {
      foundTables.push(table);
    }
  });

  // Find columns (unique)
  const foundColumnsSet = new Set<string>();
  for (const columns of Object.values(tableColumns)) {
    columns.forEach(col => {
      const colLower = col.toLowerCase();
      const singular = getSingular(colLower);
      const plural = getPlural(singular);
      if (
        words.includes(colLower) ||
        words.includes(singular) ||
        words.includes(plural)
      ) {
        foundColumnsSet.add(col);
      }
    });
  }

  // Related tables (from relationships, unique, not in foundTables)
  const relatedTablesSet = new Set<string>();
  foundTables.forEach(table => {
    const related = tableRelationships[table];
    if (related) {
      related.forEach(rt => {
        if (!foundTables.includes(rt)) {
          relatedTablesSet.add(rt);
        }
      });
    }
  });

  return {
    tables: foundTables,
    columns: Array.from(foundColumnsSet),
    relatedTables: Array.from(relatedTablesSet)
  };
}

// --- MCP Server Setup ---
(async () => {
  try {
    await testConnection();
    console.error("MySQL connection successful.");
  } catch (err) {
    console.error("MySQL connection failed:", err);
    process.exit(1);
  }

  const server = new McpServer({
    name: "mysql-schema-server",
    version: "0.1.0",
    description: "MCP server for MySQL schema inspection and query analysis. No SQL execution."
  });

  // Resource: List all tables
  server.registerResource(
    "list_tables",
    "schema://tables",
    {
      title: "List Tables",
      description: "List all tables in the current database.",
      mimeType: "application/json"
    },
    async () => {
      const tables = await listTables();
      return {
        contents: [{
          uri: "schema://tables",
          text: JSON.stringify(tables, null, 2)
        }]
      };
    }
  );

  // Resource: Table schema
  server.registerResource(
    "table_schema",
    new ResourceTemplate("schema://table/{table}", { list: undefined }),
    {
      title: "Table Schema",
      description: "Get columns and types for a table.",
      mimeType: "application/json"
    },
    async (uri, { table }) => {
      const tableName = Array.isArray(table) ? table[0] : table;
      const schema = await getTableSchema(tableName);
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(schema, null, 2)
        }]
      };
    }
  );

  // Resource: Table relationships
  server.registerResource(
    "table_relationships",
    new ResourceTemplate("schema://table/{table}/relationships", { list: undefined }),
    {
      title: "Table Relationships",
      description: "Get foreign key relationships for a table.",
      mimeType: "application/json"
    },
    async (uri, { table }) => {
      const tableName = Array.isArray(table) ? table[0] : table;
      const relationships = await getTableRelationships(tableName);
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(relationships, null, 2)
        }]
      };
    }
  );


  // Tool: Suggest a SQL query from a natural language question
  server.registerTool(
    "suggest_query",
    {
      title: "Suggest SQL Query",
      description: "Suggest a SQL SELECT query for a natural language question, using schema info and relationships.",
      inputSchema: { question: z.string() }
    },
    async ({ question }) => {
      // 1. Gather schema info
      const tables = await listTables();
      const tableNames: string[] = tables;
      const tableColumns: Record<string, string[]> = {};
      const tableRelationships: Record<string, string[]> = {}; // outgoing
      const incomingRelationships: Record<string, string[]> = {}; // incoming
      for (const table of tableNames) {
        const schema = await getTableSchema(table);
        tableColumns[table] = schema.map(col => col.column);
        // Outgoing FKs
        const rels = await getTableRelationships(table);
        tableRelationships[table] = rels.map(rel => rel.referencedTable);
        // Incoming FKs
        const [incoming] = await pool.query(
          `SELECT TABLE_NAME
           FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = ?
             AND REFERENCED_TABLE_NAME = ?
             AND TABLE_NAME != ?`,
          [DB_DATABASE, table, table]
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
        const schema = await getTableSchema(table);
        schemaText += `Table: ${table}\n`;
        schemaText += schema.map(col => `  ${col.column}: ${col.type}`).join("\n") + "\n";
        // Add all relationships
        const rels = await getTableRelationships(table);
        if (rels.length > 0) {
          schemaText += "  Foreign keys:\n";
          schemaText += rels
            .map(
              (rel: any) =>
                `    ${rel.column} → ${rel.referencedTable}(${rel.referencedColumn})`
            )
            .join("\n") + "\n";
        }
      }

      const prompt = `Given the following database schema and relationships:\n\n${schemaText}\n\nWrite a SQL SELECT query to answer: \"${question}\".\nOnly return the SQL query, nothing else.`;
      return {
        content: [
          {
            type: "text",
            text: prompt
          }
        ]
      };
    }
  );

  // Tool: Suggest a SQL query from a natural language question using the FULL schema from all resources
  server.registerTool(
    "suggest_query_pro",
    {
      title: "Suggest SQL Query (Full Schema)",
      description: "Suggest a SQL SELECT query for a natural language question, using the FULL schema and relationships from all tables.",
      inputSchema: { question: z.string() }
    },
    async ({ question }) => {
      // 1. Gather all tables
      const tables = await listTables();
      // 2. For each table, get schema and relationships
      let schemaText = "";
      for (const table of tables) {
        const schema = await getTableSchema(table);
        schemaText += `Table: ${table}\n`;
        schemaText += schema.map(col => `  ${col.column}: ${col.type}`).join("\n") + "\n";
        // Add all relationships
        const rels = await getTableRelationships(table);
        if (rels.length > 0) {
          schemaText += "  Foreign keys:\n";
          schemaText += rels
            .map(
              (rel) =>
                `    ${rel.column} → ${rel.referencedTable}(${rel.referencedColumn})`
            )
            .join("\n") + "\n";
        }
      }
      // 3. Build the prompt
      const prompt = `Given the following database schema and relationships:\n\n${schemaText}\n\nWrite a SQL SELECT query to answer: \"${question}\".\nOnly return the SQL query, nothing else.`;
      return {
        content: [
          {
            type: "text",
            text: prompt
          }
        ]
      };
    }
  );

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP MySQL Schema Server started (STDIO mode)");
})(); 