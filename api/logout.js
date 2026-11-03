const { clearCookie, SITE_URL } = require("./_lib");
module.exports = async (req, res) => { clearCookie(res); res.redirect(302, (SITE_URL || "") + "/dashboard.html"); };
