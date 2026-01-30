const parse = require("parse-diff");

function extractChangedLines(patch) {
  const parsed = parse(patch);
  const lines = [];

  parsed.forEach((file) => {
    file.chunks.forEach((chunk) => {
      let newLine = chunk.newStart;

      chunk.changes.forEach((change) => {
        if (change.type === "add") {
          lines.push({
            line: newLine,
            content: change.content.slice(1),
          });
          newLine++;
        } else if (change.type === "normal") {
          newLine++;
        }
      });
    });
  });

  return lines;
}

module.exports = {
  extractChangedLines,
};
