'use strict';

// console.log('background script loaded!');

/*
 * CONSTANTS
 */
const status = {
    STARTED: 'started',
    STOPPED: 'stopped',
    OVER: 'over'
};
const source = {
    BACKGROUND: 'background',
    PAGE: 'youtube',
    POPUP: 'popup'
};
const color = {
    GREY: '#bbbdbb',
    RED: '#F50F0F',
    BLUE: '#1c2efc',
    GREEN: '#4bb543'
};
const event = {
    INIT: 'init',
    INIT_ALL: 'initAll',
    RESET: 'reset',
    SNACKBAR: 'showSnackbar',
    CLOSE_TAB: 'closeTab',
    START_COUNTDOWN: 'startCountdown',
    SHOW_ARTICLE: 'showArticle',
    START_OVERTIME: 'startOvertime'
};
const default_soundOn = true;


/*
 * VARIABLES
 */
var active_youtube_tabs = [];
var countdownStarted = false;
var overtimeStarted = false;
var FIVE_MINUTES_IN_S = 300;
// Sound from https://notificationsounds.com/
var timesUpSound = new Audio(chrome.runtime.getURL("audio/munchausen.mp3"));
timesUpSound.loop = false;
timesUpSound.onended = countdownEndAction;
var soundOn;
function setVarsFromChromeStorage() {
    chrome.storage.sync.get(['soundOn'], function (data) {
        soundOn = typeof (data.soundOn) === 'undefined' ? default_soundOn : data.soundOn;
        chrome.storage.onChanged.addListener(function (changes, area) {
            if (area == "sync" && "soundOn" in changes) {
                soundOn = changes.soundOn.newValue;
            }
        });
    });
}
setVarsFromChromeStorage();

/*
 * MAIN - HANDLES EVENTS FROM YOUTUBE AND POPUP PAGE
 */
chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.sync.set({ 'remainingTime': 'undefined', 'exceededTime': 'undefined' });
    console.log("Installed");
    chrome.storage.sync.get(['remainingTime', 'exceededTime'], function (data) {
        console.log(data);
    });
});
chrome.runtime.onMessage.addListener(function (msg, sender) {
    var tabId = sender.tab ? sender.tab.id : null;
    // console.log("Received from", tabId, msg);
    if (msg.from === source.PAGE && typeof (msg.event) === 'undefined') {
        active_youtube_tabs.indexOf(tabId) < 0 ? addListeners(tabId) : null;
        chrome.tabs.sendMessage(tabId, {
            from: source.BACKGROUND,
            event: event.INIT,
            remainingTime: remainingTime,
            exceededTime: exceededTime
        });
    }
    switch (msg.event) {
        case event.START_COUNTDOWN:
            if (!countdownStarted) {
                startCountdown();
            }
            break;
        case event.START_OVERTIME:
            if (!overtimeStarted) {
                startOvertime();
            }
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
        case event.INIT_ALL:
            active_youtube_tabs.forEach(function (id) {
                sendInit(id);
            });
            break;
        case event.INIT:
            sendInit(tabId);
            break;
        default:
            break;
    }
});

// Send init event to specific tab
function sendInit(tabId) {
    chrome.tabs.sendMessage(tabId, {
        from: source.BACKGROUND,
        event: event.INIT
    });
}

// Resets countdown/overtime and blur
function reset() {
    remainingTime = remainingHours = remainingMinutes = remainingSeconds = 'undefined';
    exceededTime = exceededHours = exceededMinutes = exceededSeconds = 'undefined';
    if (countdownStarted) {
        stopCountdown();
    }
    if (overtimeStarted) {
        stopOvertime();
    }
    setVarsFromChromeStorage();
    setBadge('');
}

// Removes specific tab from active youtube tabs
function removeYoutubeTab(tabId) {
    var idx = active_youtube_tabs.indexOf(tabId);
    active_youtube_tabs.splice(idx, 1);

    if (active_youtube_tabs.length === 0) {
        if (countdownStarted) {
            stopCountdown();
        }
        if (overtimeStarted) {
            stopOvertime();
        }
    }
    console.log("Youtube tab closed", tabId, active_youtube_tabs);
}

// Subscribes tab to active youtube tabs and adds listener to url changes
function addListeners(tabId) {
    console.log("Youtube tab opened", tabId);
    active_youtube_tabs.push(tabId);
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
                }
            });
        }
    });
}


/*
 * EXTENSION ICON BADGE (ON, OFF, OVER)
 */
