'use strict';

// console.log('background script loaded!');
chrome.runtime.onInstalled.addListener(function () {
    // Fake sample data for testing purposes
    // var sessions = []
    // var newSession = {
    //     date: moment().add(-1, 'd')._d.getTime(),
    //     timeSpent: 2500,
    //     allocatedTime: 3600
    // };
    // sessions.push(newSession);
    chrome.storage.sync.set({
        'remainingTime': 'undefined',
        'exceededTime': 'undefined',
        'soundOn': default_soundOn,
        'presetTimes': jQuery.extend(true, {}, default_presets),
        'blur_value': default_blurValue,
        'sessions': sessions
    });
    // console.log("Installed");
});

/*
 * VARIABLES
 */
var active_youtube_tabs = [];
var persistTimesId;
var persistTimesStarted = false;

var checkId;
var checkStarted = false;

var countdownStarted = false;
var countdownId, remainingTime, remainingHours, remainingMinutes, remainingSeconds;
remainingTime = remainingHours = remainingMinutes = remainingSeconds = 'undefined';

var overtimeStarted = false;
var overtimeId, exceededTime, exceededHours, exceededMinutes, exceededSeconds;
exceededTime = exceededHours = exceededMinutes = exceededSeconds = 'undefined';

// Sound from https://notificationsounds.com/
var timesUpSound = new Audio(chrome.runtime.getURL("audio/munchausen.mp3"));
timesUpSound.loop = false;
timesUpSound.onended = countdownEndAction;
var soundOn;
var sessions;
function setVarsFromChromeStorage() {
    chrome.storage.sync.get({ 'soundOn': default_soundOn, 'remainingTime': 'undefined', 'exceededTime': 'undefined', 'sessions': [] }, function (data) {
        remainingTime = data.remainingTime;
        if (remainingTime > 0) {
            setRemainingTimes();
        }
        exceededTime = data.exceededTime;
        if (exceededTime > 0) {
            setExceededTimes();
        }
        soundOn = data.soundOn;
        sessions = data.sessions;
        chrome.storage.onChanged.addListener(function (changes, area) {
            if (area == "sync") {
                if ("soundOn" in changes) {
                    soundOn = changes.soundOn.newValue;
                }
                if ("sessions" in changes) {
                    sessions = changes.sessions.newValue;
                    // console.log("Change:", { ...changes });
                }
            }
        });
    });
}
setVarsFromChromeStorage();

/*
 * MAIN - HANDLES EVENTS FROM YOUTUBE AND POPUP PAGE
 */
function initBackground() {
    checkSessionExpired();
    setBadge();
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
                startCountdown();
                startPersistTimes();
                break;
            case event.START_OVERTIME:
                startOvertime();
                startPersistTimes();
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
}
initBackground();

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
    stopAll();
    setVarsFromChromeStorage();
    setBadge();
}

// Removes specific tab from active youtube tabs
function removeYoutubeTab(tabId) {
    var idx = active_youtube_tabs.indexOf(tabId);
    active_youtube_tabs.splice(idx, 1);

    if (active_youtube_tabs.length === 0) {
        stopAll();
    }
    // console.log("Youtube tab closed", tabId, active_youtube_tabs);
}

// Subscribes tab to active youtube tabs and adds listener to url changes
function addListeners(tabId) {
    // console.log("Youtube tab opened", tabId);
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
            chrome.browserAction.setBadgeText({ 'text': 'ON' });
            chrome.browserAction.setBadgeBackgroundColor({ color: color.GREEN });
            break;
        case status.OVER:
            chrome.browserAction.setBadgeText({ 'text': 'OVER' });
            chrome.browserAction.setBadgeBackgroundColor({ color: color.RED });
            break;
        case status.PAUSED:
            chrome.browserAction.setBadgeText({ 'text': 'OFF' });
            chrome.browserAction.setBadgeBackgroundColor({ color: color.GREY });
            break;
        default:
            // chrome.browserAction.setIcon({
            //     path: chrome.runtime.getURL("img/paused_icon.png")
            // });
            chrome.browserAction.setBadgeText({ 'text': '' });
            break;
    }
}


/*
 * COUNTDOWN
*/
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
            stopCountdown();
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
        setRemainingTimes();
    }, update);
}

function startCountdown() {
    if (countdownStarted) {
        return;
    }
    printEvent('START COUNTDOWN');
    chrome.storage.sync.get(['remainingTime'], function (data) {
        countdown(data.remainingTime);
        // countdown(302);
        setBadge(status.STARTED);
        countdownStarted = true;
        active_youtube_tabs.forEach(function (id) {
            chrome.tabs.sendMessage(id, { from: source.BACKGROUND, event: event.START_COUNTDOWN, remainingTime: data.remainingTime });
        });
    });
}

