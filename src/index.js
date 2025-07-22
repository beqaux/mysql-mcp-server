"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
var zod_1 = require("zod");
var db_1 = require("./db");
var mcp_js_2 = require("@modelcontextprotocol/sdk/server/mcp.js");
var query_analyzer_1 = require("./query_analyzer");
// Test MySQL connection at startup
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, (0, db_1.testConnection)()];
            case 1:
                _a.sent();
                console.error("MySQL connection successful.");
                return [3 /*break*/, 3];
            case 2:
                err_1 = _a.sent();
                console.error("MySQL connection failed:", err_1);
                process.exit(1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); })();
// Create the MCP server instance
var server = new mcp_js_1.McpServer({
    name: "mysql-readonly-server",
    version: "0.1.0",
    description: "MCP server for read-only MySQL access with schema inspection."
});
// Register a test resource (does not require DB)
server.registerResource("test_resource", "test://hello", {
    title: "Test Resource",
    description: "A test resource to check MCP registration.",
    mimeType: "text/plain"
}, function (uri) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, ({
                contents: [{
                        uri: uri.href,
                        text: "Hello, MCP! This is a test resource."
                    }]
            })];
    });
}); });
// Register a test tool (does not require DB)
server.registerTool("test_tool", {
    title: "Test Tool",
    description: "A test tool that echoes input.",
    inputSchema: { message: zod_1.z.string() }
}, function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var message = _b.message;
    return __generator(this, function (_c) {
        return [2 /*return*/, ({
                content: [{ type: "text", text: "Echo: ".concat(message) }]
            })];
    });
}); });
// Register a health check tool
server.registerTool("health_check", {
    title: "Health Check",
    description: "Check if the server is alive and get basic info.",
    inputSchema: zod_1.z.object({}),
}, function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, ({
                content: [
                    {
                        type: "text",
                        text: "Status: ok\nServer time: ".concat(new Date().toISOString(), "\nVersion: 0.1.0")
                    }
                ]
            })];
    });
}); });
// Register a resource to list all tables in the current database
server.registerResource("list_tables", "schema://tables", {
    title: "List Tables",
    description: "List all tables in the current database.",
    mimeType: "text/plain"
}, function () { return __awaiter(void 0, void 0, void 0, function () {
    var rows, tableNames;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, db_1.pool.query("SHOW TABLES")];
            case 1:
                rows = (_a.sent())[0];
                tableNames = rows.map(function (row) { return Object.values(row)[0]; });
                return [2 /*return*/, {
                        contents: [{
                                uri: "schema://tables",
                                text: tableNames.join("\n")
                            }]
                    }];
        }
    });
}); });
// Register a resource to get the schema of a table
server.registerResource("table_schema", new mcp_js_2.ResourceTemplate("schema://table/{table}", { list: undefined }), {
    title: "Table Schema",
    description: "Get columns and types for a table.",
    mimeType: "text/plain"
}, function (uri_1, _a) { return __awaiter(void 0, [uri_1, _a], void 0, function (uri, _b) {
    var columns, schemaText;
    var table = _b.table;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, db_1.pool.query("SHOW COLUMNS FROM ??", [table])];
            case 1:
                columns = (_c.sent())[0];
                schemaText = columns.map(function (col) { return "".concat(col.Field, ": ").concat(col.Type); }).join("\n");
                return [2 /*return*/, {
                        contents: [{
                                uri: uri.href,
                                text: schemaText
                            }]
                    }];
        }
    });
}); });
// Register a resource to get the relationships of a table
server.registerResource("table_relationships", new mcp_js_2.ResourceTemplate("schema://table/{table}/relationships", { list: undefined }), {
    title: "Table Relationships",
    description: "Get foreign key relationships for a table.",
    mimeType: "text/plain"
}, function (uri_1, _a) { return __awaiter(void 0, [uri_1, _a], void 0, function (uri, _b) {
    var relations, relText;
    var table = _b.table;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, db_1.pool.query("SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME\n       FROM information_schema.KEY_COLUMN_USAGE\n       WHERE TABLE_SCHEMA = DATABASE()\n         AND TABLE_NAME = ?\n         AND REFERENCED_TABLE_NAME IS NOT NULL", [table])];
            case 1:
                relations = (_c.sent())[0];
                if (relations.length === 0) {
                    return [2 /*return*/, {
                            contents: [{
                                    uri: uri.href,
                                    text: "No foreign key relationships found for ".concat(table, ".")
                                }]
                        }];
                }
                relText = relations
                    .map(function (rel) {
                    return "".concat(rel.COLUMN_NAME, " \u2192 ").concat(rel.REFERENCED_TABLE_NAME, "(").concat(rel.REFERENCED_COLUMN_NAME, ")");
                })
                    .join("\n");
                return [2 /*return*/, {
                        contents: [{
                                uri: uri.href,
                                text: relText
                            }]
                    }];
        }
    });
}); });
// Register a tool to suggest a SQL query from a natural language question
server.registerTool("suggest_query", {
    title: "Suggest SQL Query",
    description: "Suggest a SQL SELECT query for a natural language question, using schema info and relationships.",
    inputSchema: { question: zod_1.z.string() },
}, function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var tables, tableNames, tableColumns, tableRelationships, incomingRelationships, _i, tableNames_1, table, columns, relations, incoming, _c, relevantTables, relevantColumns, tablesWithMatchedColumns, initialTables, expandedTables, queue, current, related, _d, related_1, relTable, _e, tableNames_2, otherTable, incoming, _f, incoming_1, incTable, _g, tableNames_3, otherTable, allTables, schemaText, _h, allTables_1, table, columns, relations, prompt;
    var question = _b.question;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0: return [4 /*yield*/, db_1.pool.query("SHOW TABLES")];
            case 1:
                tables = (_j.sent())[0];
                tableNames = tables.map(function (row) { return String(Object.values(row)[0]); });
                tableColumns = {};
                tableRelationships = {};
                incomingRelationships = {};
                _i = 0, tableNames_1 = tableNames;
                _j.label = 2;
            case 2:
                if (!(_i < tableNames_1.length)) return [3 /*break*/, 7];
                table = tableNames_1[_i];
                return [4 /*yield*/, db_1.pool.query("SHOW COLUMNS FROM ??", [table])];
            case 3:
                columns = (_j.sent())[0];
                tableColumns[table] = columns.map(function (col) { return col.Field; });
                tableRelationships[table] = [];
                return [4 /*yield*/, db_1.pool.query("SELECT REFERENCED_TABLE_NAME\n         FROM information_schema.KEY_COLUMN_USAGE\n         WHERE TABLE_SCHEMA = DATABASE()\n           AND TABLE_NAME = ?\n           AND REFERENCED_TABLE_NAME IS NOT NULL", [table])];
            case 4:
                relations = (_j.sent())[0];
                tableRelationships[table] = relations.map(function (rel) { return rel.REFERENCED_TABLE_NAME; });
                return [4 /*yield*/, db_1.pool.query("SELECT TABLE_NAME\n         FROM information_schema.KEY_COLUMN_USAGE\n         WHERE TABLE_SCHEMA = DATABASE()\n           AND REFERENCED_TABLE_NAME = ?\n           AND TABLE_NAME != ?", [table, table])];
            case 5:
                incoming = (_j.sent())[0];
                incomingRelationships[table] = incoming.map(function (rel) { return rel.TABLE_NAME; });
                _j.label = 6;
            case 6:
                _i++;
                return [3 /*break*/, 2];
            case 7:
                _c = (0, query_analyzer_1.analyzeQuery)(question, tableNames, tableColumns, tableRelationships), relevantTables = _c.tables, relevantColumns = _c.columns;
                tablesWithMatchedColumns = Object.keys(tableColumns).filter(function (table) {
                    return tableColumns[table].some(function (col) { return relevantColumns.includes(col); });
                });
                initialTables = new Set(__spreadArray(__spreadArray([], relevantTables, true), tablesWithMatchedColumns, true));
                expandedTables = new Set();
                queue = __spreadArray([], initialTables, true);
                while (queue.length > 0) {
                    current = queue.pop();
                    if (expandedTables.has(current))
                        continue;
                    expandedTables.add(current);
                    related = tableRelationships[current] || [];
                    for (_d = 0, related_1 = related; _d < related_1.length; _d++) {
                        relTable = related_1[_d];
                        if (!expandedTables.has(relTable)) {
                            queue.push(relTable);
                        }
                        for (_e = 0, tableNames_2 = tableNames; _e < tableNames_2.length; _e++) {
                            otherTable = tableNames_2[_e];
                            if (otherTable !== relTable &&
                                otherTable.includes(relTable) &&
                                !expandedTables.has(otherTable)) {
                                queue.push(otherTable);
                            }
                        }
                    }
                    incoming = incomingRelationships[current] || [];
                    for (_f = 0, incoming_1 = incoming; _f < incoming_1.length; _f++) {
                        incTable = incoming_1[_f];
                        if (!expandedTables.has(incTable)) {
                            queue.push(incTable);
                        }
                        for (_g = 0, tableNames_3 = tableNames; _g < tableNames_3.length; _g++) {
                            otherTable = tableNames_3[_g];
                            if (otherTable !== incTable &&
                                otherTable.includes(incTable) &&
                                !expandedTables.has(otherTable)) {
                                queue.push(otherTable);
                            }
                        }
                    }
                }
                allTables = Array.from(expandedTables);
                schemaText = "";
                _h = 0, allTables_1 = allTables;
                _j.label = 8;
            case 8:
                if (!(_h < allTables_1.length)) return [3 /*break*/, 12];
                table = allTables_1[_h];
                return [4 /*yield*/, db_1.pool.query("SHOW COLUMNS FROM ??", [table])];
            case 9:
                columns = (_j.sent())[0];
                schemaText += "Table: ".concat(table, "\n");
                schemaText += columns.map(function (col) { return "  ".concat(col.Field, ": ").concat(col.Type); }).join("\n") + "\n";
                return [4 /*yield*/, db_1.pool.query("SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME\n         FROM information_schema.KEY_COLUMN_USAGE\n         WHERE TABLE_SCHEMA = DATABASE()\n           AND TABLE_NAME = ?\n           AND REFERENCED_TABLE_NAME IS NOT NULL", [table])];
            case 10:
                relations = (_j.sent())[0];
                if (relations.length > 0) {
                    schemaText += "  Foreign keys:\n";
                    schemaText += relations
                        .map(function (rel) {
                        return "    ".concat(rel.COLUMN_NAME, " \u2192 ").concat(rel.REFERENCED_TABLE_NAME, "(").concat(rel.REFERENCED_COLUMN_NAME, ")");
                    })
                        .join("\n") + "\n";
                }
                _j.label = 11;
            case 11:
                _h++;
                return [3 /*break*/, 8];
            case 12:
                prompt = "Given the following database schema and relationships:\n\n".concat(schemaText, "\n\nWrite a SQL SELECT query to answer: \"").concat(question, "\".\nOnly return the SQL query, nothing else.");
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: prompt,
                            },
                        ],
                    }];
        }
    });
}); });
server.registerPrompt("suggest_query_promt", {
    title: "Suggest SQL Query",
    description: "Given a database schema and a natural language question, generate a SQL SELECT query.",
    argsSchema: {
        schema: zod_1.z.string().describe("Database schema and relationships"),
        question: zod_1.z.string().describe("Natural language question to answer with SQL")
    }
}, function (_a) {
    var schema = _a.schema, question = _a.question;
    return ({
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: "Given the following database schema and relationships:\n\n".concat(schema, "\n\nWrite a SQL SELECT query to answer: \"").concat(question, "\".\nOnly return the SQL query, nothing else.")
                }
            }
        ]
    });
});
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var transport;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    transport = new stdio_js_1.StdioServerTransport();
                    return [4 /*yield*/, server.connect(transport)];
                case 1:
                    _a.sent();
                    console.error("MCP MySQL Read-Only Server started (STDIO mode)");
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
