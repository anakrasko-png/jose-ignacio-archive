const fs = require("fs");
const path = require("path");

const root = path.join(process.cwd());
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

function safeResolve(base, targetPath) {
  const resolved = path.resolve(base, targetPath);
  return resolved.startsWith(base) ? resolved : null;
}

module.exports = (req, res) => {
  const folder = typeof req.query.folder === "string" ? req.query.folder : "";
  const folderPath = safeResolve(root, folder);

  if (!folderPath) {
    res.status(400).json({ error: "Invalid folder" });
    return;
  }

  try {
    const files = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => imageExtensions.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `${folder}/${name}`);

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ images: files });
  } catch (error) {
    res.status(404).json({ error: "Folder not found" });
  }
};
