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
  try {
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
    console.log("GH_REPOSITORY: ", GH_REPOSITORY);
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

    // Extract diffs for selected files
    for (const f of selected) {
      const diff = JSON.stringify(f);
      console.log(`Extracting diff for file ${f.filename} =====>`, diff);
      if (!f.patch) continue; // binary or too large
      const chunk = `FILE: ${f.filename}\nSTATUS: ${f.status} additions:${f.additions} deletions:${f.deletions}\nDIFF: \n${diff}`;
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

    // Call LLM to get AI review
    const { callLLM } = require("./llm");

    // Call LLM to get AI review
    const review = await callLLM({
      provider: LLM_PROVIDER,
      model: MODEL,
      system,
      user: input,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    let count = 0;

    // Process AI response and post review
    await processAIResponseAndPostReview(octokit, owner, repo, pull_number, review, selected.length);
  } catch (error) {
    console.error("Error in main:", error);
    process.exit(1);
  }
}

// Main function to handle AI response and post GitHub review
async function processAIResponseAndPostReview(octokit, owner, repo, pull_number, aiResponse, selectedFilesCount) {
  try {
    // Parse the AI response
    const parsedComments = cleanAndParseAIResponse(aiResponse);

    // Convert to GitHub comment format
    const githubComments = convertToGitHubComments(parsedComments);
    console.log("githubComments length =====>", githubComments.length);

    // Post PR review with inline comments
    if (githubComments.length > 0) {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        event: "COMMENT",
        body: `AI-generated code review for ${selectedFilesCount} file(s).`,
        comments: githubComments,
      });

      console.log(`✅ AI review posted with ${githubComments.length} file-specific comments.`);
      return { success: true, type: "inline", commentCount: githubComments.length };
    } else {
      console.log("⚠️ No valid comments generated, posting general review.");
      return await postGeneralReview(octokit, owner, repo, pull_number, aiResponse, "No valid comments generated");
    }
  } catch (parseError) {
    console.error("Failed to parse AI response:", parseError.message);
    console.log("Raw AI response:", aiResponse);

    return await postGeneralReview(octokit, owner, repo, pull_number, aiResponse, "JSON parsing failed");
  }
}

// Helper function to post general review as fallback
async function postGeneralReview(octokit, owner, repo, pull_number, aiResponse, reason) {
  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    event: "COMMENT",
    body: `AI Code Review:\n\n${aiResponse.trim().slice(0, 65000)}`,
  });

  console.log(`✅ AI review posted as general comment (fallback: ${reason}).`);
  return { success: true, type: "general", reason };
}

// Helper function to clean and parse AI response
function cleanAndParseAIResponse(aiResponse) {
  let cleanedResponse = aiResponse.trim();

  // Remove markdown code block formatting if present
  if (cleanedResponse.startsWith("```json")) {
    cleanedResponse = cleanedResponse.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleanedResponse.startsWith("```")) {
    cleanedResponse = cleanedResponse.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  return JSON.parse(cleanedResponse);
}

// Helper function to convert AI comments to GitHub format
function convertToGitHubComments(aiComments) {
  if (!Array.isArray(aiComments)) {
    throw new Error("AI response is not an array");
  }

  const githubComments = [];

  for (const fileObject of aiComments) {
    if (!fileObject.fileName || !fileObject.comments || !Array.isArray(fileObject.comments)) {
      console.error("Invalid file object structure:", fileObject);
      continue;
    }

    const path = fileObject.fileName;
    const commentsArray = fileObject.comments;

    for (const comment of commentsArray) {
      if (comment.absolutePosition === undefined || comment.value === undefined) {
        console.error("Invalid comment object structure:", comment);
        continue;
      }

      githubComments.push({
        path: path,
        position: parseInt(comment.absolutePosition),
        body: comment.value,
      });
    }
  }

  return githubComments;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
