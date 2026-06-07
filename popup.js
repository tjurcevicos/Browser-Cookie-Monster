document.addEventListener('DOMContentLoaded', async () => {
  const monster = document.getElementById('monster');
  const healthBar = document.getElementById('health-bar');
  const cookieCountText = document.getElementById('cookie-count');
  const rageBtn = document.getElementById('rage-btn');
  const whitelistInput = document.getElementById('whitelist-input');
  const addWhitelistBtn = document.getElementById('add-whitelist');
  const whitelistList = document.getElementById('whitelist-list');
  
  const chewSound = new Audio('chew.mp3');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  
  const url = new URL(tab.url);
  const currentDomain = url.hostname;

  function updateCookieUI() {
    chrome.cookies.getAll({ domain: currentDomain }, (cookies) => {
      cookieCountText.innerText = `Cookies on this page: ${cookies.length}`;
    });
  }

  function updateHealthBar() {
    chrome.storage.local.get(['monsterHealth'], (data) => {
      const health = data.monsterHealth !== undefined ? data.monsterHealth : 100;
      healthBar.style.width = `${health}%`;
      healthBar.style.backgroundColor = health < 30 ? '#ff4444' : '#4CAF50';
    });
  }

  function displayWhitelist() {
    chrome.storage.local.get(['whitelist'], (data) => {
      const whitelist = data.whitelist || [];
      whitelistList.innerHTML = '';
      whitelist.forEach((domain) => {
        const li = document.createElement('li');
        li.textContent = domain;
        const removeSpan = document.createElement('span');
        removeSpan.textContent = ' ❌';
        removeSpan.className = 'remove-btn';
        removeSpan.addEventListener('click', () => {
          const updated = whitelist.filter(d => d !== domain);
          chrome.storage.local.set({ whitelist: updated }, displayWhitelist);
        });
        li.appendChild(removeSpan);
        whitelistList.appendChild(li);
      });
    });
  }

  function scheduleNextPopupTicks() {
    const choice = Math.floor(Math.random() * 3);
    let randomInterval = 10000;
    
    if (choice === 1) {
      randomInterval = 20000;
    } else if (choice === 2) {
      randomInterval = 30000;
    }

    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "tickHunger" }, () => {
        if (chrome.runtime.lastError) {
          scheduleNextPopupTicks();
          return;
        }
        updateHealthBar(); 
        updateCookieUI();
        scheduleNextPopupTicks();
      });
    }, randomInterval);
  }

  addWhitelistBtn.addEventListener('click', () => {
    const value = whitelistInput.value.trim();
    if (!value) return;
    chrome.storage.local.get(['whitelist'], (data) => {
      const whitelist = data.whitelist || [];
      if (!whitelist.includes(value)) {
        whitelist.push(value);
        chrome.storage.local.set({ whitelist }, () => {
          whitelistInput.value = '';
          displayWhitelist();
        });
      }
    });
  });

  rageBtn.addEventListener('click', () => {
    monster.className = 'rage';
    
    chrome.storage.local.get(['whitelist', 'monsterHealth'], (data) => {
      const whitelist = data.whitelist || [];
      let currentHealth = data.monsterHealth !== undefined ? data.monsterHealth : 100;
      
      chrome.cookies.getAll({ domain: currentDomain }, (cookies) => {
        let eatenCount = 0;
        
        cookies.forEach(cookie => {
          const isWhitelisted = whitelist.some(domain => currentDomain.includes(domain));
          
          if (!isWhitelisted) {
            const cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
            chrome.cookies.remove({ url: cookieUrl, name: cookie.name });
            eatenCount++;
          }
        });
        
        setTimeout(() => {
          monster.className = 'eating';
          chewSound.play().catch(err => console.log(err));

          const newHealth = Math.min(100, currentHealth + (eatenCount * 5));
          chrome.storage.local.set({ monsterHealth: newHealth }, () => {
            updateHealthBar();
          });

          setTimeout(() => {
            monster.className = 'idle';
            updateCookieUI();
          }, 1500);
        }, 1000);
      });
    });
  });

  updateCookieUI();
  displayWhitelist();
  updateHealthBar();
  scheduleNextPopupTicks();
  setInterval(updateHealthBar, 1000);
});
