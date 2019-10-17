console.log('Content Script loaded!');

// Constants
const status = {
    STARTED: 'started',
    STOPPED: 'stopped',
    DONE: 'done'
};
const source = {
    BACKGROUND: 'background',
    PAGE: 'youtube',
    POPUP: 'popup'
};
const event = {
    INIT: 'init',
    RESET: 'reset',
    SNACKBAR: 'showSnackbar',
    CLOSE_TAB: 'closeTab',
    START_COUNTDOWN: 'startCountdown',
    SHOW_ARTICLE: 'showArticle'
};
const preset_times = { "30min": 30, "1h": 60, "2h": 120, "12h": 720 };

const ONE_MINUTE_IN_MS = 60000;
const ONE_MINUTE_IN_S = 60;
const ONE_HOUR_IN_S = 3600;
const MAX_BLUR_VAL = 20;
const MAX_HOURS = 23;
const MAX_MINUTES = 59;

// Variables
var currentTabId;
var blurIntervalId;
var isPresetAdded = false;

injectSnackbar();
injectTimerIcon();

// Send message to background.js to get tab Id
chrome.runtime.sendMessage({ from: source.PAGE });

// Get current tab id from background and add listeners to detect Tabs closed or Windows closed
chrome.runtime.onMessage.addListener(function (msg) {
    console.log("Content script received", msg);
    if (msg.from === source.BACKGROUND) {
        switch (msg.event) {
            case event.INIT:
                init(msg.remainingTime);
                break;
            case event.RESET:
                reset();
                break;
            case event.SNACKBAR:
                showSnackbar();
                break;
            default:
                break;
        }
    }
});

function init(activeRemainingTime) {
    chrome.storage.sync.get(['countdown_status', 'remainingTime'], function (data) {
        var countdown_status = data.countdown_status;
        var remainingTime = activeRemainingTime || data.remainingTime;
        console.log("Init ", remainingTime, "countdown");
        countdown(remainingTime);
        // removeModal();
        // Time limit reached, apply and increase blur every 5min
        if (remainingTime === -1) {
            blur();
        } else if (countdown_status === status.STARTED && remainingTime > 0) {
            removeModal();
            return;
        } else if (countdown_status === status.STOPPED && remainingTime > 0) {
            chrome.runtime.sendMessage({ from: source.PAGE, event: event.START_COUNTDOWN });
        } else {
            showTimeModal(); //temp solution
        }
    });
}

