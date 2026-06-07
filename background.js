let currentHealth = 100;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ monsterHealth: currentHealth });
  scheduleNextHungerTicks();
});

function scheduleNextHungerTicks() {
  const intervals = [10000, 20000, 30000];
  const randomInterval = intervals[Math.floor(Math.random() * intervals.length)];

  setTimeout(() => {
    chrome.storage.local.get(['monsterHealth'], ({ monsterHealth }) => {
      if (monsterHealth !== undefined) {
        currentHealth = monsterHealth;
      }
      if (currentHealth > 0) {
        currentHealth -= 1;
        chrome.storage.local.set({ monsterHealth: currentHealth });
        
        if (currentHealth < 30) {
          checkAndAutoEat();
        }
      }
      scheduleNextHungerTicks();
    });
  }, randomInterval);
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
    } catch {
      
    }
  });
}
