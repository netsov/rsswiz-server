export const secure = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    if (req.invalidToken) {
      return res.redirect('/auth/logout');
    } else {
      return res.status(403).send();
    }
  }
};
