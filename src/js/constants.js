'use strict';

/*
 * CONSTANTS
 */
const status = {
    STARTED: 'started',
    PAUSED: 'paused',
    OVER: 'over'
};
const source = {
    BACKGROUND: 'background',
    PAGE: 'youtube',
    POPUP: 'popup'
};
const color = {
    GREY: '#bbbdbb',
    RED: '#F50F0F',
    BLUE: '#1c2efc',
    GREEN: '#4bb543'
}
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
const default_presets = { "30min": 30, "1h": 60, "2h": 120, "12h": 720 };
const default_soundOn = true;
const default_blurValue = 3;
const ONE_MINUTE_IN_MS = 60000;
const ONE_MINUTE_IN_S = 60;
const FIVE_MINUTES_IN_S = 300;
const ONE_HOUR_IN_S = 3600;
const MAX_BLUR_VAL = 20;
const MAX_HOURS = 23;
const MAX_MINUTES = 59;
const TWENTY_FOUR_HOURS_IN_S = 86400;
const FIVE_MINS_LEFT = 'You have 5 minutes left...';