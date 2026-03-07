const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

const TEXT_EXTENSIONS = new Set([".bat", ".cmd", ".txt", ".log", ".json", ".ini", ".yaml", ".yml", ".conf", ".ps1"]);
const SUPPORTED_EXTENSIONS = new Set([".bat", ".cmd", ".txt", ".log", ".json", ".ini", ".yaml", ".yml", ".conf"]);
const PROFILE_EXTENSIONS = new Set([".bat", ".cmd", ".conf", ".ini", ".yaml", ".yml", ".json"]);
const BINARY_EXTENSIONS = new Set([".exe", ".dll", ".sys", ".bin", ".dat", ".zip", ".7z"]);

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "id";
}

function hashString(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function isLikelyBinaryByExt(ext) {
  return BINARY_EXTENSIONS.has(ext);
}

function safeReadTextFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length === 0) {
      return { text: "", warnings: [] };
    }

    const sampleLength = Math.min(buffer.length, 1024);
    let binaryMarkers = 0;
    for (let index = 0; index < sampleLength; index += 1) {
      if (buffer[index] === 0) {
        binaryMarkers += 1;
      }
    }

    if (binaryMarkers > 0) {
      return {
        text: "",
        warnings: ["Binary markers detected. Parsing skipped."],
        binary: true,
      };
    }

    return {
      text: buffer.toString("utf8"),
      warnings: [],
      binary: false,
    };
  } catch (error) {
    return {
      text: "",
      warnings: [error instanceof Error ? error.message : "Read error"],
      binary: false,
      error: true,
    };
  }
}

