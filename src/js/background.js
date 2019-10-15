'use strict';

console.log('background script loaded!');

// Constants
const status = {
    STARTED: 'started',
    STOPPED: 'stopped',
}

const source = {
    BACKGROUND: 'background',
    PAGE: 'youtube',
    POPUP: 'popup'
}

const color = {
    GREY: '#bbbdbb',
    RED: '#F50F0F',
    BLUE: '#1c2efc',
    GREEN: '#4bb543'
}
var active_youtube_tabs = [];

chrome.runtime.onInstalled.addListener(function () {
    stopCountdown(); // make sure countdown is stopped if reload extension
    chrome.runtime.onMessage.addListener(function (msg, sender) {
        var tabId = sender.tab ? sender.tab.id : null;
        switch (msg.from) {
            case source.PAGE:
                if (tabId && active_youtube_tabs.indexOf(tabId) < 0) {
                    active_youtube_tabs.push(tabId);
                    chrome.tabs.sendMessage(tabId, {
                        from: source.BACKGROUND,
                        tabId: tabId
                    });
                    addListeners(tabId);
                }
                if (msg.startCountdown) {
                    chrome.storage.sync.set({ 'countdown_status': status.STARTED });
                    startCountdown();
                }
                if (tabId && msg.closeTab) {
                    chrome.tabs.remove(tabId);
                }
                break;
            case source.POPUP:
                if (msg.resetCountdown) {
                    reset();
                }
                break;
            default:
                break;
        }
    });
});

function removeYoutubeTab(tabId) {
    var idx = active_youtube_tabs.indexOf(tabId);
    active_youtube_tabs.splice(idx, 1);
    active_youtube_tabs.length === 0 ? stopCountdown() : '';
    console.log("Youtube tab closed");
}

function addListeners(senderTabId) {
    console.log("Youtube tab opened");
    chrome.tabs.onRemoved.addListener(function (id) {
        if (senderTabId === id) {
            removeYoutubeTab(senderTabId);
        }
    });
    chrome.tabs.onUpdated.addListener(function (id, changeInfo) {
        if (senderTabId === id && changeInfo.status === 'complete') {
            chrome.tabs.get(senderTabId, function (tab) {
                if (tab.url.indexOf('youtube.com') < 0) {
                    removeYoutubeTab(senderTabId);
                } else {
                    chrome.tabs.sendMessage(senderTabId, {
                        from: source.BACKGROUND,
                        init: true
                    });
                }
            });
        }
    });
}

function printEvent(ev) {
    console.log("________________\n\n" + ev + "\n________________\n\n");
}

function reset() {
    console.log('reset!');
    chrome.storage.sync.set({ 'countdown_status': status.STOPPED });
    chrome.storage.sync.set({ 'blur_value': 0 });
    remainingTime = 0;
    remainingHours = remainingMinutes = remainingSeconds = undefined;
    stopCountdown();
}

/*
 * Countdown
*/
var countdownId, remainingTime, remainingHours, remainingMinutes, remainingSeconds;

function countdown(seconds) {
    var now = new Date().getTime();
    var target = new Date(now + seconds * 1000);
    var update = 500;

    countdownId = setInterval(function () {
        var now = new Date();
        remainingTime = (target - now) / 1000;
        if (remainingTime < 0) {
            remainingTime = -1;
            stopCountdown();
            chrome.storage.sync.set({ 'blur_value': 2 });
            if (confirm('Oops! Looks like you ran out of time. Exit YouTube?')) {
                active_youtube_tabs.forEach(function (id) {
                    // Close all YouTube tabs
                    chrome.tabs.remove(id);
                    removeYoutubeTab(id);
                });
            } else {
                active_youtube_tabs.forEach(function (id) {
                    chrome.tabs.sendMessage(id, { from: source.BACKGROUND, init: true, tabId: id });
                });
            }
            return;
        }
        remainingHours = ~~((remainingTime / 3600));
        remainingMinutes = ~~((remainingTime / 60) % 60)
        remainingSeconds = ~~(remainingTime % 60);
    }, update);
}

function startCountdown() {
    chrome.storage.sync.set({ 'countdown_status': status.STARTED });
    chrome.browserAction.setBadgeText({ text: 'ON' });
    chrome.browserAction.setBadgeBackgroundColor({ color: color.GREEN });
    printEvent('START COUNTDOWN');
    chrome.storage.sync.get(['remainingTime'], function (data) {
        countdown(data.remainingTime);
    });
}

function stopCountdown() {
    chrome.storage.sync.set({ 'countdown_status': status.STOPPED });
    chrome.storage.sync.set({ 'remainingTime': remainingTime });
    chrome.browserAction.setBadgeText({ 'text': 'OFF' });
    chrome.browserAction.setBadgeBackgroundColor({ color: color.GREY });
    printEvent('STOP COUNTDOWN');
    clearInterval(countdownId);
}
