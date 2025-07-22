"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const db_1 = require("./db");
const mcp_js_2 = require("@modelcontextprotocol/sdk/server/mcp.js");
const query_analyzer_1 = require("./query_analyzer");
// Test MySQL connection at startup
(async () => {
    try {
        await (0, db_1.testConnection)();
        console.error("MySQL connection successful.");
    }
    catch (err) {
        console.error("MySQL connection failed:", err);
        process.exit(1);
    }
})();
// Create the MCP server instance
const server = new mcp_js_1.McpServer({
    name: "mysql-readonly-server",
    version: "0.1.0",
    description: "MCP server for read-only MySQL access with schema inspection."
});
// Register a test resource (does not require DB)
server.registerResource("test_resource", "test://hello", {
    title: "Test Resource",
    description: "A test resource to check MCP registration.",
    mimeType: "text/plain"
}, async (uri) => ({
    contents: [{
            uri: uri.href,
            text: "Hello, MCP! This is a test resource."
        }]
}));
// Register a test tool (does not require DB)
server.registerTool("test_tool", {
    title: "Test Tool",
    description: "A test tool that echoes input.",
    inputSchema: { message: zod_1.z.string() }
}, async ({ message }) => ({
    content: [{ type: "text", text: `Echo: ${message}` }]
}));
// Register a health check tool
server.registerTool("health_check", {
    title: "Health Check",
    description: "Check if the server is alive and get basic info.",
    inputSchema: zod_1.z.object({}),
}, async () => ({
    content: [
        {
            type: "text",
            text: `Status: ok\nServer time: ${new Date().toISOString()}\nVersion: 0.1.0`
        }
    ]
}));
// Register a resource to list all tables in the current database
server.registerResource("list_tables", "schema://tables", {
    title: "List Tables",
    description: "List all tables in the current database.",
    mimeType: "text/plain"
}, async () => {
    const [rows] = await db_1.pool.query("SHOW TABLES");
    const tableNames = rows.map((row) => Object.values(row)[0]);
    return {
        contents: [{
                uri: "schema://tables",
                text: tableNames.join("\n")
            }]
    };
});
// Register a resource to get the schema of a table
server.registerResource("table_schema", new mcp_js_2.ResourceTemplate("schema://table/{table}", { list: undefined }), {
    title: "Table Schema",
    description: "Get columns and types for a table.",
    mimeType: "text/plain"
}, async (uri, { table }) => {
    const [columns] = await db_1.pool.query("SHOW COLUMNS FROM ??", [table]);
    const schemaText = columns.map((col) => `${col.Field}: ${col.Type}`).join("\n");
    return {
        contents: [{
                uri: uri.href,
                text: schemaText
            }]
    };
});
// Register a resource to get the relationships of a table
server.registerResource("table_relationships", new mcp_js_2.ResourceTemplate("schema://table/{table}/relationships", { list: undefined }), {
    title: "Table Relationships",
    description: "Get foreign key relationships for a table.",
    mimeType: "text/plain"
}, async (uri, { table }) => {
    const [relations] = await db_1.pool.query(`SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`, [table]);
    if (relations.length === 0) {
        return {
            contents: [{
                    uri: uri.href,
                    text: `No foreign key relationships found for ${table}.`
                }]
        };
    }
    const relText = relations
        .map((rel) => `${rel.COLUMN_NAME} → ${rel.REFERENCED_TABLE_NAME}(${rel.REFERENCED_COLUMN_NAME})`)
        .join("\n");
    return {
        contents: [{
                uri: uri.href,
                text: relText
            }]
    };
});
// Register a tool to suggest a SQL query from a natural language question
server.registerTool("suggest_query", {
    title: "Suggest SQL Query",
    description: "Suggest a SQL SELECT query for a natural language question, using schema info and relationships.",
    inputSchema: { question: zod_1.z.string() },
}, async ({ question }) => {
    // 1. Gather schema info
    const [tables] = await db_1.pool.query("SHOW TABLES");
    const tableNames = tables.map((row) => String(Object.values(row)[0]));
    // Build tableColumns, outgoing and incoming relationships
    const tableColumns = {};
    const tableRelationships = {}; // outgoing
    const incomingRelationships = {}; // incoming
    for (const table of tableNames) {
        const [columns] = await db_1.pool.query("SHOW COLUMNS FROM ??", [table]);
        tableColumns[table] = columns.map((col) => col.Field);
        tableRelationships[table] = [];
        // Outgoing FKs
        const [relations] = await db_1.pool.query(`SELECT REFERENCED_TABLE_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND REFERENCED_TABLE_NAME IS NOT NULL`, [table]);
        tableRelationships[table] = relations.map((rel) => rel.REFERENCED_TABLE_NAME);
        // Incoming FKs
        const [incoming] = await db_1.pool.query(`SELECT TABLE_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND REFERENCED_TABLE_NAME = ?
           AND TABLE_NAME != ?`, [table, table]);
        incomingRelationships[table] = incoming.map((rel) => rel.TABLE_NAME);
    }
    // 2. Use the analyzer to get relevant tables/columns/relationships
    const { tables: relevantTables, columns: relevantColumns } = (0, query_analyzer_1.analyzeQuery)(question, tableNames, tableColumns, tableRelationships);
    // 3. Recursively expand all related tables (outgoing and incoming FKs, plus substring logic)
    const tablesWithMatchedColumns = Object.keys(tableColumns).filter(table => tableColumns[table].some(col => relevantColumns.includes(col)));
    const initialTables = new Set([...relevantTables, ...tablesWithMatchedColumns]);
    const expandedTables = new Set();
    const queue = [...initialTables];
    while (queue.length > 0) {
        const current = queue.pop();
        if (expandedTables.has(current))
            continue;
        expandedTables.add(current);
        // Outgoing FKs
        const related = tableRelationships[current] || [];
        for (const relTable of related) {
            if (!expandedTables.has(relTable)) {
                queue.push(relTable);
            }
            for (const otherTable of tableNames) {
                if (otherTable !== relTable &&
                    otherTable.includes(relTable) &&
                    !expandedTables.has(otherTable)) {
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
                if (otherTable !== incTable &&
                    otherTable.includes(incTable) &&
                    !expandedTables.has(otherTable)) {
                    queue.push(otherTable);
                }
            }
        }
    }
    const allTables = Array.from(expandedTables);
    // 4. Build schema context for all tables in the set
    let schemaText = "";
    for (const table of allTables) {
        const [columns] = await db_1.pool.query("SHOW COLUMNS FROM ??", [table]);
        schemaText += `Table: ${table}\n`;
        schemaText += columns.map((col) => `  ${col.Field}: ${col.Type}`).join("\n") + "\n";
        // Add all relationships
        const [relations] = await db_1.pool.query(`SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND REFERENCED_TABLE_NAME IS NOT NULL`, [table]);
        if (relations.length > 0) {
            schemaText += "  Foreign keys:\n";
            schemaText += relations
                .map((rel) => `    ${rel.COLUMN_NAME} → ${rel.REFERENCED_TABLE_NAME}(${rel.REFERENCED_COLUMN_NAME})`)
                .join("\n") + "\n";
        }
    }
    const prompt = `Given the following database schema and relationships:\n\n${schemaText}\n\nWrite a SQL SELECT query to answer: "${question}".\nOnly return the SQL query, nothing else.`;
    return {
        content: [
            {
                type: "text",
                text: prompt,
            },
        ],
    };
});
server.registerPrompt("suggest_query_promt", {
    title: "Suggest SQL Query",
    description: "Given a database schema and a natural language question, generate a SQL SELECT query.",
    argsSchema: {
        schema: zod_1.z.string().describe("Database schema and relationships"),
        question: zod_1.z.string().describe("Natural language question to answer with SQL")
    }
}, ({ schema, question }) => ({
    messages: [
        {
            role: "user",
            content: {
                type: "text",
                text: `Given the following database schema and relationships:\n\n${schema}\n\nWrite a SQL SELECT query to answer: "${question}".\nOnly return the SQL query, nothing else.`
            }
        }
    ]
}));
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("MCP MySQL Read-Only Server started (STDIO mode)");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
