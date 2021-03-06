// console.log('Content Script loaded!');

/*
 * VARIABLES
 */
var currentTabId;
var blurIntervalId;
var isPresetAdded = false;
var countdownStarted = false;
var overtimeStarted = false;
var isPageReady = false;
var sessions;
var soundOn;
var autoSetTime;
var preset_times;
var default_hours;
var default_minutes;
// Sound from https://notificationsounds.com/
var snackSound = new Audio(chrome.runtime.getURL("audio/time_is_now.mp3"));
snackSound.loop = false;
var pageReadyIntervalId = setInterval(function () {
    injectComponentOnce();
    if (isPageReady) {
        clearInterval(pageReadyIntervalId);
        subscribe();
    }
}, 500);
setVarsFromChromeStorage();

/*
 * SUBSCRIBE - HANDLES INTERACTION WITH BACKGROUND PAGE
 */
function subscribe() {
    // FIRST: Send message to background.js to subscribe active YouTube page
    chrome.runtime.sendMessage({ from: source.PAGE });

    // SECOND: Add listener to events from background.js
    chrome.runtime.onMessage.addListener(function (msg) {
        // console.log("Content script received", msg);
        if (msg.from === source.BACKGROUND) {
            // console.log(msg.event, " event received!");
            switch (msg.event) {
                case event.INIT:
                    init(msg.remainingTime, msg.exceededTime);
                    break;
                case event.RESET:
                    reset();
                    break;
                case event.SNACKBAR:
                    showSnackbar();
                    break;
                case event.START_COUNTDOWN:
                    startCountdown(msg.remainingTime);
                    break;
                case event.START_OVERTIME:
                    blur();
                    startOvertime(msg.exceededTime);
                    break;
                default:
                    break;
            }
        }
    });
}

// Init function to decide whether to show modal, start countdown or overtime
function init(activeRemainingTime, activeTimeOver) {
    chrome.storage.sync.get(['remainingTime', 'exceededTime'], function (data) {
        var remainingTime = activeRemainingTime || data.remainingTime;
        var exceededTime = activeTimeOver || data.exceededTime;
        if (remainingTime < 0) {     // Time limit reached: apply and increase blur every 5min, and start overtime if not started
            chrome.runtime.sendMessage({ from: source.PAGE, event: event.START_OVERTIME });
            blur();
            if (!overtimeStarted) {
                startOvertime(exceededTime);
            }
        } else if (remainingTime >= 0) {      // Has Time remaining: remove modal and start local countdown if not started
            chrome.runtime.sendMessage({ from: source.PAGE, event: event.START_COUNTDOWN });
            removeModal();
            if (!countdownStarted) {
                startCountdown(remainingTime);
            }
        } else {        // Time not set, show modal
            if (autoSetTime) {
                startSession(default_hours, default_minutes);
            } else {
                showModal();
            }
        }
    });
}

// Reset function
function reset() {
    removeModal();
    clearInterval(blurIntervalId);
    clearInterval(countdownIntervalId);
    clearInterval(overtimeId);
    $('#blurStyle').remove();
    $('#hourglass-displayedTime').removeClass('warning');
    $('#hourglass-displayedTime').removeClass('overtime');
    setVarsFromChromeStorage();
    init();
}

// Set variables from chrome storage
function setVarsFromChromeStorage() {
    chrome.storage.sync.get({
        'soundOn': default_soundOn,
        'autoSetTime': default_autoSetTime,
        'presetTimes': jQuery.extend(true, {}, default_presets),
        'autoSetHours': default_autoSetHours,
        'autoSetMinutes': default_autoSetMinutes,
        'sessions': []
    }, function (data) {
        soundOn = data.soundOn;
        autoSetTime = data.autoSetTime;
        preset_times = data.presetTimes;
        default_hours = parseInt(data.autoSetHours);
        default_minutes = parseInt(data.autoSetMinutes);
        chrome.storage.sync.set({
            'soundOn': soundOn,
            'autoSetTime': autoSetTime,
            'presetTimes': preset_times,
            'autoSetHours': default_hours,
            'autoSetMinutes': default_minutes,
        });
        sessions = data.sessions;
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
        if (area == "sync") {
            if ("soundOn" in changes) {
                soundOn = changes.soundOn.newValue;
            }
            if ("autoSetTime" in changes) {
                autoSetTime = changes.autoSetTime.newValue;
            }
            if ("autoSetHours" in changes) {
                default_hours = changes.autoSetHours.newValue;
            }
            if ("autoSetMinutes" in changes) {
                default_minutes = changes.autoSetMinutes.newValue;
            }
            if ("presetTimes" in changes) {
                preset_times = changes.presetTimes.newValue;
                if (typeof (remainingTime) === "undefined" || remainingTime === "undefined") {
                    removeModal();
                    showModal();
                }
            }
        }
    });
}

