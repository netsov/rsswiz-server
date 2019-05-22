import {
  generateId,
  setJwtUser,
  sendConfirmationEmail,
  to,
  db,
} from '../../utils';

export const updateEmail = async (req, res) => {
  const { email } = req.body;
  if (req.user.email.value === email) return res.status(304).send();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).send();

  const confirmationId = generateId();
  const usersCol = db().collection('users');
  const { value: user } = await usersCol.findOneAndUpdate(
    { _id: req.user._id },
    {
      $set: {
        email: { confirmed: false, value: email, confirmationId },
        'schedule.times': [],
      },
    },
    { returnOriginal: false }
  );
  if (user) {
    await setJwtUser(res, user);
  }

  await to(sendConfirmationEmail(email, confirmationId));

  return res.status(200).send();
};

export const createConfirmation = async (req, res) => {
  const recipient = req.user.email && req.user.email.value;
  if (!recipient) return res.status(400).send();

  const confirmed = req.user.email && req.user.email.confirmed;
  if (confirmed) return res.status(200).send();

  const confirmationId = generateId();
  const { value: user, ok } = await db()
    .collection('users')
    .findOneAndUpdate(
      { _id: req.user._id },
      { $set: { 'email.confirmationId': confirmationId } }
    );
  if (ok && user) {
    await to(sendConfirmationEmail(recipient, confirmationId));
  }

  return res.status(200).send();
};

export const verifyConfirmationLink = async (
  { params: { confirmationId } },
  res
) => {
  const { value: user } = await db().collection('users').findOneAndUpdate(
    { 'email.confirmationId': confirmationId },
    {
      $unset: { 'email.confirmationId': '' },
      $set: { 'email.confirmed': true },
    },
    { returnOriginal: false }
  );

  if (!user) {
    return res.status(404).send();
  }

  return res.redirect('/settings');
};
