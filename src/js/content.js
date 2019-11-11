// console.log('Content Script loaded!');

// Constants
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
const color = {
    GREY: '#bbbdbb',
    RED: '#F50F0F',
    BLUE: '#1c2efc',
    GREEN: '#4bb543'
}
const preset_times = { "30min": 30, "1h": 60, "2h": 120, "12h": 720 };

const ONE_MINUTE_IN_MS = 60000;
const ONE_MINUTE_IN_S = 60;
const FIVE_MINUTES_IN_S = 300;
const ONE_HOUR_IN_S = 3600;
const MAX_BLUR_VAL = 20;
const MAX_HOURS = 23;
const MAX_MINUTES = 59;

// Variables
var currentTabId;
var blurIntervalId;
var isPresetAdded = false;
var localCountdownStarted = false;
var localOvertimeStarted = false;
var isPageReady = false;
var soundOn;
// Sound from https://notificationsounds.com/
var snackSound = new Audio(chrome.runtime.getURL("audio/time_is_now.mp3"));
snackSound.loop = false;
// Set variables from chrome storage
chrome.storage.sync.get(['soundOn'], function (data) {
    soundOn = data.soundOn || true;
});
var pageReadyIntervalId = setInterval(function () {
    injectComponent();
    if (isPageReady) {
        clearInterval(pageReadyIntervalId);
    }
}, 1000);


// FIRST: Send message to background.js to subscribe active YouTube page
chrome.runtime.sendMessage({ from: source.PAGE });

// SECOND: Add listener to events from background.js
chrome.runtime.onMessage.addListener(function (msg) {
    // console.log("Content script received", msg);
    if (msg.from === source.BACKGROUND) {
        // console.log(msg.event, " event received!");
        switch (msg.event) {
            case event.INIT:
                init(msg.remainingTime, msg.timeOver);
                break;
            case event.RESET:
                reset();
                break;
            case event.SNACKBAR:
                showSnackbar();
                break;
            case event.START_COUNTDOWN:
                countdown(msg.remainingTime);
                break;
            case event.START_OVERTIME:
                blur();
                overtime(msg.timeOver);
                break;
            default:
                break;
        }
    }
});

function init(activeRemainingTime, activeTimeOver) {
    chrome.storage.sync.get(['countdown_status', 'remainingTime', 'overtime_status', 'timeOver'], function (data) {
        var countdown_status = data.countdown_status;
        var remainingTime = activeRemainingTime || data.remainingTime;
        var overtime_status = data.overtime_status;
        var timeOver = activeTimeOver || data.timeOver;
        // Time limit reached, apply and increase blur every 5min
        if (countdown_status === status.OVER) {
            // console.log("1. countdown_status:", countdown_status, ", overtime_status:", overtime_status, "timer over:", timeOver, ", over time started:", localOvertimeStarted);
            overtime_status === status.STOPPED ? chrome.runtime.sendMessage({ from: source.PAGE, event: event.START_OVERTIME }) : null;
            blur();
            localOvertimeStarted ? null : overtime(timeOver);
        } else if (countdown_status === status.STARTED && remainingTime > 0) {
            // console.log("2. countdown_status:", countdown_status, ", remaining time:", remainingTime, ", local countdown started:", localCountdownStarted);
            removeModal();
            localCountdownStarted ? null : countdown(remainingTime);
            return;
        } else if (countdown_status === status.STOPPED && remainingTime > 0) {
            // console.log("3. countdown_status:", countdown_status, ", remaining time:", remainingTime);
            chrome.runtime.sendMessage({ from: source.PAGE, event: event.START_COUNTDOWN });
        } else {
            // console.log("4. countdown_status:", countdown_status);
            showTimeModal(); //temp solution
        }
    });
}

function reset() {
    removeModal();
    clearInterval(blurIntervalId);
    clearInterval(countdownIntervalId);
    clearInterval(overtimeId);
    $('#blurStyle').remove();
    $('#time-remaining').removeClass('overtime');
    chrome.runtime.sendMessage({ from: source.PAGE, event: event.INIT });
}

