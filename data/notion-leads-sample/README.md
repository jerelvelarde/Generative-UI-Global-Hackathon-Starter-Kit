# Notion Leads sample data

Seed data for the kit's "AI Workshop Provider Community" lead-form demo. Use either file to populate a Notion database with the same shape the kit expects.

## Files

- **[`ai-workshop-provider-community.zip`](ai-workshop-provider-community.zip)** — Notion-flavored export. Re-importable into any Notion workspace.
- **[`ai-workshop-provider-community.csv`](ai-workshop-provider-community.csv)** — quick-look CSV of the same rows.

## Import into Notion

1. In Notion, open **Settings → Workspace → Import**.
2. Choose **Notion (CSV/ZIP)** and upload `ai-workshop-provider-community.zip`.
3. Once imported, [share the database with your integration](../../dev-docs/setup.md#notion-mcp-setup-lead-form-demo) and paste its id into `agent/.env` as `NOTION_LEADS_DATABASE_ID`.

A read-only public version of the same database is also available [in Notion](https://www.notion.so/a274791c4e1e826d882d01562af74de9?v=0e04791c4e1e83ca834988083174d19e&source=copy_link) — duplicate it into your workspace as an alternative to the import flow above.
