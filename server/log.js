// One JSON object per line, so a host's log viewer (Render, Railway…) can
// search and filter them. Never pass secrets, cookies or request bodies.
function log(level, fields) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

module.exports = { log };
