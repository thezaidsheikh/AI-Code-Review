const fs = require("fs");
const path = require("path");
const { getInstallationOctokit, fetchPRFiles, generateReviewUnits } = require("../utils/octakit");

const LLM_PROVIDER = process.env.LLM_PROVIDER || "google";
const MODEL = process.env.MODEL || "gemini-2.5-flash";
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "2500", 10);
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || "0.2");
const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, "..", "prompts", "review.md"), "utf8");
const RUBRIC = fs.readFileSync(path.join(__dirname, "..", "prompts", "rubric.md"), "utf8");
const COMMENT_TEMPLATE = fs.readFileSync(path.join(__dirname, "..", "prompts", "comment-template.md"), "utf8");

// Handle pull request
const handlePullRequest = async (payload) => {
  try {
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pull_number = payload.pull_request.number;
    const installationId = payload.installation?.id; // IMPORTANT for App auth
    const headSha = payload.pull_request.head.sha; // for file content at PR head
    const action = payload.action;

    // Skip non-actionable PR events
    if (["opened", "synchronize", "reopened"].includes(payload.action) === false) {
      console.log("Skipping PR action:", action);
      return;
    }
    console.log("Processing PR action:", action);

    const octokit = await getInstallationOctokit(installationId);

    const files = await fetchPRFiles(octokit, owner, repo, pull_number);

    const reviewUnits = await generateReviewUnits(octokit, owner, repo, files, headSha);

    const context = {
      repo: `${owner}/${repo}`,
      files: reviewUnits,
      RUBRIC,
      COMMENT_TEMPLATE,
    };

    const userContent = JSON.stringify(context, null, 2);

    // Call LLM to get AI response
    const { callLLM } = require("../helper/llm");
    const review = await callLLM({
      provider: LLM_PROVIDER,
      model: MODEL,
      system: SYSTEM_PROMPT,
      user: userContent,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    // Validate LLM response structure
    if (!review || !review.decision || !review.comments) {
      console.log("No review generated");
      return;
    }

    // Create commit status to prevent merging
    await octokit.repos.createCommitStatus({
      owner,
      repo,
      sha: headSha,
      state: review.decision !== "APPROVE" ? "failure" : "success",
      context: "ai-pr-review",
      description: review.decision === "APPROVE" ? "AI review passed" : "AI review requested changes",
      target_url: payload.pull_request.html_url, // optional UI
    });

    if (review.comments.length == 0) {
      // Request changes if AI review is not approved
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        event: review.decision,
        body: "Automated review: no actionable issues found.",
      });
    } else {
      // Create review with comments
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        event: review.decision,
        comments: review.comments.map((c) => ({
          path: c.path,
          line: c.line,
          side: "RIGHT",
          body: c.comment,
        })),
      });
    }

    return {
      success: true,
      review,
    };
  } catch (error) {
    console.error("Error handling pull request:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  handlePullRequest,
};
