// Constants
const source = {
  BACKGROUND: 'background',
  PAGE: 'youtube',
  POPUP: 'popup'
}

// Global var
var background = chrome.extension.getBackgroundPage(); // instance of background script
var hours, minutes, seconds, remainingTime;
var countdown = document.getElementById("countdown");

var intervalId = setInterval(function () {
  background = chrome.extension.getBackgroundPage(); // instance of background script
  hours = background.remainingHours;
  minutes = background.remainingMinutes;
  seconds = background.remainingSeconds;
  remainingTime = background.remainingTime;

  if (typeof (hours) === 'undefined' || typeof (minutes) === 'undefined' || typeof (seconds) === 'undefined') {
    countdown.innerHTML = 'Countdown not started yet';
  } else if (remainingTime === -1) {
    countdown.innerHTML = "Time's up!!";
    intervalId || clearInterval(intervalId);
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
    chrome.runtime.sendMessage({ from: source.POPUP, resetCountdown: true });
    alert('Countdown was successfully reset!');
  });
};
