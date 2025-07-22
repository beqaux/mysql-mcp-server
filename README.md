# Model Context Protocol (MCP) Server

## Overview
This project provides a robust, production-ready MCP server that exposes your database schema context to an LLM for SQL generation. It automatically analyzes user questions, determines the relevant tables and relationships, and builds a minimal but complete schema prompt for the LLM—including all necessary join paths, even for many-to-many relationships.

## Features
- **Automatic schema introspection**: Reads your database schema and relationships at runtime.
- **Smart context minimization**: Only includes tables and relationships relevant to the user's question.
- **Recursive join expansion**: Follows both outgoing and incoming foreign keys, so all join paths (including many-to-many) are included.
- **Handles complex queries**: No join path is missed, even for deep or indirect relationships.

## Usage

### 1. Install dependencies
```sh
npm install
```

### 2. Configure your database
Set your MySQL connection details in your environment (e.g., `.env` file):
```
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=youruser
DB_PASSWORD=yourpass
DB_DATABASE=yourdb
```

### 3. Start the MCP server
```sh
npx ts-node src/index.ts
```

### 4. Query the server (example)
You can use the provided `test-list-tables.ts` or your own MCP client to send a question:
```sh
npx ts-node test-list-tables.ts
```
This will:
- Connect to the MCP server
- Send a natural language question (e.g., "the tc of the student who takes the courses given by the coordinator")
- Print the generated schema context prompt

## How Schema Expansion Works

### Direct Table/Column Match
- The analyzer finds all tables and columns mentioned in the user's question (by name or partial match).
- These tables are included fully (all columns, all relationships).

### Recursive Relationship Expansion
- For every included table, the system follows **both outgoing and incoming foreign keys**.
- Every related table is also included fully (all columns, all relationships).
- This process is recursive: as new tables are added, their relationships are also followed, until no new tables are found.
- If a related table's name is a substring of any other table name (e.g., `user` in `user_roles`), that table is also included.

### Many-to-Many Relationships
- Many-to-many relationships are represented by a **join table** (e.g., `user_roles` for `users` and `roles`).
- The system will automatically include join tables and all their related tables if any side of the relationship is matched in the question.
- **Best practice:**
  - Name your join tables clearly, e.g., `student_courses`, `user_roles`.
  - Ensure foreign keys are set up from the join table to both related tables.
- **Example:**
  - If the question mentions `users` and `roles`, the analyzer will include `users`, `roles`, and `user_roles` (with all columns and relationships).
  - If only `users` is mentioned, but `user_roles` exists and points to `roles`, both `user_roles` and `roles` will be included.

## Best Practices for Schema Design
- **Join tables:**
  - Use clear, descriptive names (e.g., `student_courses`, `user_roles`).
  - Always set up foreign keys from the join table to both related tables.
- **Column names:**
  - Use consistent, descriptive names (e.g., `user_id`, `role_id`).
- **Avoid ambiguous names:**
  - Avoid using the same name for different tables or columns unless they are truly the same entity.

## Troubleshooting
- If your prompt is too large, consider:
  - Reducing the number of tables/columns in your schema.
  - Adding logic to limit recursion depth or the number of included tables.
- If a join path is missing, check your foreign key definitions.

## Contributing
Pull requests and issues are welcome!

## License
MIT 