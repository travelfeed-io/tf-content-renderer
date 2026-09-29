const htmlComment = /<!--([\s\S]+?)(-->|$)/g;
const imgFullSize = /<img src="([^"]*)"(?:| alt="([^"]*)") \/>/;
const instagramPost = /(?:http[s]?:\/\/)?(?:www.)?instagram\.com\/p\/(.*)\//gi;
const swmregex = /!\bsteemitworldmap\b\s((?:[-+]?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?)))\s\blat\b\s((?:[-+]?(?:180(?:\.0+)?|(?:(?:1[0-7]\d)|(?:[1-9]?\d))(?:\.\d+)?)))\s\blong\b/gi;
const ownUrl = /^(localhost|travelfeed\.io)$/;

module.exports = {
  htmlComment,
  imgFullSize,
  instagramPost,
  swmregex,
  ownUrl,
};
