import { analyzeQuery } from "../src/query_analyzer";

const tableNames = ["users", "orders", "products", "mobilities"];
const tableColumns = {
  users: ["id", "name", "email", "created_at"],
  orders: ["id", "user_id", "product_id", "created_at"],
  products: ["id", "name", "price"],
  mobilities: ["id", "user_id", "location"]
};
const tableRelationships = {
  users: ["orders", "mobilities"],
  orders: ["users", "products"],
  products: ["orders"],
  mobilities: ["users"]
};

type TestCase = {
  question: string;
  expected: {
    tables: string[];
    columns: string[];
    relatedTables: string[];
  };
};

const testCases: TestCase[] = [
  {
    question: "Get the last order of a user.",
    expected: {
      tables: ["orders", "users"],
      columns: [],
      relatedTables: ["products", "mobilities"]
    }
  },
  {
    question: "List all product names and prices.",
    expected: {
      tables: ["products"],
      columns: ["name", "price"],
      relatedTables: ["orders"]
    }
  },
  {
    question: "Show all user emails and their mobility locations.",
    expected: {
      tables: ["users", "mobilities"],
      columns: ["email", "location"],
      relatedTables: ["orders"]
    }
  },
  {
    question: "Find orders with created_at in the last week.",
    expected: {
      tables: ["orders"],
      columns: ["created_at"],
      relatedTables: ["users", "products"]
    }
  },
  {
    question: "A question with no table or column name.",
    expected: {
      tables: [],
      columns: [],
      relatedTables: []
    }
  }
];

let passed = 0;
let failed = 0;

testCases.forEach(({ question, expected }, i) => {
  const result = analyzeQuery(question, tableNames, tableColumns, tableRelationships);
  const tablesPass =
    result.tables.length === expected.tables.length &&
    expected.tables.every((t) => result.tables.includes(t));
  const columnsPass =
    result.columns.length === expected.columns.length &&
    expected.columns.every((c) => result.columns.includes(c));
  const relatedPass =
    result.relatedTables.length === expected.relatedTables.length &&
    expected.relatedTables.every((r) => result.relatedTables.includes(r));
  if (tablesPass && columnsPass && relatedPass) {
    console.log(`Test ${i + 1} passed.`);
    passed++;
  } else {
    console.error(
      `Test ${i + 1} failed. Question: "${question}"\nExpected: ${JSON.stringify(expected)}\nGot: ${JSON.stringify(result)}`
    );
    failed++;
  }
});

console.log(`\n${passed} passed, ${failed} failed.`);

if (failed > 0) process.exit(1); 