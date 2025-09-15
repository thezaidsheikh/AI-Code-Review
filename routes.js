const express = require("express");
const router = express.Router();

router.post("/review", (req, res) => {
  res.send("Hello from review endpoint");
});

module.exports = router;
