const sanitizeHtml = require('sanitize-html');
const { DefaultRenderer } = require('steem-content-renderer');
const { imageProxy } = require('tf-post-parser');
const {
  dtubeImageRegex,
  htmlComment,
  imgFullSize,
  instagramPost,
  markdownComment,
  swmregex,
  tfAdBottom,
  tfAdTop,
} = require('./helpers/regex');
const { sanitizeHtmlConfig } = require('./sanitizeConfig');

const renderer = new DefaultRenderer({
  baseUrl: 'https://travelfeed.com/',
  breaks: true,
  skipSanitization: true, // performed by sanitize
  addNofollowToLinks: false, // performed by sanitize
  doNotShowImages: false,
  allowInsecureScriptTags: true,
  ipfsPrefix: '',
  assetsWidth: 1, // performed by sanitize
  assetsHeight: 1, // performed by sanitize
  imageProxyFn: url => url,
  usertagUrlFn: account => `/@${account}`,
  hashtagUrlFn: hashtag => `/topics/${hashtag}`,
  isLinkSafeFn: () => true,
});

const parseBody = (body, options) => {
  // Remove HTML comments
  let parsedBody = body.replace(htmlComment, '');
  // remove markdown comment
  parsedBody = parsedBody.replace(markdownComment, '');
  // Remove partiko ads
  parsedBody = parsedBody.replace(/Posted using \[Partiko .*]\(.*\)/g, '');
  // Remove travelfeed ads
  parsedBody = parsedBody.replace(
    /<hr \/><center>View this post <a href="https:\/\/travelfeed\.io\/@.*">on the TravelFeed dApp<\/a> for the best experience\.<\/center>/g,
    '',
  );
  parsedBody = parsedBody.replace(tfAdBottom, '');
  parsedBody = parsedBody.replace(tfAdTop, '');
  // Remove dclick ads
  parsedBody = parsedBody.replace(/\[!\[dclick-imagead]\(h.*\)]\(.*\)/g, '');
  parsedBody = parsedBody.replace(
    /#####.*<sub>.*\*\*Sponsored \( Powered by \[dclick]\(https:\/\/www\.dclick\.io\) \)\*\* <\/sub>/g,
    '',
  );
  // Remove tripsteem ads
  parsedBody = parsedBody.replace(
    /<a href='https:\/\/.*tripsteem\.com\/post\/.*'>.*<\/a>/g,
    '',
  );
  parsedBody = parsedBody.replace(
    /This is posted on <a href='https:\/\/en\.tripsteem\.com\/'><b>trips\.teem/g,
    '',
  );
  parsedBody = parsedBody.replace(
    /<a href='https:\/\/en\.tripsteem\.com\/'>!\[image]\(https:\/\/cdn\.steemitimages\.com\/DQmUjAKXsageaSrVo4CgqvDGePsw7CbVFRfNv91fQrW9kuL\/banner_en\.jpg\)<\/a>/g,
    '',
  );
  // Remove SWM snippets with description
  parsedBody = parsedBody.replace(
    /!\b(?:steemitworldmap|pinmapple)\b\s((?:[-+]?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?)))\s\blat\b\s((?:[-+]?(?:180(?:\.0+)?|(?:(?:1[0-7]\d)|(?:[1-9]?\d))(?:\.\d+)?)))\s\blong.*d3scr/gi,
    '',
  );
  // Remove easy editor swm remains
  parsedBody = parsedBody.replace(/\\\[\/\/\\\]:# \(\)/gi, '');
  // Turn Instagram URLs into embeds
  parsedBody = parsedBody.replace(
    instagramPost,
    `<iframe src="https://www.instagram.com/p/$1/embed" />`,
  );
  // Turn Spotify URLs into embeds
  parsedBody = parsedBody.replace(
    /(?:http[s]?:\/\/)?(?:www.)?open\.spotify\.com\/track\/([a-zA-Z0-9]*)/gi,
    `<iframe src="https://open.spotify.com/embed/track/$1" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media" />`,
  );
  // If enabled: Remove tfjson
  if (options.removeJson) {
    parsedBody = parsedBody.replace(/<div json='.*'>.*<\/div>/gi, '');
  }

  // Remove preview images in dtube posts with dtube embeds
  parsedBody = parsedBody.replace(dtubeImageRegex, '');
  // remove remaining SWM snippets
  parsedBody = parsedBody.replace(swmregex, '');
  // Render markdown to HTML
  try {
    parsedBody = parsedBody.length > 0 ? renderer.render(parsedBody) : '';
  } catch (err) {
    // TODO: Content renderer needs an update to not throw an exception when script tags are used
    console.warn('Could not render post content');
  }
  // Sanitize
  parsedBody = sanitizeHtml(
    parsedBody,
    sanitizeHtmlConfig({
      secureLinks: options.secureLinks !== false,
      allLinksBlank: options.allLinksBlank === true,
      removeImageDimensions: options.removeImageDimensions === true,
    }),
  );

  // Proxify image urls and add lazyload and conditional webp - only for html editor preview!
  if (options.parseImages) {
    let imgMatches = imgFullSize.exec(parsedBody);
    while (imgMatches != null) {
      imgMatches = imgFullSize.exec(parsedBody);
      if (imgMatches != null) {
        parsedBody = parsedBody.replace(
          imgMatches[0],
          `<figure><img class="loaded"
            ${
              imgMatches[2] && !options.hideimgcaptions
                ? `alt=${imgMatches[2]}`
                : ''
            } 
              src="${imageProxy(
                imgMatches[1],
                1800,
                undefined,
                'fit',
              )}"><figcaption>${
            imgMatches[2] === undefined ||
            // ignore alt texts with image name
            imgMatches[2].match(/(DSC_|\.gif|\.jpg|\.png)/i) ||
            options.hideimgcaptions
              ? ''
              : imgMatches[2]
          }</figcaption></figure>`,
        );
      }
    }
  }
  return parsedBody;
};

module.exports = { parseBody };
