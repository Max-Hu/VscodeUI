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
    .progress {
      max-height: 180px;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #0b1220;
      padding: 8px;
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    .progress-line {
      color: var(--muted);
      margin-bottom: 4px;
    }
    .progress-line:last-child {
      margin-bottom: 0;
    }
  </style>
</head>
<body>
  <div class="title">VS Code PR Reviewer</div>

  <div class="card">
    <label for="prLink">PR Link</label>
    <input id="prLink" type="text" placeholder="https://github.com/{owner}/{repo}/pull/{number}" />
    <div class="row">
      <button id="reviewBtn" class="primary">Run Review</button>
    </div>
  </div>

  <div class="card">
    <label for="progress">Runtime Progress</label>
    <div id="progress" class="progress" aria-live="polite"></div>
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
    const state = { prLink: "", canPublish: false, progressLines: 0 };
    const els = {
      prLink: document.getElementById("prLink"),
      draft: document.getElementById("draft"),
      reviewBtn: document.getElementById("reviewBtn"),
      publishBtn: document.getElementById("publishBtn"),
      progress: document.getElementById("progress"),
      status: document.getElementById("status")
    };
    const maxProgressLines = 200;

    function setStatus(text, cls) {
      els.status.textContent = text || "";
      els.status.className = "status" + (cls ? " " + cls : "");
    }

    function clearProgress() {
      els.progress.textContent = "";
      state.progressLines = 0;
    }

    function appendProgress(text) {
      if (!text) return;
      const line = document.createElement("div");
      line.className = "progress-line";
      line.textContent = text;
      els.progress.appendChild(line);
      state.progressLines += 1;

      while (state.progressLines > maxProgressLines && els.progress.firstChild) {
        els.progress.removeChild(els.progress.firstChild);
        state.progressLines -= 1;
      }

      els.progress.scrollTop = els.progress.scrollHeight;
    }

    function toProgressSummary(event, fallbackText) {
      if (!event || typeof event !== "object") {
        return fallbackText || "progress";
      }
      if (event.name === "pipeline_started") return "Pipeline started";
      if (event.name === "pipeline_completed") return "Pipeline completed";
      if (event.name === "pipeline_failed") return "Pipeline failed";
      if (event.name === "degraded") return "Pipeline degraded";
      if (event.name === "llm_prompt") return "Preparing LLM input: " + (event.step || "unknown");
      if (event.name === "llm_response") return "Received LLM output: " + (event.step || "unknown");
      if (event.name === "llm_error") return "LLM failed: " + (event.step || "unknown");
      if (event.name === "step_started") return "Running: " + (event.step || "unknown");
      if (event.name === "step_succeeded") return "Completed: " + (event.step || "unknown");
      if (event.name === "step_failed") return "Failed: " + (event.step || "unknown");
      return fallbackText || "progress";
    }

    function runReview() {
      const prLink = (els.prLink.value || "").trim();
      state.prLink = prLink;
      state.canPublish = false;
      clearProgress();
      appendProgress("Starting review request...");
      setStatus("Running review...", "");
      vscode.postMessage({
        type: "start-review",
        payload: { prLink }
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
      } else if (message.type === "review-progress") {
        const detail = message.payload?.text || "";
        const event = message.payload?.event;
        appendProgress(detail);
        setStatus(toProgressSummary(event, detail), "");
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
