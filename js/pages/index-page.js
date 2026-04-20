import { CONFIG } from "../../app.js";
import { fetchMyEmail, getRememberEnabled, isAdminEmail, isPermissionDeniedError, loadAllowedEmails, setRememberEnabled } from "../shared/auth.js";
import { APP_VERSION, DEFAULT_VIDEO_TYPE, LOG_COLUMNS, PROJECTS_COLUMNS, STORAGE_KEYS } from "../shared/constants.js";
import { buildUploadFileName, extractExtFromFileName, extractLabelFromFileName, extractYyyymmddFromFileName, getFileExt, sanitizeLabel } from "../shared/file-name.js";
import { escapeHtml, formatBytes, formatETA, formatSpeed, normalizeDateInputToYyyymmdd, toTokyo, ymdTokyo, yyyymmddTokyo } from "../shared/format.js";
import { createDriveClient } from "../services/drive.js";
import { createSheetsClient } from "../services/sheets.js";

export function initIndexPage() {
  let accessToken = null;
  let myEmail = "";
  let lastLogMap = new Map();
  let availableVideoTypes = [];
  let availableProjects = [];
  let silentAuthInProgress = false;

  const els = {
    me: document.getElementById("me"),
    rememberSignin: document.getElementById("rememberSignin"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),
    projectSelect: document.getElementById("projectSelect"),
    btnReloadProjects: document.getElementById("btnReloadProjects"),
    descModeCommon: document.getElementById("descModeCommon"),
    descModePerFile: document.getElementById("descModePerFile"),
    commonDescWrap: document.getElementById("commonDescWrap"),
    perFileDescWrap: document.getElementById("perFileDescWrap"),
    perFileList: document.getElementById("perFileList"),
    templateSelect: document.getElementById("templateSelect"),
    desc: document.getElementById("desc"),
    videoTypeSelect: document.getElementById("videoTypeSelect"),
    videoTypeInput: document.getElementById("videoTypeInput"),
    videoTypeInfo: document.getElementById("videoTypeInfo"),
    fileInput: document.getElementById("file"),
    selectedSizeText: document.getElementById("selectedSizeText"),
    btnUpload: document.getElementById("btnUpload"),
    recordingDateInput: document.getElementById("recordingDate"),
    fileLabelInput: document.getElementById("fileLabel"),
    progressWrap: document.getElementById("progressWrap"),
    progressBar: document.getElementById("progress"),
    progressText: document.getElementById("progressText"),
    statusLine: document.getElementById("statusLine"),
    speedText: document.getElementById("speedText"),
    etaText: document.getElementById("etaText"),
    currentFileText: document.getElementById("currentFileText"),
    finalNameText: document.getElementById("finalNameText"),
    history: document.getElementById("history"),
    historyProjectFilter: document.getElementById("historyProjectFilter"),
    btnReloadHistory: document.getElementById("btnReloadHistory"),
    adminLink: document.getElementById("adminLink"),
    loginScreen: document.getElementById("loginScreen"),
    allowedEmailList: document.getElementById("allowedEmailList"),
    loginError: document.getElementById("loginError"),
    dropZone: document.getElementById("dropZone"),
  };

  const drive = createDriveClient({
    getAccessToken: () => accessToken,
  });
  const sheets = createSheetsClient({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    getAccessToken: () => accessToken,
  });

  function showLoginScreen() {
    els.loginScreen.style.display = "flex";
  }

  function hideLoginScreen() {
    els.loginScreen.style.display = "none";
  }

  function buildAllowedList() {
    const emails = loadAllowedEmails(CONFIG.ALLOWED_EMAILS || []);
    els.allowedEmailList.innerHTML = emails.length
      ? emails.map((email) => `<li>${escapeHtml(email)}</li>`).join("")
      : "<li>（管理者にお問い合わせください）</li>";
  }

  function setLoggedIn(email) {
    els.me.textContent = `Signed in: ${email}`;
    els.btnLogout.disabled = false;
  }

  function setLoggedOut() {
    els.me.textContent = "Signed out";
    els.btnLogout.disabled = true;

    accessToken = null;
    myEmail = "";
    lastLogMap = new Map();

    els.projectSelect.disabled = true;
    els.btnReloadProjects.disabled = true;
    els.descModeCommon.disabled = true;
    els.descModePerFile.disabled = true;
    els.templateSelect.disabled = true;
    els.desc.disabled = true;
    els.videoTypeSelect.disabled = true;
    els.videoTypeInput.disabled = true;
    els.fileInput.disabled = true;
    els.btnUpload.disabled = true;
    els.recordingDateInput.disabled = true;
    els.fileLabelInput.disabled = true;

    els.recordingDateInput.value = "";
    els.fileLabelInput.value = "";
    els.commonDescWrap.style.display = "block";
    els.perFileDescWrap.style.display = "none";
    els.perFileList.innerHTML = "";
    els.progressWrap.style.display = "none";
    els.progressBar.value = 0;
    els.progressText.textContent = "0%";
    els.statusLine.textContent = "";
    els.speedText.textContent = "Speed: -";
    els.etaText.textContent = "ETA: -";
    els.currentFileText.textContent = "";
    els.finalNameText.textContent = "";
    els.selectedSizeText.textContent = "Selected: 0 file(s), total -";
    els.history.textContent = "Signed out";
    els.videoTypeSelect.innerHTML = "";
    els.videoTypeInput.value = DEFAULT_VIDEO_TYPE;
    els.videoTypeInfo.textContent = "Loading types from Log...";
    els.projectSelect.innerHTML = "";
    els.historyProjectFilter.innerHTML = '<option value="">All projects</option>';
    availableVideoTypes = [];
    availableProjects = [];

    if (els.adminLink) els.adminLink.style.display = "none";
  }

  function setProgress(percent) {
    els.progressWrap.style.display = "block";
    els.progressBar.value = percent;
    els.progressText.textContent = `${percent}%`;
  }

  function setRecordingDateTodayDefault() {
    els.recordingDateInput.value = ymdTokyo(new Date());
  }

  function getSelectedRecordingYyyymmdd() {
    const normalized = normalizeDateInputToYyyymmdd(els.recordingDateInput.value || "");
    return normalized || yyyymmddTokyo();
  }

  function getSelectedProjectMeta() {
    const option = els.projectSelect.selectedOptions[0];
    if (!option || !option.value) throw new Error("No project selected");
    return {
      projectId: option.value,
      projectNo: option.dataset.projectNo,
      folderId: option.dataset.folderId,
    };
  }

  function getProjectMetaById(projectId) {
    return availableProjects.find((project) => project.projectId === projectId) || null;
  }

  function formatProjectOptionLabel(project) {
    const numberPrefix = project.projectNo ? `${String(project.projectNo).padStart(3, "0")} - ` : "";
    const name = project.projectName || project.projectId;
    return `${numberPrefix}${name}`;
  }

  function buildProjectEditOptions(currentProjectId) {
    const options = [...availableProjects];
    if (currentProjectId && !options.some((project) => project.projectId === currentProjectId)) {
      options.unshift({
        projectId: currentProjectId,
        projectNo: "",
        projectName: `${currentProjectId} (current / inactive)`,
        folderId: "",
      });
    }

    return options.map((project) => {
      const selected = project.projectId === currentProjectId ? " selected" : "";
      return `<option value="${escapeHtml(project.projectId)}"${selected}>${escapeHtml(formatProjectOptionLabel(project))}</option>`;
    }).join("");
  }

  function resetUploadFormUI() {
    els.fileInput.value = "";
    els.fileInput.type = "text";
    els.fileInput.type = "file";
    els.fileInput.accept = "video/*";
    els.fileInput.multiple = true;

    els.perFileList.innerHTML = "";
    els.perFileDescWrap.style.display = "none";
    els.commonDescWrap.style.display = "block";
    els.descModeCommon.checked = true;
    els.desc.value = "";
    els.recordingDateInput.value = "";
    els.fileLabelInput.value = "";
    els.selectedSizeText.textContent = "Selected: 0 file(s), total -";
    els.currentFileText.textContent = "";
    els.finalNameText.textContent = "";
  }

  function setUploadEnabledState() {
    const hasProject = !!els.projectSelect.value;
    const hasVideoTypeText = !!(els.videoTypeInput.value || "").trim();
    els.btnUpload.disabled = !(hasProject && hasVideoTypeText && accessToken);
  }

  function syncVideoTypeInputFromSelect() {
    els.videoTypeInput.value = els.videoTypeSelect.value || DEFAULT_VIDEO_TYPE;
    setUploadEnabledState();
  }

  function renderVideoTypeSelect(types, preferred = "") {
    els.videoTypeSelect.innerHTML = "";
    for (const type of types) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      els.videoTypeSelect.appendChild(option);
    }

    const preferredNorm = (preferred || "").trim().toLowerCase();
    const preferredMatch = preferredNorm
      ? types.find((type) => (type || "").toLowerCase() === preferredNorm)
      : "";
    const defaultMatch = types.find((type) => (type || "").toLowerCase() === DEFAULT_VIDEO_TYPE.toLowerCase());

    if (preferredMatch) {
      els.videoTypeSelect.value = preferredMatch;
    } else if (defaultMatch) {
      els.videoTypeSelect.value = defaultMatch;
    } else if (types.length > 0) {
      els.videoTypeSelect.value = types[0];
    }

    syncVideoTypeInputFromSelect();
  }

  async function loadVideoTypesFromLog(preferred = "") {
    const data = await sheets.getValues(`${CONFIG.LOG_SHEET}!L2:L`);
    const rows = data.values || [];
    const uniqueValues = new Map();

    for (const row of rows) {
      const raw = (row?.[0] || "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!uniqueValues.has(key)) uniqueValues.set(key, raw);
    }

    availableVideoTypes = Array.from(uniqueValues.values()).sort((a, b) => a.localeCompare(b));
    renderVideoTypeSelect(availableVideoTypes, preferred);

    if (availableVideoTypes.length === 0) {
      els.videoTypeSelect.disabled = true;
      els.videoTypeInfo.textContent = "No video type in Log yet. Enter text manually.";
    } else {
      els.videoTypeSelect.disabled = false;
      els.videoTypeInfo.textContent = `${availableVideoTypes.length} type(s) loaded from Log sheet`;
    }

    setUploadEnabledState();
  }

  function initTemplates() {
    els.templateSelect.innerHTML = "";
    for (const template of CONFIG.TEMPLATES) {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      els.templateSelect.appendChild(option);
    }

    els.templateSelect.onchange = () => {
      const selected = CONFIG.TEMPLATES.find((template) => template.id === els.templateSelect.value);
      if (selected && selected.body) els.desc.value = selected.body;
    };
  }

  function updateDescModeUI() {
    const perFile = els.descModePerFile.checked;
    els.commonDescWrap.style.display = perFile ? "none" : "block";
    els.perFileDescWrap.style.display = perFile ? "block" : "none";
  }

  function buildPerFileEditors(files) {
    els.perFileList.innerHTML = "";
    [...files].forEach((file, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "perFileItem";

      const title = document.createElement("div");
      title.className = "perFileTitle";
      title.innerHTML = `${index + 1}. ${escapeHtml(file.name)} <span>(${Math.round(file.size / 1024 / 1024)} MB)</span>`;

      const textarea = document.createElement("textarea");
      textarea.rows = 4;
      textarea.placeholder = "Description for this file";
      textarea.dataset.fileIndex = String(index);

      wrapper.appendChild(title);
      wrapper.appendChild(textarea);
      els.perFileList.appendChild(wrapper);
    });
  }

  function getPerFileDescriptions() {
    const map = new Map();
    els.perFileList.querySelectorAll("textarea").forEach((textarea) => {
      map.set(Number(textarea.dataset.fileIndex), textarea.value || "");
    });
    return map;
  }

  function updateSelectedSize(files) {
    const list = files ? [...files] : [];
    const total = list.reduce((sum, file) => sum + Number(file.size || 0), 0);
    els.selectedSizeText.textContent = `Selected: ${list.length} file(s), total ${total > 0 ? formatBytes(total) : "-"}`;
  }

  async function loadProjects() {
    const data = await sheets.getValues(`${CONFIG.PROJECTS_SHEET}!A2:H`);
    const rows = data.values || [];

    const active = rows
      .map((row) => ({
        projectNo: row[PROJECTS_COLUMNS.PROJECT_NO] || "",
        projectId: row[PROJECTS_COLUMNS.PROJECT_ID] || "",
        projectName: row[PROJECTS_COLUMNS.PROJECT_NAME] || "",
        folderId: row[PROJECTS_COLUMNS.FOLDER_ID] || "",
        nextSeq: row[PROJECTS_COLUMNS.NEXT_SEQ] || "1",
        isActive: (row[PROJECTS_COLUMNS.IS_ACTIVE] || "").toUpperCase() === "TRUE",
      }))
      .filter((project) => project.projectId && project.projectName && project.folderId && project.isActive)
      .sort((a, b) => Number(a.projectNo) - Number(b.projectNo));

    availableProjects = active;
    els.projectSelect.innerHTML = "";

    if (active.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "(No active projects)";
      els.projectSelect.appendChild(option);
      els.projectSelect.disabled = true;
      setUploadEnabledState();
      return;
    }

    for (const project of active) {
      const option = document.createElement("option");
      option.value = project.projectId;
      option.textContent = `${String(project.projectNo).padStart(3, "0")} - ${project.projectName}`;
      option.dataset.folderId = project.folderId;
      option.dataset.nextSeq = project.nextSeq;
      option.dataset.projectNo = project.projectNo;
      els.projectSelect.appendChild(option);
    }

    els.projectSelect.disabled = false;

    try {
      const lastProject = localStorage.getItem(STORAGE_KEYS.LAST_PROJECT);
      if (lastProject && [...els.projectSelect.options].some((option) => option.value === lastProject)) {
        els.projectSelect.value = lastProject;
      }
    } catch {}

    setUploadEnabledState();

    els.historyProjectFilter.innerHTML = '<option value="">All projects</option>';
    for (const option of els.projectSelect.options) {
      if (!option.value) continue;
      const filterOption = document.createElement("option");
      filterOption.value = option.value;
      filterOption.textContent = option.textContent;
      els.historyProjectFilter.appendChild(filterOption);
    }
  }

  async function getNextSeqSmallestAvailable(projectId, limitRows = 5000) {
    const data = await sheets.getValues(`${CONFIG.LOG_SHEET}!A2:L`);
    const rows = data.values || [];
    const sliced = rows.length > limitRows ? rows.slice(rows.length - limitRows) : rows;
    const used = new Set();

    for (const row of sliced) {
      const rowProjectId = row[LOG_COLUMNS.PROJECT_ID] || "";
      if (rowProjectId !== projectId) continue;
      const seq = Number(row[LOG_COLUMNS.SEQ] || "");
      if (Number.isInteger(seq) && seq > 0) used.add(seq);
    }

    let candidate = 1;
    while (used.has(candidate)) candidate += 1;
    return candidate;
  }

  async function appendLogRow(rowValues) {
    await sheets.appendValues(`${CONFIG.LOG_SHEET}!A1`, [rowValues]);
  }

  async function loadMyLogMap(limitRows = 800) {
    const data = await sheets.getValues(`${CONFIG.LOG_SHEET}!A2:L`);
    const rows = data.values || [];
    const startIndex = Math.max(0, rows.length - limitRows);
    const sliced = rows.slice(startIndex);

    const map = new Map();
    for (let index = 0; index < sliced.length; index += 1) {
      const row = sliced[index];
      const uploader = row[LOG_COLUMNS.UPLOADER_EMAIL] || "";
      const fileName = row[LOG_COLUMNS.FILE_NAME] || "";
      const description = row[LOG_COLUMNS.DESCRIPTION] || "";
      const driveFileId = row[LOG_COLUMNS.DRIVE_FILE_ID] || "";
      const videoType = row[LOG_COLUMNS.VIDEO_TYPE] || "";
      if (!driveFileId || uploader !== myEmail) continue;

      const rowNum = 2 + startIndex + index;
      map.set(driveFileId, { rowNum, description, fileName, videoType });
    }
    return map;
  }

  async function updateDriveFileMeta({
    fileId,
    newName,
    newRecordingDate,
    newVideoType,
    projectId = null,
    projectNo = null,
    seq = null,
    moveToFolderId = "",
  }) {
    let removeParents = "";
    if (moveToFolderId) {
      const currentFile = await drive.getFile(fileId, "id,parents");
      const currentParents = currentFile.parents || [];
      removeParents = currentParents.join(",");
    }

    const appProperties = {
      recordingDate: String(newRecordingDate || ""),
      videoType: String(newVideoType || ""),
    };
    if (projectId !== null) appProperties.projectId = String(projectId || "");
    if (projectNo !== null) appProperties.projectNo = String(projectNo || "");
    if (seq !== null) appProperties.seq = String(seq || "");

    return drive.patchFileMeta(
      fileId,
      {
        name: newName,
        appProperties,
      },
      {
        fields: "id,name,parents,appProperties",
        addParents: moveToFolderId || "",
        removeParents,
      }
    );
  }

  async function updateLogRowAfterInlineEdit(rowNum, { projectId, seq, fileName, description, videoType }) {
    await Promise.all([
      sheets.putValues(`${CONFIG.LOG_SHEET}!B${rowNum}`, [[String(projectId || "")]]),
      sheets.putValues(`${CONFIG.LOG_SHEET}!D${rowNum}`, [[String(seq || "")]]),
      sheets.putValues(`${CONFIG.LOG_SHEET}!E${rowNum}`, [[String(fileName || "")]]),
      sheets.putValues(`${CONFIG.LOG_SHEET}!G${rowNum}`, [[String(description || "")]]),
      sheets.putValues(`${CONFIG.LOG_SHEET}!L${rowNum}`, [[String(videoType || "")]]),
    ]);
  }

  async function loadMyHistory(limit = 20) {
    els.history.textContent = "Loading...";

    const selectedProject = els.historyProjectFilter.value || "";
    const qParts = [
      "trashed=false",
      `appProperties has { key='schema' and value='${CONFIG.APP_SCHEMA}' }`,
      `appProperties has { key='uploaderEmail' and value='${myEmail}' }`,
    ];
    if (selectedProject) {
      qParts.push(`appProperties has { key='projectId' and value='${selectedProject}' }`);
    }

    const files = await drive.searchFiles({
      q: qParts.join(" and "),
      pageSize: limit,
      orderBy: "createdTime desc",
      fields: "files(id,name,size,createdTime,webViewLink,appProperties)",
    });

    if (files.length === 0) {
      els.history.textContent = "No history.";
      return;
    }

    lastLogMap = await loadMyLogMap(800);

    const rows = files.map((file) => {
      const projectId = file.appProperties?.projectId || "-";
      const seq = file.appProperties?.seq || "-";
      const createdTime = toTokyo(file.createdTime);
      const size = formatBytes(file.size);
      const fileNameRaw = file.name || "";
      const link = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;

      const logEntry = lastLogMap.get(file.id);
      const descTextRaw = logEntry?.description || "";
      const descText = descTextRaw ? escapeHtml(descTextRaw).replaceAll("\n", "<br/>") : "";
      const videoTypeRaw = logEntry?.videoType || file.appProperties?.videoType || "";
      const videoTypeText = videoTypeRaw ? escapeHtml(videoTypeRaw) : "-";

      const editTypeOptions = (() => {
        const values = [...availableVideoTypes];
        if (videoTypeRaw && !values.some((value) => value.toLowerCase() === videoTypeRaw.toLowerCase())) {
          values.push(videoTypeRaw);
        }
        return values.map((value) => {
          const selected = value === videoTypeRaw ? " selected" : "";
          return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(value)}</option>`;
        }).join("");
      })();

      const currentDate = extractYyyymmddFromFileName(fileNameRaw) || (file.appProperties?.recordingDate || "");
      const currentLabel = extractLabelFromFileName(fileNameRaw);
      const editProjectOptions = buildProjectEditOptions(projectId);

      return `
        <tr data-file-id="${escapeHtml(file.id)}">
          <td>${escapeHtml(createdTime)}</td>
          <td>${escapeHtml(projectId)}</td>
          <td>${escapeHtml(seq)}</td>
          <td><a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(fileNameRaw)}</a></td>
          <td style="text-align:right;">${escapeHtml(size)}</td>
          <td>${videoTypeText}</td>
          <td class="desc">
            <div class="descView">${descText}</div>
            <div class="descEdit" style="display:none; margin-top:8px;">
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <label class="label" style="margin:0;">Project</label>
                <select class="editProject" style="min-width:260px;">${editProjectOptions}</select>
              </div>
              <div style="height:6px;"></div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <label class="label" style="margin:0;">Recording date</label>
                <input class="editDate" type="text" inputmode="numeric" placeholder="YYYYMMDD" value="${escapeHtml(currentDate)}" style="width:120px;" />
              </div>
              <div style="height:6px;"></div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <label class="label" style="margin:0;">Short label <span style="color:var(--danger,#c00);">*必須</span></label>
                <input class="editLabel" type="text" placeholder="例: gameplay" maxlength="40" value="${escapeHtml(currentLabel)}" style="min-width:180px;" />
              </div>
              <div style="height:6px;"></div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <label class="label" style="margin:0;">Video type (editable)</label>
                <select class="editVideoType" style="min-width:220px;">${editTypeOptions}</select>
              </div>
              <div style="height:6px;"></div>
              <textarea class="editDesc" rows="4" style="width:100%;">${escapeHtml(descTextRaw)}</textarea>
              <div style="display:flex; gap:8px; margin-top:8px;">
                <button class="btnPrimary btnSaveEdit" type="button">Save</button>
                <button class="btnGhost btnCancelEdit" type="button">Cancel</button>
              </div>
              <div class="small mono editStatus" style="margin-top:6px;"></div>
            </div>
          </td>
          <td style="white-space:nowrap;">
            <button class="btnEdit btnStartEdit" type="button">Edit</button>
          </td>
        </tr>
      `;
    }).join("");

    const summaryMap = new Map();
    for (const file of files) {
      const projectId = file.appProperties?.projectId || "-";
      const summary = summaryMap.get(projectId) || { count: 0, totalBytes: 0 };
      summary.count += 1;
      summary.totalBytes += Number(file.size || 0);
      summaryMap.set(projectId, summary);
    }

    const summaryHtml = `
      <div class="historySummary">
        <span class="summaryLabel">Project summary</span>
        ${[...summaryMap.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .map(([projectId, summary]) => `
            <span class="summaryItem">
              <span class="summaryProject">${escapeHtml(projectId)}</span>
              <span class="summaryCount">${summary.count} file(s)</span>
              <span class="summarySize">${formatBytes(summary.totalBytes)}</span>
            </span>
          `).join("")}
      </div>
    `;

    els.history.innerHTML = `
      ${summaryHtml}
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Date (JST)</th>
              <th>Project</th>
              <th>Seq</th>
              <th>File</th>
              <th style="text-align:right;">Size</th>
              <th>Video type</th>
              <th>Description (Sheets)</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function initializeDropZone() {
    els.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (!els.fileInput.disabled) els.dropZone.classList.add("dropZoneOver");
    });

    els.dropZone.addEventListener("dragleave", (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("dropZoneOver");
    });

    els.dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("dropZoneOver");
      if (els.fileInput.disabled) return;

      const videoFiles = [...(event.dataTransfer?.files || [])].filter((file) => file.type.startsWith("video/"));
      if (videoFiles.length === 0) {
        alert("動画ファイルのみドロップできます。");
        return;
      }

      const dataTransfer = new DataTransfer();
      videoFiles.forEach((file) => dataTransfer.items.add(file));
      els.fileInput.files = dataTransfer.files;
      buildPerFileEditors(els.fileInput.files);
      updateSelectedSize(els.fileInput.files);
      els.recordingDateInput.value = ymdTokyo(new Date());
    });

    els.fileInput.onchange = () => {
      const files = els.fileInput.files;
      if (!files || files.length === 0) {
        updateSelectedSize([]);
        return;
      }
      buildPerFileEditors(files);
      updateSelectedSize(files);
      els.recordingDateInput.value = ymdTokyo(new Date());
    };
  }

  function initializeHistoryEditing() {
    els.history.addEventListener("click", async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const button = target.closest("button");
      if (!button) return;

      const row = target.closest("tr[data-file-id]");
      if (!row) return;

      const fileId = row.getAttribute("data-file-id");
      if (!fileId) return;

      const editWrap = row.querySelector(".descEdit");
      const viewWrap = row.querySelector(".descView");
      const statusEl = row.querySelector(".editStatus");

      if (button.classList.contains("btnStartEdit")) {
        if (editWrap) editWrap.style.display = "block";
        if (viewWrap) viewWrap.style.display = "none";
        button.disabled = true;
        return;
      }

      if (button.classList.contains("btnCancelEdit")) {
        if (editWrap) editWrap.style.display = "none";
        if (viewWrap) viewWrap.style.display = "block";
        const startButton = row.querySelector(".btnStartEdit");
        if (startButton) startButton.disabled = false;
        if (statusEl) statusEl.textContent = "";
        return;
      }

      if (!button.classList.contains("btnSaveEdit")) return;

      const startButton = row.querySelector(".btnStartEdit");
      const projectInput = row.querySelector(".editProject");
      const dateInput = row.querySelector(".editDate");
      const labelInput = row.querySelector(".editLabel");
      const descInput = row.querySelector(".editDesc");
      const typeInput = row.querySelector(".editVideoType");

      const newProjectId = (projectInput?.value || "").trim();
      const newDate = normalizeDateInputToYyyymmdd(dateInput?.value || "");
      const newLabel = sanitizeLabel(labelInput?.value || "");
      const newDesc = (descInput?.value || "").trim();
      const newVideoType = (typeInput?.value || "").trim();

      if (!newProjectId) {
        if (statusEl) statusEl.textContent = "Project is required.";
        return;
      }
      if (!newDate) {
        if (statusEl) statusEl.textContent = "Invalid date. Use YYYYMMDD or YYYY-MM-DD.";
        return;
      }
      if (!newLabel) {
        if (statusEl) statusEl.textContent = "Short label is required.";
        return;
      }
      if (!newDesc) {
        if (statusEl) statusEl.textContent = "Description is required.";
        return;
      }
      if (!newVideoType) {
        if (statusEl) statusEl.textContent = "Video type is required.";
        return;
      }

      const rowInfo = lastLogMap.get(fileId);
      if (!rowInfo?.rowNum) {
        if (statusEl) statusEl.textContent = "Log row not found (try Refresh history).";
        return;
      }

      const link = row.querySelector("td:nth-child(4) a");
      const currentName = link?.textContent || "";
      const ext = extractExtFromFileName(currentName);
      const currentProjectId = row.querySelector("td:nth-child(2)")?.textContent || "";
      const currentSeq = Number(row.querySelector("td:nth-child(3)")?.textContent || "");

      if (!currentProjectId || !Number.isFinite(currentSeq)) {
        if (statusEl) statusEl.textContent = "Cannot parse projectId/seq from row.";
        return;
      }

      const projectChanged = newProjectId !== currentProjectId;
      const targetProject = projectChanged ? getProjectMetaById(newProjectId) : getProjectMetaById(currentProjectId);
      if (projectChanged && (!targetProject || !targetProject.folderId)) {
        if (statusEl) statusEl.textContent = "Target project is not available.";
        return;
      }

      const newSeq = projectChanged ? await getNextSeqSmallestAvailable(newProjectId) : currentSeq;
      const newName = buildUploadFileName({
        projectId: newProjectId,
        recordingDate: newDate,
        seq: newSeq,
        label: newLabel,
        ext,
      });

      try {
        button.disabled = true;
        if (startButton) startButton.disabled = true;
        if (statusEl) statusEl.textContent = "Saving...";

        await updateDriveFileMeta({
          fileId,
          newName,
          newRecordingDate: newDate,
          newVideoType,
          projectId: projectChanged ? newProjectId : null,
          projectNo: projectChanged ? targetProject.projectNo : null,
          seq: projectChanged ? newSeq : null,
          moveToFolderId: projectChanged ? targetProject.folderId : "",
        });
        await updateLogRowAfterInlineEdit(rowInfo.rowNum, {
          projectId: newProjectId,
          seq: newSeq,
          fileName: newName,
          description: newDesc,
          videoType: newVideoType,
        });

        if (statusEl) statusEl.textContent = "Saved.";
        await loadVideoTypesFromLog(newVideoType);
        await loadMyHistory(20);
      } catch (error) {
        console.error(error);
        if (statusEl) statusEl.textContent = "Save failed. See console.";
      } finally {
        button.disabled = false;
      }
    });
  }

  async function handleUpload() {
    let emaSpeed = 0;
    const EMA_ALPHA = 0.3;

    try {
      const files = els.fileInput.files;
      const fileList = [...files];
      if (!files || fileList.length === 0) {
        alert("Please select video files");
        return;
      }

      const project = getSelectedProjectMeta();
      const isPerFile = els.descModePerFile.checked;

      if (!isPerFile && !(els.desc.value || "").trim()) {
        alert("Description is required.");
        return;
      }

      const commonText = (els.desc.value || "").trim();
      const perDescMap = isPerFile ? getPerFileDescriptions() : new Map();

      if (isPerFile) {
        for (let index = 0; index < fileList.length; index += 1) {
          if (!(perDescMap.get(index) || "").trim()) {
            alert(`Description is required for file #${index + 1}.`);
            return;
          }
        }
      }

      const totalBytes = fileList.reduce((sum, file) => sum + file.size, 0);
      let doneBytesBefore = 0;

      els.btnUpload.disabled = true;
      setProgress(0);
      els.statusLine.textContent = `Uploading ${fileList.length} file(s)...`;
      els.speedText.textContent = "Speed: -";
      els.etaText.textContent = "ETA: -";

      const results = [];
      const uploadedFileIds = [];
      const recordingDate = getSelectedRecordingYyyymmdd();
      const selectedVideoType = (els.videoTypeInput.value || "").trim();
      if (!selectedVideoType) {
        alert("Video type is required.");
        return;
      }

      const shortLabel = sanitizeLabel((els.fileLabelInput.value || "").trim());
      if (!shortLabel) {
        alert("Short label is required.");
        return;
      }

      for (let index = 0; index < fileList.length; index += 1) {
        const file = fileList[index];
        const seq = await getNextSeqSmallestAvailable(project.projectId);
        const ext = getFileExt(file.name);
        const finalName = buildUploadFileName({
          projectId: project.projectId,
          recordingDate,
          seq,
          label: shortLabel,
          ext,
        });

        els.currentFileText.textContent = `Current: ${index + 1}/${fileList.length}  ${file.name}`;
        els.finalNameText.textContent = `Final name: ${finalName}`;

        const description = isPerFile ? (perDescMap.get(index) || "") : commonText;
        const appProperties = {
          schema: CONFIG.APP_SCHEMA,
          projectId: project.projectId,
          projectNo: String(project.projectNo),
          seq: String(seq),
          uploaderEmail: myEmail,
          recordingDate,
          videoType: selectedVideoType,
        };

        const uploadUrl = await drive.startResumableUpload({
          fileName: finalName,
          folderId: project.folderId,
          description,
          file,
          appProperties,
        });

        const uploaded = await drive.uploadInChunks(uploadUrl, file, CONFIG.CHUNK_SIZE, (status) => {
          const overall = Math.floor(((doneBytesBefore + status.fileOffset) / totalBytes) * 100);
          setProgress(overall);

          if (status.speedBps > 0) {
            emaSpeed = emaSpeed === 0 ? status.speedBps : EMA_ALPHA * status.speedBps + (1 - EMA_ALPHA) * emaSpeed;
          }

          els.speedText.textContent = `Speed: ${formatSpeed(emaSpeed)}`;
          const remaining = totalBytes - (doneBytesBefore + status.fileOffset);
          els.etaText.textContent = `ETA: ${formatETA(emaSpeed > 0 ? remaining / emaSpeed : Infinity)}`;
        });

        const fileId = uploaded.id;
        const driveLink = `https://drive.google.com/file/d/${fileId}/view`;
        const templateId = els.templateSelect.value || "none";

        await appendLogRow([
          new Date().toISOString(),
          project.projectId,
          myEmail,
          String(seq),
          finalName,
          String(file.size),
          description,
          fileId,
          driveLink,
          templateId,
          APP_VERSION,
          selectedVideoType,
        ]);

        results.push({ finalName, driveLink });
        uploadedFileIds.push(fileId);
        doneBytesBefore += file.size;
      }

      setProgress(100);
      els.statusLine.textContent = `Done: ${fileList.length} file(s) uploaded.`;
      els.speedText.textContent = "Speed: -";
      els.etaText.textContent = "ETA: 00:00";

      if (results.length > 0) {
        alert(`Upload complete:\n${results.map((result) => result.finalName).join("\n")}`);
      } else {
        alert("Upload complete");
      }

      els.progressWrap.style.display = "none";
      resetUploadFormUI();
      await loadProjects();
      await loadMyHistory(20);

      if (uploadedFileIds.length > 0) {
        const tableWrap = els.history.querySelector(".tableWrap");
        let firstMatch = null;
        for (const id of uploadedFileIds) {
          const row = els.history.querySelector(`tr[data-file-id="${id}"]`);
          if (!row) continue;
          row.classList.add("rowHighlight");
          row.addEventListener("animationend", () => row.classList.remove("rowHighlight"), { once: true });
          if (!firstMatch) firstMatch = row;
        }

        if (tableWrap) {
          tableWrap.scrollTop = firstMatch
            ? Math.max(0, firstMatch.offsetTop - tableWrap.offsetTop - 20)
            : 0;
        }
      }
    } catch (error) {
      console.error(error);
      alert("Upload failed (see console)");
    } finally {
      setUploadEnabledState();
    }
  }

  function bindEvents(tokenClient) {
    els.descModeCommon.onchange = updateDescModeUI;
    els.descModePerFile.onchange = updateDescModeUI;
    els.videoTypeSelect.onchange = () => syncVideoTypeInputFromSelect();
    els.videoTypeInput.oninput = () => setUploadEnabledState();
    els.btnUpload.onclick = handleUpload;

    if (els.rememberSignin) {
      els.rememberSignin.checked = getRememberEnabled();
      els.rememberSignin.onchange = () => setRememberEnabled(!!els.rememberSignin.checked);
    }

    els.btnLogin.addEventListener("click", () => {
      setRememberEnabled(!!els.rememberSignin?.checked);
      els.loginError.textContent = "";
      els.btnLogin.disabled = true;
      els.btnLogin.textContent = "Signing in...";
      try {
        tokenClient.requestAccessToken();
      } catch (error) {
        console.error("requestAccessToken error:", error);
        els.loginError.textContent = `エラー: ${error?.message || String(error)}`;
        els.btnLogin.disabled = false;
        els.btnLogin.textContent = "Sign in with Google";
      }
    });

    els.btnLogout.onclick = () => {
      setRememberEnabled(false);
      if (els.rememberSignin) els.rememberSignin.checked = false;
      setLoggedOut();
      showLoginScreen();
    };

    els.btnReloadProjects.onclick = async () => {
      try {
        await loadProjects();
      } catch (error) {
        console.error(error);
        alert("Failed to load projects (see console)");
      }
    };

    els.btnReloadHistory.onclick = async () => {
      try {
        await loadVideoTypesFromLog(els.videoTypeSelect.value || "");
        await loadMyHistory(20);
      } catch (error) {
        console.error(error);
        alert("Failed to load history (see console)");
      }
    };

    els.historyProjectFilter.onchange = async () => {
      try {
        await loadMyHistory(20);
      } catch (error) {
        console.error(error);
        alert("Failed to load history (see console)");
      }
    };

    els.projectSelect.addEventListener("change", () => {
      try {
        if (els.projectSelect.value) localStorage.setItem(STORAGE_KEYS.LAST_PROJECT, els.projectSelect.value);
      } catch {}
      setUploadEnabledState();
    });
  }

  function createTokenClient() {
    return google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      error_callback: (error) => {
        console.error("Google OAuth error:", error);
        if (silentAuthInProgress) {
          silentAuthInProgress = false;
          showLoginScreen();
          els.me.textContent = "Signed out";
          return;
        }

        els.btnLogin.disabled = false;
        els.btnLogin.textContent = "Sign in with Google";
        if (error?.type === "popup_failed_to_open") {
          els.loginError.textContent = "ポップアップがブロックされています。ブラウザのポップアップ許可設定を確認してください。";
          return;
        }
        if (error?.type === "popup_closed") {
          els.loginError.textContent = "サインインがキャンセルされました。";
          return;
        }
        els.loginError.textContent = `サインインに失敗しました（${error?.type || "unknown"}）`;
      },
      callback: async (response) => {
        silentAuthInProgress = false;
        accessToken = response.access_token;

        try {
          myEmail = await fetchMyEmail(accessToken);
          hideLoginScreen();
          els.loginError.textContent = "";
          els.btnLogin.disabled = false;
          els.btnLogin.textContent = "Sign in with Google";
          setLoggedIn(myEmail);

          els.recordingDateInput.disabled = false;
          if (els.adminLink) {
            els.adminLink.style.display = isAdminEmail(myEmail, CONFIG.ADMIN_EMAIL) ? "inline-flex" : "none";
          }

          els.btnReloadProjects.disabled = false;
          els.descModeCommon.disabled = false;
          els.descModePerFile.disabled = false;
          els.templateSelect.disabled = false;
          els.desc.disabled = false;
          els.videoTypeInput.disabled = false;
          els.fileInput.disabled = false;
          els.recordingDateInput.disabled = false;
          els.fileLabelInput.disabled = false;

          initTemplates();
          await loadVideoTypesFromLog();
          updateDescModeUI();
          setRecordingDateTodayDefault();
          await loadProjects();
          await loadMyHistory(20);
        } catch (error) {
          console.error(error);
          if (isPermissionDeniedError(error)) {
            els.me.textContent = `Signed in: ${myEmail} (No access)`;
            els.history.textContent = `Access denied. Ask admin (${CONFIG.ADMIN_EMAIL}) to grant access in admin.html > User Access.`;
            els.btnUpload.disabled = true;
            els.videoTypeInfo.textContent = "Access denied. Waiting for admin grant.";
          } else {
            els.me.textContent = "Post-login step failed. Check console.";
          }
        }
      },
    });
  }

  initializeDropZone();
  initializeHistoryEditing();

  const tokenClient = createTokenClient();
  bindEvents(tokenClient);
  buildAllowedList();
  setLoggedOut();

  if (getRememberEnabled()) {
    hideLoginScreen();
    els.me.textContent = "Signing in...";
    silentAuthInProgress = true;
    try {
      tokenClient.requestAccessToken({ prompt: "" });
    } catch {
      silentAuthInProgress = false;
      showLoginScreen();
      els.me.textContent = "Signed out";
    }
  } else {
    showLoginScreen();
  }
}

initIndexPage();