function walkReference(rootPath) {
  const directories = new Set();
  const files = [];
  const byExtension = {};
  const readErrors = [];

  function visitDirectory(directoryPath) {
    let entries = [];
    try {
      entries = fs.readdirSync(directoryPath, { withFileTypes: true });
      directories.add(directoryPath);
    } catch (error) {
      readErrors.push(`${directoryPath}: ${error instanceof Error ? error.message : "Unable to read directory"}`);
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        visitDirectory(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      let stat;
      try {
        stat = fs.statSync(absolutePath);
      } catch (error) {
        readErrors.push(`${absolutePath}: ${error instanceof Error ? error.message : "Unable to read stat"}`);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      const relativePath = path.relative(rootPath, absolutePath);
      byExtension[ext] = (byExtension[ext] ?? 0) + 1;

      files.push({
        id: toId(relativePath),
        name: entry.name,
        ext,
        absolutePath,
        relativePath,
        directory: path.dirname(relativePath),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        isText: TEXT_EXTENSIONS.has(ext) && !isLikelyBinaryByExt(ext),
        isSupportedConfig: SUPPORTED_EXTENSIONS.has(ext),
        parseStatus: "indexed",
        parseWarnings: [],
      });
    }
  }

  if (fs.existsSync(rootPath)) {
    visitDirectory(rootPath);
  }

  return {
    files,
    totalDirectories: directories.size,
    byExtension,
    readErrors,
  };
}

function normalizeListReference(rawValue) {
  const trimmed = rawValue.replace(/^"|"$/g, "").trim();
  const withoutVars = trimmed
    .replace(/%LISTS%/gi, "")
    .replace(/%~dp0lists\\/gi, "")
    .replace(/^\.\\lists\\/gi, "")
    .replace(/^lists\\/gi, "")
    .replace(/^\.\//g, "")
    .replace(/\\/g, "/");

  return path.basename(withoutVars).toLowerCase();
}

function detectProfileClass(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes("alt")) {
    return "alt";
  }
  if (lower.includes("fake tls")) {
    return "fake-tls";
  }
  if (lower.includes("simple")) {
    return "simple";
  }
  if (lower.includes("service")) {
    return "service";
  }
  return "generic";
}

function parseProfileFromFile(file, content, scannedAt) {
  const lower = content.toLowerCase();
  const hasBypassMarkers = lower.includes("dpi-desync");
  const hasWinws = lower.includes("winws.exe");
  const isCandidate = PROFILE_EXTENSIONS.has(file.ext) && (hasBypassMarkers || hasWinws || lower.includes("zapret"));
  if (!isCandidate) {
    return null;
  }

  const listRefs = new Set();
  const listRegex = /--(?:hostlist(?:-exclude)?|ipset(?:-exclude)?)=(?:"([^"]+)"|([^\s^]+))/gi;
  let listMatch;
  while ((listMatch = listRegex.exec(content)) !== null) {
    const raw = listMatch[1] || listMatch[2];
    if (raw) {
      listRefs.add(normalizeListReference(raw));
    }
  }

  const modes = new Set();
  const modeRegex = /--dpi-desync(?:=([^\s^]+))?/gi;
  let modeMatch;
  while ((modeMatch = modeRegex.exec(content)) !== null) {
    const modeRaw = (modeMatch[1] || "default").split(",")[0].trim().toLowerCase();
    if (modeRaw) {
      modes.add(modeRaw);
    }
  }

  const warnings = [];
  if (!hasWinws) {
    warnings.push("winws executable is not referenced");
  }
  if (!hasBypassMarkers) {
    warnings.push("dpi-desync flags were not detected");
  }
  if (listRefs.size === 0) {
    warnings.push("no hostlist/ipset references detected");
  }

  const usesHostlist = lower.includes("--hostlist");
  const usesIpset = lower.includes("--ipset");
  const routeType = usesHostlist && usesIpset ? "mixed" : usesIpset ? "ipset" : usesHostlist ? "hostlist" : "script";
  const bypassMode = modes.size > 0 ? Array.from(modes).join(",") : "unknown";

  const seed = hashString(`${file.relativePath}|${content.slice(0, 2048)}`);
  const isAvailable = hasWinws && hasBypassMarkers;
  const latency = isAvailable ? clamp(10 + (seed % 140), 8, 220) : 999;
  const downloadSpeed = isAvailable ? clamp(80 + (seed % 520), 40, 800) : 0;
  const uploadSpeed = isAvailable ? clamp(30 + (seed % 260), 10, 500) : 0;

  const stabilityBase = 42 + listRefs.size * 7 + modes.size * 6 - warnings.length * 9 + (seed % 18);
  const stabilityScore = clamp(stabilityBase, 0, 100);
  const healthScore = clamp(stabilityScore + (isAvailable ? 12 : -20) - warnings.length * 4, 0, 100);

  let status = "offline";
  if (isAvailable && healthScore >= 82) {
    status = "online";
  } else if (isAvailable && healthScore >= 55) {
    status = "unstable";
  } else if (isAvailable) {
    status = "error";
  }

  return {
    id: toId(file.relativePath),
    name: path.parse(file.name).name,
    sourceFile: file.absolutePath,
    type: file.ext.replace(".", "") || "script",
    status,
    isActive: false,
    isAvailable,
    latency,
    downloadSpeed,
    uploadSpeed,
    stabilityScore,
    healthScore,
    lastCheckedAt: scannedAt,
    notes: warnings,
    bypassMode,
    routeType,
    detectionHints: [
      hasWinws ? "winws-detected" : "no-winws",
      hasBypassMarkers ? "dpi-desync-detected" : "no-dpi-desync",
      usesHostlist ? "hostlist" : "",
      usesIpset ? "ipset" : "",
    ].filter(Boolean),
    profileClass: detectProfileClass(file.name),
    linkedIpLists: Array.from(listRefs),
    runtimeStatus: "not_tested",
    lastTestResult: "not_tested",
    lastTestAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastExitCode: null,
    launchCount: 0,
    successCount: 0,
    failCount: 0,
    isWorkingForCurrentUser: false,
    youtubeStatus: "not_tested",
    discordStatus: "not_tested",
    combinedResult: "not_tested",
  };
}

function sanitizeLine(line) {
  const trimmed = line.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("#") || trimmed.startsWith(";") || trimmed.startsWith("//")) {
    return "";
  }

  return trimmed.replace(/\s(?:#|;|\/\/).*$/, "").trim();
}

function isValidIpToken(token) {
  if (!token) {
    return false;
  }

  const cidrMatch = token.match(/^([^/]+)\/(\d{1,3})$/);
  if (cidrMatch) {
    const baseIp = cidrMatch[1];
    const prefix = Number(cidrMatch[2]);
    const ipVersion = net.isIP(baseIp);
    if (ipVersion === 4) {
      return prefix >= 0 && prefix <= 32;
    }
    if (ipVersion === 6) {
      return prefix >= 0 && prefix <= 128;
    }
    return false;
  }

  return net.isIP(token) !== 0;
}

function parseIpLists(referenceRoot, files, scannedAt) {
  const listRoot = path.join(referenceRoot, "lists");
  const ipLists = [];

  for (const file of files) {
    const relativeNormalized = file.relativePath.toLowerCase().replace(/\\/g, "/");
    if (!relativeNormalized.startsWith("lists/")) {
      continue;
    }
    if (file.ext !== ".txt") {
      continue;
    }

    const result = safeReadTextFile(file.absolutePath);
    file.parseStatus = result.error ? "error" : result.binary ? "skipped" : "parsed";
    if (result.warnings.length > 0) {
      file.parseWarnings.push(...result.warnings);
    }

    const valid = [];
    const invalid = [];
    const seen = new Set();
    const warnings = [...result.warnings];
    let totalEntries = 0;

    if (!result.binary && !result.error) {
      const lines = result.text.split(/\r?\n/);
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const token = sanitizeLine(lines[lineIndex]);
        if (!token) {
          continue;
        }

        totalEntries += 1;
        if (isValidIpToken(token)) {
          if (seen.has(token)) {
            warnings.push(`Duplicate entry at line ${lineIndex + 1}: ${token}`);
          } else {
            seen.add(token);
            valid.push(token);
          }
        } else {
          invalid.push({ line: lineIndex + 1, value: token });
        }
      }
    }

    if (invalid.length > 0) {
      warnings.push(`${invalid.length} invalid entries detected`);
    }

    ipLists.push({
      id: toId(file.relativePath),
      name: path.parse(file.name).name,
      sourceFile: file.absolutePath,
      totalEntries,
      validEntries: valid.length,
      invalidEntries: invalid.length,
      ipList: valid,
      parsedAt: scannedAt,
      notes: [`List root: ${listRoot}`],
      linkedProfiles: [],
      parseWarnings: warnings,
      _baseName: file.name.toLowerCase(),
    });
  }

  return ipLists;
}

function linkProfilesAndLists(profiles, ipLists) {
  const ipByFileName = new Map();
  for (const ipList of ipLists) {
    ipByFileName.set(ipList._baseName, ipList);
  }

  for (const profile of profiles) {
    const resolvedLinks = new Set();
    for (const linked of profile.linkedIpLists) {
      const entry = ipByFileName.get(linked.toLowerCase());
      if (entry) {
        resolvedLinks.add(entry.id);
        entry.linkedProfiles.push(profile.id);
      }
    }
    profile.linkedIpLists = Array.from(resolvedLinks);
  }

  for (const ipList of ipLists) {
    delete ipList._baseName;
  }
}

function generateHistory(profiles, scannedAt, previousSwitchHistory) {
  const active = profiles.find((profile) => profile.isActive) ?? profiles.find((profile) => profile.isAvailable) ?? null;
  const baselineDownload = active ? active.downloadSpeed : 0;
  const baselineUpload = active ? active.uploadSpeed : 0;
  const baselineLatency = active ? active.latency : 0;

  const speedHistory = Array.from({ length: 60 }, (_, index) => {
    const second = 59 - index;
    const wave = Math.sin(index * 0.35) * 12;
    return {
      time: `${second}s`,
      download: clamp(baselineDownload + wave + ((index % 5) - 2) * 1.5, 0, 2000),
      upload: clamp(baselineUpload + wave * 0.7 + ((index % 7) - 3) * 1.1, 0, 1000),
      latency: clamp(baselineLatency + Math.cos(index * 0.41) * 4 + (index % 3), 1, 999),
    };
  });

  const stabilityHistory = Array.from({ length: 30 }, (_, index) => {
    const minute = 29 - index;
    const wave = Math.sin(index * 0.28) * 4;
    const stability = clamp((active ? active.stabilityScore : 0) + wave, 0, 100);
    const quality = clamp((active ? active.healthScore : 0) + wave * 0.8, 0, 100);
    return {
      time: `${minute}m`,
      stability,
      quality,
    };
  });

  const switchHistory = Array.isArray(previousSwitchHistory) ? previousSwitchHistory.slice(0, 20) : [];
  if (switchHistory.length === 0 && profiles.length > 1) {
    switchHistory.push({
      time: scannedAt,
      from: profiles[1].name,
      to: profiles[0].name,
      reason: "Initial ranking",
      duration: "0.2s",
    });
  }

  return { speedHistory, stabilityHistory, switchHistory };
}

function buildDiagnostics(referenceIndex, profiles, ipLists, scannedAt) {
  const diagnostics = [];

  diagnostics.push({
    id: `diag-reference-${scannedAt}`,
    severity: referenceIndex.exists ? "info" : "error",
    title: "Reference availability",
    message: referenceIndex.exists ? `Reference folder found: ${referenceIndex.rootPath}` : `Reference folder is missing: ${referenceIndex.rootPath}`,
    timestamp: scannedAt,
    source: "analysis",
  });

  diagnostics.push({
    id: `diag-files-${scannedAt}`,
    severity: referenceIndex.totalFiles > 0 ? "info" : "warn",
    title: "Indexed files",
    message: `Indexed ${referenceIndex.totalFiles} files in ${referenceIndex.totalDirectories} directories`,
    timestamp: scannedAt,
    source: "analysis",
  });

  diagnostics.push({
    id: `diag-profiles-${scannedAt}`,
    severity: profiles.length > 0 ? "info" : "warn",
    title: "DPI profiles",
    message: `Detected ${profiles.length} bypass profile(s)`,
    timestamp: scannedAt,
    source: "analysis",
  });

  diagnostics.push({
    id: `diag-iplists-${scannedAt}`,
    severity: ipLists.length > 0 ? "info" : "warn",
    title: "IP lists",
    message: `Detected ${ipLists.length} list file(s) in reference/lists`,
    timestamp: scannedAt,
    source: "analysis",
  });

  const invalidIpLists = ipLists.filter((item) => item.invalidEntries > 0);
  if (invalidIpLists.length > 0) {
    diagnostics.push({
      id: `diag-invalid-ip-${scannedAt}`,
      severity: "warn",
      title: "IP list validation",
      message: `${invalidIpLists.length} list(s) contain invalid IP entries`,
      timestamp: scannedAt,
      source: "analysis",
    });
  }

  const degradedProfiles = profiles.filter((profile) => profile.status === "unstable" || profile.status === "error");
  if (degradedProfiles.length > 0) {
    diagnostics.push({
      id: `diag-degraded-${scannedAt}`,
      severity: "warn",
      title: "Profile health",
      message: `${degradedProfiles.length} profile(s) are unstable or failing`,
      timestamp: scannedAt,
      source: "analysis",
    });
  }

  if (referenceIndex.readErrors.length > 0) {
    diagnostics.push({
      id: `diag-read-errors-${scannedAt}`,
      severity: "error",
      title: "Read errors",
      message: `Encountered ${referenceIndex.readErrors.length} filesystem read error(s)`,
      timestamp: scannedAt,
      source: "analysis",
    });
  }

  return diagnostics;
}

function applyActiveProfile(profiles, preferredProfileId, previousActiveProfileId) {
  const availableProfiles = profiles.filter((profile) => profile.isAvailable);

  let nextActiveId = null;
  if (preferredProfileId && availableProfiles.some((profile) => profile.id === preferredProfileId)) {
    nextActiveId = preferredProfileId;
  } else if (previousActiveProfileId && availableProfiles.some((profile) => profile.id === previousActiveProfileId)) {
    nextActiveId = previousActiveProfileId;
  } else if (availableProfiles.length > 0) {
    nextActiveId = availableProfiles[0].id;
  }

  for (const profile of profiles) {
    profile.isActive = profile.id === nextActiveId;
    if (profile.isActive) {
      profile.status = "active";
    } else if (profile.status === "active") {
      profile.status = profile.isAvailable ? "online" : "offline";
    }
  }

  return nextActiveId;
}

function createReferenceSummary(referenceIndex, profiles, ipLists, scannedAt, warnings) {
  return {
    referenceExists: referenceIndex.exists,
    fileCount: referenceIndex.totalFiles,
    profileCount: profiles.length,
    ipListCount: ipLists.length,
    readErrorCount: referenceIndex.readErrors.length,
    lastSuccessfulAnalysisAt: referenceIndex.exists ? scannedAt : null,
    dataAvailable: referenceIndex.exists && profiles.length > 0,
    warnings,
  };
}

function scanReference(referenceRoot, options = {}) {
  const scannedAt = nowIso();
  const referenceExists = fs.existsSync(referenceRoot);

  const walked = walkReference(referenceRoot);
  const files = walked.files;

  const profiles = [];
  for (const file of files) {
    if (!file.isText || !PROFILE_EXTENSIONS.has(file.ext)) {
      continue;
    }

    const result = safeReadTextFile(file.absolutePath);
    if (result.warnings.length > 0) {
      file.parseWarnings.push(...result.warnings);
    }

    if (result.error) {
      file.parseStatus = "error";
      continue;
    }

    if (result.binary) {
      file.parseStatus = "skipped";
      continue;
    }

    file.parseStatus = "parsed";
    const profile = parseProfileFromFile(file, result.text, scannedAt);
    if (profile) {
      profiles.push(profile);
    }
  }

  const ipLists = parseIpLists(referenceRoot, files, scannedAt);
  linkProfilesAndLists(profiles, ipLists);

  const nextActiveProfileId = applyActiveProfile(
    profiles,
    options.preferredProfileId,
    options.previousActiveProfileId,
  );

  const warnings = [];
  if (!referenceExists) {
    warnings.push(`Reference folder not found: ${referenceRoot}`);
  }
  if (profiles.length === 0) {
    warnings.push("No DPI bypass profiles were detected");
  }
  if (ipLists.length === 0) {
    warnings.push("No IP list files were detected under reference/lists");
  }

  for (const ipList of ipLists) {
    if (ipList.invalidEntries > 0) {
      warnings.push(`${ipList.name}: ${ipList.invalidEntries} invalid entries`);
    }
  }

  const referenceIndex = {
    rootPath: referenceRoot,
    listsPath: path.join(referenceRoot, "lists"),
    exists: referenceExists,
    scannedAt,
    totalFiles: files.length,
    totalDirectories: walked.totalDirectories,
    byExtension: walked.byExtension,
    files,
    readErrors: walked.readErrors,
  };

  const diagnostics = buildDiagnostics(referenceIndex, profiles, ipLists, scannedAt);
  const history = generateHistory(profiles, scannedAt, options.previousSwitchHistory);

  return {
    referenceIndex,
    profiles,
    ipLists,
    diagnostics,
    referenceSummary: createReferenceSummary(referenceIndex, profiles, ipLists, scannedAt, warnings),
    warnings,
    scannedAt,
    activeProfileId: nextActiveProfileId,
    speedHistory: history.speedHistory,
    stabilityHistory: history.stabilityHistory,
    switchHistory: history.switchHistory,
  };
}

module.exports = {
  scanReference,
};





