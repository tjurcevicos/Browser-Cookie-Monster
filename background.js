let currentHealth = 100;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ monsterHealth: currentHealth });
  setupBackgroundAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  setupBackgroundAlarm();
});

function setupBackgroundAlarm() {
  chrome.alarms.create('hungerAlarm', { periodInMinutes: 1 });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "tickHunger") {
    processHealthReduction(1, sendResponse);
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'hungerAlarm') {
    processHealthReduction(3); 
  }
});

function processHealthReduction(reductionAmount, sendResponse) {
  chrome.storage.local.get(['monsterHealth'], ({ monsterHealth }) => {
    if (monsterHealth !== undefined) {
      currentHealth = monsterHealth;
    }
    
    if (currentHealth > 0) {
      currentHealth = Math.max(0, currentHealth - reductionAmount);
      chrome.storage.local.set({ monsterHealth: currentHealth }, () => {
        if (sendResponse) {
          sendResponse({ success: true, health: currentHealth });
        }
        if (currentHealth < 30) {
          checkAndAutoEat();
        }
      });
    } else if (sendResponse) {
      sendResponse({ success: true, health: currentHealth });
    }
  });
}

function checkAndAutoEat() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    const activeTab = tabs[0];
    if (!activeTab.url || !activeTab.url.startsWith('http')) return;

    try {
      const url = new URL(activeTab.url);
      const activeDomain = url.hostname;

      chrome.storage.local.get(['whitelist'], ({ whitelist = [] }) => {
        const isWhitelisted = whitelist.some(domain => activeDomain.includes(domain));

        if (!isWhitelisted) {
          chrome.cookies.getAll({ domain: activeDomain }, (cookies) => {
            if (cookies && cookies.length > 0) {
              const cookieToEat = cookies[0];
              const cookieUrl = `http${cookieToEat.secure ? 's' : ''}://${cookieToEat.domain}${cookieToEat.path}`;
              
              chrome.cookies.remove({ url: cookieUrl, name: cookieToEat.name }, () => {
                currentHealth = Math.min(100, currentHealth + 5);
                chrome.storage.local.set({ monsterHealth: currentHealth });
              });
            }
          });
        }
      });
    } catch {}
  });
}
