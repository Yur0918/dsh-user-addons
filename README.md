# dsh-user-addons

Community web add-ons for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

This package provides a small, out-of-tree DSH plugin with both Host and Web client halves. It does not modify DSH core files.

## Features

- File drop/upload support in the Web composer. Images are attached when the selected model supports image input; other files are saved locally and attached by path.
- An archived-session manager for finding, archiving, and restoring sessions through DSH's workspace registry.
- A local model and token usage dashboard, folded from `~/.dsh/sessions`.
- An image-capability endpoint used by the Web client to choose the appropriate attachment behavior.

## Requirements

- A DSH Web profile with the client module loader enabled.
- Node.js 22.19 or newer, matching the current DSH development baseline.

## Install

Install this package using the plugin/package mechanism used by your DSH profile, then restart the Web profile so the package metadata and `lib/client.js` bundle are discovered. The package declares:

```json
{
  "dsh": {
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-locale"
      ]
    }
  }
}
```

For a source checkout, make sure the published `lib/client.js` file is present before starting the Web profile. Run the package check with:

```sh
npm run check
```

## Local routes

The Host half registers same-origin `/addons/*` routes:

- `GET /addons/health`
- `GET /addons/archive/list`
- `POST /addons/archive/archive`
- `POST /addons/archive/restore`
- `GET /addons/image-capability`
- `POST /addons/upload`
- `GET /addons/usage/summary`

Uploads are limited to 100 MiB and filenames are sanitized before being written below the DSH home. Usage data is read locally from DSH session logs; this plugin does not make network requests.

## Development

The browser bundle in `lib/client.js` is intentionally committed because DSH's Web host serves built client bundles. Keep the Host and Client halves compatible with the DSH version you are using, and run `npm run check` before publishing.

Please do not commit session logs, uploaded files, credentials, generated task state, or backup files.

## License

MIT
