import * as vscode from "vscode";
import {
  getXwindTagsFromDocument,
  getXwindTagFromPosition,
} from "./getXwindTag";

const TYPESCRIPT_EXTENSION_ID = "vscode.typescript-language-features";
const PLUGIN_ID = "typescript-xwind-plugin";
const SELECTORS = [
  { language: "javascript", scheme: "file" },
  { language: "javascript", scheme: "untitled" },
  { language: "javascriptreact", scheme: "file" },
  { language: "javascriptreact", scheme: "untitled" },
  { language: "typescript", scheme: "file" },
  { language: "typescript", scheme: "untitled" },
  { language: "typescriptreact", scheme: "file" },
  { language: "typescriptreact", scheme: "untitled" },
];

const disposables: vscode.Disposable[] = [];

export async function activate(context: vscode.ExtensionContext) {
  const configuration = vscode.workspace.getConfiguration("xwind");
  const ignoreErrors = configuration.get("ignoreErrors");
  const typescriptLanguageFeaturesExtension = vscode.extensions.getExtension(
    TYPESCRIPT_EXTENSION_ID
  );
  if (!typescriptLanguageFeaturesExtension) {
    throw Error(
      "Extension vscode.typescript-language-features could not be found"
    );
  }

  const typescriptLanguageFeaturesExtensionExport = await typescriptLanguageFeaturesExtension.activate();
  const typescriptLanguageServerPluginApi = typescriptLanguageFeaturesExtensionExport.getAPI(
    0
  );
  if (!typescriptLanguageServerPluginApi) {
    throw Error("Typescript language server plugin api missing");
  }

  const tailwindConfigfiles = await vscode.workspace.findFiles(
    "**/tailwind.config.js"
  );

  typescriptLanguageServerPluginApi.configurePlugin(PLUGIN_ID, {
    config: tailwindConfigfiles[0]?.path,
    ignoreErrors,
  });

  const configWatcher = vscode.workspace.createFileSystemWatcher(
    "**/tailwind.config.js"
  );

  const configWatcherCallback = (action: string) => {
    return (e: vscode.Uri) => {
      console.log(`Config ${action}`, e.path);
      typescriptLanguageServerPluginApi.configurePlugin(PLUGIN_ID, {
        config: e.path,
        ignoreErrors,
      });
    };
  };

  configWatcher.onDidChange(configWatcherCallback("changed"));
  configWatcher.onDidCreate(configWatcherCallback("created"));
  configWatcher.onDidDelete(configWatcherCallback("deleted"));

  //TODO: get tailwind config separator
  if (configuration.get("useCompletionItemProviderTriggerProxy")) {
    disposables.push(
      vscode.languages.registerCompletionItemProvider(
        SELECTORS,
        tailwindcssinjsCompletionProvider,
        " ",
        "[",
        ":"
      )
    );
  }
}

export function deactivate(): Thenable<void> | void | undefined {
  for (const disposable of disposables) {
    disposable.dispose();
  }
}

const tailwindcssinjsCompletionProvider = {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
    //@ts-expect-error
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    //check if triggered by trigger character
    if (context.triggerKind === 1) {
      //get xwind template tags in file
      const tags = getXwindTagsFromDocument(document);
      //get tag if current position is inside a xwind tag
      const tag = getXwindTagFromPosition(position, tags);

      //if position is inside tag execute completion item provider and return results
      if (tag) {
        const completionItems = await vscode.commands.executeCommand<
          vscode.CompletionItem[] | vscode.CompletionList
        >("vscode.executeCompletionItemProvider", document.uri, position);
        return completionItems;
      }
    }
  },
};
