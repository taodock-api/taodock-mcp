# TaoDock MCP Server

Use TaoDock image and video models from Claude Desktop, Cursor, Gemini CLI, and other MCP clients.

在 Claude Desktop、Cursor、Gemini CLI 等 MCP 客户端中调用 TaoDock 图像和视频模型。

mcp-name: io.github.taodock-api/mcp-server

## API key / API Key

1. Register at [taodock.com/sign-up](https://taodock.com/sign-up?utm_source=mcp-registry&utm_medium=plugin&utm_campaign=integrations).
2. Review your [wallet](https://taodock.com/wallet) and the available [models](https://taodock.com/models).
3. Create an API key at [taodock.com/keys](https://taodock.com/keys) and enable the models you need.

## Configuration / 配置

After the npm package is published, add this server to an MCP client:

```json
{
  "mcpServers": {
    "taodock": {
      "command": "npx",
      "args": ["-y", "@taodock/mcp-server"],
      "env": {
        "TAODOCK_API_KEY": "<your TaoDock API key>"
      }
    }
  }
}
```

| Variable | Description |
|---|---|
| `TAODOCK_API_KEY` | TaoDock API key; required |
| `TAODOCK_BASE_URL` | Optional compatible API base URL; defaults to `https://taodock.com/v1` |
| `TAODOCK_OUTPUT_DIR` | Generated file directory; defaults to `./taodock-output` |
| `TAODOCK_LOCALE` | Error language: `en` or `zh` |

For Claude Desktop, a release can also include `taodock-mcp-<version>.mcpb`, built with `npm run mcpb`.

## Tools / 工具

| Tool | Purpose |
|---|---|
| `list_models` | List image, video, or text models available to the configured key |
| `generate_image` | Generate or edit an image and save the result |
| `create_video` | Start an asynchronous video generation task |
| `get_video_status` | Read a video task's current status |
| `download_video` | Wait for and save a completed video |

Image-specific fields belong in `parameters`; video-specific fields belong in `request`. Consult the [TaoDock model guide](https://docs.taodock.com/en/guide/models.html) for supported endpoints and request fields.

Requests consume TaoDock quota according to the selected model and account configuration. Review activity in [usage logs](https://taodock.com/usage-logs/common).

## Troubleshooting / 常见问题

- **401**: replace the missing, expired, disabled, or invalid key in [API Keys](https://taodock.com/keys).
- **`model_not_found`**: verify the key's group and model permissions, then check the [model catalog](https://taodock.com/models).
- **403 / `insufficient_user_quota`**: check the key quota and [wallet](https://taodock.com/wallet).
- **Empty image or video list**: confirm that the model is enabled for the key and supports the required endpoint.

## Project links

- Documentation: https://docs.taodock.com
- Privacy disclosure: [PRIVACY.md](PRIVACY.md)
- TaoDock privacy policy: https://taodock.com/privacy-policy
- Support: https://github.com/taodock-api/taodock-mcp/issues

## License

MIT © TaoDock
