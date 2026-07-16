/* JobOrbit first-party analytics beacon.
   Sends a pageview on load and exposes window.jbTrack(eventName, data) for
   key funnel events. No cookies, no cross-site identifiers — session id is
   a per-tab sessionStorage UUID used only to group a single visit. */
(function () {
  function getSessionId() {
    try {
      let id = sessionStorage.getItem('jb_sid');
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() :
          'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          }));
        sessionStorage.setItem('jb_sid', id);
      }
      return id;
    } catch (e) {
      return 'nostorage';
    }
  }

  function referrerDomain() {
    try {
      if (!document.referrer) return '';
      const host = new URL(document.referrer).hostname;
      return host === location.hostname ? '' : host;
    } catch (e) {
      return '';
    }
  }

  function send(url, payload) {
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
      }
    } catch (e) { /* tracking must never break the page */ }
  }

  const sessionId = getSessionId();

  send('/api/analytics/pageview', {
    path: location.pathname,
    referrer_domain: referrerDomain(),
    session_id: sessionId
  });

  window.jbTrack = function (eventName, eventData) {
    send('/api/analytics/event', {
      session_id: sessionId,
      event_name: eventName,
      event_data: eventData || undefined,
      path: location.pathname
    });
  };
})();
