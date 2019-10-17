// Constants
const source = {
  BACKGROUND: 'background',
  PAGE: 'youtube',
  POPUP: 'popup'
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
var hours, minutes, seconds, remainingTime;
var countdown = document.getElementById("countdown");

var intervalId = setInterval(function () {
  background = chrome.extension.getBackgroundPage(); // instance of background script
  hours = background.remainingHours;
  minutes = background.remainingMinutes;
  seconds = background.remainingSeconds;
  remainingTime = background.remainingTime;

  if (typeof (hours) === 'undefined' || typeof (minutes) === 'undefined' || typeof (seconds) === 'undefined') {
    countdown.innerHTML = 'Timer has not been set';
  } else if (remainingTime === -1) {
    countdown.innerHTML = "Time's up!!";
    clearInterval(intervalId);
  } else {
    countdown.innerHTML = 'Time remaining: ' + format(hours) + ":" + format(minutes) + ":" + format(seconds);
  }
}, 500);

function format(num) {
  return num < 10 ? "0" + num : num;
}


// Reset
let resetButton = document.getElementById('reset');

resetButton.onclick = function () {
  chrome.storage.sync.clear(function () {
    chrome.runtime.sendMessage({ from: source.POPUP, event: event.RESET });
    var countdown = document.getElementById("countdown");
    countdown.innerHTML = "RESET!";
    window.location.reload();
  });
};