function injectComponent() {
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

function showTimeModal() {
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
                        var estimatedTime = (ONE_MINUTE_IN_S * minutes) + (ONE_HOUR_IN_S * hours);
                        if (estimatedTime <= 0) {
                            chrome.runtime.sendMessage({ from: source.PAGE, event: event.CLOSE_TAB });
                        } else {
                            chrome.storage.sync.set({ 'remainingTime': estimatedTime }, function () {
                                chrome.runtime.sendMessage({ from: source.PAGE, event: event.START_COUNTDOWN });
                                chrome.runtime.sendMessage({ from: source.PAGE, event: event.INIT_ALL });
                            });
                            var lastCountdownStartDate = (new Date()).getTime();
                            chrome.storage.sync.set({ 'lastCountdownStartDate': lastCountdownStartDate });
                            countdown(estimatedTime);
                        }
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
                autoOpen: true,
                draggable: false,
                buttons: modalButtons,
                title: 'Plan and control your time on Youtube<br>Enter estimated time'
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

function removeModal() {
    $("#timeModal").dialog("close");
    $("#timeModal").dialog('destroy').remove();
    $('#overlayModal').remove();
    $('html, body').css({
        overflow: 'auto',
        height: 'auto'
    });
}

/*
 * BLUR effect
 */
function blur() {
    var blurStyle = document.getElementById('blurStyle');

    // Prevent appending multiple times the blur element
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
 * SNACKBAR (This is a replacement for chrome.notifications until we can get it to work)
 */
function injectSnackbar() {
    var snackDiv = document.createElement('div');
    snackDiv.innerHTML = '<div id="snackbar">You have 5 minutes left...</div>';
    var style = document.createElement('style');
    style.innerHTML = `
    #snackbar {
        visibility: hidden;
        min-width: 250px;
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

function showSnackbar() {
    soundOn ? snackSound.play() : null;
    var snackbar = document.getElementById("snackbar");
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
    tooltip.innerHTML = '<div class="time-remaining" id="time-remaining"></div>'.trim();
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
      
      .time-remaining {
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
}


/*
 * Start Countdown time on YouTube page
 */
var countdownIntervalId, remainingTime, hours, minutes, seconds;

function countdown(seconds) {
    localCountdownStarted = true;
    clearInterval(overtimeId);
    var now = new Date().getTime();
    var target = new Date(now + seconds * 1000);
    var update = 500;
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
    countdownIntervalId = setInterval(function () {
        // var displayedTime = $('#time-remaining');
        var now = new Date();
        remainingTime = (target - now) / 1000;
        // console.log("Time Remaining:", remainingTime);
        if (remainingTime < 0) {
            remainingTime = -1;
            $('#time-remaining').removeClass('warning');
            $('#time-remaining').html("Time's up!!");
            clearInterval(countdownIntervalId);
        } else if (!$('#time-remaining').hasClass('warning') && remainingTime < FIVE_MINUTES_IN_S) {
            $('#time-remaining').addClass('warning');
        } else {
            var hours = ~~((remainingTime / 3600));
            var minutes = ~~((remainingTime / 60) % 60);
            var seconds = ~~(remainingTime % 60);
            $('#time-remaining').html(format(hours) + ":" + format(minutes) + ":" + format(seconds));
        }
    }, update);
}

function format(num) {
    return num < 10 ? "0" + num : num;
}

/*
 * Start Overtime on YouTube page
*/
var overtimeId, timeOver, hoursOver, minutesOver, secondsOver;

function overtime(savedTimeOver) {
    localOvertimeStarted = true;
    clearInterval(countdownIntervalId);
    var start = new Date().getTime();
    var update = 500;
    clearInterval(overtimeId);
    overtimeId = null;
    overtimeId = setInterval(function () {
        $('#time-remaining').addClass('overtime');
        var now = new Date();
        timeOver = (now - start) / 1000;
        if (savedTimeOver) {
            timeOver += savedTimeOver;
        }
        // console.log("Time Over:", timeOver);
        hoursOver = ~~((timeOver / 3600));
        minutesOver = ~~((timeOver / 60) % 60);
        secondsOver = ~~(timeOver % 60);
        $('#time-remaining').html(format(hoursOver) + ":" + format(minutesOver) + ":" + format(secondsOver));
    }, update);
}