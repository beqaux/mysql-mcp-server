# MySQL MCP Server for LLMs
This project provides an MCP (Model Context Protocol) server for MySQL schema inspection and SQL query suggestion, designed to work seamlessly with the Cursor IDE.

## Features
- **List all tables** in your MySQL database
- **Inspect table schemas** (columns and types)
- **View table relationships** (foreign keys)
- **Suggest SQL queries** from natural language questions
- **Optimized for use with Cursor IDE**

## Correct Cursor MCP Server Configuration Example

Below is the correct config format you should use to start your MCP server with Cursor:

```json
{
  "mysql-mcp-server-query-builder": {
    "command": "npx",
    "args": [
      "-y",
      "mysql-mcp-server-query-builder"
    ],
    "env": {
      "DB_HOST": "127.0.0.1",
      "DB_PORT": "3306",
      "DB_USERNAME": "root",
      "DB_PASSWORD": "",
      "DB_DATABASE": "erasmus_management"
    }
  }
}
```


Cursor Deeplink:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=mysql-mcp-server-query-builder&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm15c3FsLW1jcC1zZXJ2ZXIiXSwiZW52Ijp7IkRCX0hPU1QiOiJsb2NhbGhvc3QiLCJEQl9QT1JUIjoiMzMwNiIsIkRCX1VTRVJOQU1FIjoieW91cl91c2VybmFtZSIsIkRCX1BBU1NXT1JEIjoieW91cl9wYXNzd29yZCIsIkRCX0RBVEFCQVNFIjoieW91cl9kYXRhYmFzZV9uYW1lIn19
```

You can easily add an MCP server to Cursor using this deeplink by filling in your own database information.


## Quick Start (in Cursor IDE)

### 1. Prerequisites
- Node.js (v16+ recommended)
- MySQL database (with schema you want to inspect)
- [Cursor IDE](https://www.cursor.so/) with MCP support

### 2. Install Dependencies
Open a terminal in the project root and run:

```
npm install
```

### 3. Configure MCP Server (Cursor IDE)

Cursor IDE uses the `C:\Users\{username}\.cursor\mcp.json` file to configure MCP servers. This project includes a sample configuration:

```json
{
  "mcpServers": {
    "sql-mcp-server": {
      "command": "npx ts-node",
      "args": [
        "/path/to/your/project/src/index.ts"
      ],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "3306",
        "DB_USERNAME": "your_username",
        "DB_PASSWORD": "your_password",
        "DB_DATABASE": "your_database_name"
      },
      "cwd": "/path/to/your/project"
    }
  }
}
```

- **Edit the `env` section** to match your MySQL credentials and database.
- Make sure the `args` path points to your `src/index.ts` file.

### 4. Start the MCP Server

In Cursor IDE, the MCP server will be started automatically when you use MCP features (like schema inspection or query suggestion). You can also run it manually:

```
npx ts-node src/index.ts
```

## Usage in Cursor IDE
Once your MCP server is configured and running, you can use it in Cursor IDE's agent mode to inspect your database schema and get SQL query suggestions.

### Available Resources (Data Inspection)

- **list_tables**: Get a list of all tables in your database
- **get_table_schema**: Get detailed schema information for a specific table (columns, types, constraints)
- **get_table_relationships**: Get foreign key relationships for a specific table

### Example Agent Interactions

 **Get Query Suggestions**:
   - "suggest_query I need a query to find all active users"
   - "suggest_query Show me all orders from the last 30 days with customer details"
   - "suggest_query_pro Find the top 10 customers by total order value"

The agent will automatically use the appropriate resources to understand your database structure and provide relevant SQL queries.


### SQL Query Suggestion Tools

- **suggest_query**: Suggests a SQL SELECT query for a natural language question, using only the relevant subset of the schema (minimizing token usage for efficiency).
- **suggest_query_pro**: Suggests a SQL SELECT query using the FULL schema and all relationships (uses more tokens, but provides the most complete context).

**Tip:** Use `suggest_query` for most questions to save tokens. Use `suggest_query_pro` if you want the LLM to see the entire database schema.

## Project Structure
- `src/index.ts` — Main MCP server implementation
- `.cursor/mcp.json` — MCP server configuration for Cursor IDE
- `package.json` — Project dependencies

## Troubleshooting
- Ensure your MySQL server is running and accessible with the credentials in `.cursor/mcp.json`.
- If you see connection errors, check your environment variables and database permissions.

## License
MIT 