// Function that injects html components (snackbar and hourglass icon) once
function injectComponentOnce() {
    try {
        injectSnackbar();
        injectTimerIcon();
        isPageReady = true;
    }
    catch (err) {
        console.error(err);
    }
}


/*
 * MODAL
 */

// function to inject modal html component
function injectTimeModal() {
    // Add overlay
    var body = document.body,
        html = document.documentElement;

    var maxHeight = Math.max(body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight);
    $("body").append("<div id='overlayModal'></div>");
    $("#overlayModal")
        .height(maxHeight)
        .css({
            'opacity': 0.7,
            'position': 'absolute',
            'top': 0,
            'left': 0,
            'background-color': 'black',
            'width': '100%',
            'height': '100%',
            'z-index': 5000
        });

    // CSS
    var style = document.createElement('style');
    style.innerHTML = `
    .ui-widget.success-dialog {
        font-family: var(--paper-font-common-base_-_font-family);
        font-size: 12px;
    }

    .ui-widget-content.success-dialog {
        background: rgb(243, 243, 243);
        border: 0;
        color: #222222;
        font-weight: bold;
        border-radius: 8px;
    }

    .ui-dialog.success-dialog {
        left: 0;
        outline: 0 none;
        padding: 0 !important;
        position: absolute;
        top: 0;
        z-index: 5001;
    }

    .ui-dialog.success-dialog .ui-dialog-content {
        background: none repeat 0 0 transparent;
        border: 0 none;
        position: relative;
        padding: 0 !important;
        margin: 0;
    }

    .ui-dialog.success-dialog .ui-widget-header {
        box-shadow: 0 2px 16px rgba(0, 0, 0, 0.2);
        background-color: rgb(48, 48, 48);
        border: 0;
        color: #fff;
        font-weight: bold;
        text-align: center;
        border-top-left-radius: 6px;
        border-top-right-radius: 6px;
    }

    .ui-dialog.success-dialog .ui-dialog-titlebar {
        padding: 8px 2px;
        position: relative;
        font-size: 15px;
        font-family: var(--paper-font-common-base_-_font-family);
    }

    .ui-dialog-titlebar-close {
        display: none;
    }

    .ui-dialog-buttonpane {
        clear: both;
        text-align: center;
        padding: 1rem 0;
    }
    .ui-dialog-buttonset {
        padding: 0 1.5rem;
    }
    .okButton {
        background-color: rgb(48, 48, 48) !important;
        border-radius: 4px;
        border: none;
        color: white;
        font-weight: bold;
        margin: 4px;
        padding: 4px 1.5rem;
        opacity: 0.2;
        transition: 0.5s;
        cursor: not-allowed;
        display: block;
        margin: 1rem auto 0;
    }
    .okButton.valid:hover {
        opacity: 1;
    }
    .okButton.valid {
        opacity: 0.7;
        cursor: pointer;
    }
 
    .preset {
        text-align: center;
        margin: 3px;
        background: transparent;
        border: 2px solid #F50F0F;
        border-radius: 5px;
        padding: 5px;
        color: black;
        transition: all 0.2s ease;
    }
    .preset:hover {
        background-color: #F50F0F;
        color: white;
        cursor: pointer;
    }
    .preset:focus {
          outline: 0;
          background-color: #F50F0F;
          color: white;
    }
    .modal_input {
        font-family: var(--paper-font-common-base_-_font-family);
    }
    input:focus, button:focus {
        outline: 0;
    }
    #estimated_hours, #estimated_minutes {
        border: 1px solid grey;
        border-radius: 4px;
        padding-left: 5px;
        width: 3.5rem;
    }
    #timeModalForm {
        padding-top: 1rem;
    }
    #errorMessages{
        min-height: 5px;
        color: red;
    }`;

    // Modal form
    var modalContent = '<div id="timeModal">' + '<form id="timeModalForm" method="post">' + '<div style="float:left;padding-left:2rem;margin-left: 12%;"><label class="modal_input">Hours: </label>' + '<input id="estimated_hours" name="estimated_hours" type="number"></div>' + '<div style="float:left;padding-left:2rem;"><label class="modal_input">Minutes: </label>' + '<input id="estimated_minutes" name="estimated_minutes" type="number"></div>' + '<div style="padding-top:1rem;clear:both;text-align:center;display: none;" id="errorMessages"></div>' + '</form>' + '</div>';
    var modalDiv = document.createElement('div');
    modalDiv.id = "modal-container";
    modalDiv.innerHTML = modalContent.trim();
    modalDiv.appendChild(style);
    document.body.appendChild(modalDiv);

    $('#estimated_hours').on('input', function () {
        changeOkButtonStatus();
    });
    $('#estimated_minutes').on('input', function () {
        changeOkButtonStatus();
    });
}

