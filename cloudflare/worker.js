const GITHUB_API = "https://api.github.com";
const GITHUB_USER_AGENT = "wanglab-phd-roles-worker";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

async function sha256(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64Url(input) {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64StandardFromString(input) {
  return btoa(input);
}

function githubHeaders(tokenOrJwt, extra = {}) {
  return {
    Authorization: `Bearer ${tokenOrJwt}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": GITHUB_USER_AGENT,
    ...extra,
  };
}

async function signGitHubAppJwt(appId, pemKey) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now - 60, exp: now + 540, iss: appId };
  const enc = new TextEncoder();
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pemKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${unsigned}.${sig}`;
}

function pemToArrayBuffer(pem) {
  const cleanedPem = pem.trim();
  const isPkcs1 = cleanedPem.includes("-----BEGIN RSA PRIVATE KEY-----");
  const normalized = cleanedPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace("-----BEGIN RSA PRIVATE KEY-----", "")
    .replace("-----END RSA PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const derBytes = decodeBase64ToBytes(normalized);

  if (!isPkcs1) {
    return derBytes.buffer;
  }

  return wrapPkcs1InPkcs8(derBytes).buffer;
}

function decodeBase64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function wrapPkcs1InPkcs8(pkcs1Bytes) {
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const algorithmIdentifier = new Uint8Array([
    0x30, 0x0d,
    0x06, 0x09,
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  ]);
  const privateKey = encodeDerElement(0x04, pkcs1Bytes);
  return encodeDerElement(0x30, concatBytes(version, algorithmIdentifier, privateKey));
}

function encodeDerElement(tag, valueBytes) {
  return concatBytes(new Uint8Array([tag]), encodeDerLength(valueBytes.length), valueBytes);
}

function encodeDerLength(length) {
  if (length < 0x80) {
    return new Uint8Array([length]);
  }

  const bytes = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function concatBytes(...arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    merged.set(arr, offset);
    offset += arr.length;
  }
  return merged;
}

async function getInstallationToken(env) {
  const jwt = await signGitHubAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const installsRes = await fetch(`${GITHUB_API}/app/installations`, {
    headers: githubHeaders(jwt),
  });

  if (!installsRes.ok) {
    const text = await installsRes.text();
    throw new Error(`List GitHub App installations failed (${installsRes.status}): ${text || "no response body"}`);
  }

  const installations = await installsRes.json();
  const [owner, repo] = String(env.GITHUB_REPO || "").split("/");
  const installation = (installations || []).find((entry) => {
    const accountLogin = entry?.account?.login;
    const selectedReposUrl = entry?.repositories_url;
    return accountLogin === owner && typeof selectedReposUrl === "string";
  });

  if (!installation) {
    throw new Error(`No GitHub App installation was found for ${env.GITHUB_REPO}.`);
  }

  const tokenRes = await fetch(`${GITHUB_API}/app/installations/${installation.id}/access_tokens`, {
    method: "POST",
    headers: githubHeaders(jwt),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Create installation token failed (${tokenRes.status}): ${text || "no response body"}`);
  }

  const tokenPayload = await tokenRes.json();
  const token = tokenPayload.token;
  const reposRes = await fetch(`${GITHUB_API}/installation/repositories`, {
    headers: githubHeaders(token),
  });

  if (!reposRes.ok) {
    const text = await reposRes.text();
    throw new Error(`Read installation repositories failed (${reposRes.status}): ${text || "no response body"}`);
  }

  const reposPayload = await reposRes.json();
  const installationHasRepo = Array.isArray(reposPayload.repositories)
    && reposPayload.repositories.some((entry) => entry?.name === repo && entry?.full_name === env.GITHUB_REPO);

  if (!installationHasRepo) {
    throw new Error(`GitHub App installation does not include ${env.GITHUB_REPO}.`);
  }

  return token;
}

// This endpoint intentionally exposes no secret material. It lets an admin
// confirm that the deployed Worker has the expected App identifier and key.
async function healthCheck(env) {
  const pem = String(env.GITHUB_APP_PRIVATE_KEY || "").trim();
  const appIdentifier = String(env.GITHUB_APP_ID || "").trim();
  const keyFormat = pem.includes("-----BEGIN RSA PRIVATE KEY-----")
    ? "PKCS#1 RSA"
    : pem.includes("-----BEGIN PRIVATE KEY-----")
      ? "PKCS#8"
      : "unrecognized";

  try {
    const jwt = await signGitHubAppJwt(appIdentifier, pem);
    const response = await fetch(`${GITHUB_API}/app`, {
      headers: githubHeaders(jwt),
    });
    const body = await response.text();
    let github;
    try {
      github = JSON.parse(body);
    } catch {
      github = { response: body };
    }

    if (!response.ok) {
      return jsonResponse({
        ok: false,
        githubStatus: response.status,
        configuredAppIdentifier: appIdentifier,
        keyFormat,
        keyFingerprint: await sha256(pem),
        githubAppId: github.id || null,
        githubClientId: github.client_id || null,
        githubMessage: github.message || null,
      }, 502);
    }

    const installationToken = await getInstallationToken(env);
    const repoFile = await getRepoFile(installationToken, env, "initial-data.json");

    return jsonResponse({
      ok: true,
      githubStatus: response.status,
      configuredAppIdentifier: appIdentifier,
      keyFormat,
      keyFingerprint: await sha256(pem),
      githubAppId: github.id || null,
      githubClientId: github.client_id || null,
      repositoryRead: Boolean(repoFile.sha),
      repositoryFile: "initial-data.json",
    }, response.ok ? 200 : 502);
  } catch (error) {
    return jsonResponse({
      ok: false,
      configuredAppIdentifier: appIdentifier,
      keyFormat,
      keyFingerprint: await sha256(pem),
      error: error.message || "Health check failed.",
    }, 500);
  }
}

async function getRepoFile(token, env, path) {
  const res = await fetch(`${GITHUB_API}/repos/${env.GITHUB_REPO}/contents/${path}`, {
    headers: githubHeaders(token),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Read ${path} from repository failed (${res.status}): ${text || "no response body"}`);
  }

  return res.json();
}

async function updateRepoFile(token, env, path, content, sha, message) {
  const res = await fetch(`${GITHUB_API}/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers: githubHeaders(token, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      message,
      content: base64StandardFromString(content),
      sha,
      branch: env.GITHUB_BRANCH || "main",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "GitHub update failed.");
  }

  return res.json();
}

async function handleUpdate(request, env) {
  const payload = await request.json();
  const nickname = String(payload.nickname || "").trim();
  const semester = String(payload.semester || "").trim();
  const role = String(payload.role || "").trim().toUpperCase();
  const rcsId = String(payload.rcsId || "").trim();

  const token = await getInstallationToken(env);
  const initialFile = await getRepoFile(token, env, "initial-data.json");
  const data = JSON.parse(atob(initialFile.content.replace(/\n/g, "")));

  if (!data.credentials || data.credentials[nickname] !== rcsId) {
    return jsonResponse({ error: "RCS ID did not match nickname." }, 403);
  }
  if (!Array.isArray(data.terms) || !data.terms.includes(semester)) {
    return jsonResponse({ error: "Invalid semester." }, 400);
  }
  if (!["TA", "RA"].includes(role)) {
    return jsonResponse({ error: "Role must be TA or RA." }, 400);
  }

  const student = (data.students || []).find((entry) => entry.name === nickname);
  if (!student) {
    return jsonResponse({ error: "Student not found." }, 404);
  }

  student.roles = student.roles || {};
  student.roles[semester] = role;
  const nextContent = `${JSON.stringify(data, null, 2)}\n`;
  await updateRepoFile(
    token,
    env,
    "initial-data.json",
    nextContent,
    initialFile.sha,
    `Update ${nickname} ${semester} role`
  );

  return jsonResponse({
    ok: true,
    message: "Role saved to GitHub.",
    updated: { nickname, semester, role },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return jsonResponse({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return healthCheck(env);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    try {
      return await handleUpdate(request, env);
    } catch (error) {
      return jsonResponse({ error: error.message || "Update failed." }, 500);
    }
  },
};
