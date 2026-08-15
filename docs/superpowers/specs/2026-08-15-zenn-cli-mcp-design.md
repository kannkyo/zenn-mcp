# zenn-cli MCPサーバー 設計

## 背景・目的

[Zenn CLI](https://zenn.dev/zenn/articles/install-zenn-cli) は、Zennの記事・本をローカルで作成・管理するための公式CLIツールである。本プロジェクトは、zenn-cliのコマンド群をMCP（Model Context Protocol）ツールとしてラップし、MCPクライアント（Claude Codeなど）から直接呼び出せるようにするサーバーを提供する。

このリポジトリはMCPサーバーの実装のみを持つ。記事・本のデータは持たず、MCPクライアントが指定した任意のZennプロジェクトディレクトリ（`projectDir`）を操作対象とする汎用的なサーバーとして設計する。

## スコープ

- zenn-cliの以下のコマンドをフルラップする:
  - `zenn init`
  - `zenn new:article`
  - `zenn new:book`
  - `zenn list:articles`
  - `zenn list:books`
- `zenn preview`（ローカルプレビューサーバーの起動）は対象外とする。常駐プロセスの管理はMCPツール呼び出しモデルと相性が悪く、今回のスコープから明示的に除外する。

## アーキテクチャ

TypeScript製のstdio MCPサーバー。`@modelcontextprotocol/sdk` でツール群を公開し、各ツールは内部で `npx zenn <command>` を child_process として呼び出すだけの薄いラッパーとする。zenn-cli自体のロジックには一切手を入れない。

対象のZennプロジェクトディレクトリは、各ツール呼び出し時に引数 `projectDir`（絶対パス）として渡される。

## 提供ツール

| ツール名 | 対応するzenn-cliコマンド | 引数 |
|---|---|---|
| `zenn_init` | `npx zenn init` | `projectDir` |
| `zenn_new_article` | `npx zenn new:article` | `projectDir`, `slug?`, `title?`, `type?`(`tech`\|`idea`), `emoji?`, `published?`(boolean) |
| `zenn_new_book` | `npx zenn new:book` | `projectDir`, `slug?` |
| `zenn_list_articles` | `npx zenn list:articles` | `projectDir` |
| `zenn_list_books` | `npx zenn list:books` | `projectDir` |

- `zenn_new_article` / `zenn_new_book` のオプション引数はzenn-cliのCLIオプションに1:1で対応させ、指定されたものだけをコマンドライン引数として組み立てる。
- `list:*` 系はzenn-cliのコンソール出力をそのままテキストとして返す。構造化パースは行わない（zenn-cli側の出力フォーマット変更に対して脆くなるのを避けるため）。

## データフロー

1. MCPクライアントがツールを呼び出す（`projectDir` + 任意の追加引数）。
2. `zennCli.ts` が `projectDir` の存在・Zennプロジェクトであることを検証する（`articles/` または `package.json` の存在確認）。
3. 検証を通過したら `npx zenn <command> [...args]` を `cwd: projectDir` で spawn し、完了を待つ。
4. 標準出力・標準エラー・終了コードを受け取り、MCPツールの実行結果として整形して返す。

## エラーハンドリング

- `projectDir` が存在しない、またはZennプロジェクトと判定できない場合、コマンドを実行せずにエラーを返す。
- `npx` 実行が非0終了コードで終わった場合、stderrの内容をそのままエラーメッセージとして返す。
- `npx` コマンド自体が見つからない（Node.js/npm未インストール環境）場合も、エラーとして分かりやすく返す。

## 構成

```
src/
  index.ts    # McpServerのセットアップ + stdio transportの起動
  zennCli.ts  # npx zenn 呼び出しの共通ラッパー（spawn、projectDir検証、結果整形）
  tools/      # 各ツールのハンドラ（引数スキーマ定義 + zennCli呼び出し）
package.json
tsconfig.json
```

## テスト

- `zennCli.ts` のコマンドライン引数組み立てロジックと `projectDir` バリデーションをunit testで検証する（vitest、`child_process` はモック化）。
- 各 `tools/*` ハンドラの引数スキーマ（Zod等によるバリデーション）をunit testで検証する。
- 実際の `npx zenn` 呼び出しを伴う軽量な統合テストを1〜2本用意する（一時ディレクトリに対して `init` → `new:article` が成功することを確認する程度に留める）。