function reset() {
    removeModal();
    if (blurIntervalId) {
        clearInterval(blurIntervalId);
    }
    var blur = document.getElementById('blurStyle');
    blur && blur.remove();
    init();
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
        font-family: Verdana,Arial,sans-serif;
        font-size: .8em;
    }
    
    .ui-widget-content.success-dialog {
        background: #fae8e9;
        border: 1px solid #982122;
        color: #222222;
        font-weight: bold;
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
        background: #c4302b;
        border: 0;
        color: #fff;
        font-weight: bold;
        text-align: center;
    }
    
    .ui-dialog.success-dialog .ui-dialog-titlebar {
        padding: 0.1em .5em;
        position: relative;
        font-size: 1em;
    }

    .ui-dialog-titlebar-close {
        visibility: hidden;
    }
    
    .ui-dialog-buttonpane {
        text-align: center;
        padding-bottom: 1rem;
    }
    .okButton {
        background-color: rgb(96, 96, 255) !important;
        border-radius: 4px;
        border: none;
        color: white;
        font-weight: bold;
        margin: 4px;
        padding: 4px 1.5rem;
        opacity: 0.4;
        transition: 0.5s;
    }
    .okButton:hover {
        opacity: 1;
    }
    input {
        border-radius: 4px;
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
        color: red;
    }`;

    // Modal form
    var modalContent = '<div id="timeModal" title="Estimated Time on YouTube:">' + '<form id="timeModalForm" method="post">' + '<div style="float:left;padding-left:1rem;"><label>Hours: </label>' + '<input id="estimated_hours" name="estimated_hours" type="number"></div>' + '<div style="float:left;padding-left:1rem;"><label>Minutes: </label>' + '<input id="estimated_minutes" name="estimated_minutes" type="number"></div>' + '<div style="padding:1rem 0;clear:both;text-align:center" id="errorMessages"></div><div id="presets_wrapper"></div>' + '</form>' + '</div>';
    var modalDiv = document.createElement('div');
    modalDiv.id = "modal-container";
    modalDiv.innerHTML = modalContent.trim();
    modalDiv.appendChild(style);
    document.body.appendChild(modalDiv);
    addPresetTimes();
}

//TODO: Add suggested times
function showTimeModal() {
    injectTimeModal();
    $('html, body').css({
        overflow: 'hidden'
    });
    $(document).ready(function () {
        $(function () {
            $("#timeModal").dialog({
                height: "auto",
                minHeight: 185,
                maxHeight: 350,
                width: 200,
                modal: true,
                resizable: true,
                dialogClass: 'no-close success-dialog',
                autoOpen: true,
                buttons: [
                    {
                        text: "OK",
                        "class": 'okButton',
                        click: function () {
                            $("#estimated_hours").val().trim().length === 0 ? $("#estimated_hours").val(0) : null;
                            $("#estimated_minutes").val().trim().length === 0 ? $("#estimated_minutes").val(0) : null;
                            if ($('#timeModalForm').valid()) {
                                var hours = $("#estimated_hours").val();
                                var minutes = $("#estimated_minutes").val();
                                var estimatedTime = (ONE_MINUTE_IN_S * minutes) + (ONE_HOUR_IN_S * hours);
                                removeModal();
                                if (estimatedTime <= 0) {
                                    chrome.runtime.sendMessage({ from: source.PAGE, event: event.CLOSE_TAB });
                                    return;
                                }
                                chrome.storage.sync.set({ 'remainingTime': estimatedTime }, function () {
                                    chrome.runtime.sendMessage({ from: source.PAGE, event: event.START_COUNTDOWN });
                                });
                                var lastCountdownStartDate = (new Date()).getTime();
                                chrome.storage.sync.set({ 'lastCountdownStartDate': lastCountdownStartDate });
                                countdown(estimatedTime);
                            }
                        }
                    }
                ],
            });
        });
        $('#timeModalForm').validate({
            wrapper: 'div',
            errorLabelContainer: "#errorMessages",
            rules: {
                estimated_hours: {
                    required: true,
                    range: [0, MAX_HOURS],
                    digits: true
                },
                estimated_minutes: {
                    required: true,
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
    $("#timeModal").dialog('destroy').remove();
    $('#overlayModal').remove();
    $('html, body').css({
        overflow: 'auto',
        height: 'auto'
    });
}

function addPresetTimes() {
    var presets_wrapper = document.getElementById('presets_wrapper');
    var presetStyle = document.createElement('style');
    presetStyle.innerHTML = `
    div#presets_wrapper {
        display: flex;
        margin: 0 2rem;
        align-items: center;
        align-content: space-between;
        flex-direction: row;
    }
    div#preset {
        text-align: center;
        margin: 3px;
        background: transparent;
        border: 2px solid rgb(255, 56, 96);
        border-radius: 5px;
        padding: 5px;
        color: black;
        transition: 0.5s
    }
    div#preset:hover {
        background-color: rgb(255, 56, 96);
        color: white;
        cursor: pointer;
    }
    div#preset:focus {
          outline: 0;
    }`;
    var modalForm = document.getElementById('timeModalForm');
    modalForm.appendChild(presetStyle);
    for (preset in preset_times) {
        var newPreset = document.createElement('div');
        newPreset.id = "preset";
        newPreset.innerHTML = preset;
        newPreset.setAttribute('data-value', preset_times[preset]);
        newPreset.onclick = function (e) {
            var val = e.srcElement.attributes['data-value'].value;
            var hours = ~~(val / 60);
            var minutes = ~~(val % 60);
            $("#estimated_hours").val(hours);
            $("#estimated_minutes").val(minutes);
        };
        presets_wrapper.appendChild(newPreset);
    }
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
                    video, ytd-thumbnail {
                        filter: blur(${val}px);
                    }`;
            document.body.parentElement.appendChild(style);

            // Incremental blur every minute
            blurIntervalId = setInterval(function () {
                val >= MAX_BLUR_VAL ? clearInterval(blurIntervalId) : val++;
                var blurStyle = document.getElementById('blurStyle');
                blurStyle.innerHTML = `
                    video, yt-img-shadow, ytd-moving-thumbnail-renderer {
                        filter: blur(${val}px);
                    }`;
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
        background-color: #333;
        color: #fff;
        text-align: center;
        border-radius: 2px;
        padding: 16px;
        position: fixed;
        z-index: 1;
        left: 50%;
        bottom: 30px;
        font-size: 17px;
        cursor: pointer;
        box-shadow: 0;
        transition: box-shadow 0.3s;
    }
      
    #snackbar.show {
        visibility: visible;
        -webkit-animation: fadein 0.5s;
        animation: fadein 0.5s;
    }

    #snackbar.hide {
        visibility: visible;
        -webkit-animation: fadeout 0.5s;
        animation: fadeout 0.5s;
    }

    #snackbar:hover {
        box-shadow: 0 0 5px #00fffb;
    }
      
    @-webkit-keyframes fadein {
        from {bottom: 0; opacity: 0;} 
        to {bottom: 30px; opacity: 1;}
    }
      
    @keyframes fadein {
        from {bottom: 0; opacity: 0;}
        to {bottom: 30px; opacity: 1;}
    }
      
    @-webkit-keyframes fadeout {
        from {bottom: 30px; opacity: 1;} 
        to {bottom: 0; opacity: 0;}
    }
      
    @keyframes fadeout {
        from {bottom: 30px; opacity: 1;}
        to {bottom: 0; opacity: 0;}
    }`;
    snackDiv.appendChild(style);
    document.body.appendChild(snackDiv);
}

function showSnackbar() {
    var snackbar = document.getElementById("snackbar");
    snackbar.className = "show";
    snackbar.onclick = function () {
        snackbar.className = snackbar.className.replace("show", "hide");
        setTimeout(function () {
            snackbar.className = snackbar.className.replace("hide", "");
        }, 500);
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
    var now = new Date().getTime();
    var target = new Date(now + seconds * 1000);
    var update = 500;
    var tooltip = document.getElementById('time-remaining');
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }
    if (seconds === 0) {
        tooltip.innerHTML = "Timer has not been set";
    }
    countdownIntervalId = setInterval(function () {
        var now = new Date();
        remainingTime = (target - now) / 1000;

        if (remainingTime < 0) {
            remainingTime = -1;
            tooltip.innerHTML = "Time's up!!";
            clearInterval(countdownIntervalId);
        } else {
            var hours = ~~((remainingTime / 3600));
            var minutes = ~~((remainingTime / 60) % 60);
            var seconds = ~~(remainingTime % 60);
            tooltip.innerHTML = format(hours) + ":" + format(minutes) + ":" + format(seconds);
        }
    }, update);
}

function format(num) {
    return num < 10 ? "0" + num : num;
}