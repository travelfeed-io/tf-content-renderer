const dtubeImageRegex = /<center><a href='https:\/\/d\.tube\/#!\/v\/(.*)\/(.*)'><img src='https:\/\/ipfs\.io\/ipfs\/.*'><\/a><\/center><hr>/i;
const htmlComment = /<!--([\s\S]+?)(-->|$)/g;
const imgFullSize = /<img src="([^"]*)"(?:| alt="([^"]*)") \/>/;
const instagramPost = /(?:http[s]?:\/\/)?(?:www.)?instagram\.com\/p\/(.*)\//gi;
const markdownComment = /\[\/\/\]:\S?\s\(.*\)/g;
const swmregex = /!\bsteemitworldmap\b\s((?:[-+]?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?)))\s\blat\b\s((?:[-+]?(?:180(?:\.0+)?|(?:(?:1[0-7]\d)|(?:[1-9]?\d))(?:\.\d+)?)))\s\blong\b/gi;
const tfAdBottom = /\n\n---\n\nView this post \[on TravelFeed]\(https:\/\/travelfeed\.io\/@.*\/.*\) for the best experience\./i;
const tfAdTop = /<a href="https:\/\/travelfeed\.io\/@.*\/.*"><center>(?:|<img src=".*" alt=".*"\/>)<h3>Read (?:this post|".*") on TravelFeed\.io for the best experience<\/h3><\/center><\/a><hr \/>\n\n/i;
const ownUrl = /^(localhost|travelfeed\.io)$/;

module.exports = {
  dtubeImageRegex,
  htmlComment,
  imgFullSize,
  instagramPost,
  markdownComment,
  swmregex,
  tfAdBottom,
  tfAdTop,
  ownUrl,
};
