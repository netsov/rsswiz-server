import { generateId, db } from './index';

const Notification = ({ type, code, text }) => (user, ...rest) => ({
  code,
  generate: () => ({
    type,
    code,
    text: typeof text === 'function' ? text(...rest) : text,
    id: generateId(),
  }),
  push: async function() {
    let updated;
    if (
      !user.notifications ||
      !user.notifications.find(n => n.code === this.code)
    ) {
      updated = await db()
        .collection('users')
        .findOneAndUpdate(
          { _id: user._id },
          {
            $push: {
              notifications: this.generate(),
            },
          },
          { returnOriginal: false }
        );
    }
    return updated ? updated.value : user;
  },
});

export const TwitterLogoutWarning = Notification({
  type: 'warning',
  code: 'twitterlogoutwarning',
  text: username =>
    `@${username} has already been added. Did you forget to switch twitter account?`,
});

export const LinkedToAnotherAccountError = Notification({
  type: 'danger',
  code: 'linkedtoanotheraccount',
  text: username => `@${username} is linked to another account`,
});

export const TooManyRequestsError = Notification({
  type: 'danger',
  code: 'toomanyrequestserror',
  text: 'Too many requests. Try in 15 min',
});
