import { CONFIG } from "../../app.js";
import {
  clearRememberSigninCookies,
  fetchMyEmail,
  getCachedSigninEmail,
  getRememberEnabled,
  isAdminEmail,
  loadAllowedEmails,
  saveAllowedEmails,
  setCachedSigninEmail,
  setRememberEnabled,
} from "../shared/auth.js";
import { LOG_COLUMNS, PROJECTS_COLUMNS } from "../shared/constants.js";
import { normalizeProjectId } from "../shared/file-name.js";
import { escapeHtml, formatBytes, nowISO, pad3, toTokyo } from "../shared/format.js";
import { createDriveClient } from "../services/drive.js";
import { createSheetsClient } from "../services/sheets.js";

export function initAdminPage() {
  let accessToken = null;
  let myEmail = "";
  let silentAuthInProgress = false;

  const els = {
    me: document.getElementById("me"),
    rememberSignin: document.getElementById("rememberSignin"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),
    blockedCard: document.getElementById("blockedCard"),
    blockedMsg: document.getElementById("blockedMsg"),
    lastSigninHint: document.getElementById("lastSigninHint"),
    adminCard: document.getElementById("adminCard"),
    accessCard: document.getElementById("accessCard"),
    projectsCard: document.getElementById("projectsCard"),
    filesCard: document.getElementById("filesCard"),
    linkSheet: document.getElementById("linkSheet"),
    linkRoot: document.getElementById("linkRoot"),
    adminInfo: document.getElementById("adminInfo"),
    inviteEmail: document.getElementById("inviteEmail"),
    btnGrantAccess: document.getElementById("btnGrantAccess"),
    btnReloadAccess: document.getElementById("btnReloadAccess"),
    accessStatus: document.getElementById("accessStatus"),
    accessTable: document.getElementById("accessTable"),
    newProjectId: document.getElementById("newProjectId"),
    newProjectName: document.getElementById("newProjectName"),
    btnAddProject: document.getElementById("btnAddProject"),
    btnReloadProjects: document.getElementById("btnReloadProjects"),
    projectsStatus: document.getElementById("projectsStatus"),
    projectsTable: document.getElementById("projectsTable"),
    btnReloadFiles: document.getElementById("btnReloadFiles"),
    fileProjectFilter: document.getElementById("fileProjectFilter"),
    fileLimit: document.getElementById("fileLimit"),
    deleteFileId: document.getElementById("deleteFileId"),
    btnDeleteById: document.getElementById("btnDeleteById"),
    filesStatus: document.getElementById("filesStatus"),
    filesTable: document.getElementById("filesTable"),
  };

  const drive = createDriveClient({
    getAccessToken: () => accessToken,
  });
  const sheets = createSheetsClient({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    getAccessToken: () => accessToken,
  });

  function sheetUrl() {
    return `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/edit`;
  }

  function folderUrl(folderId) {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }

  function showBlocked(message) {
    els.blockedCard.style.display = "block";
    els.adminCard.style.display = "none";
    els.accessCard.style.display = "none";
    els.projectsCard.style.display = "none";
    els.filesCard.style.display = "none";
    els.blockedMsg.textContent = message;
  }

  function showAdmin() {
    els.blockedCard.style.display = "none";
    els.adminCard.style.display = "block";
    els.accessCard.style.display = "block";
    els.projectsCard.style.display = "block";
    els.filesCard.style.display = "block";
  }

  function renderLastSigninHint() {
    if (!els.lastSigninHint) return;

    const cachedEmail = !accessToken ? getCachedSigninEmail() : "";
    if (!cachedEmail) {
      els.lastSigninHint.hidden = true;
      els.lastSigninHint.textContent = "";
      return;
    }

    els.lastSigninHint.hidden = false;
    els.lastSigninHint.textContent = `Last signed in as: ${cachedEmail}`;
  }

  function setSignedOutUi(message = "Please sign in.") {
    accessToken = null;
    myEmail = "";
    els.me.textContent = "Signed out";
    els.btnLogout.disabled = true;
    els.btnLogin.style.display = "";
    showBlocked(message);
    renderLastSigninHint();
  }

  function setSigningInUi() {
    els.me.textContent = "Signing in...";
    els.btnLogin.style.display = "none";
    showBlocked("Signing in...");
    if (els.lastSigninHint) els.lastSigninHint.hidden = true;
  }

  function normEmail(value) {
    return (value || "").trim().toLowerCase();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(value));
  }

  async function grantUserAccessToUploader(email) {
    await drive.createUserPermission({ fileId: CONFIG.SPREADSHEET_ID, email, role: "writer" });
    await drive.createUserPermission({ fileId: CONFIG.ROOT_FOLDER_ID, email, role: "writer" });

    const projectsData = await sheets.getValues(`${CONFIG.PROJECTS_SHEET}!D2:D`);
    const folderIds = [...new Set((projectsData.values || []).map((row) => (row[0] || "").trim()).filter(Boolean))];
    if (folderIds.length === 0) return;

    const results = await Promise.allSettled(
      folderIds.map((folderId) => drive.createUserPermission({ fileId: folderId, email, role: "writer" }))
    );
    const failures = results.filter((result) => result.status === "rejected").length;
    if (failures > 0) {
      console.warn(`Grant warning: ${failures}/${folderIds.length} project folder permissions failed`);
    }
  }

  async function loadAccessList() {
    els.accessStatus.textContent = "Loading access list...";

    const [sheetPerms, rootPerms] = await Promise.all([
      drive.listUserPermissions(CONFIG.SPREADSHEET_ID),
      drive.listUserPermissions(CONFIG.ROOT_FOLDER_ID),
    ]);

    const byEmail = new Map();
    for (const permission of sheetPerms) {
      const email = normEmail(permission.emailAddress);
      if (!email) continue;
      if (!byEmail.has(email)) byEmail.set(email, { email, sheetRole: "-", rootRole: "-" });
      byEmail.get(email).sheetRole = permission.role || "-";
    }
    for (const permission of rootPerms) {
      const email = normEmail(permission.emailAddress);
      if (!email) continue;
      if (!byEmail.has(email)) byEmail.set(email, { email, sheetRole: "-", rootRole: "-" });
      byEmail.get(email).rootRole = permission.role || "-";
    }

    const rows = [...byEmail.values()]
      .sort((a, b) => a.email.localeCompare(b.email))
      .map((user) => {
        const ok = user.sheetRole !== "-" && user.rootRole !== "-";
        return `
          <tr>
            <td class="mono">${escapeHtml(user.email)}</td>
            <td class="mono">${escapeHtml(user.sheetRole)}</td>
            <td class="mono">${escapeHtml(user.rootRole)}</td>
            <td>${ok ? "OK" : "Missing permission"}</td>
          </tr>
        `;
      }).join("");

    els.accessTable.innerHTML = `
      <table>
        <thead>
          <tr><th>Email</th><th>Sheet</th><th>Root Folder</th><th>Status</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4" class="mono">No user permissions found.</td></tr>'}</tbody>
      </table>
    `;

    els.accessStatus.textContent = `${byEmail.size} user(s) listed`;

    saveAllowedEmails(
      [...byEmail.values()]
        .filter((user) => user.sheetRole !== "-" && user.rootRole !== "-")
        .map((user) => user.email)
    );
    renderAllowedEmailsEditor();
  }

  function renderAllowedEmailsEditor() {
    const card = document.getElementById("allowedEmailsCard");
    if (!card) return;

    const stored = loadAllowedEmails([]);
    card.innerHTML = `
      <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
        <div class="label">許可アカウント（ログイン画面表示用）</div>
        <p class="hint">Access Listと連動して自動更新されます。手動で編集することも可能です（1行1件）。<br>変更後はindex.htmlをリロードすると反映されます。</p>
        <textarea id="allowedEmailsTextarea" rows="5" style="font-family:var(--mono);">${stored.join("\n")}</textarea>
        <div class="row" style="margin-top:8px;">
          <button id="btnSaveAllowedEmails" class="btnPrimary">保存</button>
          <span class="mono" id="allowedEmailsSaveStatus"></span>
        </div>
      </div>
    `;

    document.getElementById("btnSaveAllowedEmails").onclick = () => {
      const emails = document.getElementById("allowedEmailsTextarea").value
        .split("\n")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      saveAllowedEmails(emails);
      const status = document.getElementById("allowedEmailsSaveStatus");
      status.textContent = "保存しました";
      setTimeout(() => {
        if (status) status.textContent = "";
      }, 2000);
    };
  }

  async function loadProjects() {
    els.projectsStatus.textContent = "Loading...";
    const data = await sheets.getValues(`${CONFIG.PROJECTS_SHEET}!A2:H`);
    const rows = data.values || [];

    const items = rows.map((row, index) => ({
      rowNum: 2 + index,
      projectNo: Number(row[PROJECTS_COLUMNS.PROJECT_NO] || "0"),
      projectId: row[PROJECTS_COLUMNS.PROJECT_ID] || "",
      projectName: row[PROJECTS_COLUMNS.PROJECT_NAME] || "",
      folderId: row[PROJECTS_COLUMNS.FOLDER_ID] || "",
      nextSeq: row[PROJECTS_COLUMNS.NEXT_SEQ] || "1",
      isActive: (row[PROJECTS_COLUMNS.IS_ACTIVE] || "").toUpperCase() === "TRUE",
      createdAt: row[PROJECTS_COLUMNS.CREATED_AT] || "",
      createdBy: row[PROJECTS_COLUMNS.CREATED_BY] || "",
    }));

    els.projectsStatus.textContent = `${items.length} project(s)`;
    els.projectsTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>No</th><th>projectId</th><th>Name</th><th>Folder</th><th>nextSeq</th><th>isActive</th><th>createdAt</th><th>createdBy</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((project) => `
            <tr>
              <td>${escapeHtml(project.projectNo ? pad3(project.projectNo) : "-")}</td>
              <td class="mono">${escapeHtml(project.projectId)}</td>
              <td>${escapeHtml(project.projectName)}</td>
              <td>${project.folderId ? `<a href="${folderUrl(project.folderId)}" target="_blank" rel="noopener noreferrer">Folder</a>` : "-"}</td>
              <td class="mono">${escapeHtml(project.nextSeq)}</td>
              <td>${project.isActive ? "TRUE" : "FALSE"}</td>
              <td class="mono">${escapeHtml(project.createdAt)}</td>
              <td class="mono">${escapeHtml(project.createdBy)}</td>
              <td>
                <button data-action="toggle" data-row="${project.rowNum}" data-active="${project.isActive ? "1" : "0"}">
                  ${project.isActive ? "Archive" : "Activate"}
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    els.projectsTable.querySelectorAll("button[data-action='toggle']").forEach((button) => {
      button.onclick = async () => {
        const rowNum = Number(button.dataset.row);
        const isActive = button.dataset.active === "1";
        const newValue = isActive ? "FALSE" : "TRUE";
        try {
          button.disabled = true;
          await sheets.putValues(`${CONFIG.PROJECTS_SHEET}!F${rowNum}`, [[newValue]]);
          await loadProjects();
        } catch (error) {
          console.error(error);
          alert("Failed to update project");
        } finally {
          button.disabled = false;
        }
      };
    });
  }

  async function addProject() {
    const projectId = normalizeProjectId(els.newProjectId.value);
    const projectName = (els.newProjectName.value || "").trim();
    if (!projectId) {
      alert("Project ID is required");
      return;
    }
    if (!projectName) {
      alert("Project Name is required");
      return;
    }

    const data = await sheets.getValues(`${CONFIG.PROJECTS_SHEET}!A2:B`);
    const rows = data.values || [];
    const existingIds = new Set(rows.map((row) => row[PROJECTS_COLUMNS.PROJECT_ID]).filter(Boolean));
    if (existingIds.has(projectId)) {
      alert("projectId already exists");
      return;
    }

    const projectNumbers = rows
      .map((row) => Number(row[PROJECTS_COLUMNS.PROJECT_NO] || "0"))
      .filter((value) => isFinite(value));
    const nextNo = (projectNumbers.length > 0 ? Math.max(...projectNumbers) : 0) + 1;
    const folderName = `${pad3(nextNo)}_${projectId}`;

    els.btnAddProject.disabled = true;
    els.projectsStatus.textContent = "Creating folder...";

    const folder = await drive.createFolder({
      name: folderName,
      parentId: CONFIG.ROOT_FOLDER_ID,
    });

    els.projectsStatus.textContent = "Writing sheet...";
    await sheets.appendValues(`${CONFIG.PROJECTS_SHEET}!A1`, [[
      String(nextNo),
      projectId,
      projectName,
      folder.id,
      "1",
      "TRUE",
      nowISO(),
      myEmail,
    ]]);

    els.newProjectId.value = "";
    els.newProjectName.value = "";
    await loadProjects();
    els.projectsStatus.textContent = `Project added: ${projectId}`;
    els.btnAddProject.disabled = false;
  }

  async function getSheetIdByTitle(title) {
    const data = await sheets.getSpreadsheet("sheets(properties(sheetId,title))");
    const sheet = (data.sheets || []).find((candidate) => candidate.properties?.title === title);
    if (!sheet) throw new Error(`Sheet not found: ${title}`);
    return sheet.properties.sheetId;
  }

  async function findLogRowNumbersByFileId(fileId) {
    const data = await sheets.getValues(`${CONFIG.LOG_SHEET}!A2:L`);
    const rows = data.values || [];
    const hits = [];

    for (let index = 0; index < rows.length; index += 1) {
      const driveFileId = rows[index][LOG_COLUMNS.DRIVE_FILE_ID] || "";
      if (driveFileId === fileId) hits.push(2 + index);
    }
    return hits;
  }

  async function deleteLogRowsByFileId(fileId) {
    const rowNums = await findLogRowNumbersByFileId(fileId);
    if (rowNums.length === 0) return 0;

    const sheetId = await getSheetIdByTitle(CONFIG.LOG_SHEET);
    rowNums.sort((a, b) => b - a);

    await sheets.batchUpdate(
      rowNums.map((rowNum) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: rowNum - 1,
            endIndex: rowNum,
          },
        },
      }))
    );

    return rowNums.length;
  }

  async function loadFiles() {
    els.filesStatus.textContent = "Loading...";
    const limit = Number(els.fileLimit.value || "50");
    const projectId = (els.fileProjectFilter.value || "").trim();

    const qParts = [
      "trashed=false",
      `appProperties has { key='schema' and value='${CONFIG.APP_SCHEMA}' }`,
    ];
    if (projectId) {
      qParts.push(`appProperties has { key='projectId' and value='${projectId}' }`);
    }

    const files = await drive.searchFiles({
      q: qParts.join(" and "),
      pageSize: limit,
      orderBy: "createdTime desc",
      fields: "files(id,name,size,createdTime,webViewLink,appProperties)",
    });

    els.filesStatus.textContent = `${files.length} file(s)`;
    els.filesTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Date (JST)</th><th>projectId</th><th>seq</th><th>uploader</th><th>File</th><th>Size</th><th>fileId</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${files.map((file) => `
            <tr>
              <td class="mono">${escapeHtml(toTokyo(file.createdTime))}</td>
              <td class="mono">${escapeHtml(file.appProperties?.projectId || "-")}</td>
              <td class="mono">${escapeHtml(file.appProperties?.seq || "-")}</td>
              <td class="mono">${escapeHtml(file.appProperties?.uploaderEmail || "-")}</td>
              <td><a href="${file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`}" target="_blank" rel="noopener noreferrer">${escapeHtml(file.name || "")}</a></td>
              <td style="text-align:right;" class="mono">${escapeHtml(formatBytes(file.size))}</td>
              <td class="mono">${escapeHtml(file.id)}</td>
              <td><button data-del="${escapeHtml(file.id)}">Delete</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    els.filesTable.querySelectorAll("button[data-del]").forEach((button) => {
      button.onclick = async () => {
        const fileId = button.dataset.del;
        if (!fileId) return;
        if (!confirm(`Delete this file?\n${fileId}\n\nThis will also delete matching rows in Sheets Log.`)) return;

        try {
          button.disabled = true;
          await drive.deleteFile(fileId);
          const deletedRows = await deleteLogRowsByFileId(fileId);
          await loadFiles();
          alert(`Deleted.\nDrive: OK\nLog rows removed: ${deletedRows}`);
        } catch (error) {
          console.error(error);
          alert("Failed to delete (see console)");
        } finally {
          button.disabled = false;
        }
      };
    });
  }

  function bindEvents(tokenClient) {
    if (els.rememberSignin) {
      els.rememberSignin.checked = getRememberEnabled();
      els.rememberSignin.onchange = () => setRememberEnabled(!!els.rememberSignin.checked);
    }

    els.btnLogin.onclick = () => {
      setRememberEnabled(!!els.rememberSignin?.checked);
      tokenClient.requestAccessToken();
    };

    els.btnLogout.onclick = () => {
      clearRememberSigninCookies();
      if (els.rememberSignin) els.rememberSignin.checked = false;
      location.reload();
    };

    els.btnReloadProjects.onclick = async () => {
      try {
        await loadProjects();
      } catch (error) {
        console.error(error);
        alert("Failed to load projects");
      }
    };

    els.btnAddProject.onclick = async () => {
      try {
        await addProject();
      } catch (error) {
        console.error(error);
        alert("Failed to add project");
        els.btnAddProject.disabled = false;
      }
    };

    els.btnGrantAccess.onclick = async () => {
      const email = normEmail(els.inviteEmail.value);
      if (!isValidEmail(email)) {
        alert("Enter a valid email address");
        return;
      }

      try {
        els.btnGrantAccess.disabled = true;
        els.accessStatus.textContent = `Granting access to ${email}...`;
        await grantUserAccessToUploader(email);
        els.inviteEmail.value = "";
        await loadAccessList();
        alert(`Access granted: ${email}\n\nThey should sign out/in once and try index.html again.`);
      } catch (error) {
        console.error(error);
        alert("Failed to grant access (see console)");
      } finally {
        els.btnGrantAccess.disabled = false;
      }
    };

    els.btnReloadAccess.onclick = async () => {
      try {
        await loadAccessList();
      } catch (error) {
        console.error(error);
        alert("Failed to load access list");
      }
    };

    els.inviteEmail.onkeydown = async (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      await els.btnGrantAccess.onclick();
    };

    els.btnReloadFiles.onclick = async () => {
      try {
        await loadFiles();
      } catch (error) {
        console.error(error);
        alert("Failed to load files");
      }
    };

    els.btnDeleteById.onclick = async () => {
      const fileId = (els.deleteFileId.value || "").trim();
      if (!fileId) {
        alert("Enter fileId");
        return;
      }
      if (!confirm(`Delete this file?\n${fileId}\n\nThis will also delete matching rows in Sheets Log.`)) return;

      try {
        els.btnDeleteById.disabled = true;
        await drive.deleteFile(fileId);
        const deletedRows = await deleteLogRowsByFileId(fileId);
        els.deleteFileId.value = "";
        await loadFiles();
        alert(`Deleted.\nDrive: OK\nLog rows removed: ${deletedRows}`);
      } catch (error) {
        console.error(error);
        alert("Failed to delete fileId (see console)");
      } finally {
        els.btnDeleteById.disabled = false;
      }
    };
  }

  function createTokenClient() {
    return google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      error_callback: (error) => {
        console.error("Google OAuth error:", error);
        if (silentAuthInProgress) {
          silentAuthInProgress = false;
          setSignedOutUi("Please sign in.");
          return;
        }
        if (error?.type === "popup_failed_to_open") {
          alert("Google sign-in popup was blocked. Allow popups for this site, then try again.");
          return;
        }
        if (error?.type === "popup_closed") {
          alert("Google sign-in popup was closed before completion.");
          return;
        }
        alert("Google sign-in failed. Check browser popup settings and try again.");
      },
      callback: async (response) => {
        silentAuthInProgress = false;
        accessToken = response.access_token;
        renderLastSigninHint();

        try {
          myEmail = await fetchMyEmail(accessToken);
          setCachedSigninEmail(myEmail);
          els.me.textContent = `Signed in: ${myEmail}`;
          els.btnLogout.disabled = false;
          renderLastSigninHint();

          if (!isAdminEmail(myEmail, CONFIG.ADMIN_EMAIL)) {
            showBlocked(`Access denied. Admin only: ${CONFIG.ADMIN_EMAIL}`);
            return;
          }

          showAdmin();
          els.linkSheet.href = sheetUrl();
          els.linkRoot.href = folderUrl(CONFIG.ROOT_FOLDER_ID);
          els.adminInfo.textContent = `Admin: ${myEmail} • Sheet: ${CONFIG.SPREADSHEET_ID} • Root: ${CONFIG.ROOT_FOLDER_ID}`;

          await loadAccessList();
          await loadProjects();
          await loadFiles();
        } catch (error) {
          console.error(error);
          showBlocked("Failed to sign in. Check console.");
        }
      },
    });
  }

  const tokenClient = createTokenClient();
  bindEvents(tokenClient);
  renderLastSigninHint();

  if (getRememberEnabled()) {
    setSigningInUi();
    silentAuthInProgress = true;
    try {
      tokenClient.requestAccessToken({ prompt: "" });
    } catch {
      silentAuthInProgress = false;
      setSignedOutUi("Please sign in.");
    }
  } else {
    setSignedOutUi("Please sign in.");
  }
}

initAdminPage();
