#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerZennInit } from "./tools/init.js";
import { registerZennNewArticle } from "./tools/newArticle.js";
import { registerZennNewBook } from "./tools/newBook.js";
import { registerZennListArticles } from "./tools/listArticles.js";
import { registerZennListBooks } from "./tools/listBooks.js";

const server = new McpServer({
  name: "zenn-mcp",
  version: "0.1.0",
});

registerZennInit(server);
registerZennNewArticle(server);
registerZennNewBook(server);
registerZennListArticles(server);
registerZennListBooks(server);

const transport = new StdioServerTransport();
await server.connect(transport);
