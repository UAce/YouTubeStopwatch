'use strict';

console.log('background script loaded!');

// Constants
const status = {
    STARTED: 'started',
    STOPPED: 'stopped',
    DONE: 'done'
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
const event = {
    INIT: 'init',
    RESET: 'reset',
    SNACKBAR: 'showSnackbar',
    CLOSE_TAB: 'closeTab',
    START_COUNTDOWN: 'startCountdown',
    SHOW_ARTICLE: 'showArticle'
}

// Variables
var active_youtube_tabs = [];
var FIVE_MINUTES_IN_S = 300;

chrome.runtime.onInstalled.addListener(function () {
    stopCountdown(); // make sure countdown is stopped if reload extension
    chrome.runtime.onMessage.addListener(function (msg, sender) {
        var tabId = sender.tab ? sender.tab.id : null;
        if (msg.from === source.PAGE && active_youtube_tabs.indexOf(tabId) < 0) {
            active_youtube_tabs.push(tabId);
            addListeners(tabId);
            chrome.storage.sync.get(['countdown_status'], function (data) {
                setBadge(data.countdown_status);
            });
        }
        switch (msg.event) {
            case event.START_COUNTDOWN:
                startCountdown();
                break;
            case event.CLOSE_TAB:
                tabId && chrome.tabs.remove(tabId);
                break;
            case event.SHOW_ARTICLE:
                showArticle();
                break;
            case event.RESET:
                active_youtube_tabs.forEach(function (id) {
                    chrome.tabs.sendMessage(id, { from: source.BACKGROUND, event: event.RESET });
                });
                reset();
                break;
            default:
                break;
        }
    });
});

function removeYoutubeTab(tabId) {
    var idx = active_youtube_tabs.indexOf(tabId);
    active_youtube_tabs.splice(idx, 1);

    if (active_youtube_tabs.length === 0) {
        var isDone = remainingTime > 0 ? false : true;
        stopCountdown(isDone);
    }
    console.log("Youtube tab closed", tabId, active_youtube_tabs);
}

function addListeners(tabId) {
    console.log("Youtube tab opened", tabId);
    chrome.tabs.onRemoved.addListener(function (id) {
        if (tabId === id) {
            removeYoutubeTab(tabId);
        }
    });
    chrome.tabs.onUpdated.addListener(function (id, changeInfo) {
        if (tabId === id && changeInfo.status === 'complete') {
            chrome.tabs.get(tabId, function (tab) {
                if (tab.url.indexOf('youtube.com') < 0) {
                    removeYoutubeTab(tabId);
                } else {
                    chrome.tabs.sendMessage(tabId, {
                        from: source.BACKGROUND,
                        event: event.INIT,
                        remainingTime: remainingTime
                    });
                }
            });
        }
    });
}

function setBadge(state) {
    switch (state) {
        case status.STARTED:
            chrome.browserAction.setBadgeText({ text: 'ON' });
            chrome.browserAction.setBadgeBackgroundColor({ color: color.GREEN });
            break;
        case status.DONE:
            chrome.browserAction.setBadgeText({ 'text': 'DONE' });
            chrome.browserAction.setBadgeBackgroundColor({ color: color.RED });
            break;
        case status.STOPPED:
        // I purposely removed the break
        default:
            chrome.browserAction.setBadgeText({ 'text': 'OFF' });
            chrome.browserAction.setBadgeBackgroundColor({ color: color.GREY });
            break;
    }
}

function printEvent(ev) {
    console.log("________________\n\n" + ev + "\n________________\n\n");
}

function reset() {
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
    var isToastSent = false;

    countdownId = setInterval(function () {
        var now = new Date();
        remainingTime = (target - now) / 1000;
        if (remainingTime < 0) {
            remainingTime = -1;
            stopCountdown(true);
            chrome.storage.sync.set({ 'blur_value': 3 });
            if (confirm('Oops! Looks like you ran out of time. Exit YouTube?')) {
                active_youtube_tabs.forEach(function (id) {
                    // Close all YouTube tabs
                    chrome.tabs.remove(id);
                });
            } else {
                active_youtube_tabs.forEach(function (id) {
                    chrome.tabs.sendMessage(id, { from: source.BACKGROUND, event: event.INIT });
                });
                showArticle();
            }
            return;
        }
        if (Math.floor(remainingTime) === FIVE_MINUTES_IN_S && !isToastSent) {
            active_youtube_tabs.forEach(function (id) {
                chrome.tabs.sendMessage(id, { from: source.BACKGROUND, event: event.SNACKBAR });
            });
            isToastSent = true;
        }
        remainingHours = ~~((remainingTime / 3600));
        remainingMinutes = ~~((remainingTime / 60) % 60);
        remainingSeconds = ~~(remainingTime % 60);
    }, update);
}

function startCountdown() {
    printEvent('START COUNTDOWN');
    chrome.storage.sync.get(['remainingTime'], function (data) {
        countdown(data.remainingTime);
        chrome.storage.sync.set({ 'countdown_status': status.STARTED });
        setBadge(status.STARTED);
        active_youtube_tabs.forEach(function (id) {
            chrome.tabs.sendMessage(id, { from: source.BACKGROUND, event: event.INIT });
        });
    });
}

function stopCountdown(isDone) {
    printEvent('STOP COUNTDOWN');
    clearInterval(countdownId);
    var state = isDone ? status.DONE : status.STOPPED;
    chrome.storage.sync.set({ 'remainingTime': remainingTime });
    chrome.storage.sync.set({ 'countdown_status': state });
    setBadge(state);
}


/*
 * Show popup articles
 */
const article_url = ["https://slate.com/technology/2018/03/youtube-is-only-just-realizing-that-it-might-be-bad-for-all-of-us.html"];
function showArticle() {
    var w = 800;
    var h = 500;
    var left = (screen.width / 2) - (w / 2);
    var top = (screen.height / 2) - (h / 2);
    var idx = randomIntFromInterval(0, article_url.length - 1);
    chrome.windows.create({
        url: article_url[idx],
        type: "popup", height: h, width: w, 'left': left, 'top': top, focused: true
    });
}

function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}