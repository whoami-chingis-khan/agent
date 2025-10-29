export interface SessionData {
  'x-xsrf-token': string;
  'host-session-id': string;
  'membercode': string;
  'request-owner': string;
  'cookie': string;
}

export interface SessionStatus {
  hasAuth: boolean;
  xsrfToken?: string;
  aid?: string;
  rid?: string;
  sessionId?: string;
  memberCode?: string;
  requestOwner?: string;
}
