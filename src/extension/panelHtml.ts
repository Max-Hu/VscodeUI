export function getPanelHtml(nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>PR Reviewer</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #111827;
      --panel-soft: #1f2937;
      --text: #e5e7eb;
      --muted: #9ca3af;
      --accent: #22c55e;
      --danger: #ef4444;
      --border: #374151;
      --mono: Consolas, "Courier New", monospace;
    }
    body {
      margin: 0;
      padding: 16px;
      background: radial-gradient(circle at 20% 10%, #1e293b 0%, var(--bg) 50%);
      color: var(--text);
      font-family: "Segoe UI", sans-serif;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .card {
      background: linear-gradient(145deg, var(--panel), var(--panel-soft));
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 8px;
    }
    label {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 4px;
    }
    input, select, textarea, button {
      width: 100%;
      box-sizing: border-box;
      border-radius: 8px;
      border: 1px solid var(--border);
      padding: 8px 10px;
      background: #0b1220;
      color: var(--text);
      font-family: inherit;
      font-size: 13px;
    }
    textarea {
      min-height: 180px;
      resize: vertical;
      font-family: var(--mono);
      line-height: 1.4;
    }
    button {
      cursor: pointer;
      width: auto;
      min-width: 92px;
      background: #111827;
      transition: 120ms ease;
    }
    button:hover { border-color: #6b7280; }
    button.primary {
      border-color: #14532d;
      background: linear-gradient(145deg, #166534, #14532d);
    }
    button.danger {
      border-color: #7f1d1d;
      background: linear-gradient(145deg, #991b1b, #7f1d1d);
    }
    .status {
      font-size: 12px;
      color: var(--muted);
      min-height: 18px;
    }
    .status.error { color: var(--danger); }
    .status.ok { color: var(--accent); }
  </style>
</head>
<body>
  <div class="title">VS Code PR Reviewer</div>

  <div class="card">
    <label for="prLink">PR Link</label>
    <input id="prLink" type="text" placeholder="https://github.com/{owner}/{repo}/pull/{number}" />
    <div class="row">
      <div style="flex:1;">
        <label for="profile">Profile</label>
        <select id="profile">
          <option value="default">default</option>
          <option value="security">security</option>
          <option value="performance">performance</option>
          <option value="compliance">compliance</option>
        </select>
      </div>
      <div style="flex:2;">
        <label for="keywords">Additional Keywords (comma separated)</label>
        <input id="keywords" type="text" placeholder="auth, retry, rollback" />
      </div>
    </div>
    <div class="row">
      <button id="reviewBtn" class="primary">Run Review</button>
    </div>
  </div>

  <div class="card">
    <label for="draft">Draft Comment (editable)</label>
    <textarea id="draft" placeholder="Run review to generate draft..."></textarea>
    <div class="row">
      <button id="publishBtn" class="danger">Publish</button>
    </div>
  </div>

  <div id="status" class="status"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = { prLink: "", canPublish: false };
    const els = {
      prLink: document.getElementById("prLink"),
      profile: document.getElementById("profile"),
      keywords: document.getElementById("keywords"),
      draft: document.getElementById("draft"),
      reviewBtn: document.getElementById("reviewBtn"),
      publishBtn: document.getElementById("publishBtn"),
      status: document.getElementById("status")
    };

    function setStatus(text, cls) {
      els.status.textContent = text || "";
      els.status.className = "status" + (cls ? " " + cls : "");
    }

    function runReview() {
      const prLink = (els.prLink.value || "").trim();
      const profile = els.profile.value;
      const keywordText = (els.keywords.value || "").trim();
      const additionalKeywords = keywordText ? keywordText.split(",").map(v => v.trim()).filter(Boolean) : [];
      state.prLink = prLink;
      state.canPublish = false;
      setStatus("Running review...", "");
      vscode.postMessage({
        type: "start-review",
        payload: { prLink, reviewProfile: profile, additionalKeywords }
      });
    }

    function publish() {
      if (!state.prLink) {
        setStatus("Run review first.", "error");
        return;
      }
      if (!state.canPublish) {
        setStatus("No draft available to publish.", "error");
        return;
      }
      const confirmed = confirm("Publish edited comment to PR?");
      if (!confirmed) {
        return;
      }
      setStatus("Publishing comment...", "");
      vscode.postMessage({
        type: "publish-review",
        payload: {
          prLink: state.prLink,
          commentBody: els.draft.value || "",
          confirmed: true
        }
      });
    }

    els.reviewBtn.addEventListener("click", runReview);
    els.publishBtn.addEventListener("click", publish);

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (!message || !message.type) return;

      if (message.type === "review-completed") {
        state.canPublish = true;
        const markdown = message.payload?.draft?.markdown || "";
        els.draft.value = markdown;
        setStatus("Review completed.", "ok");
      } else if (message.type === "publish-completed") {
        setStatus("Published: " + (message.payload?.commentUrl || ""), "ok");
      } else if (message.type === "review-failed") {
        state.canPublish = false;
        setStatus(message.payload?.message || "Request failed.", "error");
      }
    });
  </script>
</body>
</html>`;
}

export function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 24; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
