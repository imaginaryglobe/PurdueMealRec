# Purdue Dining MCP Server

Exposes the Purdue HFS dining GraphQL API as MCP tools so Claude can look up menus and plan meals directly, in any chat.

## Tools

- `list_dining_courts` — Earhart, Ford, Hillenbrand, Wiley, Windsor
- `get_menu(date, court?, meal?)` — raw menu items with nutrition facts
- `best_protein_sources(date, court?, meal?, limit?)` — items ranked by calories/gram of protein
- `best_fiber_sources(date, court?, meal?, limit?)` — items ranked by calories/gram of fiber

`date` is `YYYY-MM-DD`. `court`/`meal` are optional filters; omit for all courts/meals.

## Setup

```bash
cd mcp-server
npm install
```

## Connect to Claude Code

```bash
claude mcp add purdue-dining -- node "C:\Users\Jaden\coding\purduemealrec3\mcp-server\index.js"
```

## Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "purdue-dining": {
      "command": "node",
      "args": ["C:\\Users\\Jaden\\coding\\purduemealrec3\\mcp-server\\index.js"]
    }
  }
}
```

Restart Claude Desktop/Code after adding. Then just ask, e.g. "plan a high-protein lunch for me today from Wiley or Ford."
