# Privacy Policy

The TaoDock MCP server sends the configured API key and the inputs needed for a requested tool call to `https://taodock.com/v1`. Depending on the tool, those inputs can include a model ID, prompt, model parameters, or video task data. The server also reads the key's authorized models, reads the public model catalog, and downloads generated media.

The server does not intentionally log or persist API keys, prompts, request parameters, or API responses. Generated images and videos are written to `TAODOCK_OUTPUT_DIR`, or to `./taodock-output` when no directory is configured. The MCP host may retain tool inputs, outputs, and logs according to its own configuration.

TaoDock processes API traffic under https://taodock.com/privacy-policy. Do not submit secrets or personal data unless your use is authorized under the policies that apply to your TaoDock account, MCP host, and selected model.