function changeOkButtonStatus() {
    $('#timeModalForm').valid() ? focusOkButton() : blurOkButton(0);
}
function focusOkButton() {
    $('.okButton').addClass('valid').removeAttr("disabled");
}
function blurOkButton() {
    $('.okButton').removeClass('valid').attr("disabled", true).blur();
}

// Function to remove modal
function removeModal() {
    $("#timeModal").dialog("close");
    $("#timeModal").dialog('destroy').remove();
    $('#overlayModal').remove();
    $('html, body').css({
        height: 'auto'
    });
}

// Function to display modal
function showModal() {
    injectTimeModal();
    $('html, body').css({
        overflow: 'hidden'
    });
    $(document).ready(function () {
        $(function () {
            var modalButtons = [];
            var OkButton = {
                text: "OK",
                "class": 'okButton',
                click: function () {
                    // Invalid if both are empty, else if one of them is empty, set it to 0
                    var isHoursEmpty = $("#estimated_hours").val().trim().length === 0;
                    var isMinutesEmpty = $("#estimated_minutes").val().trim().length === 0;
                    if (isHoursEmpty && isMinutesEmpty) {
                        $("#estimated_hours").val(undefined); $("#estimated_minutes").val(undefined);
                        blurOkButton();
                        return;
                    } else {
                        isHoursEmpty ? $("#estimated_hours").val(0) : null;
                        isMinutesEmpty ? $("#estimated_minutes").val(0) : null;
                    }
                    if ($('#timeModalForm').valid()) {
                        var hours = $("#estimated_hours").val();
                        var minutes = $("#estimated_minutes").val();
                        startSession(hours, minutes);
                        $(this).dialog("close");
                        removeModal();
                    }
                }
            };
            for (preset in preset_times) {
                var newPreset = {
                    text: preset,
                    "class": "preset",
                    "value": preset_times[preset],
                    click: function (e) {
                        var val = e.target.value;
                        var hours = ~~(val / 60);
                        var minutes = ~~(val % 60);
                        $("#estimated_hours").val(hours);
                        $("#estimated_minutes").val(minutes);
                        focusOkButton();
                    }
                };
                modalButtons.push(newPreset);
            }
            modalButtons.push(OkButton);
            $.widget("ui.dialog", $.extend({}, $.ui.dialog.prototype, {
                _title: function (title) {
                    if (!this.options.title) {
                        title.html("&#160;");
                    } else {
                        title.html(this.options.title);
                    }
                }
            }));
            $("#timeModal").dialog({
                height: "auto",
                minHeight: 185,
                maxHeight: 350,
                width: 300,
                modal: true,
                resizable: true,
                dialogClass: 'no-close success-dialog',
                closeOnEscape: false,
                autoOpen: true,
                draggable: false,
                buttons: modalButtons,
                title: 'Plan and control your time on Youtube<br>Enter estimated time for the day'
            });
        });
        $('#timeModalForm').validate({
            wrapper: 'div',
            errorLabelContainer: "#errorMessages",
            rules: {
                estimated_hours: {
                    range: [0, MAX_HOURS],
                    digits: true
                },
                estimated_minutes: {
                    range: [0, MAX_MINUTES],
                    digits: true
                }
            },
            messages: {
                estimated_hours: "Hours must be between 0 and 23",
                estimated_minutes: "Minutes must be between 0 and 59",
            }
        });
    });
}

function startSession(hours, minutes) {
    var estimatedTime = (ONE_MINUTE_IN_S * minutes) + (ONE_HOUR_IN_S * hours);
    if (estimatedTime <= 0) {
        chrome.runtime.sendMessage({ from: source.PAGE, event: event.CLOSE_TAB });
    } else {
        var startDate = new Date();
        var currentTimeInSeconds = startDate.getHours() * ONE_HOUR_IN_S + startDate.getMinutes() * ONE_MINUTE_IN_S + startDate.getSeconds();
        var timeToMidnight = TWENTY_FOUR_HOURS_IN_S - currentTimeInSeconds;
        if (timeToMidnight < estimatedTime) {
            estimatedTime = timeToMidnight;
            var h = ~~((estimatedTime / 3600));
            var min = ~~((estimatedTime / 60) % 60);
            var sec = ~~(estimatedTime % 60);
            showSnackbar(`Timer has been set to ${h}h ${min}min ${sec}s due to it exceeding the daily time limit (12:00 AM)`);
        }
        var newSession = {
            date: moment().startOf('day')._d.getTime(),
            timeSpent: 0,
            allocatedTime: estimatedTime
        };
        validateSession(newSession);
        chrome.storage.sync.set({ 'remainingTime': estimatedTime, 'sessions': sessions }, function () {
            chrome.runtime.sendMessage({ from: source.PAGE, event: event.START_COUNTDOWN });
            chrome.runtime.sendMessage({ from: source.PAGE, event: event.INIT_ALL });
        });
        startCountdown(estimatedTime);
    }
}

