import { setJwtUser, db } from '../../utils';

export const deleteNotification = async (
  { user: { _id }, params: { notificationId } },
  res
) => {
  const col = db().collection('users');
  const { value: user } = await col.findOneAndUpdate(
    { _id },
    { $pull: { notifications: { id: notificationId } } },
    { returnOriginal: false }
  );
  if (!user) return res.status(404).send();

  await setJwtUser(res, user);

  return res.status(202).send();
};
