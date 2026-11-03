const { CLIENT_ID, redirectUri } = require("./_lib");
module.exports = async (req, res) => {
  res.redirect(302, `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri())}&response_type=code&scope=identify&prompt=none`);
};
