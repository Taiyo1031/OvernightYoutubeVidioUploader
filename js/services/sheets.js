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

export function createSheetsClient({ spreadsheetId, getAccessToken }) {
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;

  async function getValues(rangeA1) {
    const res = await fetch(`${baseUrl}/values/${encodeURIComponent(rangeA1)}`, {
      headers: getAuthHeaders(getAccessToken),
    });
    await ensureOk(res);
    return res.json();
  }

  async function putValues(rangeA1, values) {
    const url = `${baseUrl}/values/${encodeURIComponent(rangeA1)}?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: "PUT",
      headers: getAuthHeaders(getAccessToken, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ values }),
    });
    await ensureOk(res);
  }

  async function appendValues(rangeA1, values) {
    const url =
      `${baseUrl}/values/${encodeURIComponent(rangeA1)}:append` +
      "?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS";
    const res = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(getAccessToken, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ values }),
    });
    await ensureOk(res);
    return res.json();
  }

  async function batchUpdate(requests) {
    const res = await fetch(`${baseUrl}:batchUpdate`, {
      method: "POST",
      headers: getAuthHeaders(getAccessToken, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ requests }),
    });
    await ensureOk(res);
    return res.json();
  }

  async function getSpreadsheet(fields = "") {
    const params = new URLSearchParams();
    if (fields) params.set("fields", fields);
    const url = params.size > 0 ? `${baseUrl}?${params.toString()}` : baseUrl;
    const res = await fetch(url, {
      headers: getAuthHeaders(getAccessToken),
    });
    await ensureOk(res);
    return res.json();
  }

  return {
    getValues,
    putValues,
    appendValues,
    batchUpdate,
    getSpreadsheet,
  };
}
