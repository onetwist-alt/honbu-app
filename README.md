# 本部アプリ

社員の業務・タスク・日報・出勤・人件費をまとめて管理するWebアプリです。

- 画面：このリポジトリを GitHub Pages で公開しています（変換なし。ファイルをそのまま公開）
- データ：Googleスプレッドシート「業務管理データ」
- つなぎ役：Google Apps Script（`gas/honbu-gas.gs` を Apps Script に貼り付けて使います）

## ファイルの構成

| 場所 | 中身 |
|---|---|
| `index.html` | 入口のページ |
| `css/app.css` | 見た目 |
| `js/config.js` | GASのURLなどの設定 |
| `js/core.js` | 日付・計算・共通の部品 |
| `js/api.js` | GASとのやり取り、ログイン |
| `js/view-*.js` | 各画面（全体・社員・出勤・月次レポート・システム管理・外枠） |
| `js/modals.js` | 小窓（タスク、業務、設定など） |
| `js/actions.js` | 保存などの操作 |
| `js/events.js` | ボタンや指の操作の受け取り |
| `js/app.js` | 起動 |
| `gas/honbu-gas.gs` | Apps Script に貼るコード（控え） |

## 更新のしかた

1. ファイルを直したら、GitHub Desktop でコミットして Push します。
2. GASを直したときは、Apps Script に貼り替えて「デプロイを管理」→ 編集 →「新バージョン」でデプロイします（URLは変わりません）。

パスワードや社員のデータは、このリポジトリには入れません。
