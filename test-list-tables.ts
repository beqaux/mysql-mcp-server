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

  // List tables
  // const tablesResource = await client.readResource({
  //   uri: "schema://tables"
  // });
  // console.log("Tables:\n" + tablesResource.contents[0].text);

  // // Get schema for a table
  // const table = "mobilities";
  // const schemaResource = await client.readResource({
  //   uri: `schema://table/${table}`
  // });
  // console.log(`Schema for ${table}:\n` + schemaResource.contents[0].text);

  // // Get relationships for a table
  // const relResource = await client.readResource({
  //   uri: `schema://table/${table}/relationships`
  // });
  // console.log(`Relationships for ${table}:\n` + relResource.contents[0].text);

  const callTool = await client.callTool({
    name: "suggest_query",
    arguments: {
      question: "the tc of the student who takes the courses given by the coordinator"
    }
  });
  console.log(callTool);

  process.exit(0);

  
}

main();