// app.js (current)
export const CONFIG = {
  // OAuth Client ID
  CLIENT_ID: "411263853516-98l2a2vrsa03v4h57q8ass5153qicrvk.apps.googleusercontent.com",

  // Google Sheets
  SPREADSHEET_ID: "1G3sD3UsK0rvrg0p9nQk4UlpI4j6Zy6qyi1KatGCZI0E",
  PROJECTS_SHEET: "Projects",
  LOG_SHEET: "Log",

  // Drive root folder (parent of project folders)
  ROOT_FOLDER_ID: "1q05tNgvo8iz89sg3cuoDjDGtdEHvykvX",

  // Admin gate (used for showing Admin button + admin.html access)
  ADMIN_EMAIL: "taiyoparent1@gmail.com",

  // Chunk size for resumable upload
  CHUNK_SIZE: 8 * 1024 * 1024,

  // OAuth scopes (email + Drive + Sheets)
  SCOPES: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets"
  ].join(" "),

  // Drive appProperties schema name
  APP_SCHEMA: "devlog_v1",

  // Description templates
  TEMPLATES: [
    { id: "none", name: "(None)", body: "" },
    {
      id: "daily",
      name: "Devlog (Daily)",
      body:
        "[What I did]\n- \n\n" +
        "[Blockers]\n- \n\n" +
        "[Next steps]\n- \n"
    }
  ]
};