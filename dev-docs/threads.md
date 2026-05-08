# Threads / Intelligence walkthrough

The threads drawer surfaces every conversation the user has had with the agent on this machine. Threads live in the **Intelligence composite container** (Postgres-backed). When you reload, the active thread is restored.

- **Search** the loaded set client-side; click "Load more" or "Search older threads" to paginate further.
- **Archive** to hide threads you're done with; toggle the filter to view archived.
- **Restore** brings them back; **Delete** is permanent.
- **Theme toggle** in the drawer footer.

To wipe all threads and start fresh:

```bash
npm run dev:infra:down
docker volume rm $(docker volume ls -q | grep intelligence)
npm run dev:infra
```
