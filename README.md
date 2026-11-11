# TaoDock AI Image & Video MCP Server

[![npm](https://img.shields.io/npm/v/@taodock-ai/mcp-server?label=npm)](https://www.npmjs.com/package/@taodock-ai/mcp-server)
[![CI](https://github.com/taodock-api/taodock-mcp/actions/workflows/validate.yml/badge.svg)](https://github.com/taodock-api/taodock-mcp/actions/workflows/validate.yml)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-io.github.taodock--api%2Fmcp--server-6f42c1)](https://registry.modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Use TaoDock image and video models from Claude Desktop, Cursor, VS Code, Gemini CLI, and other local MCP clients. One TaoDock API key discovers the models authorized for your account, generates images, starts asynchronous video jobs, checks their status, and downloads completed media.

> The server uses local **stdio** transport. It does not expose a remote HTTP or SSE endpoint. Image and video generation consume TaoDock quota and generated files are written to your computer.

中文简介：在 Claude Desktop、Cursor、VS Code、Gemini CLI 等 MCP 客户端中调用 TaoDock 图片与视频模型。详细隐私边界见 [PRIVACY.md](PRIVACY.md)。

`mcp-name: io.github.taodock-api/mcp-server`

## Requirements

- Node.js 20.11 or later
- A TaoDock account and API key
- An MCP client that can launch a local stdio server

Create an account at [taodock.com/sign-up](https://taodock.com/sign-up?utm_source=mcp-registry&utm_medium=plugin&utm_campaign=integrations), review your [wallet](https://taodock.com/wallet), then create a key at [taodock.com/keys](https://taodock.com/keys) with the models you need.

## Quick start

Use the same server definition in any MCP client that accepts `mcpServers` JSON:

```json
{
  "mcpServers": {
    "taodock": {
      "command": "npx",
      "args": ["-y", "@taodock-ai/mcp-server@0.2.0"],
      "env": {
        "TAODOCK_API_KEY": "<your TaoDock API key>",
        "TAODOCK_OUTPUT_DIR": "/absolute/path/to/TaoDock"
      }
    }
  }
}
```

Pinning the package version makes client startup reproducible. Remove `@0.2.0` only if you intentionally want every launch to use the latest release.

### Claude Desktop

Add the configuration above to:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\\Claude\\claude_desktop_config.json`

Restart Claude Desktop after saving. You can also install the signed release artifact from [GitHub Releases](https://github.com/taodock-api/taodock-mcp/releases/latest): `taodock-mcp-0.2.0.mcpb`.

### Cursor

Open **Settings → Tools & Integrations → MCP Tools → New MCP Server**, then add the JSON definition. Cursor also supports project configuration in `.cursor/mcp.json` and user configuration in `~/.cursor/mcp.json`.

### VS Code

Create `.vscode/mcp.json` in a workspace or use the user-level MCP configuration:

```json
{
  "servers": {
    "taodock": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@taodock-ai/mcp-server@0.2.0"],
      "env": {
        "TAODOCK_API_KEY": "${input:taodock-api-key}",
        "TAODOCK_OUTPUT_DIR": "/absolute/path/to/TaoDock"
      }
    }
  },
  "inputs": [
    {
      "id": "taodock-api-key",
      "type": "promptString",
      "description": "TaoDock API key",
      "password": true
    }
  ]
}
```

### Gemini CLI

Add a local MCP server with Gemini CLI:

```bash
gemini mcp add --scope user \
  -e TAODOCK_API_KEY=<your-key> \
  -e TAODOCK_OUTPUT_DIR=/absolute/path/to/TaoDock \
  taodock npx -y @taodock-ai/mcp-server@0.2.0
```

## Configuration

| Variable | Required | Description |
|---|---:|---|
| `TAODOCK_API_KEY` | Yes | TaoDock API key from [taodock.com/keys](https://taodock.com/keys) |
| `TAODOCK_BASE_URL` | No | Trusted HTTPS-compatible endpoint; defaults to `https://taodock.com/v1`. The API key is sent to this endpoint. |
| `TAODOCK_OUTPUT_DIR` | No | Directory for generated files. Use an absolute path; otherwise the default is `./taodock-output` relative to the MCP process. |
| `TAODOCK_LOCALE` | No | Error language: `en` or `zh`; defaults to `en` |

Never configure an untrusted base URL. The server rejects plain HTTP and URLs containing embedded credentials.

## Tools

| Tool | Purpose | Side effects |
|---|---|---|
| `list_models` | List image, video, or text models available to the configured key | Reads the authorized model list and public catalog |
| `generate_image` | Generate an image and save the result | Consumes quota and writes local files |
| `create_video` | Start an asynchronous video generation task | Consumes quota and creates a remote task |
| `get_video_status` | Read a video task's current status | Read-only API request |
| `download_video` | Wait for and save a completed video | Writes a local file |

Image-specific fields belong in `parameters`; video-specific fields belong in `request`. The selected model and prompt cannot be overridden by these objects. Consult the [TaoDock model guide](https://docs.taodock.com/en/guide/models.html) for supported fields.

### Example prompts

```text
List the image models available to my TaoDock key.
Generate a 1024×1024 product hero image with a clean white background.
Create a video task with an available video model and return the task ID immediately.
Check video task <task-id>, then download it when completed.
```

Review usage and costs in [TaoDock usage logs](https://taodock.com/usage-logs/common).

## Run from source

```bash
git clone https://github.com/taodock-api/taodock-mcp.git
cd taodock-mcp
npm ci
npm run validate
TAODOCK_API_KEY=<your-key> npm start
```

For local client development, replace the `npx` command with an absolute path to Node and `dist/index.js`. Run `npm run mcpb` to validate and build the Claude Desktop extension.

## Security and privacy

- API keys are sent only as Bearer credentials to the configured HTTPS API endpoint.
- Generated image URLs must use HTTPS, redirects are rejected, responses must be images, and downloads are limited to 25 MiB.
- Generated media remains in `TAODOCK_OUTPUT_DIR` until you delete it.
- The MCP host may retain prompts, tool results, file paths, or logs according to its settings.
- See [PRIVACY.md](PRIVACY.md) and the [TaoDock privacy policy](https://taodock.com/privacy-policy).

Report vulnerabilities privately through the repository's GitHub security advisory page. Do not include API keys in public issues.

## Troubleshooting

- **401**: replace the missing, expired, disabled, or invalid key in [API Keys](https://taodock.com/keys).
- **`model_not_found`**: verify the key's group and model permissions, then check the [model catalog](https://taodock.com/models).
- **403 / `insufficient_user_quota`**: check the key quota and [wallet](https://taodock.com/wallet).
- **Empty image or video list**: confirm that the model is enabled for the key and supports the required endpoint.
- **Server exits immediately**: use Node.js 20.11 or later and inspect the MCP client's stderr logs.
- **Cannot find generated files**: set `TAODOCK_OUTPUT_DIR` to an absolute path.

## TaoDock integrations

- [n8n community nodes](https://github.com/taodock-api/taodock-n8n-nodes)
- [Vercel AI SDK provider](https://github.com/taodock-api/taodock-ai-sdk)
- [Dify tools](https://github.com/taodock-api/taodock-dify-tools)
- [AstrBot plugin](https://github.com/taodock-api/taodock-astrbot-plugin)
- [WordPress AI provider](https://github.com/taodock-api/taodock-wordpress)

Documentation: https://docs.taodock.com · Support: https://github.com/taodock-api/taodock-mcp/issues

## License

MIT © TaoDock
