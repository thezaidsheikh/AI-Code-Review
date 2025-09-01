// Import required modules
const fs = require("fs");
const path = require("path");
const { chunkText, isTextFile, pickFiles } = require("./util");

// Get environment variables
const GH_EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const GH_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GH_TOKEN = process.env.GITHUB_TOKEN;
const LLM_PROVIDER = process.env.LLM_PROVIDER || "google";
const MODEL = process.env.MODEL || "gemini-2.5-flash";
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "2500", 10);
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || "0.2");
const FILE_GLOBS = (process.env.FILE_GLOBS || "")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

// Main function
async function main() {
  const { Octokit } = await import("@octokit/rest");

  console.log("Starting AI PR review in main ...");

  if (!GH_EVENT_PATH || !GH_TOKEN || !GH_REPOSITORY) {
    throw new Error("Missing required GitHub env (GITHUB_EVENT_PATH, GITHUB_TOKEN, GITHUB_REPOSITORY).");
  }

  const event = JSON.parse(fs.readFileSync(GH_EVENT_PATH, "utf8"));
  const { number: pull_number } = event.pull_request || {};
  if (!pull_number) throw new Error("This workflow must run on pull_request events.");

  const [owner, repo] = GH_REPOSITORY.split("/");
  const octokit = new Octokit({ auth: GH_TOKEN });

  console.log("GH_EVENT_PATH: ", GH_EVENT_PATH);
  console.log("GH_TOKEN: ", GH_TOKEN);
  console.log("GH_REPOSITORY: ", GH_REPOSITORY);
  console.log("LLM_PROVIDER: ", LLM_PROVIDER);
  console.log("MODEL: ", MODEL);
  console.log("MAX_TOKENS: ", MAX_TOKENS);
  console.log("TEMPERATURE: ", TEMPERATURE);
  console.log("FILE_GLOBS: ", FILE_GLOBS);
  console.log("owner: ", owner);
  console.log("repo: ", repo);
  console.log("pull_number: ", pull_number);

  // Get PR metadata
  const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number });

  // Get changed files (with patches)
  const files = await octokit.paginate(octokit.pulls.listFiles, { owner, repo, pull_number, per_page: 100 });

  // Select files to review (by type + glob)
  const selected = files.filter((f) => isTextFile(f.filename) && (!FILE_GLOBS.length || pickFiles([f.filename], FILE_GLOBS).length));

  // Build prompt input from patches (unified diff). Limit total size.
  const DIFF_LIMIT_CHARS = 120_000; // guardrail for token/cost
  let total = 0;
  const diffs = [];
  for (const f of selected) {
    console.log(`Extracting diff for file ${f.filename} =====>`, JSON.stringify(f));
    if (!f.patch) continue; // binary or too large
    const chunk = `FILE: ${f.filename}\nSTATUS: ${f.status} additions:${f.additions} deletions:${f.deletions}\n---PATCH BEGIN---\n${f.patch}\n---PATCH END---`;
    if (total + chunk.length > DIFF_LIMIT_CHARS) continue;
    diffs.push(chunk);
    total += chunk.length;
  }

  if (!diffs.length) {
    console.error("❌ No textual diffs to review. Exiting.");
    return;
  }

  // Load rubric + system guardrails
  const rubric = fs.readFileSync(path.join(__dirname, "..", "prompts", "rubric.md"), "utf8");
  const system = fs.readFileSync(path.join(__dirname, "..", "prompts", "system.md"), "utf8");

  const input = [
    `PR #${pull_number}: ${pr.title}`,
    `Author: ${pr.user && pr.user.login}`,
    `Base: ${pr.base && pr.base.ref}  ->  Head: ${pr.head && pr.head.ref}`,
    pr.body ? `\nPR DESCRIPTION:\n${pr.body}\n` : "",
    `\nRUBRIC:\n${rubric}\n`,
    `\nDIFFS (unified):\n${chunkText(diffs.join("\n\n"), 100_000)}`,
  ].join("\n");

  const { callLLM } = require("./llm");
  const review = await callLLM({
    provider: LLM_PROVIDER,
    model: MODEL,
    system,
    user: input,
    maxTokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  });

  // Post a PR review (general comment). Inline suggestions are an advanced follow-up.
  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    event: "COMMENT",
    body: review.trim().slice(0, 65_000), // server-side guardrail
  });

  console.log("✅ AI review posted.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
