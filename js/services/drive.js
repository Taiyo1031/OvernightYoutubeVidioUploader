function getAuthHeaders(getAccessToken, extraHeaders = {}) {
  const token = getAccessToken();
  if (!token) throw new Error("Missing access token");
  return {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
}

async function ensureOk(res) {
  if (!res.ok) throw new Error(await res.text());
  return res;
}

export function createDriveClient({ getAccessToken }) {
  async function getFile(fileId, fields = "id,name,parents,appProperties") {
    const params = new URLSearchParams({ fields });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`, {
      headers: getAuthHeaders(getAccessToken),
    });
    await ensureOk(res);
    return res.json();
  }

  async function searchFiles({ q, pageSize, orderBy, fields }) {
    const params = new URLSearchParams({
      q,
      pageSize: String(pageSize),
      orderBy,
      fields,
    });

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: getAuthHeaders(getAccessToken),
    });
    await ensureOk(res);
    const data = await res.json();
    return data.files || [];
  }

  async function startResumableUpload({ fileName, folderId, description, file, appProperties }) {
    const metadata = {
      name: fileName,
      parents: [folderId],
      description: description || "",
      appProperties: appProperties || {},
    };

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,createdTime,webViewLink,appProperties",
      {
        method: "POST",
        headers: getAuthHeaders(getAccessToken, {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": file.type || "application/octet-stream",
          "X-Upload-Content-Length": String(file.size),
        }),
        body: JSON.stringify(metadata),
      }
    );
    await ensureOk(res);

    const uploadUrl = res.headers.get("Location");
    if (!uploadUrl) throw new Error("Resumable session URL was not returned");
    return uploadUrl;
  }

  async function uploadInChunks(uploadUrl, file, chunkSize, onProgress) {
    let offset = 0;
    let lastTime = performance.now();
    let lastOffset = 0;

    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size);
      const chunk = file.slice(offset, end);

      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: getAuthHeaders(getAccessToken, {
          "Content-Length": String(chunk.size),
          "Content-Range": `bytes ${offset}-${end - 1}/${file.size}`,
        }),
        body: chunk,
      });

      if (res.status === 308) {
        offset = end;
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        const transferred = offset - lastOffset;
        const speed = dt > 0 ? transferred / dt : 0;
        const remaining = file.size - offset;
        const eta = speed > 0 ? remaining / speed : Infinity;

        lastTime = now;
        lastOffset = offset;

        if (onProgress) {
          onProgress({
            fileOffset: offset,
            speedBps: speed,
            etaSec: eta,
          });
        }
        continue;
      }

      if (res.ok) {
        if (onProgress) {
          onProgress({
            fileOffset: file.size,
            speedBps: 0,
            etaSec: 0,
          });
        }
        return res.json();
      }

      throw new Error(await res.text());
    }

    throw new Error("Upload did not complete");
  }

  async function patchFileMeta(fileId, body, options = {}) {
    const params = new URLSearchParams();
    if (options.fields) params.set("fields", options.fields);
    if (options.addParents) params.set("addParents", options.addParents);
    if (options.removeParents) params.set("removeParents", options.removeParents);

    const query = params.toString();
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}${query ? `?${query}` : ""}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: getAuthHeaders(getAccessToken, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
    });
    await ensureOk(res);
    return res.json();
  }

  async function createFolder({ name, parentId }) {
    const meta = {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    };
    const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
      method: "POST",
      headers: getAuthHeaders(getAccessToken, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(meta),
    });
    await ensureOk(res);
    return res.json();
  }

  async function deleteFile(fileId) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: getAuthHeaders(getAccessToken),
    });
    await ensureOk(res);
  }

  async function createUserPermission({ fileId, email, role = "writer" }) {
    const url =
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions` +
      "?sendNotificationEmail=true&supportsAllDrives=true&fields=id,type,role,emailAddress";
    const res = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(getAccessToken, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        type: "user",
        role,
        emailAddress: email,
      }),
    });

    if (res.ok) return res.json();

    const text = await res.text();
    if (res.status === 409 || /already has|already exists/i.test(text)) {
      return { alreadyExists: true };
    }
    throw new Error(text);
  }

  async function listUserPermissions(fileId) {
    const url =
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions` +
      "?supportsAllDrives=true&fields=permissions(id,type,role,emailAddress,displayName,deleted)";
    const res = await fetch(url, {
      headers: getAuthHeaders(getAccessToken),
    });
    await ensureOk(res);
    const data = await res.json();
    const permissions = data.permissions || [];
    return permissions.filter((permission) => permission.type === "user" && permission.emailAddress && !permission.deleted);
  }

  return {
    getFile,
    searchFiles,
    startResumableUpload,
    uploadInChunks,
    patchFileMeta,
    createFolder,
    deleteFile,
    createUserPermission,
    listUserPermissions,
  };
}
