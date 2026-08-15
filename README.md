# zenn-mcp

[Zenn CLI](https://zenn.dev/zenn/articles/install-zenn-cli) の主要コマンドをMCP（Model Context Protocol）ツールとしてラップするstdio MCPサーバーです。

## 提供ツール

| ツール名 | 対応するzenn-cliコマンド | 引数 |
|---|---|---|
| `zenn_init` | `npx zenn init` | `projectDir` |
| `zenn_new_article` | `npx zenn new:article` | `projectDir`, `slug?`, `title?`, `type?`(`tech`\|`idea`), `emoji?`, `published?` |
| `zenn_new_book` | `npx zenn new:book` | `projectDir`, `slug?` |
| `zenn_list_articles` | `npx zenn list:articles` | `projectDir` |
| `zenn_list_books` | `npx zenn list:books` | `projectDir` |

`projectDir` は操作対象のZennプロジェクトの絶対パスです。このサーバー自体は記事・本のデータを持たず、呼び出し元が指定した任意のディレクトリを操作します。`zenn preview`（ローカルプレビューサーバー）はスコープ外です。

## セットアップ

```bash
npm install
npm run build
```

## MCPクライアントへの登録例

```json
{
  "mcpServers": {
    "zenn-mcp": {
      "command": "node",
      "args": ["/path/to/zenn-mcp/dist/index.js"]
    }
  }
}
```

## 開発

```bash
npm run dev        # tsxで直接起動
npm test           # vitest
npm run typecheck  # tsc --noEmit
```
