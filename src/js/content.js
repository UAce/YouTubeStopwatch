console.log('Content Script loaded!');

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

var currentTabId;
var blurIntervalId;
const ONE_MINUTE_IN_S = 60;
const ONE_HOUR_IN_S = 60 * 60;

injectSnackbar();

// Send message to background.js to get tab Id
chrome.runtime.sendMessage({ from: source.PAGE });

// Get current tab id from background and add listeners to detect Tabs closed or Windows closed
chrome.runtime.onMessage.addListener(function (msg) {
    console.log("Content script received", msg);
    if (msg.from === source.BACKGROUND) {
        msg.init ? init() : null;
        msg.showSnackbar ? showSnackbar() : null;
    }
});
init();

function init() {
    chrome.storage.sync.get(['countdown_status', 'remainingTime'], function (data) {
        var countdown_status = data.countdown_status;
        var remainingTime = data.remainingTime;

        // Time limit reached, apply and increase blur every 5min
        if (remainingTime === -1) {
            blur();
        } else if (countdown_status === status.STARTED && remainingTime > 0) {
            return;
        } else if (countdown_status === status.STOPPED && remainingTime > 0) {
            chrome.runtime.sendMessage({ from: source.PAGE, startCountdown: true });
        } else {
            //TODO: inject div into YouTube page OR redirect to form page
            showTimeModal(); //temp solution
        }
    });
}


//TODO: Add suggested times
function showTimeModal() {
    injectTimeModal();
    $(document).ready(function () {
        $(function () {
            $("#timeModal").dialog({
                height: "auto",
                minHeight: 200,
                maxHeight: 400,
                width: 200,
                modal: true,
                resizable: true,
                dialogClass: 'no-close success-dialog',
                autoOpen: true,
                buttons: {
                    'OK': function () {
                        $("#estimated_hours").val().trim().length === 0 ? $("#estimated_hours").val(0) : null;
                        $("#estimated_minutes").val().trim().length === 0 ? $("#estimated_minutes").val(0) : null;
                        if ($('#timeModalForm').valid()) {
                            var hours = $("#estimated_hours").val();
                            var minutes = $("#estimated_minutes").val();
                            var estimatedTime = (ONE_MINUTE_IN_S * minutes) + (ONE_HOUR_IN_S * hours);
                            $('#timeModal').dialog('close');
                            $("#overlayModal").remove();
                            if (estimatedTime <= 0) {
                                chrome.runtime.sendMessage({ from: source.PAGE, closeTab: true });
                                return;
                            }
                            chrome.storage.sync.set({ 'remainingTime': estimatedTime }, function () {
                                chrome.runtime.sendMessage({ from: source.PAGE, startCountdown: true });
                            });
                            var lastCountdownStartDate = (new Date()).getTime();
                            chrome.storage.sync.set({ 'lastCountdownStartDate': lastCountdownStartDate });
                        }
                    }
                }
            });
        });
        $('#timeModalForm').validate({
            wrapper: 'div',
            errorLabelContainer: "#errorMessages",
            rules: {
                estimated_hours: {
                    required: true,
                    range: [0, 23],
                    digits: true
                },
                estimated_minutes: {
                    required: true,
                    range: [0, 59],
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

function injectTimeModal() {
    // Add overlay
    var docHeight = $(document).height();
    $("body").append("<div id='overlayModal'></div>");
    $("#overlayModal")
        .height(docHeight)
        .css({
            'opacity': 0.7,
            'position': 'absolute',
            'top': 0,
            'left': 0,
            'background-color': 'black',
            'width': '100%',
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
    ui-button {
        background-color: white !important;
    }
    #estimated_hours, #estimated_minutes {
        width: 40px
    }
    #timeModalForm {
        padding-top: 1rem;
    }
    #errorMessages{
        color: red;
    }`;

    // Modal form
    var modalString = '<div id="timeModal" title="Estimated Time on YouTube:">' + '<form id="timeModalForm" method="post">' + '<div style="float:left;padding-left:1rem;"><label>Hours: </label>' + '<input id="estimated_hours" name="estimated_hours" type="number"></div>' + '<div style="float:left;padding-left:1rem;"><label>Minutes: </label>' + '<input id="estimated_minutes" name="estimated_minutes" type="number"></div>' + '<div style="padding:1rem 0;clear:both;text-align:center" id="errorMessages"></div>' + '</form>' + '</div>';
    var modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalString.trim();
    modalDiv.appendChild(style);
    document.body.appendChild(modalDiv);
}


/*
 * Blur effect
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
                val >= 20 ? clearInterval(blurIntervalId) : val++;
                var blurStyle = document.getElementById('blurStyle');
                blurStyle.innerHTML = `
                    video, ytd-thumbnail {
                        filter: blur(${val}px);
                    }`;
                chrome.storage.sync.set({ 'blur_value': val });
            }, ONE_MINUTE_IN_S);
        });
    }
}


// This is a replacement for chrome.notifications until we can get it to work
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
    var x = document.getElementById("snackbar");
    x.className = "show";
    x.onclick = function () {
        x.className = x.className.replace("show", "hide");
        setTimeout(function () {
            x.className = x.className.replace("hide", "");
        }, 500);
    };
}