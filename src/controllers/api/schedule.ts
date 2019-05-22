import { db } from '../../utils';

export const schedule = ({ user: { schedule = {} } }, res) => {
  return res.status(200).json(schedule);
};

export const updateSchedule = async (req, res) => {
  const { value: { schedule } } = await db()
    .collection('users')
    .findOneAndUpdate(
      { _id: req.user._id },
      { $set: { schedule: req.body } },
      { returnOriginal: false }
    );

  return res.status(200).send(schedule);
};
