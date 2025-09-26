const { minimatch } = require("minimatch");

function chunkText(text, limit) {
  if (text.length <= limit) return text;
  return text.slice(0, limit);
}

// Check file is text file or not
function isTextFile(filename) {
  const textExt = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".json",
    ".mjs",
    ".cjs",
    ".py",
    ".rb",
    ".go",
    ".java",
    ".kt",
    ".cs",
    ".php",
    ".rs",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".md",
    ".yml",
    ".yaml",
    ".sql",
    ".sh",
    ".toml",
    ".ini",
  ];
  return textExt.some((ext) => filename.endsWith(ext));
}

function pickFiles(files, globs) {
  let count = 0;
  if (!globs || !globs.length) return files;
  const res = [];
  for (const f of files) {
    if (globs.some((g) => minimatch(f, g))) res.push(f);
  }
  console.log("pickFiles ====>", JSON.stringify(res));
  return res;
}

function countFiles(files, globs) {
  throw new Error("Not implemented");
  let count = 0;
  if (!globs || !globs.length) return files;
  for (const f of files) {
    if (globs.some((g) => minimatch(f, g))) count++;
  }
  console.log("countFiles ====>", count);
  return count;
}

module.exports = { chunkText, isTextFile, pickFiles, countFiles };
