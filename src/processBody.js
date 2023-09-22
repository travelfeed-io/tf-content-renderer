const readingTime = require('reading-time');
const sanitize = require('sanitize-html');
const { parseBody } = require('./parseBody');
const { isSpam } = require('./helpers/isSpam');

const processBody = (body, options) => {
  const htmlBody = parseBody(body, {
    secureLinks: !options || options.secureLinks !== false,
  });
  const bodyToSanitize = parseBody(body, {
    removeJson: true,
  });
  const sanitized = sanitize(bodyToSanitize, { allowedTags: [] });
  const readtime = readingTime(sanitized);
  const { minutes, words } = readtime;
  const excerpt = sanitized.substring(0, 350);
  const isSpamComment = isSpam(sanitized);
  return {
    body: htmlBody,
    wordCount: words,
    readTime: minutes,
    excerpt,
    isSpamComment,
  };
};

module.exports = {
  processBody,
};
