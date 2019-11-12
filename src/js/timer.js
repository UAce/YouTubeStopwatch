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
const event = {
  INIT: 'init',
  RESET: 'reset',
  SNACKBAR: 'showSnackbar',
  CLOSE_TAB: 'closeTab',
  START_COUNTDOWN: 'startCountdown',
  SHOW_ARTICLE: 'showArticle',
  START_OVERTIME: 'startOvertime'
};
let background = chrome.extension.getBackgroundPage(); // instance of background script


/*
 * VARIABLES
 */
var hours, minutes, seconds, remainingTime;
var timeOver, hoursOver, minutesOver, secondsOver;
if (typeof (background.remainingHours) === 'undefined' || typeof (background.remainingMinutes) === 'undefined' || typeof (background.remainingSeconds) === 'undefined') {
  $('#displayedTime').html('Timer has not been set');
}


/*
 * COUNTDOWN/OVERTIME
 */
var intervalId = setInterval(function () {
  background = chrome.extension.getBackgroundPage(); // instance of background script
  var countdown_status = background.countdown_status;

  if (countdown_status === status.STARTED) {
    // Countdown
    hours = background.remainingHours;
    minutes = background.remainingMinutes;
    seconds = background.remainingSeconds;
    remainingTime = Math.floor(background.remainingTime);

    if (remainingTime <= 0 && $('#displayedTime').html() !== "Time's up!!") {
      $('#displayedTime').html("Time's up!!");
    } else if (remainingTime > 0) {
      $('#displayedTime').html('Time remaining: ' + format(hours) + ":" + format(minutes) + ":" + format(seconds));
    }
  } else if (countdown_status === status.OVER) {
    // Overtime
    hoursOver = background.hoursOver;
    minutesOver = background.minutesOver;
    secondsOver = background.secondsOver;
    $('#displayedTime').html("Overtime");
    if (typeof (hoursOver) !== 'undefined' && typeof (minutesOver) !== 'undefined' && typeof (secondsOver) !== 'undefined') {
      $('#displayedTime').append(': ' + format(hoursOver) + ":" + format(minutesOver) + ":" + format(secondsOver));
    }
  }
}, 500);


/*
 * POPUP HOME
 */
$(function () {
  $('#popup-settings').hide();
});

// Show settings
$('#settings').click(function () {
  $('#popup-home').hide();
  initSettings();
  $('#popup-settings').show('slide', { direction: 'left', easing: 'easeOutQuint' }, 200);
});

// Show last article
$('#showLastArticle').click(function () {
  chrome.runtime.sendMessage({ from: source.POPUP, event: event.SHOW_ARTICLE });
});


/*
 * SETTINGS
 */
function initSettings() {
  chrome.storage.sync.get(['soundOn'], function (data) {
    $("#soundOn").prop('checked', data.soundOn || true);
  });
}

// Return to home
$('#back').click(function () {
  $('#popup-home').show('slide', { direction: 'right', easing: 'easeOutQuint' }, 200);
  $('#popup-settings').hide();
});

// Reset
$('#reset').click(function () {
  chrome.storage.sync.clear(function () {
    chrome.runtime.sendMessage({ from: source.POPUP, event: event.RESET });
    $('#displayedTime').html('Timer has not been set');
  });
});
$('#reset').hide();
// Show/Hide reset button on 'Shift + R'
document.addEventListener('keydown', function (event) {
  if (event.defaultPrevented || $('#popup-settings').is(":hidden")) {
    return;
  }
  var key = event.key || event.keyCode;
  if (event.shiftKey && (key === "R" || key === "KeyR" || key === 82)) {
    $('#reset').is(":hidden") ? $('#reset').show() : $('#reset').hide();
  }
});

// Save setting changes
$('#save_changes').click(function () {
  chrome.storage.sync.set({
    soundOn: $('#soundOn').prop('checked')
  }, function () {
    var snackbar = document.getElementById("saved_snackbar");
    snackbar.className = "show";
    saveButton.disabled = true;
    setTimeout(function () {
      snackbar.className = snackbar.className.replace("show", "");
      saveButton.disabled = false;
    }, 2000);
  });
});

// Restore default settings
$('#restore_default').click(function () {
  // Default values: soundOn = true
  $("#soundOn").prop('checked', true);
});

// Validate preset options
function validatePresetTime(evt) {
  var presetType = $('#preset_type');
  var presetInput = $('#preset_input');
  var charCode = (evt.which) ? evt.which : evt.keyCode;
  console.log(charCode, presetType, presetInput);
  console.log(evt);
  if (charCode != 46 && charCode > 31
    && (charCode < 48 || charCode > 57))
    return false;

  return true;
}


/*
 * HELPERS
 */
function format(num) {
  return num < 10 ? "0" + num : num;
}