const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const PORT = process.env.PORT || 3002;

app.get("/check-health", (req, res) => {
  res.send("Server is up 🆙 and running 🏃");
});

app.post("/webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  if (event === "pull_request") {
    await handlePullRequest(req.body);
  }
  res.sendStatus(200);
});

app.listen(3002, "0.0.0.0", (err) => {
  if (err) throw err;
  console.log(`Server running at http://localhost:${PORT}/`);
});
