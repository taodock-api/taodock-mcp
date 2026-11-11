# Privacy and Data Handling

The TaoDock MCP server is a local stdio process. It does not expose an HTTP or SSE server.

## Data sent over the network

For each requested tool call, the server sends the configured API key and the inputs required for that operation to `https://taodock.com/v1`. Depending on the tool, this can include model IDs, prompts, model-specific parameters, video task IDs, and wait settings. Requests include an `X-TaoDock-Plugin` header containing the MCP server version.

The server also reads the API key's authorized model list and the public model catalog at `https://taodock.com/api/pricing`. Generated media may be downloaded from an HTTPS URL returned by the API. The media host receives normal network metadata such as the client's IP address.

If `TAODOCK_BASE_URL` is configured, the API key and tool inputs are sent to that HTTPS endpoint instead of the default TaoDock API. Only use an endpoint you trust. The public model catalog is still read from `taodock.com`.

## Local storage and MCP host retention

Generated images and videos are written to `TAODOCK_OUTPUT_DIR`, or to `./taodock-output` relative to the MCP process working directory when no directory is configured. An absolute output path is recommended. Files are not deleted automatically, and their absolute paths are returned to the MCP host.

Small generated images may also be returned inline as base64 data. The MCP host may retain tool inputs, outputs, files, and logs according to its own configuration.

The MCP server does not intentionally log or persist API keys, prompts, request parameters, or API responses beyond the generated media files described above.

TaoDock processes API traffic under https://taodock.com/privacy-policy. Selected model providers may apply their own data-processing terms. Do not submit secrets or personal data unless your use is authorized under the policies that apply to your TaoDock account, MCP host, and selected model.
