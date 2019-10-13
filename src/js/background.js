'use strict';

console.log('background script loaded!');

var active_youtube_tabs = [];
var _countdown_status;

chrome.runtime.onInstalled.addListener(function () {
    stopCountdown(); // make sure countdown is stopped if reload extension
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
                    addListeners(tabId);
                }
                if (msg.startCountdown) {
                    chrome.storage.sync.set({ 'countdown_status': 'started' });
                    startCountdown();
                }
                if (msg.closeTab) {
                    chrome.tabs.remove(tabId, function () { });
                }
                break;
            case "popup":
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
    chrome.tabs.onRemoved.addListener(function (id, removed) {
        if (senderTabId === id) {
            removeYoutubeTab(senderTabId);
        }
    });
    chrome.tabs.onUpdated.addListener(function (id, changeInfo, tab) {
        if (senderTabId === id && changeInfo.status === 'complete') {
            chrome.tabs.get(senderTabId, function (tab) {
                if (tab.url.indexOf('youtube.com') < 0) {
                    removeYoutubeTab(senderTabId);
                }
            });
        }
    });
}

function printEvent(ev) {
    console.log("________________\n\n" + ev + "\n________________\n\n");
}

/*
 * Countdown
*/
var countdownId, remainingTime, remainingMinutes, remainingSeconds;

function countdown(seconds) {
    var now = new Date().getTime();
    var target = new Date(now + seconds * 1000);
    var update = 500;

    countdownId = setInterval(function () {
        var now = new Date();
        remainingTime = (target - now) / 1000;
        console.log("RemainingTime:", format(remainingMinutes) + ":" + format(remainingSeconds));
        if (remainingTime < 0) {
            remainingTime = 0;
            stopCountdown('completed');
            return;
        }
        remainingMinutes = ~~(remainingTime / 60);
        remainingSeconds = ~~(remainingTime % 60);
    }, update);
}

function format(num) {
    return num < 10 ? "0" + num : num;
}

function startCountdown() {
    _countdown_status = 'started';
    chrome.storage.sync.set({ 'countdown_status': 'started' });
    chrome.browserAction.setBadgeText({ text: 'ON' });
    chrome.browserAction.setBadgeBackgroundColor({ color: '#4bb543' });
    printEvent('START COUNTDOWN');
    chrome.storage.sync.get(['remainingTime'], function (data) {
        countdown(data.remainingTime);
    });
}

function stopCountdown(status) {
    var countdown_status = typeof (status) !== 'undefined' ? status : 'paused'
    _countdown_status = countdown_status;
    chrome.storage.sync.set({ 'countdown_status': countdown_status });
    chrome.storage.sync.set({ 'remainingTime': remainingTime });
    chrome.browserAction.setBadgeText({ 'text': 'OFF' });
    chrome.browserAction.setBadgeBackgroundColor({ color: '#bbbdbb' });
    printEvent('STOP COUNTDOWN');
    clearInterval(countdownId);
}


/*
 * Colors
 */
// Grey:  #bbbdbb
// Red:   #F50F0F
// Blue:  #1c2efc
// Green: #4bb543