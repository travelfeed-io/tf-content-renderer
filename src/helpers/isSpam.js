const isSpam = body => {
  if (body.length < 3) return true;
  if (
    (body.length < 10 && body.match(/!DERANGED/)) ||
    body.match(/BEER/) ||
    body.match(/@tipu curate/ || body.match(/\$trdo/))
  ) {
    return true;
  }
  if (
    body.match(/steemit/i) ||
    body.match(/#posh/) ||
    body.match(/PhotoStream/) ||
    body.match(/Thanks for writing this comment through TravelFeed\.io!/)
  )
    return true;
  return false;
};

module.exports = {
  isSpam,
};