function setBadge(state) {
    switch (state) {
        case status.STARTED:
            console.log("On");
            chrome.browserAction.setBadgeText({ text: 'ON' });
            chrome.browserAction.setBadgeBackgroundColor({ color: color.GREEN });
            break;
        case status.OVER:
            console.log("OVER");
            chrome.browserAction.setBadgeText({ 'text': 'OVER' });
            chrome.browserAction.setBadgeBackgroundColor({ color: color.RED });
            break;
        case status.STOPPED:
        // I purposely removed the break
        default:
            console.log("OFF");
            // chrome.browserAction.setIcon({path:"my-icon.png"});
            chrome.browserAction.setBadgeText({ 'text': 'OFF' });
            chrome.browserAction.setBadgeBackgroundColor({ color: color.GREY });
            break;
    }
}


/*
 * COUNTDOWN
*/
var countdownId, remainingTime, remainingHours, remainingMinutes, remainingSeconds;
remainingTime = remainingHours = remainingMinutes = remainingSeconds = 'undefined';

function countdown(seconds) {
    var now = new Date().getTime();
    var target = new Date(now + seconds * 1000);
    var update = 500;
    var isToastSent = false;

    countdownId = setInterval(function () {
        var now = new Date();
        remainingTime = (target - now) / 1000;
        // console.log("Time Remaining:", remainingTime);
        if (remainingTime < 0) {
            clearInterval(countdownId);
            remainingTime = -1;
            stopCountdown(true);
            chrome.storage.sync.set({ 'blur_value': 3 });
            if (soundOn) {
                timesUpSound.play();
            } else {
                countdownEndAction();
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
        // countdown(3);
        setBadge(status.STARTED);
        countdownStarted = true;
        active_youtube_tabs.forEach(function (id) {
            chrome.tabs.sendMessage(id, { from: source.BACKGROUND, event: event.START_COUNTDOWN, remainingTime: data.remainingTime });
        });
    });
}

function stopCountdown(isOver) {
    printEvent('STOP COUNTDOWN');
    clearInterval(countdownId);
    countdownStarted = false;
    var state = status.STOPPED;
    if (remainingTime < 0) {
        state = status.OVER;
    }
    chrome.storage.sync.set({ 'remainingTime': remainingTime });
    setBadge(state);
}

function countdownEndAction() {
    if (confirm('Oops! Looks like you ran out of time. Exit YouTube?\n\nWARNING: If you click on “cancel” you will be subject to video visual deterioration on YouTube and awareness article pop-ups.')) {
        active_youtube_tabs.forEach(function (id) {
            // Close all YouTube tabs
            chrome.tabs.remove(id);
        });
    } else {
        active_youtube_tabs.forEach(function (id) {
            chrome.tabs.sendMessage(id, { from: source.BACKGROUND, event: event.START_OVERTIME });
        });
        showArticle();
        startOvertime();
    }
}


/*
 * OVERTIME
*/
var overtimeId, exceededTime, exceededHours, exceededMinutes, exceededSeconds;
exceededTime = exceededHours = exceededMinutes = exceededSeconds = 'undefined';

function overtime(savedTimeOver) {
    var start = new Date().getTime();
    var update = 500;

    overtimeId = setInterval(function () {
        var now = new Date();
        exceededTime = (now - start) / 1000;
        if (savedTimeOver) {
            exceededTime += savedTimeOver;
        }
        // console.log("Time Over:", exceededTime);
        if (exceededTime === 300) {
            showArticle();
        }
        exceededHours = ~~((exceededTime / 3600));
        exceededMinutes = ~~((exceededTime / 60) % 60);
        exceededSeconds = ~~(exceededTime % 60);
    }, update);
}

function startOvertime() {
    printEvent('START OVERTIME');
    chrome.storage.sync.get(['exceededTime'], function (data) {
        overtime(data.exceededTime);
        setBadge(status.OVER);
        overtimeStarted = true;
        active_youtube_tabs.forEach(function (id) {
            chrome.tabs.sendMessage(id, { from: source.BACKGROUND, event: event.START_OVERTIME, exceededTime: data.exceededTime });
        });
    });
}

function stopOvertime() {
    printEvent('STOP OVERTIME', overtimeId);
    clearInterval(overtimeId);
    overtimeStarted = false;
    chrome.storage.sync.set({ 'exceededTime': exceededTime });
    setBadge(status.STOPPED);
}


/*
 * POPUP ARTICLES
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


/*
 * HELPERS
 */
function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

setInterval(function () {
    chrome.storage.sync.set({ 'remainingTime': remainingTime, 'exceededTime': exceededTime });
}, 5000);


/*
 * DEBUGGING
 */
function printEvent(ev) {
    // console.log("________________\n\n" + ev + "\n________________\n\n");
}