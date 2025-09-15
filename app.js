const express = require("express");
const app = express();
const port = 3200;

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.use("/api", require("./routes"));

app.listen(port, (err) => {
  if (err) throw err;
  console.log(`Server running at http://localhost:${port}/`);
});
