import { HttpError, textToBase64, bytesToBase64 } from "./util.js";
import { assertSafePath } from "./paths.js";

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "koltigin-admin-api",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function safeGitHubMessage(status) {
  if (status === 409 || status === 422) return "GitHub reported a conflict. Reload and try again.";
  if (status === 401 || status === 403) return "GitHub rejected the publisher credential.";
  if (status === 404) return "Repository path was not found.";
  return "GitHub publish failed.";
}

export class MockGitHub {
  constructor(files = {}) {
    this.files = new Map(Object.entries(files));
    this.commits = [];
    this.sha = "sha0";
  }

  listPaths() {
    return [...this.files.keys()];
  }

  async getText(path) {
    const value = this.files.get(path);
    if (value == null) throw new HttpError(404, "File not found");
    return typeof value === "string" ? value : new TextDecoder().decode(value);
  }

  async getBytes(path) {
    const value = this.files.get(path);
    if (value == null) throw new HttpError(404, "File not found");
    return typeof value === "string" ? new TextEncoder().encode(value) : value;
  }

  async exists(path) {
    return this.files.has(path);
  }

  async listPrefix(prefix) {
    return this.listPaths().filter((path) => path === prefix || path.startsWith(prefix));
  }

  async commit({ message, upserts = [], deletes = [] }) {
    if (this.failCommit) {
      throw new HttpError(409, "GitHub reported a conflict. Reload and try again.");
    }
    for (const item of upserts) {
      assertSafePath(item.path);
      this.files.set(item.path, item.bytes ? item.bytes : item.text);
    }
    for (const path of deletes) {
      assertSafePath(path);
      this.files.delete(path);
    }
    this.sha = `sha${this.commits.length + 1}`;
    this.commits.push({ message, sha: this.sha, upserts: upserts.map((item) => item.path), deletes });
    return { sha: this.sha, message };
  }
}

export class GitHubClient {
  constructor(env) {
    this.env = env;
    this.owner = env.GITHUB_OWNER || "koltigin";
    this.repo = env.GITHUB_REPO || "KolTigin-Website";
    this.branch = env.GITHUB_BRANCH || "main";
    this.token = env.GITHUB_TOKEN;
    this.base = `https://api.github.com/repos/${this.owner}/${this.repo}`;
  }

  async api(path, options = {}) {
    if (!this.token) throw new HttpError(500, "Publisher is not configured");
    const response = await fetch(`${this.base}${path}`, {
      ...options,
      headers: { ...ghHeaders(this.token), ...(options.headers || {}) }
    });
    if (response.status === 404) throw new HttpError(404, "File not found");
    if (!response.ok) {
      throw new HttpError(response.status === 409 || response.status === 422 ? 409 : 502, safeGitHubMessage(response.status));
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async getText(path) {
    const data = await this.api(`/contents/${path}?ref=${encodeURIComponent(this.branch)}`);
    if (!data || !data.content) throw new HttpError(404, "File not found");
    const binary = atob(String(data.content).replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async exists(path) {
    try {
      await this.api(`/contents/${path}?ref=${encodeURIComponent(this.branch)}`);
      return true;
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return false;
      throw error;
    }
  }

  async listPrefix(prefix) {
    const ref = await this.api(`/git/ref/heads/${this.branch}`);
    const commit = await this.api(`/git/commits/${ref.object.sha}`);
    const tree = await this.api(`/git/trees/${commit.tree.sha}?recursive=1`);
    return (tree.tree || [])
      .filter((item) => item.type === "blob" && (item.path === prefix || item.path.startsWith(prefix)))
      .map((item) => item.path);
  }

  async commit({ message, upserts = [], deletes = [] }) {
    const ref = await this.api(`/git/ref/heads/${this.branch}`);
    const parent = ref.object.sha;
    const commit = await this.api(`/git/commits/${parent}`);
    const treeItems = [];
    for (const item of upserts) {
      assertSafePath(item.path);
      const content = item.bytes ? bytesToBase64(item.bytes) : textToBase64(item.text);
      const blob = await this.api("/git/blobs", {
        method: "POST",
        body: JSON.stringify({ content, encoding: "base64" })
      });
      treeItems.push({ path: item.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    for (const path of deletes) {
      assertSafePath(path);
      treeItems.push({ path, mode: "100644", type: "blob", sha: null });
    }
    const tree = await this.api("/git/trees", {
      method: "POST",
      body: JSON.stringify({ base_tree: commit.tree.sha, tree: treeItems })
    });
    const created = await this.api("/git/commits", {
      method: "POST",
      body: JSON.stringify({ message, tree: tree.sha, parents: [parent] })
    });
    const latest = await this.api(`/git/ref/heads/${this.branch}`);
    if (!latest?.object?.sha || latest.object.sha !== parent) {
      throw new HttpError(409, "GitHub reported a conflict. Reload and try again.");
    }
    try {
      await this.api(`/git/refs/heads/${this.branch}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: created.sha, force: false })
      });
    } catch (error) {
      throw new HttpError(409, "GitHub reported a conflict. Reload and try again.");
    }
    return { sha: created.sha, message };
  }
}

export function createGitHub(env) {
  if (env.TEST_MODE === "1" || env.github) return env.github || new MockGitHub(env.files || {});
  return new GitHubClient(env);
}
