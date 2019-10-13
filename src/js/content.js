console.log('Content Script loaded!');

var currentTabId;

// Send message to background.js to get tab Id
chrome.runtime.sendMessage({ from: "youtube" });

// Get current tab id from background and add listeners to detect Tabs closed or Windows closed
chrome.runtime.onMessage.addListener(function (msg) {
    console.log("Content script received", msg);
    if (msg.from === "background") {
        currentTabId = msg.tabId;
    }
});
init();

function init() {
    chrome.storage.sync.get(['countdown_status', 'remainingTime'], function (data) {
        var status = data.countdown_status;
        var remainingTime = data.remainingTime;
        console.log('status:', status);
        if (status === 'started' && remainingTime > 0) {
            console.log('RemainingTime:', remainingTime);
            return;
        } else if (status === 'paused' && remainingTime > 0) {
            chrome.runtime.sendMessage({ from: "youtube", startCountdown: true });
        } else {
            //TODO: inject div into YouTube page OR redirect to form page
            showTimeModal(); //temp solution
        }
    });
}


const ONE_MINUTE_IN_S = 60;
const ONE_HOUR_IN_S = 60 * 60;

function showTimeModal() {
    injectTimeModal();
    $(document).ready(function () {
        $(function () {
            $("#timeModal").dialog({
                height: "auto",
                minHeight: 110,
                maxHeight: 300,
                width: 200,
                modal: true,
                resizable: true,
                dialogClass: 'no-close success-dialog',
                autoOpen: true,
                buttons: {
                    'ok': function () {
                        if ($('#timeModalForm').valid()) {
                            var hours = $("#estimated_hours").val();
                            var minutes = $("#estimated_minutes").val();
                            var estimatedTime = (ONE_MINUTE_IN_S * minutes) + (ONE_HOUR_IN_S * hours);
                            $('#timeModal').dialog('close');
                            $("#overlay").remove();
                            if (estimatedTime <= 0) {
                                chrome.runtime.sendMessage({ from: "youtube", closeTab: true });
                                return;
                            }
                            chrome.storage.sync.set({ 'remainingTime': estimatedTime }, function () {
                                console.log('prompt value:', estimatedTime);
                                chrome.runtime.sendMessage({ from: "youtube", startCountdown: true });
                            });
                            var lastCountdownStartDate = new Date();
                            chrome.storage.sync.set({ 'lastCountdownStartDate': lastCountdownStartDate }, function () {
                                console.log('lastCountdownStartDate value:', lastCountdownStartDate);
                            });
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
    $("body").append("<div id='overlay'></div>");
    $("#overlay")
        .height(docHeight)
        .css({
            'opacity': 0.4,
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
    var modalString = '<div id="timeModal" title="Estimated Time on YouTube:">' + '<form id="timeModalForm" method="post">' + '<div style="float:left;padding-left:1rem;"><label>Hours:</label>' + '<input id="estimated_hours" name="estimated_hours" type="number"></div>' + '<div style="float:left;padding-left:1rem;"><label>Minutes:</label>' + '<input id="estimated_minutes" name="estimated_minutes" type="number"></div>' + '<div style="padding:1rem 0;clear:both;text-align:center" id="errorMessages"></div>' + '</form>' + '</div>';
    var modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalString.trim();
    modalDiv.appendChild(style);
    document.body.appendChild(modalDiv);
}

