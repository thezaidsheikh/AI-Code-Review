const { extractChangedLines } = require("../helper/diff");
const { fetchFileLines } = require("../helper/files");

// Get installation octokit for App auth
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

const fetchPRFiles = async (octokit, owner, repo, pull_number) => {
  try {
    const filesResp = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });
    return filesResp.data;
  } catch (error) {
    throw new Error(error.message);
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
  getInstallationOctokit,
  fetchPRFiles,
  generateReviewUnits,
};
