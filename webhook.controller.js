const { extractChangedLines } = require("./diff");
const { fetchFileLines } = require("./files");
const fs = require("fs");
const path = require("path");

const LLM_PROVIDER = process.env.LLM_PROVIDER || "google";
const MODEL = process.env.MODEL || "gemini-2.5-flash";
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "2500", 10);
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || "0.2");
const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, "prompts", "review.md"), "utf8");

async function getInstallationOctokit(installationId) {
  const { createAppAuth } = await import("@octokit/auth-app");
  const { Octokit } = await import("@octokit/rest");
  const fs = await import("fs");
  const auth = createAppAuth({
    appId: Number(process.env.GITHUB_APP_ID),
    privateKey: fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY).toString().replace(/\\n/g, "\n"),
    clientId: process.env.APP_CLIENT_ID,
    clientSecret: process.env.APP_CLIENT_SECRET,
  });

  // returns { token, expiresAt, ... }
  const installationAuth = await auth({ type: "installation", installationId: Number(installationId) });

  const octokit = new Octokit({ auth: installationAuth.token });
  return octokit;
}

const handlePullRequest = async (payload) => {
  try {
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pull_number = payload.pull_request.number;
    const installationId = payload.installation?.id; // IMPORTANT for App auth
    const headSha = payload.pull_request.head.sha; // for file content at PR head
    const octokit = await getInstallationOctokit(installationId);

    const filesResp = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });

    const files = filesResp.data;

    console.log(`Files changed: ${files.length}`);

    const reviewUnits = await generateReviewUnits(octokit, owner, repo, files, headSha);

    console.log("Review units:", reviewUnits);

    const context = {
      repo: `${owner}/${repo}`,
      files: reviewUnits,
    };

    const userContent = JSON.stringify(context, null, 2);

    // Call LLM to get AI response
    const { callLLM } = require("./llm");
    const review = await callLLM({
      provider: LLM_PROVIDER,
      model: MODEL,
      system: SYSTEM_PROMPT,
      user: userContent,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    console.log("AI Review:", review);

    // TODO: Post comments to the PR
  } catch (error) {
    console.error("Error handling pull request:", error);
  }
};

const generateReviewUnits = async (octokit, owner, repo, files, headSha) => {
  const reviewUnits = [];

  for (const file of files) {
    if (!file.patch) continue;

    const changedLines = extractChangedLines(file.patch);

    const fileLines = await fetchFileLines(octokit, owner, repo, file.filename, headSha);

    const hunks = changedLines.map((ch) => {
      const L = ch.line;

      const context = fileLines.slice(Math.max(0, L - 6), Math.min(fileLines.length, L + 5)).join("\n");

      return {
        file: file.filename,
        line: L,
        changed: ch.content,
        context,
      };
    });

    if (hunks.length > 0) {
      reviewUnits.push({
        file: file.filename,
        language: file.filename.split(".").pop(),
        hunks,
      });
    }
  }
  return reviewUnits;
};

module.exports = {
  handlePullRequest,
};
