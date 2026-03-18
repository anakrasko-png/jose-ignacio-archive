const fs = require("fs");
const path = require("path");

const root = path.join(process.cwd());
const audioExtensions = new Set([".mp4", ".mov", ".m4a", ".mp3", ".wav", ".aac"]);

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
      .filter((name) => audioExtensions.has(path.extname(name).toLowerCase()))
      .sort((a, b) => {
        const aName = a.toLowerCase();
        const bName = b.toLowerCase();
        const aPriority = aName.startsWith("img_") ? 0 : 1;
        const bPriority = bName.startsWith("img_") ? 0 : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return aName.localeCompare(bName);
      })
      .map((name) => `${folder}/${name}`);

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ files });
  } catch (error) {
    res.status(404).json({ error: "Folder not found" });
  }
};
