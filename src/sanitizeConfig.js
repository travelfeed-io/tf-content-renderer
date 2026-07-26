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
  'travelfeed.com',
  'www.travelfeed.com',
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
  'tiktok.com',
  'twitter.com',
  'x.com',
  'en.wikipedia.org',
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
  'maps.app.goo.gl',
  'www.travelpayouts.com',
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
  'www.tiktok.com',
  'www.twitter.com',
  'www.x.com',
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

// The rel values an author may set on their own blog. "dofollow" is not a real
// rel value — the absence of nofollow is what makes a link followed — so it is
// deliberately not here.
const AUTHOR_REL = ['nofollow', 'sponsored', 'ugc'];

const dedupeRel = values =>
  values
    .filter((value, index) => value && values.indexOf(value) === index)
    .join(' ');

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
  // TravelFeed Hosting. On a hosted blog the AUTHOR owns their link graph: an
  // editorial link should pass ranking signal, an affiliate link must be
  // rel="sponsored" (Google requires it), and neither is user-generated
  // content. The default (false) keeps the community policy exactly as it is —
  // every off-domain link nofollowed or marked ugc, because on travelfeed.com
  // the link graph is ours to protect, not the poster's to spend.
  preserveLinkRel = false,
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
  // NEVER return `text:` from a transformTags handler.
  //
  // sanitize-html 2.3.3 sets a single `addedText` flag when a transform supplies
  // replacement text (index.js:423) and never resets it — every text node in the
  // REST OF THE DOCUMENT is then dropped (index.js:452-455). One post with one
  // unsupported iframe therefore lost every paragraph below it on the published
  // page: they render as empty <p></p>. Found by the Editor v2 corpus gate.
  //
  // Fixed upstream by resetting the flag per tag; until this package can take a
  // sanitize-html bump, the rule is simply not to use the feature.
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
      // NO `text:` here — see the note above transformTags. The URL is already
      // recorded in sanitizeErrors for callers that want it; printing
      // `(Unsupported …)` into the article cost every paragraph after it.
      return { tagName: 'div' };
    },
    img: (tagName, attribs) => {
      // Same reason as the iframe branch: a `text:` transform silences every
      // text node in the rest of the document.
      if (noImage) return { tagName: 'div' };
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

      // Only these three are the author's to declare. Anything else in their
      // rel (including a hand-written "dofollow", which is not a real value)
      // is dropped rather than passed through into the page.
      const declaredRel = preserveLinkRel
        ? String(attribs.rel || '')
            .split(/\s+/)
            .filter(value => AUTHOR_REL.indexOf(value) !== -1)
        : [];

      if (
        secureLinks &&
        knownDomains.indexOf(hostname) === -1 &&
        ownDomains.indexOf(hostname) === -1
      ) {
        // The exit interstitial is about reader safety and spam, not ranking,
        // so it still applies even when the author owns the link graph.
        href = `/exit?url=${encodeURIComponent(href)}`;
        attys.rel = dedupeRel(['nofollow'].concat(declaredRel));
      } else if (preserveLinkRel) {
        // Author-controlled: an unmarked link stays a plain editorial link.
        // noopener/noreferrer only ride along with a new tab, where leaving
        // them off hands the destination a handle back into the page.
        const wantsNewTab = attribs.target === '_blank';
        if (wantsNewTab) attys.target = '_blank';
        const rel = dedupeRel(
          declaredRel.concat(wantsNewTab ? ['noopener', 'noreferrer'] : []),
        );
        if (rel) attys.rel = rel;
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
