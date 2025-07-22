import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "ts-node",
  args: ["src/index.ts"]
});

const client = new Client({
  name: "test-client",
  version: "0.1.0"
});

async function main() {
  await client.connect(transport);

  // 1. Fetch all tables
  const tablesResource = await client.readResource({ uri: "schema://tables" });
  const tablesContents = tablesResource.contents as { text: string }[];
  const tableNames = tablesContents[0].text.split("\n").map((t: string) => t.trim()).filter(Boolean);

  // 2. Gather schema and relationships for each table
  let schema = "";
  for (const table of tableNames) {
    // Table schema
    const schemaRes = await client.readResource({ uri: `schema://table/${table}` });
    const schemaContents = schemaRes.contents as { text: string }[];
    schema += `Table: ${table}\n${schemaContents[0].text}\n`;

    // Table relationships
    const relRes = await client.readResource({ uri: `schema://table/${table}/relationships` });
    const relContents = relRes.contents as { text: string }[];
    const relText = relContents[0].text.trim();
    if (relText && !relText.startsWith("No foreign key")) {
      schema += `Foreign keys:\n${relText}\n`;
    }
  }

  // 3. Call the suggest_query prompt
  const question = "Show all users who registered in the last month.";
  const result = await client.getPrompt({
    name: "suggest_query_promt",
    arguments: {
      schema,
      question
    }
  });
  const sql = (result as any).messages[0].content.text;
  console.log("Generated SQL:\n" + sql);
  console.log(result);
  console.log(result.messages[0].content.type);
  process.exit(0);
}

main();