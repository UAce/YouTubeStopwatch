console.log('Content Script loaded!');

var currentTabId;

// Send message to background.js to get tab Id
chrome.runtime.sendMessage({ from: "youtube" });

// Get current tab id from background and add listeners to detect Tabs closed or Windows closed
chrome.runtime.onMessage.addListener(function (msg) {
    console.log("Content script received", msg);
    if (msg.from === "background") {
        currentTabId = msg.tabId;
    }
});