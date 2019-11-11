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
  RESET: 'reset',
  SNACKBAR: 'showSnackbar',
  CLOSE_TAB: 'closeTab',
  START_COUNTDOWN: 'startCountdown',
  SHOW_ARTICLE: 'showArticle',
  START_OVERTIME: 'startOvertime'
};

$(function () {
  $('#popup-settings').hide();
});

let background = chrome.extension.getBackgroundPage(); // instance of background script

// Variables
var hours, minutes, seconds, remainingTime;
var timeOver, hoursOver, minutesOver, secondsOver;
var displayedTime = document.getElementById("displayedTime");

if (typeof (background.remainingHours) === 'undefined' || typeof (background.remainingMinutes) === 'undefined' || typeof (background.remainingSeconds) === 'undefined') {
  displayedTime.innerHTML = 'Timer has not been set';
}

/*
 * Main function
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

    if (remainingTime <= 0 && displayedTime.innerHTML !== "Time's up!!") {
      displayedTime.innerHTML = "Time's up!!";
    } else if (remainingTime > 0) {
      displayedTime.innerHTML = 'Time remaining: ' + format(hours) + ":" + format(minutes) + ":" + format(seconds);
    }
  } else if (countdown_status === status.OVER) {
    // Overtime
    hoursOver = background.hoursOver;
    minutesOver = background.minutesOver;
    secondsOver = background.secondsOver;
    displayedTime.innerHTML = 'Overtime';
    if (typeof (hoursOver) !== 'undefined' && typeof (minutesOver) !== 'undefined' && typeof (secondsOver) !== 'undefined') {
      displayedTime.innerHTML += ': ' + format(hoursOver) + ":" + format(minutesOver) + ":" + format(secondsOver);
    }
  }
}, 500);


// Helpers
function format(num) {
  return num < 10 ? "0" + num : num;
}


// Reset
let resetButton = document.getElementById('reset');

resetButton.onclick = function () {
  chrome.storage.sync.clear(function () {
    chrome.runtime.sendMessage({ from: source.POPUP, event: event.RESET });
    var displayedTime = document.getElementById("displayedTime");
    displayedTime.innerHTML = "Timer has not been set";
  });
};
$('#reset').hide();
document.addEventListener('keydown', function (event) {
  if (event.defaultPrevented || $('#popup-settings').is(":hidden")) {
    return;
  }
  var key = event.key || event.keyCode;
  if (event.shiftKey && (key === "R" || key === "KeyR" || key === 82)) {
    $('#reset').is(":hidden") ? $('#reset').show() : $('#reset').hide();
  }
});

// Show last article
let showArticleButton = document.getElementById('showLastArticle');

showArticleButton.onclick = function () {
  chrome.runtime.sendMessage({ from: source.POPUP, event: event.SHOW_ARTICLE });
};


// Settings
function initSettings() {
  chrome.storage.sync.get(['soundOn'], function (data) {
    $("#soundOn").prop('checked', data.soundOn || true);
  });
}

let showSettingsButton = document.getElementById('settings');

showSettingsButton.onclick = function () {
  $('#popup-home').hide();
  initSettings();
  $('#popup-settings').show('slide', { direction: 'left', easing: 'easeOutQuint' }, 200);
}

let backButton = document.getElementById('back');

backButton.onclick = function () {
  $('#popup-home').show('slide', { direction: 'right', easing: 'easeOutQuint' }, 200);
  $('#popup-settings').hide();
}

let saveButton = document.getElementById('save_changes');
saveButton.onclick = function () {
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
}

let restoreDefaultButton = document.getElementById('restore_default');
restoreDefaultButton.onclick = function () {
  // Default values: soundOn = true
  $("#soundOn").prop('checked', true);
}