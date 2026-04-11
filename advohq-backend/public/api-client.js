/**
 * AdvoHQ API client
 * Drop this file next to your HTML pages.
 * Configure ADVOHQ_API via a <script> before this one:
 *   window.ADVOHQ_API = 'https://your-backend.onrender.com';
 * Or it defaults to window.location.origin (same-origin hosting).
 */

(function (global) {
  'use strict';

  const BASE = (global.ADVOHQ_API || '').replace(/\/$/, '') || '';

  // ── Token helpers ────────────────────────────────────────────────────────────
  function getToken()    { return localStorage.getItem('advohq_token'); }
  function setToken(t)   { localStorage.setItem('advohq_token', t); }
  function getRefresh()  { return localStorage.getItem('advohq_refresh'); }
  function setRefresh(t) { localStorage.setItem('advohq_refresh', t); }

  function clearSession() {
    localStorage.removeItem('advohq_token');
    localStorage.removeItem('advohq_refresh');
    localStorage.removeItem('advohq_user');
  }

  function saveUser(u) {
    localStorage.setItem('advohq_user', JSON.stringify(u));
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem('advohq_user')); } catch { return null; }
  }

  // ── Fetch wrapper with automatic refresh ────────────────────────────────────
  let _refreshing = null;

  async function req(method, path, body, isRetry = false) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(BASE + path, opts);

    // Attempt token refresh on 401, once
    if (res.status === 401 && !isRetry) {
      const refresh = getRefresh();
      if (!refresh) { clearSession(); throw new Error('Session expired. Please log in again.'); }

      if (!_refreshing) {
        _refreshing = fetch(BASE + '/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        }).then(r => r.json()).finally(() => { _refreshing = null; });
      }

      const data = await _refreshing;
      if (!data.token) { clearSession(); throw new Error('Session expired. Please log in again.'); }
      setToken(data.token);
      if (data.refresh_token) setRefresh(data.refresh_token);
      return req(method, path, body, true);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  const get    = (p)    => req('GET',    p);
  const post   = (p, b) => req('POST',   p, b);
  const put    = (p, b) => req('PUT',    p, b);
  const patch  = (p, b) => req('PATCH',  p, b);
  const del    = (p)    => req('DELETE', p);

  // ── Public API object ────────────────────────────────────────────────────────
  const API = {

    // ── Auth ──────────────────────────────────────────────────────────────────
    isLoggedIn() { return !!getToken(); },
    getUser,

    async register(name, email, username, password) {
      const data = await post('/api/auth/register', { name, email, username, password });
      setToken(data.token);
      if (data.refresh_token) setRefresh(data.refresh_token);
      if (data.user) saveUser(data.user);
      return data;
    },

    async login(login, password) {
      const data = await post('/api/auth/login', { login, password });
      setToken(data.token);
      if (data.refresh_token) setRefresh(data.refresh_token);
      if (data.user) saveUser(data.user);
      return data;
    },

    async logout() {
      const refresh_token = getRefresh();
      try { await post('/api/auth/logout', { refresh_token }); } catch {}
      clearSession();
      window.location.href = 'login.html';
    },

    async getMe() {
      const data = await get('/api/auth/me');
      if (data.user) saveUser(data.user);
      return data;
    },

    // ── Cases ─────────────────────────────────────────────────────────────────
    getCases(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return get('/api/cases' + (qs ? '?' + qs : ''));
    },
    getCase(id)          { return get(`/api/cases/${id}`); },
    createCase(body)     { return post('/api/cases', body); },
    updateCase(id, body) { return put(`/api/cases/${id}`, body); },
    updatePoints(id, points) { return patch(`/api/cases/${id}/points`, { points }); },
    deleteCase(id)       { return del(`/api/cases/${id}`); },

    // ── Events ────────────────────────────────────────────────────────────────
    getEvents(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return get('/api/events' + (qs ? '?' + qs : ''));
    },
    getUpcomingEvents()       { return get('/api/events/upcoming'); },
    createEvent(body)         { return post('/api/events', body); },
    updateEvent(id, body)     { return put(`/api/events/${id}`, body); },
    deleteEvent(id)           { return del(`/api/events/${id}`); },

    // ── Notifications ─────────────────────────────────────────────────────────
    getNotifications()        { return get('/api/notifications'); },
    getNotificationCount()    { return get('/api/notifications/count'); },
    markNotificationRead(id)  { return patch(`/api/notifications/${id}/read`, {}); },
    markAllNotificationsRead(){ return post('/api/notifications/read-all', {}); },
    deleteNotification(id)    { return del(`/api/notifications/${id}`); },

    // ── Files ─────────────────────────────────────────────────────────────────
    getFiles(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return get('/api/files' + (qs ? '?' + qs : ''));
    },
    getFile(id)              { return get(`/api/files/${id}`); },
    createFile(body)         { return post('/api/files', body); },
    saveCanvas(id, canvasData) { return patch(`/api/files/${id}/canvas`, { canvas_data: canvasData }); },
    deleteFile(id)           { return del(`/api/files/${id}`); },

    // ── Users / Settings ──────────────────────────────────────────────────────
    updateProfile(body)      { return patch('/api/users/me', body); },
    updatePassword(current_password, new_password) {
      return patch('/api/users/me/password', { current_password, new_password });
    },
    saveSettings(settings)   { return patch('/api/users/me/settings', { settings }); },
    deleteAccount(password)  { return req('DELETE', '/api/users/me', { password }); },
  };

  global.API = API;

})(window);