function stopCountdown() {
    if (countdownStarted) {
        printEvent('STOP COUNTDOWN');
        clearInterval(countdownId);
        countdownStarted = false;
        var state = status.PAUSED;
        if (remainingTime < 0) {
            state = status.OVER;
        }
        chrome.storage.sync.set({ 'remainingTime': remainingTime });
        setBadge(state);
    }
}

function countdownEndAction() {
    if (confirm('Oops! Looks like you ran out of time. Exit YouTube?\n\nWARNING: If you click on “cancel” you will be subject to video visual deterioration on YouTube and awareness article pop-ups.')) {
        active_youtube_tabs.forEach(function (id) {
            // Close all YouTube tabs
            chrome.tabs.remove(id);
        });
        setBadge(status.PAUSED);
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
function overtime(savedTimeOver) {
    var start = new Date().getTime();
    var update = 500;

    overtimeId = setInterval(function () {
        var now = new Date();
        exceededTime = (now - start) / 1000;
        if (savedTimeOver && savedTimeOver !== 'undefined') {
            exceededTime += savedTimeOver;
        }
        // show article again after 5min
        if (exceededTime === 300) {
            showArticle();
        }
        setExceededTimes();
    }, update);
}

function startOvertime() {
    if (overtimeStarted) {
        return;
    }
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
    if (overtimeStarted) {
        printEvent('STOP OVERTIME', overtimeId);
        clearInterval(overtimeId);
        overtimeStarted = false;
        chrome.storage.sync.set({ 'exceededTime': exceededTime });
        setBadge(status.PAUSED);
    }
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

function setRemainingTimes() {
    remainingHours = ~~((remainingTime / 3600));
    remainingMinutes = ~~((remainingTime / 60) % 60);
    remainingSeconds = ~~(remainingTime % 60);
}

function setExceededTimes() {
    exceededHours = ~~((exceededTime / 3600));
    exceededMinutes = ~~((exceededTime / 60) % 60);
    exceededSeconds = ~~(exceededTime % 60);
}

function stopAll() {
    stopCountdown();
    stopOvertime();
    stopPersistTimes();
}

// Save times and update current session every 2s
function startPersistTimes() {
    if (persistTimesStarted) {
        return;
    }
    checkSessionExpired();
    persistTimesStarted = true;
    printEvent("START PERSISTING TIMES");
    persistTimesId = setInterval(function () {
        chrome.storage.sync.get("sessions", function (data) {
            var allSessions = data.sessions;
            var n = allSessions.length;
            if (n === 0) {
                return;
            }
            if (countdownStarted && (remainingTime && remainingTime !== 'undefined')) {
                // console.log("Set countdown:", countdownStarted, remainingTime);
                allSessions[n - 1].timeSpent = allSessions[n - 1].allocatedTime - remainingTime;
                chrome.storage.sync.set({ 'remainingTime': remainingTime, 'sessions': allSessions });
            } else if (overtimeStarted && remainingTime < 0) {
                // console.log("Set overtime:", overtimeStarted, exceededTime);
                allSessions[n - 1].timeSpent = allSessions[n - 1].allocatedTime + exceededTime;
                chrome.storage.sync.set({ 'exceededTime': exceededTime, 'sessions': allSessions });
            }
        });
    }, 2000);
}
function stopPersistTimes() {
    if (persistTimesStarted) {
        persistTimesStarted = false;
        clearInterval(persistTimesId);
    }
}


/*
 * Check session expired
 */
function checkSessionExpired() {
    if (checkStarted) {
        return;
    }
    checkStarted = true;
    printEvent("Check Session Expired");
    checkId = setInterval(function () {
        chrome.storage.sync.get("sessions", function (data) {
            var allSessions = data.sessions;
            var n = allSessions.length;
            if (n === 0) {
                return;
            }
            var lastSession = allSessions[n - 1];
            var today = moment().startOf('day')._d.getTime();
            // console.log("check", lastSession, today);
            if (lastSession.date != today) {
                stopAll();
                chrome.storage.sync.set({ 'remainingTime': 'undefined', 'exceededTime': 'undefined' }, function () {
                    remainingTime = exceededTime = 'undefined';
                    active_youtube_tabs.forEach(function (id) {
                        sendInit(id);
                    });
                    stopCheckExpired();
                });
            }
        });
    }, 5000);
}
function stopCheckExpired() {
    printEvent("Stop Check Session Expired");
    if (checkStarted) {
        clearInterval(checkId);
        checkStarted = false;
    }
}


/*
 * DEBUGGING
 */
function printEvent(ev) {
    // console.log("________________\n\n" + ev + "\n________________\n\n");
}