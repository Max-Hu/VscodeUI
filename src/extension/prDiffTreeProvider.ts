import * as vscode from "vscode";

export const PR_REVIEWER_DIFF_TREE_VIEW_ID = "prReviewer.diffFiles";
export const PR_REVIEWER_OPEN_DIFF_FROM_TREE_COMMAND = "prReviewer.openDiffFileFromTree";
export const PR_REVIEWER_OPEN_ALL_DIFFS_FROM_TREE_COMMAND = "prReviewer.openAllDiffsFromTree";

export interface PrDiffTreeFileItem {
  path: string;
  status: string;
  previousPath?: string;
  openable: boolean;
  reason?: string;
}

export interface PrDiffTreeModel {
  prLink: string;
  prTitle: string;
  source: "demo" | "real";
  files: PrDiffTreeFileItem[];
}

type TreeNode = InfoNode | ActionNode | FileNode;

interface InfoNode {
  kind: "info";
  label: string;
  description?: string;
}

interface ActionNode {
  kind: "action";
  label: string;
  command: {
    id: string;
    args: unknown[];
  };
  description?: string;
}

interface FileNode {
  kind: "file";
  prLink: string;
  file: PrDiffTreeFileItem;
}

export class PrDiffTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly emitter = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  private model: PrDiffTreeModel | undefined;

  readonly onDidChangeTreeData = this.emitter.event;

  setModel(model: PrDiffTreeModel): void {
    this.model = {
      ...model,
      files: model.files.slice().sort(compareDiffFiles)
    };
    this.refresh();
  }

  clear(): void {
    this.model = undefined;
    this.refresh();
  }

  getCurrentPrLink(): string | undefined {
    return this.model?.prLink;
  }

  getCurrentOpenableFilePaths(): string[] {
    if (!this.model) {
      return [];
    }
    return this.model.files.filter((file) => file.openable).map((file) => file.path);
  }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.kind === "info") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.description = element.description;
      item.contextValue = "prDiffInfo";
      item.iconPath = new vscode.ThemeIcon("info");
      return item;
    }

    if (element.kind === "action") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.description = element.description;
      item.contextValue = "prDiffAction";
      item.iconPath = new vscode.ThemeIcon("play");
      item.command = {
        command: element.command.id,
        title: element.label,
        arguments: element.command.args
      };
      return item;
    }

    const item = new vscode.TreeItem(element.file.path, vscode.TreeItemCollapsibleState.None);
    item.description = fileDescription(element.file);
    item.tooltip = buildFileTooltip(this.model, element.file);
    item.contextValue = element.file.openable ? "prDiffFile" : "prDiffFileDisabled";
    item.iconPath = iconForStatus(element.file.status, element.file.openable);
    if (element.file.openable) {
      item.command = {
        command: PR_REVIEWER_OPEN_DIFF_FROM_TREE_COMMAND,
        title: "Open PR Diff",
        arguments: [element.prLink, element.file.path]
      };
    }
    return item;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (element) {
      return [];
    }

    if (!this.model) {
      return [
        {
          kind: "info",
          label: "No PR diff loaded",
          description: "Use 'Load PR Files' in the PR Reviewer panel"
        }
      ];
    }

    const openable = this.model.files.filter((file) => file.openable).length;
    const unsupported = Math.max(0, this.model.files.length - openable);

    const nodes: TreeNode[] = [
      {
        kind: "info",
        label: this.model.prTitle || "PR Diff Files",
        description: `${this.model.source} | ${this.model.files.length} files`
      },
      {
        kind: "action",
        label: "Open All Supported Diffs",
        description: `${openable} files${unsupported ? ` | ${unsupported} skipped` : ""}`,
        command: {
          id: PR_REVIEWER_OPEN_ALL_DIFFS_FROM_TREE_COMMAND,
          args: [this.model.prLink]
        }
      }
    ];

    for (const file of this.model.files) {
      nodes.push({
        kind: "file",
        prLink: this.model.prLink,
        file
      });
    }
    return nodes;
  }
}

function compareDiffFiles(a: PrDiffTreeFileItem, b: PrDiffTreeFileItem): number {
  if (a.openable !== b.openable) {
    return a.openable ? -1 : 1;
  }
  return a.path.localeCompare(b.path);
}

function fileDescription(file: PrDiffTreeFileItem): string {
  const status = file.status.toUpperCase();
  if (file.previousPath) {
    return `${status} <- ${file.previousPath}`;
  }
  if (!file.openable && file.reason) {
    return `${status} | ${file.reason}`;
  }
  return status;
}

function buildFileTooltip(model: PrDiffTreeModel | undefined, file: PrDiffTreeFileItem): string {
  const lines = [file.path, `status: ${file.status}`];
  if (file.previousPath) {
    lines.push(`previous: ${file.previousPath}`);
  }
  if (!file.openable && file.reason) {
    lines.push(`reason: ${file.reason}`);
  }
  if (model) {
    lines.push(`source: ${model.source}`);
  }
  return lines.join("\n");
}

function iconForStatus(status: string, openable: boolean): vscode.ThemeIcon {
  if (!openable) {
    return new vscode.ThemeIcon("circle-slash");
  }
  const normalized = status.toLowerCase();
  if (normalized === "added") {
    return new vscode.ThemeIcon("diff-added");
  }
  if (normalized === "removed") {
    return new vscode.ThemeIcon("diff-removed");
  }
  if (normalized === "renamed") {
    return new vscode.ThemeIcon("diff-renamed");
  }
  return new vscode.ThemeIcon("diff-modified");
}