/*
 * BLUR EFFECT
 */
function blur() {
    var blurStyle = document.getElementById('blurStyle');

    // Prevents creating multiple times the blur element
    if (!blurStyle) {
        chrome.storage.sync.get(['blur_value'], function (data) {
            var val = data.blur_value;
            var style = document.createElement('style');
            style.id = 'blurStyle';
            style.innerHTML = `
                video, yt-img-shadow, ytd-moving-thumbnail-renderer, div.ytp-videowall-still-image {
                        filter: blur(${val}px);
                }`;
            document.body.parentElement.appendChild(style);

            // Incremental blur every minute
            blurIntervalId = setInterval(function () {
                val >= MAX_BLUR_VAL ? clearInterval(blurIntervalId) : val++;
                $('#blurStyle').html(`
                video, yt-img-shadow, ytd-moving-thumbnail-renderer, div.ytp-videowall-still-image {
                    filter: blur(${val}px);
                }`);
                chrome.storage.sync.set({ 'blur_value': val });
            }, ONE_MINUTE_IN_MS);
        });
    }
}


/*
 * SNACKBAR (This is a replacement for chrome.notifications because I couldn't get it to work)
 */
function injectSnackbar() {
    var snackDiv = document.createElement('div');
    snackDiv.innerHTML = '<div id="snackbar"></div>';
    var style = document.createElement('style');
    style.innerHTML = `
    #snackbar {
        visibility: hidden;
        width: 250px;
        min-height: 20px;
        height: auto;
        word-break: break-word;
        margin-left: -125px;
        background-color: ${color.RED};
        color: #fff;
        font-weight: bold;
        text-align: center;
        border-radius: 2px;
        padding: 16px;
        position: fixed;
        z-index: 1;
        left: 50%;
        bottom: 45px;
        font-size: 17px;
        cursor: pointer;
        box-shadow: 0;
        transition: background-color 0.5s ease, box-shadow 0.5s ease, color 0.5s ease;
    }
      
    #snackbar.show {
        visibility: visible;
        -webkit-animation: fadein 0.5s, fadeout 0.5s 29.75s;
        animation: fadein 0.5s, fadeout 0.5s 29.75s;
    }

    #snackbar:hover {
        box-shadow: 0 0 5px ${color.RED};
        background-color: #333;
    }
      
    @-webkit-keyframes fadein {
        from {bottom: 0; opacity: 0;} 
        to {bottom: 45px; opacity: 1;}
    }
      
    @keyframes fadein {
        from {bottom: 0; opacity: 0;}
        to {bottom: 45px; opacity: 1;}
    }
      
    @-webkit-keyframes fadeout {
        from {bottom: 45px; opacity: 1;} 
        to {bottom: 0; opacity: 0;}
    }
      
    @keyframes fadeout {
        from {bottom: 45px; opacity: 1;}
        to {bottom: 0; opacity: 0;}
    }`;
    snackDiv.appendChild(style);
    document.body.appendChild(snackDiv);
}

function showSnackbar(text = FIVE_MINS_LEFT) {
    soundOn ? snackSound.play() : null;
    var snackbar = document.getElementById("snackbar");
    snackbar.innerText = text;
    snackbar.className = "show";

    // Auto hide after 1min
    var autoHide = setTimeout(function () {
        snackbar.className = snackbar.className.replace("show", "");
    }, 30000);

    snackbar.onclick = function () {
        snackbar.className = snackbar.className.replace("show", "");
        clearTimeout(autoHide);
    };
}


/*
 * TIMER ICON
 */
