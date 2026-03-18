const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const root = "/Users/admin/Downloads";
const defaultFile = "design-97d6a0c3-c41c-4d11-ba6a-e3ccf26c52d4.html";
const port = 2998;
const host = "127.0.0.1";
const weatherUrl =
  "https://api.open-meteo.com/v1/forecast?latitude=-34.83&longitude=-54.63&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto";
const imageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif"
]);
const audioExtensions = new Set([
  ".mp4",
  ".m4a",
  ".mp3",
  ".wav",
  ".aac",
  ".mov"
]);

const types = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webp": "image/webp"
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": contentType
  });
  res.end(body);
}

function sendFile(req, res, filePath) {
  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      send(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = types[ext] || "application/octet-stream";
    const rangeHeader = req.headers.range;

    if (!rangeHeader) {
      res.writeHead(200, {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "Content-Length": stats.size,
        "Content-Type": contentType
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) {
      res.writeHead(416, {
        "Content-Range": `bytes */${stats.size}`
      });
      res.end();
      return;
    }

    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : stats.size - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stats.size) {
      res.writeHead(416, {
        "Content-Range": `bytes */${stats.size}`
      });
      res.end();
      return;
    }

    end = Math.min(end, stats.size - 1);

    res.writeHead(206, {
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      "Content-Type": contentType
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  });
}

function safeResolve(base, targetPath) {
  const resolved = path.resolve(base, targetPath);
  return resolved.startsWith(base) ? resolved : null;
}

function listFolderFiles(folder, extensions) {
  const folderPath = safeResolve(root, folder);
  if (!folderPath) {
    return null;
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => extensions.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `${folder}/${name}`);
}

function listGalleryImages(folder) {
  return listFolderFiles(folder, imageExtensions);
}

function listGalleryAudio(folder) {
  const files = listFolderFiles(folder, audioExtensions);
  if (!files) {
    return null;
  }

  return files.sort((a, b) => {
    const aName = path.basename(a).toLowerCase();
    const bName = path.basename(b).toLowerCase();
    const aPriority = aName.startsWith("img_") ? 0 : 1;
    const bPriority = bName.startsWith("img_") ? 0 : 1;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return aName.localeCompare(bName);
  });
}

function weatherLabel(code) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Conditions changing";
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${host}:${port}`);

    if (url.pathname === "/__gallery.json") {
      const folder = url.searchParams.get("folder") || "";

      try {
        const images = listGalleryImages(folder);
        if (!images) {
          send(res, 400, JSON.stringify({ error: "Invalid folder" }), types[".json"]);
          return;
        }
        send(res, 200, JSON.stringify({ images }), types[".json"]);
      } catch (error) {
        send(res, 404, JSON.stringify({ error: "Folder not found" }), types[".json"]);
      }
      return;
    }

    if (url.pathname === "/__weather.json") {
      try {
        const response = await fetch(weatherUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Weather request failed with ${response.status}`);
        }

        const data = await response.json();
        const current = data.current;
        const payload = {
          location: "Jose Ignacio, Uruguay",
          temperatureC: current.temperature_2m,
          windKmh: current.wind_speed_10m,
          weatherCode: current.weather_code,
          isDay: current.is_day === 1,
          summary: weatherLabel(current.weather_code),
          time: current.time
        };

        send(res, 200, JSON.stringify(payload), types[".json"]);
      } catch (error) {
        send(res, 502, JSON.stringify({ error: "Weather unavailable" }), types[".json"]);
      }
      return;
    }

    if (url.pathname === "/__audio.json") {
      const folder = url.searchParams.get("folder") || "";

      try {
        const files = listGalleryAudio(folder);
        if (!files) {
          send(res, 400, JSON.stringify({ error: "Invalid folder" }), types[".json"]);
          return;
        }
        send(res, 200, JSON.stringify({ files }), types[".json"]);
      } catch (error) {
        send(res, 404, JSON.stringify({ error: "Folder not found" }), types[".json"]);
      }
      return;
    }

    const requestPath = decodeURIComponent(url.pathname);
    const relativePath = requestPath === "/" ? defaultFile : requestPath.replace(/^\/+/, "");
    const filePath = safeResolve(root, relativePath);

    if (!filePath) {
      send(res, 403, "Forbidden");
      return;
    }

    sendFile(req, res, filePath);
  })
  .listen(port, host, () => {
    console.log(`Serving ${root} at http://${host}:${port}`);
  });
