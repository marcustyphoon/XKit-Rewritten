import moment from '../lib/moment.js';
import { keyToCss } from '../utils/css_map.js';
import { pageModifications } from '../utils/mutations.js';
import { getPreferences } from '../utils/preferences.js';

let format;
let displayRelative;

const relativeTimeFormat = new Intl.RelativeTimeFormat(document.documentElement.lang, { style: 'long' });
const thresholds = [
  { unit: 'year', denominator: 31557600 },
  { unit: 'month', denominator: 2629800 },
  { unit: 'week', denominator: 604800 },
  { unit: 'day', denominator: 86400 },
  { unit: 'hour', denominator: 3600 },
  { unit: 'minute', denominator: 60 },
  { unit: 'second', denominator: 1 }
];

const constructRelativeTimeString = function (unixTime) {
  const now = Math.trunc(new Date().getTime() / 1000);
  const unixDiff = unixTime - now;
  const unixDiffAbsolute = Math.abs(unixDiff);

  for (const { unit, denominator } of thresholds) {
    if (unixDiffAbsolute >= denominator) {
      const value = Math.trunc(unixDiff / denominator);
      return relativeTimeFormat.format(value, unit);
    }
  }

  return relativeTimeFormat.format(-0, 'second');
};

const formatTimeElements = function (timeElements) {
  timeElements.forEach(timeElement => {
    const momentDate = moment(timeElement.dateTime, moment.ISO_8601);
    timeElement.dataset.formattedTime = momentDate.format(format);
    if (displayRelative) {
      timeElement.dataset.formattedTime += '\u2002\u00B7\u2002';
      timeElement.dataset.formattedRelativeTime = constructRelativeTimeString(momentDate.unix());
    }
  });
};

export const main = async function () {
  ({ format, displayRelative } = await getPreferences('timeformat'));
  pageModifications.register(`${keyToCss('timestamp')}[datetime]`, formatTimeElements);
};

export const clean = async function () {
  pageModifications.unregister(formatTimeElements);
  $('[data-formatted-time]').removeAttr('data-formatted-time');
  $('[data-formatted-relative-time]').removeAttr('data-formatted-relative-time');
};

export const stylesheet = true;