function injectTimerIcon() {
    var containerDiv = document.createElement('div');
    containerDiv.id = containerDiv.className = "timer-container";

    var imgIcon = document.createElement('img');
    imgIcon.id = "timer-hourglass";
    imgIcon.src = chrome.runtime.getURL('img/hourglass.png');
    imgIcon.style.height = imgIcon.style.width = '24px';
    containerDiv.appendChild(imgIcon);

    var tooltip = document.createElement('div');
    tooltip.innerHTML = '<div class="hourglass-displayedTime" id="hourglass-displayedTime"></div>'.trim();
    tooltip.id = tooltip.className = "timer-tooltip";
    containerDiv.appendChild(tooltip);

    var tooltipStyle = document.createElement('style');
    tooltipStyle.innerHTML = `
    .timer-container {
        position: relative;
        width: 24px;
        display: inline-block;
      }
      
      .timer-tooltip {
        position: absolute;
        top: 50px;
        bottom: 0;
        left: 50%;
        transform: translateX(-75%);
        opacity: 0;
        transition: .5s ease;
      }
      
      .timer-container:hover .timer-tooltip {
        opacity: 1;
      }
      
      .hourglass-displayedTime {
        color: white;
        font-size: 18px;
        position: absolute;
        top: 50%;
        left: 50%;
        -webkit-transform: translate(-50%, -50%);
        -ms-transform: translate(-50%, -50%);
        transform: translate(-50%, -50%);
        text-align: center;
        white-space: nowrap;
        padding: 0.75rem;
        border-radius: 5px;
        background-color: var(--paper-tooltip-background, #616161);
      }

      .warning {
        color: rgba(255, 255, 0, 1);
        animation: blink-warning 1s linear infinite;
      }
      @keyframes blink-warning {
        50% {
            color: rgba(255, 255, 177, 0.6);
        }
      }

      .overtime {
        color: rgb(245, 15, 15, 1);
      }`;
    containerDiv.appendChild(tooltipStyle);

    // Add hourglass next to YouTube logo
    var youtubeLogo = document.getElementsByTagName('ytd-topbar-logo-renderer')[0];
    youtubeLogo.parentNode.insertBefore(containerDiv, youtubeLogo.nextSibling); // Insert timer-container div after youtube logo
    $('#hourglass-displayedTime').html("----");
}


/*
 * COUNTDOWN
 */
var countdownIntervalId, remainingTime, hours, minutes, seconds;

function startCountdown(seconds) {
    countdownStarted = true;
    clearInterval(overtimeId);
    var now = new Date().getTime();
    var target = new Date(now + seconds * 1000);
    var update = 500;
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
    countdownIntervalId = setInterval(function () {
        var now = new Date();
        remainingTime = (target - now) / 1000;
        if (remainingTime < 0) {
            remainingTime = -1;
            $('#hourglass-displayedTime').removeClass('warning');
            $('#hourglass-displayedTime').html("Time's up!!");
            clearInterval(countdownIntervalId);
            countdownStarted = false;
        } else {
            var hours = ~~((remainingTime / 3600));
            var minutes = ~~((remainingTime / 60) % 60);
            var seconds = ~~(remainingTime % 60);
            $('#hourglass-displayedTime').html(format(hours) + ":" + format(minutes) + ":" + format(seconds));
        }
        if (remainingTime < FIVE_MINUTES_IN_S && !$('#hourglass-displayedTime').hasClass('warning')) {
            $('#hourglass-displayedTime').addClass('warning');
        }
    }, update);
}


/*
 * OVERTIME
*/
var overtimeId, exceededTime, exceededHours, exceededMinutes, exceededSeconds;

function startOvertime(savedTimeOver) {
    $('#hourglass-displayedTime').removeClass('warning');
    overtimeStarted = true;
    clearInterval(countdownIntervalId);
    var start = new Date().getTime();
    var update = 500;
    clearInterval(overtimeId);
    overtimeId = null;
    overtimeId = setInterval(function () {
        $('#hourglass-displayedTime').addClass('overtime');
        var now = new Date();
        exceededTime = (now - start) / 1000;
        if (savedTimeOver && savedTimeOver !== 'undefined') {
            exceededTime += savedTimeOver;
        }
        exceededHours = ~~((exceededTime / 3600));
        exceededMinutes = ~~((exceededTime / 60) % 60);
        exceededSeconds = ~~(exceededTime % 60);
        $('#hourglass-displayedTime').html(format(exceededHours) + ":" + format(exceededMinutes) + ":" + format(exceededSeconds));
    }, update);
}


/*
 * HELPERS
 */
function format(num) {
    return num < 10 ? "0" + num : num;
}

function validateSession(newSession) {
    for (var i = 0; i < sessions.length;) {
        if (sessions[i].date === newSession.date) {
            sessions.splice(i, 1);
        } else {
            i++;
        }
    }
    sessions.push(newSession);
    if (sessions.length > 7) {
        sessions.shift();
    }
}