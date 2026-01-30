const base64 = require("base-64");

async function fetchFileLines(octokit, owner, repo, path, ref) {
  const resp = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });

  const decoded = base64.decode(resp.data.content);
  return decoded.split("\n");
}

module.exports = {
  fetchFileLines,
};
