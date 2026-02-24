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
      --bg: #f5f5f5;
      --panel: #ffffff;
      --panel-soft: #fafafa;
      --text: #1f1f1f;
      --muted: #666666;
      --accent: #107c41;
      --danger: #b42318;
      --brand: #db0011;
      --brand-dark: #b3000f;
      --border: #d8d8d8;
      --border-strong: #bdbdbd;
      --surface: #ffffff;
      --surface-alt: #f7f7f7;
      --focus: rgba(219, 0, 17, 0.18);
      --mono: Consolas, "Courier New", monospace;
    }
    body {
      margin: 0;
      padding: 16px;
      background:
        linear-gradient(180deg, #ffffff 0, #ffffff 72px, transparent 72px),
        linear-gradient(135deg, #fbfbfb 0%, #f1f1f1 100%);
      color: var(--text);
      font-family: "Segoe UI", sans-serif;
    }
    .title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 17px;
      font-weight: 700;
      margin-bottom: 14px;
      padding: 10px 12px;
      border-left: 4px solid var(--brand);
      background: #fff;
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }
    .title-logo {
      width: 24px;
      height: 24px;
      flex: 0 0 24px;
      display: block;
    }
    .title-text {
      line-height: 1.1;
    }
    .card {
      position: relative;
      background: linear-gradient(180deg, var(--panel) 0%, var(--panel-soft) 100%);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 14px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }
    .card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      border-radius: 8px 8px 0 0;
      background: var(--brand);
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 10px;
    }
    label {
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      margin-bottom: 6px;
    }
    input, select, textarea, button {
      width: 100%;
      box-sizing: border-box;
      border-radius: 6px;
      border: 1px solid var(--border);
      padding: 9px 10px;
      background: var(--surface);
      color: var(--text);
      font-family: inherit;
      font-size: 13px;
      transition: border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
    }
    input::placeholder, textarea::placeholder {
      color: #8a8a8a;
    }
    input:focus, select:focus, textarea:focus, button:focus-visible {
      outline: none;
      border-color: var(--brand);
      box-shadow: 0 0 0 3px var(--focus);
    }
    textarea {
      min-height: 180px;
      resize: vertical;
      font-family: var(--mono);
      line-height: 1.4;
      background: #fff;
    }
    button {
      cursor: pointer;
      width: auto;
      min-width: 92px;
      font-weight: 600;
      background: #fff;
      color: #222;
      border-color: var(--border-strong);
      transition: border-color 120ms ease, background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
    }
    button:hover {
      border-color: #8f8f8f;
      background: #f6f6f6;
    }
    button:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      border-color: var(--border);
      background: #f3f3f3;
      color: #8a8a8a;
      box-shadow: none;
    }
    button.primary {
      border-color: var(--brand);
      background: linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%);
      color: #fff;
    }
    button.primary:hover {
      border-color: var(--brand-dark);
      background: linear-gradient(180deg, #e10012 0%, var(--brand-dark) 100%);
    }
    button.danger {
      border-color: #2f2f2f;
      background: #2f2f2f;
      color: #fff;
    }
    button.danger:hover {
      border-color: #1f1f1f;
      background: #1f1f1f;
    }
    button.danger.publish-ready {
      border-color: var(--brand);
      background: #fff;
      color: var(--brand);
    }
    button.danger.publish-ready:hover {
      border-color: var(--brand-dark);
      background: #fff4f5;
      color: var(--brand-dark);
    }
    button.danger.publish-confirm {
      border-color: var(--brand);
      background: linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%);
      color: #fff;
      box-shadow: 0 0 0 1px rgba(219, 0, 17, 0.08);
    }
    button.danger.publish-confirm:hover {
      border-color: var(--brand-dark);
      background: linear-gradient(180deg, #e10012 0%, var(--brand-dark) 100%);
      color: #fff;
    }
    .status {
      font-size: 12px;
      color: var(--muted);
      min-height: 18px;
      line-height: 1.4;
    }
    .status.error { color: var(--danger); }
    .status.ok { color: var(--accent); }
    .status.warn { color: #a15c00; }
    .progress {
      max-height: 180px;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: #fcfcfc;
      padding: 8px;
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
      scrollbar-width: thin;
      scrollbar-color: #b6b6b6 #f1f1f1;
    }
    .progress-line {
      color: var(--muted);
      margin-bottom: 6px;
      padding: 6px 8px;
      border-left: 3px solid transparent;
      border-radius: 4px;
      background: #ffffff;
      box-shadow: inset 0 0 0 1px #f0f0f0;
    }
    .progress-line:last-child {
      margin-bottom: 0;
    }
    .progress-line.tone-info {
      border-left-color: #7c7c7c;
      color: #404040;
    }
    .progress-line.tone-step {
      border-left-color: var(--brand);
      color: #2a2a2a;
      background: #fff8f8;
      box-shadow: inset 0 0 0 1px #fde3e5;
    }
    .progress-line.tone-success {
      border-left-color: #2e8b57;
      color: #1f5135;
      background: #f3fbf6;
      box-shadow: inset 0 0 0 1px #d8f1e2;
    }
    .progress-line.tone-warn {
      border-left-color: #d48806;
      color: #7a4f00;
      background: #fffaf0;
      box-shadow: inset 0 0 0 1px #fde7bd;
    }
    .progress-line.tone-error {
      border-left-color: #c23934;
      color: #7a1f1f;
      background: #fff5f5;
      box-shadow: inset 0 0 0 1px #f5d3d3;
    }
    .progress-line.tone-llm {
      border-left-color: #5c6f91;
      color: #32435e;
      background: #f6f8fc;
      box-shadow: inset 0 0 0 1px #dfe6f3;
    }
    select {
      appearance: none;
      background-image:
        linear-gradient(45deg, transparent 50%, #555 50%),
        linear-gradient(135deg, #555 50%, transparent 50%);
      background-position:
        calc(100% - 16px) calc(50% - 2px),
        calc(100% - 11px) calc(50% - 2px);
      background-size: 5px 5px, 5px 5px;
      background-repeat: no-repeat;
      padding-right: 28px;
    }
    textarea,
    .progress {
      scrollbar-width: thin;
      scrollbar-color: #b6b6b6 #f1f1f1;
    }
    textarea::-webkit-scrollbar,
    .progress::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    textarea::-webkit-scrollbar-track,
    .progress::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 8px;
    }
    textarea::-webkit-scrollbar-thumb,
    .progress::-webkit-scrollbar-thumb {
      background: #b6b6b6;
      border-radius: 8px;
      border: 2px solid #f1f1f1;
    }
    textarea::-webkit-scrollbar-thumb:hover,
    .progress::-webkit-scrollbar-thumb:hover {
      background: var(--brand);
    }
    @media (max-width: 520px) {
      body {
        padding: 12px;
      }
      .row {
        flex-wrap: wrap;
      }
      .row button {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="title">
    <svg class="title-logo" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="84" height="84" fill="#ffffff" stroke="#db0011" stroke-width="4"/>
      <polygon points="8,8 50,50 8,92" fill="#db0011"/>
      <polygon points="92,8 50,50 92,92" fill="#db0011"/>
      <polygon points="8,8 50,50 92,8" fill="#db0011"/>
      <polygon points="8,92 50,50 92,92" fill="#db0011"/>
      <polygon points="20,20 50,50 20,80" fill="#ffffff"/>
      <polygon points="80,20 50,50 80,80" fill="#ffffff"/>
    </svg>
    <span class="title-text">VS Code PR Reviewer</span>
  </div>

  <div class="card">
    <label for="prLink">PR Link</label>
    <input id="prLink" type="text" placeholder="https://github.com/{owner}/{repo}/pull/{number}" />
    <div class="row">
      <button id="reviewBtn" class="primary">Run Review</button>
    </div>
  </div>

  <div class="card">
    <label for="copilotModel">Copilot Model (analysis)</label>
    <div class="row">
      <select id="copilotModel" aria-label="Copilot model">
        <option value="">Loading models...</option>
      </select>
      <button id="refreshModelsBtn" type="button">Refresh Models</button>
    </div>
    <div id="modelStatus" class="status"></div>
  </div>

  <div class="card">
    <label for="progress">Runtime Progress</label>
    <div id="progress" class="progress" aria-live="polite"></div>
  </div>

  <div class="card">
    <label for="draft">Draft Comment (editable)</label>
    <textarea id="draft" placeholder="Run review to generate draft..."></textarea>
    <div class="row">
      <button id="publishBtn" class="danger" disabled aria-disabled="true">Publish</button>
    </div>
  </div>

  <div id="status" class="status"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = {
      prLink: "",
      canPublish: false,
      publishArmed: false,
      progressLines: 0,
      copilotModels: [],
      selectedCopilotModelId: "mock"
    };
    const els = {
      prLink: document.getElementById("prLink"),
      copilotModel: document.getElementById("copilotModel"),
      refreshModelsBtn: document.getElementById("refreshModelsBtn"),
      modelStatus: document.getElementById("modelStatus"),
      draft: document.getElementById("draft"),
      reviewBtn: document.getElementById("reviewBtn"),
      publishBtn: document.getElementById("publishBtn"),
      progress: document.getElementById("progress"),
      status: document.getElementById("status")
    };
    const maxProgressLines = 200;
    const publishDefaultLabel = "Publish";
    const publishConfirmLabel = "Click again to confirm publish";
    const mockModelId = "mock";
    const mockModelLabel = "Mock (default)";

    function setStatus(text, cls) {
      els.status.textContent = text || "";
      els.status.className = "status" + (cls ? " " + cls : "");
    }

    function setModelStatus(text, cls) {
      els.modelStatus.textContent = text || "";
      els.modelStatus.className = "status" + (cls ? " " + cls : "");
    }

    function setPublishEnabled(enabled) {
      state.canPublish = Boolean(enabled);
      if (!state.canPublish) {
        state.publishArmed = false;
      }
      syncPublishButton();
    }

    function syncPublishButton() {
      const disabled = !state.canPublish;
      els.publishBtn.disabled = disabled;
      els.publishBtn.setAttribute("aria-disabled", String(disabled));
      els.publishBtn.textContent = state.publishArmed ? publishConfirmLabel : publishDefaultLabel;
      els.publishBtn.classList.remove("publish-ready", "publish-confirm");
      if (!disabled) {
        els.publishBtn.classList.add(state.publishArmed ? "publish-confirm" : "publish-ready");
      }
    }

    function clearProgress() {
      els.progress.textContent = "";
      state.progressLines = 0;
    }

    function appendProgress(text, tone) {
      if (!text) return;
      const line = document.createElement("div");
      line.className = "progress-line tone-" + (tone || "info");
      const stamp = new Date().toLocaleTimeString("en-US", { hour12: false });
      line.textContent = "[" + stamp + "] " + text;
      els.progress.appendChild(line);
      state.progressLines += 1;

      while (state.progressLines > maxProgressLines && els.progress.firstChild) {
        els.progress.removeChild(els.progress.firstChild);
        state.progressLines -= 1;
      }

      els.progress.scrollTop = els.progress.scrollHeight;
    }

    function setCopilotModelLoading(loading) {
      els.copilotModel.disabled = Boolean(loading);
      els.refreshModelsBtn.disabled = Boolean(loading);
      els.refreshModelsBtn.setAttribute("aria-disabled", String(Boolean(loading)));
      if (loading) {
        els.refreshModelsBtn.textContent = "Loading...";
      } else {
        els.refreshModelsBtn.textContent = "Refresh Models";
      }
    }

    function appendModelOption(id, label, title) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      if (title) {
        option.title = title;
      }
      els.copilotModel.appendChild(option);
      return option;
    }

    function setSelectedModelStatus() {
      if (state.selectedCopilotModelId === mockModelId) {
        setModelStatus("Selected: " + mockModelLabel + " | available=" + state.copilotModels.length, "ok");
        return;
      }
      const selected = state.copilotModels.find((m) => m.id === state.selectedCopilotModelId);
      if (selected) {
        setModelStatus("Selected: " + selected.label + " | available=" + state.copilotModels.length, "ok");
        return;
      }
      setModelStatus("Selected model unavailable. Falling back to mock.", "warn");
    }

    function renderCopilotModels(models, error) {
      const previous = state.selectedCopilotModelId;
      state.copilotModels = Array.isArray(models) ? models : [];
      els.copilotModel.innerHTML = "";
      appendModelOption(mockModelId, mockModelLabel, "Use built-in mock LLM provider");

      if (!state.copilotModels.length) {
        state.selectedCopilotModelId = mockModelId;
        els.copilotModel.value = mockModelId;
        setModelStatus(
          error
            ? "Selected: " + mockModelLabel + " | Copilot unavailable (" + error + ")"
            : "Selected: " + mockModelLabel + " | no Copilot models found",
          error ? "warn" : "ok"
        );
        return;
      }

      for (const model of state.copilotModels) {
        appendModelOption(
          model.id || "",
          model.label || model.id || "unknown model",
          model.reasoningEffort ? "Reasoning effort: " + model.reasoningEffort : ""
        );
      }

      const resolved =
        (previous === mockModelId ? mockModelId : "") ||
        state.copilotModels.find((m) => m.id === previous)?.id ||
        mockModelId;
      els.copilotModel.value = resolved;
      state.selectedCopilotModelId = resolved;
      setSelectedModelStatus();
    }

    function requestCopilotModels() {
      setCopilotModelLoading(true);
      setModelStatus("Loading Copilot models...", "");
      vscode.postMessage({
        type: "list-copilot-models",
        payload: {}
      });
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

    function toneFromEvent(event) {
      if (!event || typeof event !== "object") {
        return "info";
      }
      if (event.name === "step_started") return "step";
      if (event.name === "step_succeeded") return "success";
      if (event.name === "pipeline_completed") return "success";
      if (event.name === "review-completed") return "success";
      if (event.name === "publish-completed") return "success";
      if (event.name === "degraded") return "warn";
      if (event.name === "step_failed") return "error";
      if (event.name === "pipeline_failed") return "error";
      if (event.name === "review-failed") return "error";
      if (event.name === "llm_prompt" || event.name === "llm_response") return "llm";
      if (event.name === "llm_error") return "error";
      return "info";
    }

    function runReview() {
      const prLink = (els.prLink.value || "").trim();
      state.prLink = prLink;
      setPublishEnabled(false);
      clearProgress();
      appendProgress("Starting review request...", "info");
      setStatus("Running review...", "");
      vscode.postMessage({
        type: "start-review",
        payload: {
          prLink,
          copilotModelId: state.selectedCopilotModelId || undefined
        }
      });
    }

    function publish() {
      if (!state.prLink) {
        appendProgress("Run review first.", "error");
        setStatus("Run review first.", "error");
        return;
      }
      if (!state.canPublish) {
        appendProgress("No draft available to publish.", "error");
        setStatus("No draft available to publish.", "error");
        return;
      }
      if (!state.publishArmed) {
        state.publishArmed = true;
        syncPublishButton();
        appendProgress("Publish armed. Click again to confirm.", "warn");
        setStatus("Click publish again to confirm.", "warn");
        return;
      }
      state.publishArmed = false;
      syncPublishButton();
      setPublishEnabled(false);
      appendProgress("Publishing edited comment...", "step");
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
    els.refreshModelsBtn.addEventListener("click", requestCopilotModels);
    els.copilotModel.addEventListener("change", () => {
      state.selectedCopilotModelId = (els.copilotModel.value || "").trim();
      setSelectedModelStatus();
    });
    els.draft.addEventListener("input", () => {
      if (state.publishArmed) {
        state.publishArmed = false;
        syncPublishButton();
      }
    });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (!message || !message.type) return;

      if (message.type === "review-completed") {
        setPublishEnabled(true);
        const markdown = message.payload?.draft?.markdown || "";
        els.draft.value = markdown;
        appendProgress("Review completed.", "success");
        setStatus("Review completed.", "ok");
      } else if (message.type === "review-progress") {
        const detail = message.payload?.text || "";
        const event = message.payload?.event;
        appendProgress(detail, toneFromEvent(event));
        setStatus(toProgressSummary(event, detail), "");
      } else if (message.type === "publish-completed") {
        setPublishEnabled(true);
        appendProgress("Published: " + (message.payload?.commentUrl || ""), "success");
        setStatus("Published: " + (message.payload?.commentUrl || ""), "ok");
      } else if (message.type === "review-failed") {
        setPublishEnabled(false);
        const errorMessage = message.payload?.message || "Request failed.";
        appendProgress(errorMessage, "error");
        setStatus(errorMessage, "error");
      } else if (message.type === "copilot-models") {
        setCopilotModelLoading(false);
        renderCopilotModels(message.payload?.models || [], message.payload?.error || "");
        if (message.payload?.error) {
          appendProgress("Copilot model list failed: " + message.payload.error, "warn");
        } else {
          appendProgress("Loaded Copilot models: " + String((message.payload?.models || []).length), "info");
        }
      }
    });

    setPublishEnabled(false);
    requestCopilotModels();
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
