/* eslint-disable no-useless-escape */
/* eslint-disable no-restricted-syntax */
/**
This function is extracted from the source code of busy.org and condenser with 
some slight adjustments to meet our needs. Refer to the main one in case of 
future problems:
 * 
 * 
 * https://github.com/busyorg/busy/blob/a09049a4cb18103363fb578ebaec57b35c7d15e0/src/client/vendor/SanitizeConfig.js
 * https://raw.githubusercontent.com/steemit/steemit.com/354c08a10cf88e0828a70dbf7ed9082698aea20d/app/utils/SanitizeConfig.js
 *
 */

const sanitizeHtml = require('sanitize-html');
const URL = require('url-parse');
const { ownUrl } = require('./helpers/regex');

const ownDomains = [
  'localhost',
  'travelfeed.io',
  'www.travelfeed.io',
  'staging.travelfeed.io',
  'dev.travelfeed.io',
];

const knownDomains = [
  'localhost',
  'steempeak.com',
  'steemit.com',
  'hive.blog',
  'peakd.com',
  'ecency.com',
  'd.tube',
  'youtube.com',
  'instagram.com',
  'facebook.com',
  'discord.gg',
  'viator.com',
  'booking.com',
  'agoda.com',
  'viator.tp.st', // Travelpayouts
  'booking.tp.st',
  'discovercars.tp.st',
  'hostelworld.tp.st',
  'omio.tp.st',
  'safetywing.com',
  'tiqets.tp.st',
  'agoda.tp.st',
  '12go.tp.st',
  'getyourguide.tp.st',
  'klook.tp.st',
  'www.steempeak.com',
  'www.steemit.com',
  'www.hive.blog',
  'www.peakd.com',
  'www.ecency.com',
  'www.d.tube',
  'www.youtube.com',
  'www.instagram.com',
  'www.facebook.com',
  'www.discord.gg',
  'www.viator.com',
  'www.booking.com',
  'www.agoda.com',
];

const iframeWhitelist = [
  {
    re: /^(https?:)?\/\/player.vimeo.com\/video\/.*/i,
    fn: src => {
      // <iframe src="https://player.vimeo.com/video/179213493" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>
      if (!src) return null;
      const m = src.match(/https:\/\/player\.vimeo\.com\/video\/([0-9]+)/);
      if (!m || m.length !== 2) return null;
      return `https://player.vimeo.com/video/${m[1]}`;
    },
  },
  {
    re: /^(https?:)?\/\/embed\.truvvl\.com\/@.*/i,
  },
  {
    re: /^(https?:)?\/\/(?:www.)?instagram\.com\/p\/.*/i,
  },
  {
    re: /^(https?:)?\/\/www.youtube.com\/embed\/.*/i,
    fn: src => src.replace(/\?.+$/, ''), // strip query string (yt: autoplay=1,controls=0,showinfo=0, etc)
  },
  {
    re: /^(https?:)?\/\/www\.google\.com\/maps(|\/d|\/d\/u\/0)\/embed.*/i,
  },
  {
    re: /^https:\/\/www\.facebook\.com\/plugins\/video\.php\?href=https:\/\/www\.facebook\.com\/.*/i,
  },
  {
    re: /^(https?:)?\/\/w.soundcloud.com\/player\/.*/i,
    fn: src => {
      if (!src) return null;
      // <iframe width="100%" height="450" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/257659076&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=true"></iframe>
      const m = src.match(/url=(.+?)[&?]/);
      if (!m || m.length !== 2) return null;
      return (
        `https://w.soundcloud.com/player/?url=${m[1]}&auto_play=false&hide_related=false&show_comments=true` +
        '&show_user=true&show_reposts=false&visual=true'
      );
    },
  },
  {
    re: /^(https?:)?\/\/open\.spotify\.com\/embed\/track\/[a-zA-Z0-9]*/i,
  },
  {
    re: /^(https?:)?\/\/mapa-turystyczna\.pl\/map\/widget\/route\/[a-zA-Z0-9\/]*.html/i,
  },
  {
    re: /^(https?:)?\/\/(?:www\.)?(?:(player.)?twitch.tv\/)(.*)?$/i,
    fn: src => src,
  },
];
const noImageText = '(Image not shown due to low ratings)';
const allowedTags = `
    div, iframe, del,
    a, p, b, q, br, ul, li, ol, img, h1, h2, h3, h4, h5, h6, hr,
    blockquote, pre, code, em, i, strong, center, table, thead, tbody, tr, th, td,
    strike, sup, sub, details, summary, figure, figcaption
`
  .trim()
  .split(/,\s*/);

const processHeading = (tagName, attribs) => {
  const attys = {};
  if (attribs.json) attys.json = attribs.json;
  const classWhitelist = ['text-right'];
  const validClass = classWhitelist.find(e => attribs.class === e);
  if (validClass) {
    attys.class = validClass;
  }
  return {
    tagName,
    attribs: attys,
  };
};

const processJson = json => {
  try {
    const parsed = JSON.parse(json);
    if (parsed && parsed.type === 'button' && parsed.data && parsed.data.link) {
      let href = parsed.data.link;
      if (!href) href = '#';
      href = href.trim();
      const url = new URL(href);
      const hostname = url.hostname || 'localhost';
      if (
        knownDomains.indexOf(hostname) === -1 &&
        ownDomains.indexOf(hostname) === -1
      ) {
        return json;
      }
      parsed.data.isWhitelist = true;
      return JSON.stringify(parsed);
    }
    return json;
  } catch (err) {
    console.error(err);
    return json;
  }
};

