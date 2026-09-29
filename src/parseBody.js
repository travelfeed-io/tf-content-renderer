const sanitizeHtml = require('sanitize-html');
const { DefaultRenderer } = require('steem-content-renderer');
const { imageProxy } = require('tf-post-parser');
const {
  htmlComment,
  imgFullSize,
  instagramPost,
  swmregex,
} = require('./helpers/regex');
const { removeSnippet } = require('./helpers/removeSnippets');
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
  // The removals below do not use regexes: the greedy `.*` regexes they
  // replace backtracked for seconds on one long line (see
  // helpers/removeSnippets.js).
  // remove markdown comment
  parsedBody = removeSnippet.markdownComment(parsedBody);
  // Remove partiko ads
  parsedBody = removeSnippet.partikoAd(parsedBody);
  // Remove travelfeed ads
  parsedBody = removeSnippet.travelfeedDappAd(parsedBody);
  parsedBody = removeSnippet.travelfeedBottomAd(parsedBody);
  parsedBody = removeSnippet.travelfeedTopAd(parsedBody);
  // Remove dclick ads
  parsedBody = removeSnippet.dclickImageAd(parsedBody);
  parsedBody = removeSnippet.dclickSponsoredAd(parsedBody);
  // Remove tripsteem ads
  parsedBody = removeSnippet.tripsteemAd(parsedBody);
  parsedBody = parsedBody.replace(
    /This is posted on <a href='https:\/\/en\.tripsteem\.com\/'><b>trips\.teem/g,
    '',
  );
  parsedBody = parsedBody.replace(
    /<a href='https:\/\/en\.tripsteem\.com\/'>!\[image]\(https:\/\/cdn\.steemitimages\.com\/DQmUjAKXsageaSrVo4CgqvDGePsw7CbVFRfNv91fQrW9kuL\/banner_en\.jpg\)<\/a>/g,
    '',
  );
  // Remove SWM snippets with description
  parsedBody = removeSnippet.swmWithDescription(parsedBody);
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
    parsedBody = removeSnippet.json(parsedBody);
  }

  // Remove preview images in dtube posts with dtube embeds
  parsedBody = removeSnippet.dtubePreviewImage(parsedBody);
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
      // Off unless a caller explicitly opts in, so community rendering is
      // untouched.
      preserveLinkRel: options.preserveLinkRel === true,
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
