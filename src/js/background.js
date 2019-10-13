'use strict';

console.log('background script loaded!');

var active_youtube_tabs = [];

chrome.runtime.onInstalled.addListener(function () {
    chrome.runtime.onMessage.addListener(function (msg, sender) {
        var tabId = sender.tab.id;
        switch (msg.from) {
            case "youtube":
                if (active_youtube_tabs.indexOf(tabId) < 0) {
                    active_youtube_tabs.push(tabId);
                    chrome.tabs.sendMessage(tabId, {
                        from: "background",
                        tabId: tabId
                    });
                    chrome.tabs.onRemoved.addListener(function (id, removed) {
                        if (tabId === id) {
                            var idx = active_youtube_tabs.indexOf(tabId);
                            active_youtube_tabs.splice(idx, 1);
                            active_youtube_tabs.length === 0 ? pauseCountdown() : '';
                            console.log("Youtube tab closed");
                        }
                    });
                }
                if (msg.content && msg.content === 'startCountdown') {
                    startCountdown();
                }
                break;
            case "popup":
                break;
            default:
                break;
        }
    });
});

function startCountdown() {
    chrome.storage.sync.set({ 'countdown_status': 'started' });
    chrome.browserAction.setBadgeText({ text: 'ON' });
    chrome.browserAction.setBadgeBackgroundColor({ color: '#F50F0F' });
    console.log("Start countdown");
}

function pauseCountdown() {
    chrome.storage.sync.set({ 'countdown_status': 'paused' });
    chrome.browserAction.setBadgeText({ 'text': '' });
    console.log("Pause countdown");
}
