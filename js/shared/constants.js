export const STORAGE_KEYS = Object.freeze({
  REMEMBER_SIGNIN: "devlog_remember_signin",
  LAST_PROJECT: "devlog_last_project",
  ALLOWED_EMAILS: "devlog_allowed_emails",
});

export const DEFAULT_VIDEO_TYPE = "Screen Recording";
export const APP_VERSION = "v1.0";

export const PROJECTS_COLUMNS = Object.freeze({
  PROJECT_NO: 0,
  PROJECT_ID: 1,
  PROJECT_NAME: 2,
  FOLDER_ID: 3,
  NEXT_SEQ: 4,
  IS_ACTIVE: 5,
  CREATED_AT: 6,
  CREATED_BY: 7,
});

export const LOG_COLUMNS = Object.freeze({
  UPLOADED_AT: 0,
  PROJECT_ID: 1,
  UPLOADER_EMAIL: 2,
  SEQ: 3,
  FILE_NAME: 4,
  SIZE_BYTES: 5,
  DESCRIPTION: 6,
  DRIVE_FILE_ID: 7,
  DRIVE_LINK: 8,
  TEMPLATE_ID: 9,
  APP_VERSION: 10,
  VIDEO_TYPE: 11,
});