// Medium insert plugin uses: div, figure, figcaption, iframe
const sanitizeHtmlConfig = ({
  large = true,
  noImage = false,
  sanitizeErrors = [],
  secureLinks = false,
  allLinksBlank = false,
  removeImageDimensions = false,
  addLinkAttys = true,
}) => ({
  allowedTags,
  // figure, figcaption,

  // SEE https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet
  allowedAttributes: {
    // "src" MUST pass a whitelist (below)
    iframe: [
      'src',
      'width',
      'height',
      'frameborder',
      'allowfullscreen',
      'webkitallowfullscreen',
      'mozallowfullscreen',
    ],

    // class attribute is strictly whitelisted (below)
    div: ['class', 'json'],
    h1: ['class'],
    h2: ['class'],
    h3: ['class'],
    h4: ['class'],
    h5: ['class'],
    h6: ['class'],

    // style is subject to attack, filtering more below
    td: ['style'],
    img: ['src', 'alt', 'width', 'height'],
    a: ['href', 'rel', 'target'],
  },
  allowedSchemes: sanitizeHtml.defaults.allowedSchemes.concat([
    'byteball',
    'bitcoin',
  ]),
  transformTags: {
    iframe: (tagName, attribs) => {
      const srcAtty = decodeURIComponent(attribs.src);
      for (const item of iframeWhitelist) {
        if (item.re.test(srcAtty)) {
          const src =
            typeof item.fn === 'function' ? item.fn(srcAtty, item.re) : srcAtty;
          if (!src) break;
          return {
            tagName: 'iframe',
            attribs: {
              frameborder: '0',
              allowfullscreen: 'allowfullscreen',
              webkitallowfullscreen: 'webkitallowfullscreen', // deprecated but required for vimeo : https://vimeo.com/forums/help/topic:278181
              mozallowfullscreen: 'mozallowfullscreen', // deprecated but required for vimeo
              src,
              width: large ? '960' : '480',
              height: large ? '540' : '270',
            },
          };
        }
      }
      sanitizeErrors.push(`Invalid iframe URL: ${srcAtty}`);
      return { tagName: 'div', text: `(Unsupported ${srcAtty})` };
    },
    img: (tagName, attribs) => {
      if (noImage) return { tagName: 'div', text: noImageText };
      // See https://github.com/punkave/sanitize-html/issues/117
      const { src, alt, width, height } = attribs;
      if (!/^(https?:)?\/\//i.test(src)) {
        sanitizeErrors.push('An image in this post did not save properly.');
        return {
          tagName: 'div',
        };
      }

      const atts = { src };
      if (alt && alt !== '') atts.alt = alt;
      if (!removeImageDimensions) {
        if (width && width !== '') atts.width = width;
        if (height && height !== '') atts.height = height;
      }
      return { tagName, attribs: atts };
    },
    div: (tagName, attribs) => {
      const attys = {};
      if (attribs.json) attys.json = processJson(attribs.json);
      const classWhitelist = [
        'pull-right',
        'pull-left',
        'text-justify',
        'text-rtl',
        'text-center',
        'text-right',
        'videoWrapper',
      ];
      const validClass = classWhitelist.find(e => attribs.class === e);
      if (validClass) {
        attys.class = validClass;
      }
      return {
        tagName,
        attribs: attys,
      };
    },
    td: (tagName, attribs) => {
      const attys = {};
      if (attribs.style === 'text-align:right') {
        attys.style = 'text-align:right';
      }
      const retTag = {
        tagName,
        attribs: attys,
      };
      return retTag;
    },
    a: (tagName, attribs) => {
      let { href } = attribs;
      if (!href) href = '#';
      href = href.trim();
      const attys = {};

      const url = new URL(href);
      const hostname = url.hostname || 'localhost';

      if (
        secureLinks &&
        knownDomains.indexOf(hostname) === -1 &&
        ownDomains.indexOf(hostname) === -1
      ) {
        href = `/exit?url=${encodeURIComponent(href)}`;
        attys.rel = 'nofollow';
      } else if (
        addLinkAttys &&
        (allLinksBlank ||
          (secureLinks &&
            ownDomains.indexOf(hostname) === -1 &&
            ['https', 'http'].indexOf(url.protocol)) ||
          !hostname.match(ownUrl))
      ) {
        attys.target = '_blank';
        attys.rel = 'ugc noopener noreferrer';
      }
      attys.href = href;

      return {
        tagName,
        attribs: attys,
      };
    },
    h1: (tagName, attribs) => {
      return processHeading(tagName, attribs);
    },
    h2: (tagName, attribs) => {
      return processHeading(tagName, attribs);
    },
    h3: (tagName, attribs) => {
      return processHeading(tagName, attribs);
    },
    h4: (tagName, attribs) => {
      return processHeading(tagName, attribs);
    },
    h5: (tagName, attribs) => {
      return processHeading(tagName, attribs);
    },
    h6: (tagName, attribs) => {
      return processHeading(tagName, attribs);
    },
  },
});

module.exports = { sanitizeHtmlConfig };
