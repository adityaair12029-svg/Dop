const statusEl = document.getElementById('status');
const activateBtn = document.getElementById('activateBtn');

chrome.runtime.sendMessage({ type: 'get_status' }, (res) => {
  if (chrome.runtime.lastError) {
    statusEl.textContent = 'Extension worker starting...';
    return;
  }
  statusEl.textContent = res?.companionConnected
    ? 'Desktop Companion: Connected'
    : 'Desktop Companion: Not detected (install native host)';
});

activateBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'activate_voice' }, (res) => {
    statusEl.textContent = res?.companionConnected
      ? 'Listening requested via Desktop Companion.'
      : 'Desktop Companion offline. Open the DOPE Web Dashboard to use browser voice mode.';
  });
});
