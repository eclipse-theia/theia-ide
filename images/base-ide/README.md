# Theia Base IDE Image

The Base IDE serves as the foundational image for creating language-specific Theia IDE variants. It provides a minimal, lightweight Theia application with essential core functionality, designed to be extended with language-specific tooling and plugins.

## Design Philosophy

- **Minimal**: Includes only universal development tools (Git, Markdown, JSON)
- **Lightweight**: Excludes language-specific built-ins to reduce image size
- **Reusable**: Built once, copied into multiple language-specific images
- **Extensible**: Clean foundation for adding language tooling

## Purpose

This image:

1. Compiles the Theia IDE application from source
2. Downloads and configures core VS Code built-in extensions
3. Provides a standardized base for language-specific images
4. Eliminates redundant Theia builds across variants

For the complete architecture and usage examples, see the [Images README](../README.md).

## Included VS Code Built-in Extensions

The Base IDE includes VS Code built-in extensions from Theia's [builtin-extension-pack](https://open-vsx.org/extension/eclipse-theia/builtin-extension-pack), with only a few extensions included to optimize the resulting image.

### Complete Extension List

The following table shows all built-in extensions included in this base image:

| Package Name                         | Description                                                                                                                                  | URL                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| vscode.diff                          | Provides syntax highlighting & bracket matching in Diff files.                                                                               | https://open-vsx.org/extension/vscode/diff                            |
| vscode.git                           | Git SCM Integration                                                                                                                          | https://open-vsx.org/extension/vscode/git                             |
| vscode.git-base                      | Git static contributions and pickers.                                                                                                        | https://open-vsx.org/extension/vscode/git-base                        |
| vscode.json                          | Provides syntax highlighting & bracket matching in JSON files.                                                                               | https://open-vsx.org/extension/vscode/json                            |
| vscode.json-language-features        | Provides rich language support for JSON files.                                                                                               | https://open-vsx.org/extension/vscode/json-language-features          |
| vscode.log                           | Provides syntax highlighting for files with .log extension.                                                                                  | https://open-vsx.org/extension/vscode/log                             |
| vscode.markdown                      | Provides snippets and syntax highlighting for Markdown.                                                                                      | https://open-vsx.org/extension/vscode/markdown                        |
| vscode.markdown-language-features    | Provides rich language support for Markdown.                                                                                                 | https://open-vsx.org/extension/vscode/markdown-language-features      |
| vscode.media-preview                 | Provides VS Code's built-in previews for images, audio, and video                                                                            | https://open-vsx.org/extension/vscode/media-preview                   |
| vscode.merge-conflict                | Highlighting and commands for inline merge conflicts.                                                                                        | https://open-vsx.org/extension/vscode/merge-conflict                  |
| vscode.prompt                        | Terminal prompt suggestions and completions.                                                                                                 | https://open-vsx.org/extension/vscode/prompt                          |
| vscode.references-view               | Reference Search results as separate, stable view in the sidebar                                                                             | https://open-vsx.org/extension/vscode/references-view                 |
| vscode.search-result                 | Provides syntax highlighting and language features for tabbed search results.                                                                | https://open-vsx.org/extension/vscode/search-result                   |
| vscode.terminal-suggest              | Provides suggestions and completions in the terminal.                                                                                        | https://open-vsx.org/extension/vscode/terminal-suggest                |
| vscode.xml                           | Provides syntax highlighting and bracket matching in XML files.                                                                              | https://open-vsx.org/extension/vscode/xml                             |
| vscode.yaml                          | Provides syntax highlighting and bracket matching in YAML files.                                                                             | https://open-vsx.org/extension/vscode/yaml                            |

## Extending the Base Image

See the [Images README](../README.md) for complete examples and detailed documentation.
